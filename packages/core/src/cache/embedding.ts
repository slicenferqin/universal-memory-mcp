/**
 * Embedding Cache
 *
 * Caches generated embeddings to avoid redundant API calls
 */

import { createHash } from 'node:crypto'

export interface CacheEntry {
  embedding: number[]
  timestamp: number
  hits: number
}

export interface CacheStats {
  size: number
  hits: number
  misses: number
  hitRate: number
}

/**
 * In-memory embedding cache with LRU eviction
 */
export class EmbeddingCache {
  private cache: Map<string, CacheEntry>
  private maxEntries: number
  private ttl: number // Time to live in milliseconds
  private stats: { hits: number; misses: number }

  constructor(maxEntries: number = 1000, ttl: number = 24 * 60 * 60 * 1000) {
    this.cache = new Map()
    this.maxEntries = maxEntries
    this.ttl = ttl
    this.stats = { hits: 0, misses: 0 }
  }

  /**
   * Generate cache key from text
   */
  private generateKey(text: string): string {
    return createHash('sha256').update(text).digest('hex')
  }

  /**
   * Get embedding from cache
   */
  get(text: string): number[] | null {
    const key = this.generateKey(text)
    const entry = this.cache.get(key)

    if (!entry) {
      this.stats.misses++
      return null
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      this.stats.misses++
      return null
    }

    // Update hit count and move to end (LRU)
    entry.hits++
    this.cache.delete(key)
    this.cache.set(key, entry)
    this.stats.hits++

    return entry.embedding
  }

  /**
   * Set embedding in cache
   */
  set(text: string, embedding: number[]): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    const key = this.generateKey(text)
    this.cache.set(key, {
      embedding,
      timestamp: Date.now(),
      hits: 0,
    })
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear()
    this.stats = { hits: 0, misses: 0 }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses
    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    }
  }

  /**
   * Clean expired entries
   */
  cleanExpired(): number {
    const now = Date.now()
    let cleaned = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key)
        cleaned++
      }
    }

    return cleaned
  }
}
