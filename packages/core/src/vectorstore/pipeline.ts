/**
 * Indexing Pipeline for Vector Store
 *
 * Automatically indexes conversations into the vector store
 */

import { join } from 'node:path'
import { readdir, readFile } from 'node:fs/promises'
import type { EmbeddingProvider } from '../types.js'
import { VectorStore, type VectorDocument } from './store.js'
import { chunkConversation, type Chunk } from '../embedding/chunker.js'

export interface IndexingOptions {
  batchSize?: number
  skipIndexed?: boolean
  verbose?: boolean
}

export interface IndexingStats {
  totalFiles: number
  totalConversations: number
  totalChunks: number
  indexedChunks: number
  skippedChunks: number
  errors: string[]
}

export interface IndexingJob {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  startedAt: number
  completedAt?: number
  error?: string
  stats?: IndexingStats
}

/**
 * Indexing pipeline for conversations
 */
export class IndexingPipeline {
  private vectorStore: VectorStore
  private embeddingProvider: EmbeddingProvider
  private storagePath: string
  private dirty: boolean = false
  private currentJob: IndexingJob | null = null

  constructor(vectorStore: VectorStore, embeddingProvider: EmbeddingProvider, storagePath: string) {
    this.vectorStore = vectorStore
    this.embeddingProvider = embeddingProvider
    this.storagePath = storagePath
  }

  /**
   * Index all daily logs
   */
  async indexAll(options: IndexingOptions = {}): Promise<IndexingStats> {
    const { batchSize = 20, skipIndexed = true, verbose = false } = options

    const stats: IndexingStats = {
      totalFiles: 0,
      totalConversations: 0,
      totalChunks: 0,
      indexedChunks: 0,
      skippedChunks: 0,
      errors: [],
    }

    try {
      // Get all daily log files
      const dailyDir = join(this.storagePath, 'daily')
      const files = await readdir(dailyDir)
      const logFiles = files.filter((f) => f.endsWith('.md')).sort()

      stats.totalFiles = logFiles.length

      if (verbose) {
        console.log(`📂 Found ${logFiles.length} daily log files`)
      }

      // Process each file
      for (const file of logFiles) {
        try {
          const filePath = join(dailyDir, file)
          const content = await readFile(filePath, 'utf-8')
          const conversations = this.parseConversations(content, file)

          stats.totalConversations += conversations.length

          if (verbose) {
            console.log(`📄 ${file}: ${conversations.length} conversations`)
          }

          // Index conversations in batches
          for (let i = 0; i < conversations.length; i += batchSize) {
            const batch = conversations.slice(i, i + batchSize)
            await this.indexBatch(batch, stats, skipIndexed, verbose)
          }
        } catch (error) {
          const msg = `Error processing ${file}: ${error instanceof Error ? error.message : String(error)}`
          stats.errors.push(msg)
          if (verbose) {
            console.error(`❌ ${msg}`)
          }
        }
      }

      if (verbose) {
        console.log('\n✅ Indexing complete!')
        console.log(`   Total chunks: ${stats.totalChunks}`)
        console.log(`   Indexed: ${stats.indexedChunks}`)
        console.log(`   Skipped: ${stats.skippedChunks}`)
        console.log(`   Errors: ${stats.errors.length}`)
      }

      return stats
    } catch (error) {
      stats.errors.push(`Fatal error: ${error instanceof Error ? error.message : String(error)}`)
      return stats
    }
  }

  /**
   * Index recent conversations (last N days)
   */
  async indexRecent(days: number, options: IndexingOptions = {}): Promise<IndexingStats> {
    const dailyDir = join(this.storagePath, 'daily')
    const files = await readdir(dailyDir)

    // Calculate date threshold
    const thresholdDate = new Date()
    thresholdDate.setDate(thresholdDate.getDate() - days)

    const thresholdStr = thresholdDate.toISOString().split('T')[0]

    // Filter files by date
    const recentFiles = files
      .filter((f) => f.endsWith('.md'))
      .filter((f) => f >= thresholdStr)
      .sort()

    if (options.verbose) {
      console.log(`📅 Indexing last ${days} days (${recentFiles.length} files)`)
    }

    const stats: IndexingStats = {
      totalFiles: recentFiles.length,
      totalConversations: 0,
      totalChunks: 0,
      indexedChunks: 0,
      skippedChunks: 0,
      errors: [],
    }

    for (const file of recentFiles) {
      try {
        const filePath = join(dailyDir, file)
        const content = await readFile(filePath, 'utf-8')
        const conversations = this.parseConversations(content, file)

        stats.totalConversations += conversations.length

        const skipIndexed = options.skipIndexed ?? true
        const verbose = options.verbose ?? false
        await this.indexBatch(conversations, stats, skipIndexed, verbose)
      } catch (error) {
        stats.errors.push(`${file}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    // Reset dirty flag after successful indexing
    this.dirty = false

    return stats
  }

  /**
   * Index recent conversations asynchronously (non-blocking)
   * Returns immediately with a job ID, indexing happens in background
   */
  indexRecentAsync(days: number, options: IndexingOptions = {}): IndexingJob {
    // Create job
    const job: IndexingJob = {
      id: `index-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      status: 'pending',
      startedAt: Date.now(),
    }

    this.currentJob = job

    // Start indexing in background
    setImmediate(async () => {
      try {
        job.status = 'running'

        const stats = await this.indexRecent(days, {
          ...options,
          verbose: options.verbose ?? false,
        })

        job.status = 'completed'
        job.completedAt = Date.now()
        job.stats = stats
      } catch (error) {
        job.status = 'failed'
        job.completedAt = Date.now()
        job.error = error instanceof Error ? error.message : String(error)
      }
    })

    return job
  }

  /**
   * Check if there are pending changes that need indexing
   */
  isDirty(): boolean {
    return this.dirty
  }

  /**
   * Mark that there are pending changes
   */
  markDirty(): void {
    this.dirty = true
  }

  /**
   * Get current indexing job status
   */
  getCurrentJob(): IndexingJob | null {
    return this.currentJob
  }

  /**
   * Index a single conversation
   */
  async indexConversation(conversation: any): Promise<void> {
    // Chunk the conversation
    const chunks = chunkConversation(conversation)

    // Generate embeddings for all chunks
    const texts = chunks.map((c) => c.content)
    const embeddings = await this.embeddingProvider.generateBatch(texts)

    // Create vector documents
    const docs: VectorDocument[] = chunks.map((chunk, i) => ({
      id: chunk.id,
      conversationId: chunk.metadata.conversationId,
      chunkIndex: chunk.metadata.chunkIndex,
      content: chunk.content,
      embedding: embeddings[i],
      timestamp: chunk.metadata.timestamp.getTime(),
      project: chunk.metadata.project,
      client: chunk.metadata.client,
      sessionId: chunk.metadata.sessionId,
      sourceFile: this.generateSourceFile(chunk.metadata.timestamp, chunk.metadata.sessionId),
    }))

    // Insert into vector store
    this.vectorStore.insertBatch(docs)
  }

  /**
   * Index a batch of conversations
   */
  private async indexBatch(
    conversations: any[],
    stats: IndexingStats,
    skipIndexed: boolean,
    verbose: boolean
  ): Promise<void> {
    for (const conv of conversations) {
      try {
        // Check if already indexed
        const existingDoc = this.vectorStore.getById(conv.id)
        if (skipIndexed && existingDoc) {
          stats.skippedChunks++
          continue
        }

        // Chunk the conversation
        const chunks = chunkConversation(conv)
        stats.totalChunks += chunks.length

        // Generate embeddings
        const texts = chunks.map((c) => c.content)
        const embeddings = await this.embeddingProvider.generateBatch(texts)

        // Create and insert documents
        const docs: VectorDocument[] = chunks.map((chunk, i) => ({
          id: chunk.id,
          conversationId: chunk.metadata.conversationId,
          chunkIndex: chunk.metadata.chunkIndex,
          content: chunk.content,
          embedding: embeddings[i],
          timestamp: chunk.metadata.timestamp.getTime(),
          project: chunk.metadata.project,
          client: chunk.metadata.client,
          sessionId: chunk.metadata.sessionId,
          sourceFile: this.generateSourceFile(chunk.metadata.timestamp, chunk.metadata.sessionId),
        }))

        this.vectorStore.insertBatch(docs)
        stats.indexedChunks += docs.length

        if (verbose && docs.length > 0) {
          console.log(`   ✅ Indexed ${conv.id} (${docs.length} chunks)`)
        }
      } catch (error) {
        const msg = `Error indexing ${conv.id}: ${error instanceof Error ? error.message : String(error)}`
        stats.errors.push(msg)
        if (verbose) {
          console.error(`   ❌ ${msg}`)
        }
      }
    }
  }

  /**
   * Parse conversations from daily log content
   */
  private parseConversations(content: string, fileName: string): any[] {
    const blocks = content.split(/^---$/m)
    const conversations: any[] = []

    for (const block of blocks) {
      if (!block.trim()) continue

      // Extract timestamp
      const timestampMatch = block.match(/## (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/)
      if (!timestampMatch) continue

      // Extract metadata
      const projectMatch = block.match(/\*\*Project:\*\* (.+)/)
      const clientMatch = block.match(/\*\*Client:\*\* (.+)/)
      const sessionMatch = block.match(/\*\*Session:\*\* (.+)/)

      // Extract messages
      const userMatch = block.match(/\*\*User:\*\* ([\s\S]*?)(?=\*\*AI:\*\*|$)/)
      const aiMatch = block.match(/\*\*AI:\*\* ([\s\S]*?)$/)

      if (!userMatch || !aiMatch) continue

      const timestamp = new Date(timestampMatch[1])
      const sessionId = sessionMatch ? sessionMatch[1].trim() : 'unknown'

      // Generate unique ID
      const id = `${fileName}-${timestamp.getTime()}-${sessionId}`

      conversations.push({
        id,
        userMessage: userMatch[1].trim(),
        aiResponse: aiMatch[1].trim(),
        context: {
          timestamp,
          project: projectMatch ? projectMatch[1].trim() : undefined,
          client: clientMatch ? clientMatch[1].trim() : undefined,
          sessionId,
        },
      })
    }

    return conversations
  }

  /**
   * Generate source file path from timestamp and session ID
   */
  private generateSourceFile(timestamp: Date, sessionId: string): string {
    const dateStr = timestamp.toISOString().split('T')[0]
    return `daily/${dateStr}.md`
  }
}
