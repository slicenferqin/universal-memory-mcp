/**
 * Enhanced Search Engine
 *
 * Integrates semantic search with traditional keyword search
 */

import type { SearchOptions, SearchResult, MemoryConfig, EmbeddingProvider } from '../types.js'
import type { VectorStore } from '../vectorstore/index.js'
import { LocalFileStorage } from '../storage.js'
import { semanticSearch, hybridSearch, type SemanticSearchOptions } from './semantic.js'

/**
 * Enhanced search engine with vector search support
 */
export class EnhancedSearchEngine {
  private storage: LocalFileStorage
  private config: MemoryConfig
  private vectorStore?: VectorStore
  private embeddingProvider?: EmbeddingProvider

  constructor(
    config: MemoryConfig,
    vectorStore?: VectorStore,
    embeddingProvider?: EmbeddingProvider
  ) {
    this.config = config
    this.storage = new LocalFileStorage()
    this.vectorStore = vectorStore
    this.embeddingProvider = embeddingProvider
  }

  /**
   * Search with automatic mode selection
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const {
      mode = 'hybrid', // 'keyword' | 'semantic' | 'hybrid'
      limit = this.config.defaultLimit,
      timeRange,
      project,
      client,
    } = options

    // Use vector search if available and requested
    if (this.vectorStore && this.embeddingProvider && mode !== 'keyword') {
      try {
        const semanticOptions: SemanticSearchOptions = {
          embeddingProvider: this.embeddingProvider,
          vectorStore: this.vectorStore,
          limit,
          project,
          client,
          timeRange,
          timeDecay: true,
          timeDecayHalfLife: 30,
          projectRelevance: true,
          currentProject: project,
        }

        if (mode === 'semantic') {
          return await semanticSearch(query, semanticOptions)
        } else if (mode === 'hybrid') {
          return await hybridSearch(query, {
            ...semanticOptions,
            semanticWeight: this.config.semanticWeight,
            keywordWeight: this.config.keywordWeight,
          })
        }
      } catch (error) {
        console.warn('Vector search failed, falling back to keyword search:', error)
        // Fall through to keyword search
      }
    }

    // Fallback to traditional keyword search
    return this.keywordSearch(query, { limit, timeRange, project, client })
  }

  /**
   * Traditional keyword search (fallback)
   */
  private async keywordSearch(
    query: string,
    options: {
      limit?: number
      timeRange?: [Date, Date]
      project?: string
      client?: string
    }
  ): Promise<SearchResult[]> {
    // Implementation from original SearchEngine
    // This is simplified - would need full implementation
    const { limit = 10 } = options

    // For now, return empty if vector search unavailable
    // In real implementation, would use the original file-based search
    return []
  }

  /**
   * Check if semantic search is available
   */
  isSemanticSearchAvailable(): boolean {
    return !!(this.vectorStore && this.embeddingProvider)
  }
}
