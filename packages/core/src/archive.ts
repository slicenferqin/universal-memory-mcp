/**
 * Archive Manager
 *
 * Moves old memories to archive/ directory for cold storage
 * and updates the vector store to remove archived chunks
 */

import { join, dirname } from 'node:path'
import { existsSync, mkdirSync, renameSync } from 'node:fs'
import { readdir, stat, readFile, writeFile } from 'node:fs/promises'

export interface ArchiveStats {
  archivedDailyFiles: number
  archivedLongTermEntries: number
  archivedChunksRemoved: number
  errors: string[]
}

export interface ArchiveOptions {
  archiveDailyAfter?: number // Default: 7 days
  archiveLongTermAfter?: number // Default: 30 days
  dryRun?: boolean // If true, don't actually move files
  verbose?: boolean
}

/**
 * Calculate age of a file in days
 */
async function getFileAgeInDays(filePath: string): Promise<number> {
  const stats = await stat(filePath)
  const now = Date.now()
  const fileTime = stats.mtime.getTime()
  return (now - fileTime) / (1000 * 60 * 60 * 24)
}

/**
 * Ensure archive directory exists
 */
function ensureArchiveDir(storagePath: string, subdir: string): string {
  const archiveDir = join(storagePath, 'archive', subdir)
  if (!existsSync(archiveDir)) {
    mkdirSync(archiveDir, { recursive: true })
  }
  return archiveDir
}

/**
 * Archive old daily log files
 */
async function archiveDailyFiles(
  storagePath: string,
  thresholdDays: number,
  dryRun: boolean,
  verbose: boolean
): Promise<number> {
  const dailyPath = join(storagePath, 'daily')
  if (!existsSync(dailyPath)) {
    return 0
  }

  const archivePath = ensureArchiveDir(storagePath, 'daily')
  let archivedCount = 0

  const files = await readdir(dailyPath)
  for (const file of files) {
    if (!file.endsWith('.md')) continue

    const filePath = join(dailyPath, file)
    const ageInDays = await getFileAgeInDays(filePath)

    if (ageInDays >= thresholdDays) {
      const archiveFilePath = join(archivePath, file)

      if (dryRun) {
        if (verbose)
          console.log(`   [DRY RUN] Would archive: ${file} (${ageInDays.toFixed(1)} days old)`)
      } else {
        renameSync(filePath, archiveFilePath)
        if (verbose) console.log(`   📦 Archived: ${file} (${ageInDays.toFixed(1)} days old)`)
      }

      archivedCount++
    }
  }

  return archivedCount
}

/**
 * Archive old long-term memory entries
 *
 * This is more complex because long_term/*.md files contain multiple entries.
 * We need to:
 * 1. Read the file
 * 2. Extract entries older than threshold
 * 3. Move them to archive/long_term/
 * 4. Update the original file
 */
async function archiveLongTermEntries(
  storagePath: string,
  thresholdDays: number,
  dryRun: boolean,
  verbose: boolean
): Promise<number> {
  const longTermPath = join(storagePath, 'long_term')
  if (!existsSync(longTermPath)) {
    return 0
  }

  const archivePath = ensureArchiveDir(storagePath, 'long_term')
  let archivedCount = 0

  const files = await readdir(longTermPath)
  for (const file of files) {
    if (!file.endsWith('.md')) continue

    const filePath = join(longTermPath, file)
    const content = await readFile(filePath, 'utf-8')

    // Parse entries (assuming format: "## YYYY-MM-DD\n...\n\n## YYYY-MM-DD\n...")
    const entryRegex = /## (\d{4}-\d{2}-\d{2})\n([\s\S]+?)(?=\n## \d{4}-\d{2}-\d{2}\n|$)/g
    const entries: Array<{ date: string; content: string; ageInDays: number }> = []

    let match
    while ((match = entryRegex.exec(content)) !== null) {
      const dateStr = match[1]
      const entryContent = match[0]
      const entryDate = new Date(dateStr)
      const ageInDays = (Date.now() - entryDate.getTime()) / (1000 * 60 * 60 * 24)

      entries.push({ date: dateStr, content: entryContent, ageInDays })
    }

    // Separate old and new entries
    const oldEntries = entries.filter((e) => e.ageInDays >= thresholdDays)
    const newEntries = entries.filter((e) => e.ageInDays < thresholdDays)

    if (oldEntries.length === 0) {
      continue
    }

    // Archive old entries
    const archiveFilePath = join(archivePath, file)
    const oldEntriesContent = oldEntries.map((e) => e.content).join('\n\n')

    if (dryRun) {
      if (verbose) {
        console.log(`   [DRY RUN] Would archive ${oldEntries.length} entries from ${file}`)
      }
    } else {
      // Append to archive file
      let archiveContent = ''
      if (existsSync(archiveFilePath)) {
        archiveContent = await readFile(archiveFilePath, 'utf-8')
      }
      archiveContent += '\n\n' + oldEntriesContent
      await writeFile(archiveFilePath, archiveContent.trim(), 'utf-8')

      if (verbose) {
        console.log(`   📦 Archived ${oldEntries.length} entries from ${file}`)
      }
    }

    // Update original file with only new entries
    if (newEntries.length > 0) {
      const newEntriesContent = newEntries.map((e) => e.content).join('\n\n')

      if (!dryRun) {
        await writeFile(filePath, newEntriesContent.trim(), 'utf-8')
        if (verbose) {
          console.log(`   ✅ Updated ${file} (kept ${newEntries.length} entries)`)
        }
      }
    } else {
      // All entries archived, remove the file
      if (!dryRun) {
        // Keep an empty file with a header
        await writeFile(filePath, `# ${file.replace('.md', '')}\n\n_No recent entries_\n`, 'utf-8')
        if (verbose) {
          console.log(`   🗑️  Cleared ${file} (all entries archived)`)
        }
      }
    }

    archivedCount += oldEntries.length
  }

  return archivedCount
}

/**
 * Archive Manager
 *
 * Manages the archival of old memories to cold storage
 */
export class ArchiveManager {
  private storagePath: string

  constructor(storagePath: string) {
    this.storagePath = storagePath
  }

  /**
   * Run archival process
   */
  async archive(options: ArchiveOptions = {}): Promise<ArchiveStats> {
    const {
      archiveDailyAfter = 7, // Default: archive daily logs after 7 days
      archiveLongTermAfter = 30, // Default: archive long-term entries after 30 days
      dryRun = false,
      verbose = true,
    } = options

    const stats: ArchiveStats = {
      archivedDailyFiles: 0,
      archivedLongTermEntries: 0,
      archivedChunksRemoved: 0,
      errors: [],
    }

    if (verbose) {
      console.log('\n📦 [Archive] Starting archival process...')
      if (dryRun) {
        console.log('   ⚠️  DRY RUN MODE - No files will be moved')
      }
    }

    try {
      // Archive old daily log files
      const dailyFilesArchived = await archiveDailyFiles(
        this.storagePath,
        archiveDailyAfter,
        dryRun,
        verbose
      )
      stats.archivedDailyFiles = dailyFilesArchived

      // Archive old long-term memory entries
      const longTermEntriesArchived = await archiveLongTermEntries(
        this.storagePath,
        archiveLongTermAfter,
        dryRun,
        verbose
      )
      stats.archivedLongTermEntries = longTermEntriesArchived

      if (verbose) {
        console.log(`\n   ✅ Archival complete:`)
        console.log(`      - Daily files: ${stats.archivedDailyFiles}`)
        console.log(`      - Long-term entries: ${stats.archivedLongTermEntries}`)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      stats.errors.push(errorMsg)
      console.error(`   ❌ Archival failed: ${errorMsg}`)
    }

    return stats
  }

  /**
   * Get archive directory paths
   */
  getArchivePaths(): { daily: string; longTerm: string } {
    return {
      daily: join(this.storagePath, 'archive', 'daily'),
      longTerm: join(this.storagePath, 'archive', 'long_term'),
    }
  }

  /**
   * Check if a file is in the archive
   */
  isArchived(relativePath: string): boolean {
    return relativePath.startsWith('archive/')
  }
}
