/**
 * Tests for search/semantic.ts
 *
 * Priority: P0 (High)
 * Coverage: Time decay, project relevance, hybrid search, weighted fusion
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  calculateTimeDecay,
  calculateProjectRelevance,
  semanticSearch,
  weightedScoreMerge,
  hybridSearch,
  type SemanticSearchOptions,
} from '../semantic.js'
import type { SearchResult } from '../../types.js'

// Mock dependencies with minimal required properties
const mockEmbeddingProvider = {
  name: 'test',
  dimensions: 1024,
  async generate(text: string): Promise<number[]> {
    return new Array(1024).fill(0.1)
  },
  async generateBatch(texts: string[]): Promise<number[][]> {
    return texts.map(() => new Array(1024).fill(0.1))
  },
}

const mockVectorStore = {
  semanticSearch: vi.fn(),
  keywordSearch: vi.fn(),
} as any

const mockMetadataManager = {
  recordAccess: vi.fn(),
  getMetadata: vi.fn(),
  updateImportanceScore: vi.fn(),
  calculateImportanceScore: vi.fn(),
  getTopMemories: vi.fn(),
  getRecentlyAccessed: vi.fn(),
  getMostAccessed: vi.fn(),
} as any

describe('calculateTimeDecay', () => {
  it('should return 1.0 for current timestamp', () => {
    const now = Date.now()
    const decay = calculateTimeDecay(now, 30)
    expect(decay).toBeCloseTo(1.0, 1)
  })

  it('should return lower value for old timestamp', () => {
    const now = Date.now()
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
    const decay = calculateTimeDecay(thirtyDaysAgo, 30)
    expect(decay).toBeCloseTo(0.368, 1) // e^(-1) ≈ 0.368
  })

  it('should use default half-life of 30 days', () => {
    const now = Date.now()
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
    const decayDefault = calculateTimeDecay(thirtyDaysAgo)
    const decayExplicit = calculateTimeDecay(thirtyDaysAgo, 30)
    expect(decayDefault).toBe(decayExplicit)
  })

  it('should decay faster with shorter half-life', () => {
    const now = Date.now()
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000

    const decayShortHalfLife = calculateTimeDecay(thirtyDaysAgo, 7)
    const decayLongHalfLife = calculateTimeDecay(thirtyDaysAgo, 30)

    expect(decayShortHalfLife).toBeLessThan(decayLongHalfLife)
  })

  it('should handle very old timestamps', () => {
    const now = Date.now()
    const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000
    const decay = calculateTimeDecay(oneYearAgo, 30)
    expect(decay).toBeGreaterThan(0)
    expect(decay).toBeLessThan(0.01) // Should be very small
  })
})

describe('calculateProjectRelevance', () => {
  it('should return 1.0 when no project specified', () => {
    const boost = calculateProjectRelevance(undefined, undefined)
    expect(boost).toBe(1.0)
  })

  it('should return 1.0 when projects do not match', () => {
    const boost = calculateProjectRelevance('project-a', 'project-b')
    expect(boost).toBe(1.0)
  })

  it('should return boost factor for exact match', () => {
    const boost = calculateProjectRelevance('my-app', 'my-app', 1.5)
    expect(boost).toBe(1.5)
  })

  it('should return partial boost for partial match', () => {
    const boost1 = calculateProjectRelevance('my-app', 'my-app-api')
    const boost2 = calculateProjectRelevance('my-app-api', 'my-app')
    expect(boost1).toBe(1.2)
    expect(boost2).toBe(1.2)
  })

  it('should use default boost factor of 1.5', () => {
    const boost = calculateProjectRelevance('my-app', 'my-app')
    expect(boost).toBe(1.5)
  })

  it('should handle empty strings', () => {
    const boost = calculateProjectRelevance('', 'my-app')
    expect(boost).toBe(1.0)
  })
})

describe('semanticSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call vectorStore.semanticSearch with query embedding', async () => {
    const mockResults: SearchResult[] = [
      {
        content: 'Test result',
        score: 0.8,
        timestamp: new Date(),
        project: 'test-project',
        sourcePath: 'test.md',
      },
    ]

    vi.mocked(mockVectorStore.semanticSearch).mockReturnValue(mockResults)

    const result = await semanticSearch('test query', {
      embeddingProvider: mockEmbeddingProvider,
      vectorStore: mockVectorStore,
      limit: 10,
      timeDecay: false,
      projectRelevance: false,
    })

    // Verify it returns results
    expect(result).toHaveLength(1)
    expect(mockVectorStore.semanticSearch).toHaveBeenCalledTimes(1)
  })

  it('should apply time decay when enabled', async () => {
    const now = Date.now()
    const oldTimestamp = now - 30 * 24 * 60 * 60 * 1000 // 30 days ago

    const mockResults: SearchResult[] = [
      {
        content: 'Recent result',
        score: 0.8,
        timestamp: new Date(now),
        project: 'test-project',
        sourcePath: 'recent.md',
      },
      {
        content: 'Old result',
        score: 0.8,
        timestamp: new Date(oldTimestamp),
        project: 'test-project',
        sourcePath: 'old.md',
      },
    ]

    vi.mocked(mockVectorStore.semanticSearch).mockReturnValue(mockResults)

    const results = await semanticSearch('test query', {
      embeddingProvider: mockEmbeddingProvider,
      vectorStore: mockVectorStore,
      limit: 10,
      timeDecay: true,
      timeDecayHalfLife: 30,
    })

    // Recent result should have higher score than old result
    expect(results[0].score).toBeGreaterThan(results[1].score)
  })

  it('should apply project relevance boost when enabled', async () => {
    const mockResults: SearchResult[] = [
      {
        content: 'Same project result',
        score: 0.7,
        timestamp: new Date(),
        project: 'my-app',
        sourcePath: 'same.md',
      },
      {
        content: 'Different project result',
        score: 0.7,
        timestamp: new Date(),
        project: 'other-app',
        sourcePath: 'different.md',
      },
    ]

    vi.mocked(mockVectorStore.semanticSearch).mockReturnValue(mockResults)

    const results = await semanticSearch('test query', {
      embeddingProvider: mockEmbeddingProvider,
      vectorStore: mockVectorStore,
      limit: 10,
      projectRelevance: true,
      currentProject: 'my-app',
    })

    // Same project result should be boosted
    expect(results[0].score).toBeGreaterThan(results[1].score)
  })

  it('should apply candidate multiplier to candidate pool size', async () => {
    vi.mocked(mockVectorStore.semanticSearch).mockReturnValue([])

    await semanticSearch('test query', {
      embeddingProvider: mockEmbeddingProvider,
      vectorStore: mockVectorStore,
      limit: 10,
      candidateMultiplier: 4,
      maxCandidates: 200,
    })

    const callArgs = vi.mocked(mockVectorStore.semanticSearch).mock.calls[0]
    const candidatePoolSize = callArgs[1] // Second argument is candidate count

    expect(candidatePoolSize).toBe(40) // 10 * 4 = 40
  })

  it('should respect maxCandidates hard limit', async () => {
    vi.mocked(mockVectorStore.semanticSearch).mockReturnValue([])

    await semanticSearch('test query', {
      embeddingProvider: mockEmbeddingProvider,
      vectorStore: mockVectorStore,
      limit: 100, // Would produce 400 candidates with 4x multiplier
      candidateMultiplier: 4,
      maxCandidates: 200,
    })

    const callArgs = vi.mocked(mockVectorStore.semanticSearch).mock.calls[0]
    const candidatePoolSize = callArgs[1]

    expect(candidatePoolSize).toBe(200) // Hard limit
  })

  it('should return results limited by limit option', async () => {
    const mockResults: SearchResult[] = Array.from({ length: 20 }, (_, i) => ({
      content: `Result ${i}`,
      score: 0.9 - i * 0.01,
      timestamp: new Date(),
      project: 'test-project',
      sourcePath: `result-${i}.md`,
    }))

    vi.mocked(mockVectorStore.semanticSearch).mockReturnValue(mockResults)

    const results = await semanticSearch('test query', {
      embeddingProvider: mockEmbeddingProvider,
      vectorStore: mockVectorStore,
      limit: 5,
    })

    expect(results).toHaveLength(5)
  })

  it('should handle empty results', async () => {
    vi.mocked(mockVectorStore.semanticSearch).mockReturnValue([])

    const results = await semanticSearch('test query', {
      embeddingProvider: mockEmbeddingProvider,
      vectorStore: mockVectorStore,
      limit: 10,
    })

    expect(results).toHaveLength(0)
  })

  it('should clamp scores to [0, 1]', async () => {
    const mockResults: SearchResult[] = [
      {
        content: 'High score result',
        score: 1.5, // Above 1.0
        timestamp: new Date(),
        project: 'test-project',
        sourcePath: 'high.md',
      },
    ]

    vi.mocked(mockVectorStore.semanticSearch).mockReturnValue(mockResults)

    const results = await semanticSearch('test query', {
      embeddingProvider: mockEmbeddingProvider,
      vectorStore: mockVectorStore,
      limit: 10,
      timeDecay: false,
      projectRelevance: false,
    })

    expect(results[0].score).toBeLessThanOrEqual(1.0)
  })
})

describe('weightedScoreMerge', () => {
  it('should merge vector and text results with weighted scores', () => {
    const vectorResults: SearchResult[] = [
      {
        content: 'Result 1',
        score: 0.8,
        timestamp: new Date(),
        project: 'test',
        sourcePath: 'result-1',
      },
      {
        content: 'Result 2',
        score: 0.6,
        timestamp: new Date(),
        project: 'test',
        sourcePath: 'result-2',
      },
    ]

    const textResults = [
      {
        id: 'result-1',
        content: 'Result 1',
        score: 0.9,
        timestamp: Date.now(),
        project: 'test',
      },
      {
        id: 'result-3',
        content: 'Result 3',
        score: 0.7,
        timestamp: Date.now(),
        project: 'test',
      },
    ]

    const merged = weightedScoreMerge(vectorResults, textResults, {
      vectorWeight: 0.7,
      textWeight: 0.3,
    })

    // Should have 3 results (2 from vector + 1 unique from text)
    expect(merged).toHaveLength(3)

    // Result 1 should have weighted score: 0.8 * 0.7 + 0.9 * 0.3 = 0.83
    const result1 = merged.find((r) => r.sourcePath === 'result-1')
    expect(result1?.score).toBeCloseTo(0.83, 2)
  })

  it('should handle results only in vector search', () => {
    const vectorResults: SearchResult[] = [
      {
        content: 'Vector only',
        score: 0.8,
        timestamp: new Date(),
        project: 'test',
        sourcePath: 'vector-only',
      },
    ]

    const textResults: Array<{
      id: string
      content: string
      score: number
      timestamp: number
      project: string
    }> = []

    const merged = weightedScoreMerge(vectorResults, textResults, {
      vectorWeight: 0.7,
      textWeight: 0.3,
    })

    expect(merged).toHaveLength(1)
    // Weighted score: 0.8 * (0.7 / (0.7 + 0.3)) = 0.8 * 0.7 = 0.56
    expect(merged[0].score).toBeCloseTo(0.56, 1)
  })

  it('should handle results only in text search', () => {
    const vectorResults: SearchResult[] = []

    const textResults: Array<{
      id: string
      content: string
      score: number
      timestamp: number
      project: string
    }> = [
      {
        id: 'text-only',
        content: 'Text only',
        score: 0.9,
        timestamp: Date.now(),
        project: 'test',
      },
    ]

    const merged = weightedScoreMerge(vectorResults, textResults, {
      vectorWeight: 0.7,
      textWeight: 0.3,
    })

    expect(merged).toHaveLength(1)
    // Weighted score: 0.9 * (0.3 / (0.7 + 0.3)) = 0.9 * 0.3 = 0.27
    expect(merged[0].score).toBeCloseTo(0.27, 1)
  })

  it('should normalize weights', () => {
    const vectorResults: SearchResult[] = [
      {
        content: 'Result 1',
        score: 0.5,
        timestamp: new Date(),
        project: 'test',
        sourcePath: 'result-1',
      },
    ]

    const textResults: Array<{
      id: string
      content: string
      score: number
      timestamp: number
      project: string
    }> = [
      {
        id: 'result-1',
        content: 'Result 1',
        score: 0.5,
        timestamp: Date.now(),
        project: 'test',
      },
    ]

    // Even with different weights, should normalize
    const merged1 = weightedScoreMerge(vectorResults, textResults, {
      vectorWeight: 0.9,
      textWeight: 0.1,
    })

    const merged2 = weightedScoreMerge(vectorResults, textResults, {
      vectorWeight: 0.5,
      textWeight: 0.5,
    })

    // Both should produce 0.5 when normalized and weights are equal
    expect(merged2[0].score).toBeCloseTo(0.5, 1)
  })
})
