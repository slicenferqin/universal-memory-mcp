/**
 * Result Cache for search results
 *
 * Caches search results to avoid repeated searches
 */

export type SearchCacheKey = string

export interface CachedResult {
  results: Array<{
    content: string
    score: number
    timestamp: number
    project?: string
  }>
  cachedAt: number
  query: string
}

/**
 * Search result cache
 */
export class SearchCache {
  private cache: Map<SearchCacheKey, CachedResult>
  private maxEntries: number
  private ttl: number

  constructor(maxEntries: number = 100, ttl: number = 5 * 60 * 1000) {
    this.cache = new Map()
    this.maxEntries = maxEntries
    this.ttl = ttl // 5 minutes default
  }

  /**
   * Generate cache key
   */
  private generateKey(
    query: string,
    options: {
      mode?: string
      limit?: number
      project?: string
      client?: string
    }
  ): SearchCacheKey {
    const opts = JSON.stringify(options)
    return `${query}:${opts}`
  }

  /**
   * Get cached results
   */
  get(
    query: string,
    options: {
      mode?: string
      limit?: number
      project?: string
      client?: string
    }
  ): CachedResult | null {
    const key = this.generateKey(query, options)
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // Check if expired
    if (Date.now() - entry.cachedAt > this.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry
  }

  /**
   * Cache results
   */
  set(
    query: string,
    results: any[],
    options: {
      mode?: string
      limit?: number
      project?: string
      client?: string
    }
  ): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    const key = this.generateKey(query, options)
    this.cache.set(key, {
      results: results.map((r) => ({
        content: r.content,
        score: r.score,
        timestamp: r.timestamp?.getTime?.() || r.timestamp,
        project: r.project,
      })),
      cachedAt: Date.now(),
      query,
    })
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size
  }
}
