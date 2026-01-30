/**
 * Cached Embedding Provider
 *
 * Wraps any embedding provider with caching
 */

import type { EmbeddingProvider } from '../types.js'
import { EmbeddingCache } from '../cache/index.js'

export class CachedEmbeddingProvider implements EmbeddingProvider {
  readonly name: string
  readonly dimensions: number
  private provider: EmbeddingProvider
  private cache: EmbeddingCache

  constructor(provider: EmbeddingProvider, cacheSize: number = 1000) {
    this.provider = provider
    this.name = `${provider.name}-cached`
    this.dimensions = provider.dimensions
    this.cache = new EmbeddingCache(cacheSize)
  }

  async generate(text: string): Promise<number[]> {
    // Check cache
    const cached = this.cache.get(text)
    if (cached) {
      return cached
    }

    // Generate embedding
    const embedding = await this.provider.generate(text)

    // Cache result
    this.cache.set(text, embedding)

    return embedding
  }

  async generateBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = []
    const toGenerate: { text: string; index: number }[] = []

    // Check cache for each text
    for (let i = 0; i < texts.length; i++) {
      const cached = this.cache.get(texts[i])
      if (cached) {
        results[i] = cached
      } else {
        toGenerate.push({ text: texts[i], index: i })
      }
    }

    // Generate embeddings for uncached texts
    if (toGenerate.length > 0) {
      const generated = await this.provider.generateBatch(toGenerate.map((t) => t.text))

      // Cache and place results
      for (let i = 0; i < toGenerate.length; i++) {
        const embedding = generated[i]
        const { text, index } = toGenerate[i]

        this.cache.set(text, embedding)
        results[index] = embedding
      }
    }

    return results
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats()
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear()
  }
}
