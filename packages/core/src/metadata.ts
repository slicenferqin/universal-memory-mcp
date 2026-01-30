/**
 * Metadata Manager
 *
 * Tracks access statistics and importance scores for memories
 */

import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import Database from 'better-sqlite3'

export interface MemoryMetadata {
  id: string
  accessCount: number
  lastAccessedAt: number
  importanceScore: number
  createdAt: number
  updatedAt: number
}

export interface MetadataUpdate {
  id: string
  accessCount?: number
  lastAccessedAt?: number
  importanceScore?: number
}

/**
 * Metadata Manager
 *
 * Manages metadata for memories including access statistics and importance scores
 */
export class MetadataManager {
  private db: Database.Database
  private metadataCache: Map<string, MemoryMetadata> = new Map()

  constructor(storagePath: string) {
    const dbPath = join(storagePath, 'metadata.db')
    this.db = new Database(dbPath)
    this.initializeSchema()
  }

  /**
   * Initialize database schema
   */
  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_metadata (
        id TEXT PRIMARY KEY,
        access_count INTEGER NOT NULL DEFAULT 0,
        last_accessed_at INTEGER NOT NULL DEFAULT 0,
        importance_score REAL NOT NULL DEFAULT 0.5,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_importance_score ON memory_metadata(importance_score DESC);
      CREATE INDEX IF NOT EXISTS idx_last_accessed ON memory_metadata(last_accessed_at DESC);
    `)
  }

  /**
   * Get metadata for a memory
   */
  getMetadata(id: string): MemoryMetadata | null {
    // Check cache first
    if (this.metadataCache.has(id)) {
      return this.metadataCache.get(id)!
    }

    const stmt = this.db.prepare('SELECT * FROM memory_metadata WHERE id = ?')
    const row = stmt.get(id) as any

    if (!row) {
      return null
    }

    const metadata: MemoryMetadata = {
      id: row.id,
      accessCount: row.access_count,
      lastAccessedAt: row.last_accessed_at,
      importanceScore: row.importance_score,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }

    // Cache the metadata
    this.metadataCache.set(id, metadata)

    return metadata
  }

  /**
   * Create or update metadata for a memory
   */
  setMetadata(metadata: MemoryMetadata): void {
    const stmt = this.db.prepare(`
      INSERT INTO memory_metadata (id, access_count, last_accessed_at, importance_score, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        access_count = excluded.access_count,
        last_accessed_at = excluded.last_accessed_at,
        importance_score = excluded.importance_score,
        updated_at = excluded.updated_at
    `)

    const now = Date.now()
    stmt.run(
      metadata.id,
      metadata.accessCount,
      metadata.lastAccessedAt,
      metadata.importanceScore,
      metadata.createdAt || now,
      now
    )

    // Update cache
    this.metadataCache.set(metadata.id, { ...metadata, updatedAt: now })
  }

  /**
   * Update specific fields of metadata
   */
  updateMetadata(update: MetadataUpdate): void {
    const existing = this.getMetadata(update.id)
    if (!existing) {
      // Create new metadata with defaults
      const now = Date.now()
      this.setMetadata({
        id: update.id,
        accessCount: update.accessCount || 0,
        lastAccessedAt: update.lastAccessedAt || now,
        importanceScore: update.importanceScore || 0.5,
        createdAt: now,
        updatedAt: now,
      })
      return
    }

    // Update fields
    const updated: MemoryMetadata = {
      ...existing,
      updatedAt: Date.now(),
    }

    if (update.accessCount !== undefined) {
      updated.accessCount = update.accessCount
    }
    if (update.lastAccessedAt !== undefined) {
      updated.lastAccessedAt = update.lastAccessedAt
    }
    if (update.importanceScore !== undefined) {
      updated.importanceScore = update.importanceScore
    }

    this.setMetadata(updated)
  }

  /**
   * Record access to a memory
   * Increments access count and updates last accessed time
   */
  recordAccess(id: string): void {
    const metadata = this.getMetadata(id)
    if (metadata) {
      this.updateMetadata({
        id,
        accessCount: metadata.accessCount + 1,
        lastAccessedAt: Date.now(),
      })
    } else {
      // Create new metadata
      this.setMetadata({
        id,
        accessCount: 1,
        lastAccessedAt: Date.now(),
        importanceScore: 0.5, // Default importance
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    }
  }

  /**
   * Calculate importance score for a memory
   * Based on:
   * - Access frequency
   * - Recency of access
   * - Content quality (optional, passed in)
   */
  calculateImportanceScore(
    id: string,
    options?: {
      contentLength?: number
      hasStructure?: boolean
      userFeedback?: number // 0-1, higher is better
    }
  ): number {
    const metadata = this.getMetadata(id)
    if (!metadata) {
      return 0.5 // Default score
    }

    const now = Date.now()
    const daysSinceLastAccess = (now - metadata.lastAccessedAt) / (1000 * 60 * 60 * 24)
    const daysSinceCreation = (now - metadata.createdAt) / (1000 * 60 * 60 * 24)

    // Access frequency score (0-1)
    // Higher access count = higher score, but normalized by age
    const accessFrequency = metadata.accessCount / Math.max(1, daysSinceCreation)
    const accessScore = Math.min(accessFrequency / 10, 1.0) // Cap at 1.0

    // Recency score (0-1)
    // More recent access = higher score
    // Decay: score = e^(-days/30), so 30 days ago = 0.37, 7 days ago = 0.79
    const recencyScore = Math.exp(-daysSinceLastAccess / 30)

    // Content quality score (0-1) if provided
    let contentScore = 0.5 // Default
    if (options?.contentLength) {
      // Prefer medium-length content (100-1000 chars)
      const length = options.contentLength
      if (length >= 100 && length <= 1000) {
        contentScore = 0.8
      } else if (length > 1000) {
        contentScore = 0.6 // Too long might be less relevant
      } else {
        contentScore = 0.4 // Too short might lack context
      }
    }
    if (options?.hasStructure) {
      contentScore += 0.1 // Structured content is better
    }

    // User feedback score (0-1) if provided
    const feedbackScore = options?.userFeedback ?? 0.5

    // Combined score: weighted average
    // Access frequency: 30%, Recency: 30%, Content: 20%, Feedback: 20%
    const importanceScore =
      accessScore * 0.3 + recencyScore * 0.3 + contentScore * 0.2 + feedbackScore * 0.2

    return Math.max(0, Math.min(1, importanceScore)) // Clamp to [0, 1]
  }

  /**
   * Update importance score for a memory
   */
  updateImportanceScore(
    id: string,
    options?: {
      contentLength?: number
      hasStructure?: boolean
      userFeedback?: number
    }
  ): void {
    const score = this.calculateImportanceScore(id, options)
    this.updateMetadata({
      id,
      importanceScore: score,
    })
  }

  /**
   * Get top memories by importance score
   */
  getTopMemories(limit: number = 10): MemoryMetadata[] {
    const stmt = this.db.prepare(`
      SELECT * FROM memory_metadata
      ORDER BY importance_score DESC
      LIMIT ?
    `)

    const rows = stmt.all(limit) as any[]
    return rows.map((row) => ({
      id: row.id,
      accessCount: row.access_count,
      lastAccessedAt: row.last_accessed_at,
      importanceScore: row.importance_score,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  }

  /**
   * Get recently accessed memories
   */
  getRecentlyAccessed(limit: number = 10): MemoryMetadata[] {
    const stmt = this.db.prepare(`
      SELECT * FROM memory_metadata
      ORDER BY last_accessed_at DESC
      LIMIT ?
    `)

    const rows = stmt.all(limit) as any[]
    return rows.map((row) => ({
      id: row.id,
      accessCount: row.access_count,
      lastAccessedAt: row.last_accessed_at,
      importanceScore: row.importance_score,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  }

  /**
   * Get most frequently accessed memories
   */
  getMostAccessed(limit: number = 10): MemoryMetadata[] {
    const stmt = this.db.prepare(`
      SELECT * FROM memory_metadata
      ORDER BY access_count DESC
      LIMIT ?
    `)

    const rows = stmt.all(limit) as any[]
    return rows.map((row) => ({
      id: row.id,
      accessCount: row.access_count,
      lastAccessedAt: row.last_accessed_at,
      importanceScore: row.importance_score,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  }

  /**
   * Clear the metadata cache
   */
  clearCache(): void {
    this.metadataCache.clear()
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.metadataCache.clear()
    this.db.close()
  }
}
