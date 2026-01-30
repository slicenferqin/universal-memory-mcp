/**
 * Semantic Search Engine
 *
 * Integrates VectorStore with time decay and relevance weighting
 */

import type { EmbeddingProvider } from '../types.js'
import type { VectorStore } from '../vectorstore/index.js'
import type { SearchOptions, SearchResult } from '../types.js'

export interface SemanticSearchOptions extends SearchOptions {
  embeddingProvider: EmbeddingProvider
  vectorStore: VectorStore
  // Time decay options
  timeDecay?: boolean
  timeDecayHalfLife?: number // days
  // Relevance weighting
  projectRelevance?: boolean
  currentProject?: string
}

/**
 * Calculate time decay factor
 *
 * Uses exponential decay: score * e^(-days_ago / half_life)
 */
export function calculateTimeDecay(timestamp: number, halfLifeDays: number = 30): number {
  const daysAgo = (Date.now() - timestamp) / (1000 * 60 * 60 * 24)
  return Math.exp(-daysAgo / halfLifeDays)
}

/**
 * Calculate project relevance boost
 *
 * Boosts score if result matches current project
 */
export function calculateProjectRelevance(
  resultProject: string | undefined,
  currentProject: string | undefined,
  boostFactor: number = 1.5
): number {
  if (!resultProject || !currentProject) {
    return 1.0
  }

  // Exact match
  if (resultProject === currentProject) {
    return boostFactor
  }

  // Partial match (e.g., "my-app" and "my-app-api")
  if (resultProject.includes(currentProject) || currentProject.includes(resultProject)) {
    return 1.2
  }

  return 1.0
}

/**
 * Enhanced semantic search with weighting
 */
export async function semanticSearch(
  query: string,
  options: SemanticSearchOptions
): Promise<SearchResult[]> {
  const {
    embeddingProvider,
    vectorStore,
    limit = 10,
    project,
    client,
    timeRange,
    timeDecay = true,
    timeDecayHalfLife = 30,
    projectRelevance = true,
    currentProject,
  } = options

  // Generate query embedding
  const queryEmbedding = await embeddingProvider.generate(query)

  // Build filters
  const filters: any = {}
  if (project) filters.project = project
  if (client) filters.client = client
  if (timeRange) {
    if (timeRange[0]) filters.minTimestamp = timeRange[0].getTime()
    if (timeRange[1]) filters.maxTimestamp = timeRange[1].getTime()
  }

  // Perform semantic search
  const vectorResults = vectorStore.semanticSearch(
    queryEmbedding,
    limit * 2, // Get more results for re-ranking
    filters
  )

  // Apply time decay and project relevance
  const enhancedResults: SearchResult[] = vectorResults.map((result) => {
    let adjustedScore = result.score

    // Apply time decay
    if (timeDecay) {
      const decayFactor = calculateTimeDecay(result.timestamp, timeDecayHalfLife)
      adjustedScore *= decayFactor
    }

    // Apply project relevance
    if (projectRelevance && currentProject) {
      const relevanceFactor = calculateProjectRelevance(result.project, currentProject)
      adjustedScore *= relevanceFactor
    }

    return {
      content: result.content,
      score: Math.min(adjustedScore, 1.0), // Clamp to [0, 1]
      timestamp: new Date(result.timestamp),
      project: result.project,
      sourcePath: result.id, // Use ID as source
    }
  })

  // Sort by adjusted score and limit
  return enhancedResults.sort((a, b) => b.score - a.score).slice(0, limit)
}

/**
 * Hybrid search combining semantic and keyword results
 *
 * Uses Reciprocal Rank Fusion (RRF) algorithm
 */
export async function hybridSearch(
  query: string,
  options: SemanticSearchOptions & {
    semanticWeight?: number
    keywordWeight?: number
  }
): Promise<SearchResult[]> {
  const {
    semanticWeight = 0.7,
    keywordWeight = 0.3,
    vectorStore,
    embeddingProvider,
    limit = 10,
    ...searchOptions
  } = options

  // Normalize weights
  const totalWeight = semanticWeight + keywordWeight
  const normSemanticWeight = semanticWeight / totalWeight
  const normKeywordWeight = keywordWeight / totalWeight

  // Perform semantic search
  const semanticResults = await semanticSearch(query, {
    ...searchOptions,
    embeddingProvider,
    vectorStore,
    limit: limit * 2,
  })

  // Perform keyword search
  const keywordResults = vectorStore.keywordSearch(query, limit * 2)

  // RRF fusion
  const k = 60 // RRF constant
  const fusedScores = new Map<
    string,
    {
      result: SearchResult
      score: number
    }
  >()

  // Add semantic results
  semanticResults.forEach((result, rank) => {
    const score = (normSemanticWeight * k) / (k + rank + 1)
    const existing = fusedScores.get(result.sourcePath)

    if (existing) {
      existing.score += score
    } else {
      fusedScores.set(result.sourcePath, {
        result,
        score,
      })
    }
  })

  // Add keyword results
  keywordResults.forEach((result, rank) => {
    const score = (normKeywordWeight * k) / (k + rank + 1)
    const sourcePath = result.id // VectorSearchResult uses 'id'

    const existing = fusedScores.get(sourcePath)

    if (existing) {
      existing.score += score
    } else {
      // Convert VectorSearchResult to SearchResult
      fusedScores.set(sourcePath, {
        result: {
          content: result.content,
          score: result.score, // Will be overridden by fused score
          timestamp: new Date(result.timestamp),
          project: result.project,
          sourcePath: result.id,
        },
        score,
      })
    }
  })

  // Sort by fused score and return
  return Array.from(fusedScores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => ({
      ...item.result,
      score: Math.min(item.score, 1.0), // Normalize to [0, 1]
    }))
}
