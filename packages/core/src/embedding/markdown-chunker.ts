/**
 * Markdown chunking for L1/L2 memory files
 *
 * Chunks long_term/*.md and summary files for vectorization
 */

import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface MarkdownChunk {
  id: string
  content: string
  metadata: {
    sourceFile: string // e.g., 'long_term/decisions.md'
    category: 'decisions' | 'preferences' | 'facts' | 'profile' | 'summary' | 'knowledge'
    chunkIndex: number
    totalChunks: number
    timestamp: Date
    entryCount?: number // Number of original entries in this chunk
  }
}

export interface MarkdownChunkOptions {
  maxChunkSize?: number // Maximum entries per chunk (default: 20)
  overlap?: number // Overlap entries between chunks (default: 2)
}

/**
 * Chunk a long-term memory Markdown file
 */
export async function chunkMarkdownFile(
  storagePath: string,
  filename:
    | 'decisions.md'
    | 'preferences.md'
    | 'facts.md'
    | 'profile.md'
    | 'profile-summary.md'
    | 'knowledge-summary.md',
  options: MarkdownChunkOptions = {}
): Promise<MarkdownChunk[]> {
  const { maxChunkSize = 20, overlap = 2 } = options

  const filePath = join(storagePath, 'long_term', filename)

  try {
    const content = await readFile(filePath, 'utf-8')
    return chunkMarkdownContent(content, filename, maxChunkSize, overlap)
  } catch (error) {
    // File doesn't exist or can't be read
    return []
  }
}

/**
 * Chunk Markdown content into pieces
 */
function chunkMarkdownContent(
  content: string,
  filename: string,
  maxChunkSize: number,
  overlap: number
): MarkdownChunk[] {
  // Determine category from filename
  const category = getCategoryFromFile(filename)

  // Extract entries (lines starting with "- [timestamp]")
  const entries = extractEntries(content)

  if (entries.length === 0) {
    return []
  }

  // Chunk entries
  const chunks: MarkdownChunk[] = []
  let chunkIndex = 0

  for (let i = 0; i < entries.length; i += maxChunkSize - overlap) {
    const chunkEntries = entries.slice(i, i + maxChunkSize)

    const chunkContent = chunkEntries.join('\n')

    chunks.push({
      id: `${filename.replace('.md', '')}-chunk-${chunkIndex}-${randomUUID()}`,
      content: chunkContent,
      metadata: {
        sourceFile: `long_term/${filename}`,
        category,
        chunkIndex,
        totalChunks: 0, // Will update at end
        timestamp: new Date(),
        entryCount: chunkEntries.length,
      },
    })

    chunkIndex++
  }

  // Update totalChunks
  chunks.forEach((chunk) => {
    chunk.metadata.totalChunks = chunks.length
  })

  return chunks
}

/**
 * Extract entries from Markdown content
 *
 * Matches lines like: "- [2026-01-30 10:00:00] Content here"
 */
function extractEntries(content: string): string[] {
  const lines = content.split('\n')
  const entries: string[] = []
  let currentEntry = ''

  for (const line of lines) {
    // Match entry start
    const match = line.match(/^-\s*\[[\d\-\s:]+\]\s*(.*)/)

    if (match) {
      // Save previous entry if exists
      if (currentEntry.trim()) {
        entries.push(currentEntry.trim())
      }
      // Start new entry
      currentEntry = line
    } else if (currentEntry) {
      // Continuation of previous entry (multiline content)
      currentEntry += '\n' + line
    }
  }

  // Don't forget the last entry
  if (currentEntry.trim()) {
    entries.push(currentEntry.trim())
  }

  return entries
}

/**
 * Get category from filename
 */
function getCategoryFromFile(
  filename: string
): 'decisions' | 'preferences' | 'facts' | 'profile' | 'summary' | 'knowledge' {
  if (filename.includes('decisions')) return 'decisions'
  if (filename.includes('preferences')) return 'preferences'
  if (filename.includes('facts')) return 'facts'
  if (filename.includes('profile')) return 'profile'
  if (filename.includes('knowledge')) return 'knowledge'
  return 'facts' // default
}

/**
 * Chunk all long-term memory files
 */
export async function chunkAllLongTermFiles(
  storagePath: string,
  options: MarkdownChunkOptions = {}
): Promise<MarkdownChunk[]> {
  const files: Array<
    | 'decisions.md'
    | 'preferences.md'
    | 'facts.md'
    | 'profile.md'
    | 'profile-summary.md'
    | 'knowledge-summary.md'
  > = [
    'decisions.md',
    'preferences.md',
    'facts.md',
    'profile.md',
    'profile-summary.md',
    'knowledge-summary.md',
  ]

  const allChunks: MarkdownChunk[] = []

  for (const file of files) {
    const chunks = await chunkMarkdownFile(storagePath, file, options)
    allChunks.push(...chunks)
  }

  return allChunks
}
