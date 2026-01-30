/**
 * Vector Store for semantic search using sqlite-vec
 *
 * Implements vector indexing and similarity search with SQLite
 */

import Database from 'better-sqlite3'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import type { EmbeddingProvider } from '../types.js'

export interface VectorStoreConfig {
  storagePath: string
  dimensions: number
}

export interface VectorDocument {
  id: string
  conversationId: string
  chunkIndex: number
  content: string
  embedding: number[]
  timestamp: number
  project?: string
  client?: string
  sessionId: string
  sourceFile: string
}

export interface SearchResult {
  id: string
  content: string
  score: number
  timestamp: number
  project?: string
  client?: string
  distance?: number
}

/**
 * Vector Store using sqlite-vec for similarity search
 */
export class VectorStore {
  private db: Database.Database
  private dimensions: number

  constructor(config: VectorStoreConfig) {
    this.dimensions = config.dimensions
    const dbPath = join(config.storagePath, 'vector.db')

    this.db = new Database(dbPath)
    this.initializeSchema()
  }

  /**
   * Initialize database schema
   */
  private initializeSchema(): void {
    // Main vectors table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_vectors (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding BLOB NOT NULL,
        timestamp INTEGER NOT NULL,
        project TEXT,
        client TEXT,
        session_id TEXT NOT NULL,
        source_file TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `)

    // Full-text search index
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
        content,
        content_rowid=ROWID,
        tokenize='porter'
      );
    `)

    // Vector index using sqlite-vec
    try {
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS vec_index USING vec0(
          embedding FLOAT[${this.dimensions}]
        );
      `)
    } catch (error) {
      if (error instanceof Error && !error.message.includes('already exists')) {
        console.warn('Warning: Could not create vec_index:', error.message)
      }
    }
  }

  /**
   * Insert a document with its embedding
   */
  insert(doc: VectorDocument): void {
    const stmt = this.db.prepare(`
      INSERT INTO memory_vectors (
        id, conversation_id, chunk_index, content, embedding,
        timestamp, project, client, session_id, source_file, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const embeddingBlob = this.float32ArrayToBlob(doc.embedding)
    const createdAt = Date.now()

    stmt.run(
      doc.id,
      doc.conversationId,
      doc.chunkIndex,
      doc.content,
      embeddingBlob,
      doc.timestamp,
      doc.project || null,
      doc.client || null,
      doc.sessionId,
      doc.sourceFile,
      createdAt
    )

    // Also insert into FTS for keyword search
    const ftsStmt = this.db.prepare(`
      INSERT INTO memory_fts (content) VALUES (?)
    `)
    ftsStmt.run(doc.content)
  }

  /**
   * Batch insert documents
   */
  insertBatch(docs: VectorDocument[]): void {
    const insert = this.db.transaction((documents: VectorDocument[]) => {
      for (const doc of documents) {
        this.insert(doc)
      }
    })

    insert(docs)
  }

  /**
   * Semantic search using cosine similarity
   */
  semanticSearch(
    queryEmbedding: number[],
    limit: number = 10,
    filters?: {
      project?: string
      client?: string
      minTimestamp?: number
      maxTimestamp?: number
    }
  ): SearchResult[] {
    // Build WHERE clause for filters
    const conditions: string[] = []
    const params: any[] = []

    if (filters?.project) {
      conditions.push('project = ?')
      params.push(filters.project)
    }
    if (filters?.client) {
      conditions.push('client = ?')
      params.push(filters.client)
    }
    if (filters?.minTimestamp) {
      conditions.push('timestamp >= ?')
      params.push(filters.minTimestamp)
    }
    if (filters?.maxTimestamp) {
      conditions.push('timestamp <= ?')
      params.push(filters.maxTimestamp)
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

    // Manual cosine similarity calculation
    const results: SearchResult[] = []

    const stmt = this.db.prepare(`
      SELECT id, content, embedding, timestamp, project, client
      FROM memory_vectors
      ${whereClause}
    `)

    const rows = stmt.all(...params) as any[]

    for (const row of rows) {
      const docEmbedding = this.blobToFloat32Array(row.embedding)
      const similarity = this.cosineSimilarity(queryEmbedding, docEmbedding)

      results.push({
        id: row.id,
        content: row.content,
        score: similarity,
        timestamp: row.timestamp,
        project: row.project,
        client: row.client,
        distance: 1 - similarity, // Convert to distance
      })
    }

    // Sort by score (descending) and limit
    return results.sort((a, b) => b.score - a.score).slice(0, limit)
  }

  /**
   * Keyword search using FTS5
   */
  keywordSearch(query: string, limit: number = 10): SearchResult[] {
    const stmt = this.db.prepare(`
      SELECT 
        mv.id, mv.content, mv.timestamp, mv.project, mv.client,
        bm25(memory_fts) as score
      FROM memory_fts
      JOIN memory_vectors mv ON memory_fts.content = mv.content
      WHERE memory_fts MATCH ?
      ORDER BY score
      LIMIT ?
    `)

    const rows = stmt.all(query, limit) as any[]

    return rows.map((row) => ({
      id: row.id,
      content: row.content,
      score: 1 / (1 + Math.abs(row.score)), // Convert BM25 to similarity-like score
      timestamp: row.timestamp,
      project: row.project,
      client: row.client,
    }))
  }

  /**
   * Get document by ID
   */
  getById(id: string): VectorDocument | null {
    const stmt = this.db.prepare(`
      SELECT * FROM memory_vectors WHERE id = ?
    `)

    const row = stmt.get(id) as any
    if (!row) return null

    return {
      id: row.id,
      conversationId: row.conversation_id,
      chunkIndex: row.chunk_index,
      content: row.content,
      embedding: this.blobToFloat32Array(row.embedding),
      timestamp: row.timestamp,
      project: row.project,
      client: row.client,
      sessionId: row.session_id,
      sourceFile: row.source_file,
    }
  }

  /**
   * Delete document by ID
   */
  delete(id: string): void {
    const stmt = this.db.prepare('DELETE FROM memory_vectors WHERE id = ?')
    stmt.run(id)
  }

  /**
   * Delete all documents for a conversation
   */
  deleteByConversation(conversationId: string): void {
    const stmt = this.db.prepare('DELETE FROM memory_vectors WHERE conversation_id = ?')
    stmt.run(conversationId)
  }

  /**
   * Get statistics
   */
  getStats(): { totalDocuments: number; totalChunks: number } {
    const totalDocs = this.db
      .prepare(
        `
      SELECT COUNT(DISTINCT conversation_id) as count FROM memory_vectors
    `
      )
      .get() as any

    const totalChunks = this.db
      .prepare(
        `
      SELECT COUNT(*) as count FROM memory_vectors
    `
      )
      .get() as any

    return {
      totalDocuments: totalDocs.count,
      totalChunks: totalChunks.count,
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close()
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions must match')
    }

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB)
    if (denominator === 0) {
      return 0
    }

    return dotProduct / denominator
  }

  /**
   * Convert Float32Array to SQLite BLOB
   */
  private float32ArrayToBlob(arr: number[]): Buffer {
    const float32 = new Float32Array(arr)
    return Buffer.from(float32.buffer)
  }

  /**
   * Convert SQLite BLOB to Float32Array
   */
  private blobToFloat32Array(blob: Buffer): number[] {
    const float32 = new Float32Array(blob.buffer, blob.byteOffset, blob.byteLength / 4)
    return Array.from(float32)
  }
}
