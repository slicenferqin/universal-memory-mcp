/**
 * Lifecycle Scheduler for Three-Tier Memory Architecture
 *
 * Automatically manages memory lifecycle:
 * - Daily: L0 (daily logs) → L1 (extracted facts)
 * - Weekly: L1 → L2 (consolidated summaries)
 * - Monthly: Archive old memories
 */

import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { ArchiveManager } from '../archive.js'
import type { IndexingPipeline } from '../vectorstore/pipeline.js'

export interface SchedulerConfig {
  storagePath: string
  // Schedule intervals (in milliseconds)
  dailyInterval?: number // Default: 24 hours
  weeklyInterval?: number // Default: 7 days
  monthlyInterval?: number // Default: 30 days
  // Archive thresholds (in days)
  archiveDailyAfter?: number // Default: 7 days
  archiveLongTermAfter?: number // Default: 30 days
  // Consolidation options
  extractionModel?: 'haiku' | 'sonnet' | 'opus' // Default: 'haiku'
  consolidationModel?: 'haiku' | 'sonnet' | 'opus' // Default: 'sonnet'
  // Indexing pipeline for vectorization
  indexingPipeline?: IndexingPipeline
}

export interface ScheduleResult {
  type: 'daily' | 'weekly' | 'monthly'
  timestamp: Date
  success: boolean
  stats?: any
  error?: string
}

export interface SchedulerStats {
  lastDailyRun?: Date
  lastWeeklyRun?: Date
  lastMonthlyRun?: Date
  nextDailyRun?: Date
  nextWeeklyRun?: Date
  nextMonthlyRun?: Date
  totalRuns: number
  totalErrors: number
  history: ScheduleResult[]
}

/**
 * Lifecycle Scheduler
 *
 * Coordinates automatic memory consolidation and archiving
 */
export class LifecycleScheduler {
  private config: SchedulerConfig
  private timers: Map<string, NodeJS.Timeout> = new Map()
  private stats: SchedulerStats = {
    totalRuns: 0,
    totalErrors: 0,
    history: [],
  }
  private running: boolean = false
  private archiveManager: ArchiveManager

  constructor(config: SchedulerConfig) {
    this.config = {
      dailyInterval: 24 * 60 * 60 * 1000, // 24 hours
      weeklyInterval: 7 * 24 * 60 * 60 * 1000, // 7 days
      monthlyInterval: 30 * 24 * 60 * 60 * 1000, // 30 days
      archiveDailyAfter: 7, // 7 days
      archiveLongTermAfter: 30, // 30 days
      extractionModel: 'haiku',
      consolidationModel: 'sonnet',
      ...config,
    }
    this.archiveManager = new ArchiveManager(this.config.storagePath)
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.running) {
      console.warn('LifecycleScheduler already running')
      return
    }

    this.running = true
    console.log('🔄 Starting Lifecycle Scheduler...')

    // Schedule daily tasks
    this.scheduleDaily()

    // Schedule weekly tasks
    this.scheduleWeekly()

    // Schedule monthly tasks
    this.scheduleMonthly()

    console.log('✅ Lifecycle Scheduler started')
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.running) {
      return
    }

    console.log('🛑 Stopping Lifecycle Scheduler...')

    // Clear all timers
    for (const [name, timer] of this.timers) {
      clearInterval(timer)
      console.log(`   Cleared ${name} timer`)
    }

    this.timers.clear()
    this.running = false

    console.log('✅ Lifecycle Scheduler stopped')
  }

  /**
   * Schedule daily tasks (L0 → L1 extraction)
   */
  private scheduleDaily(): void {
    const interval = this.config.dailyInterval!

    const timer = setInterval(async () => {
      await this.runDailyTask()
    }, interval)

    this.timers.set('daily', timer)

    // Calculate next run time
    this.stats.nextDailyRun = new Date(Date.now() + interval)

    console.log(`   📅 Daily task scheduled (every ${interval / (60 * 60 * 1000)} hours)`)
  }

  /**
   * Schedule weekly tasks (L1 → L2 consolidation)
   */
  private scheduleWeekly(): void {
    const interval = this.config.weeklyInterval!

    const timer = setInterval(async () => {
      await this.runWeeklyTask()
    }, interval)

    this.timers.set('weekly', timer)

    // Calculate next run time
    this.stats.nextWeeklyRun = new Date(Date.now() + interval)

    console.log(`   📅 Weekly task scheduled (every ${interval / (24 * 60 * 60 * 1000)} days)`)
  }

  /**
   * Schedule monthly tasks (archiving)
   */
  private scheduleMonthly(): void {
    const interval = this.config.monthlyInterval!

    const timer = setInterval(async () => {
      await this.runMonthlyTask()
    }, interval)

    this.timers.set('monthly', timer)

    // Calculate next run time
    this.stats.nextMonthlyRun = new Date(Date.now() + interval)

    console.log(`   📅 Monthly task scheduled (every ${interval / (24 * 60 * 60 * 1000)} days)`)
  }

  /**
   * Run daily task: L0 → L1 extraction
   *
   * Consolidates recent conversations into long-term memory
   */
  private async runDailyTask(): Promise<void> {
    console.log('\n🔄 [Daily Task] Running L0 → L1 extraction...')

    const result: ScheduleResult = {
      type: 'daily',
      timestamp: new Date(),
      success: false,
    }

    try {
      // Import consolidation module dynamically
      // Use relative path since we're in a monorepo
      const { scanDailyLogs, extractWithClaudeCLI, deduplicateResults, updateLongTermMemory } =
        await import('../../../mcp-server/dist/consolidation/index.js')

      // 1. Scan daily logs for recent conversations
      console.log('   🔍 Scanning daily logs...')
      const scanResult = await scanDailyLogs(this.config.storagePath, { days: 1 })

      if (scanResult.conversations.length === 0) {
        console.log('   ℹ️  No new conversations to consolidate')
        result.success = true
        result.stats = { conversationsProcessed: 0 }
      } else {
        console.log(`   📝 Found ${scanResult.conversations.length} conversations`)

        // 2. Extract facts using Claude CLI
        console.log('   🧠 Extracting facts with Claude CLI...')
        const extracted = await extractWithClaudeCLI(scanResult.conversations, {
          model: this.config.extractionModel,
          verbose: false,
        })

        // 3. Deduplicate results
        console.log('   🔀 Deduplicating results...')
        const deduplicated = await deduplicateResults(extracted, this.config.storagePath)

        // 4. Update long-term memory files
        console.log('   💾 Updating long-term memory...')
        const processedIds = scanResult.conversations.map((c: any) => c.id)
        await updateLongTermMemory(this.config.storagePath, deduplicated, processedIds)

        console.log(`   ✅ Extracted ${Object.keys(deduplicated).length} categories`)
        result.success = true
        result.stats = {
          conversationsProcessed: scanResult.conversations.length,
          categoriesExtracted: Object.keys(deduplicated).length,
        }

        // 5. Index long-term files if pipeline is available
        if (this.config.indexingPipeline) {
          console.log('   📊 Indexing long-term files...')
          await this.config.indexingPipeline.indexLongTermFiles({ verbose: false })
          console.log('   ✅ Indexing complete')
        }
      }

      this.stats.lastDailyRun = new Date()
    } catch (error) {
      console.error(`   ❌ Daily task failed: ${error}`)
      result.error = error instanceof Error ? error.message : String(error)
      this.stats.totalErrors++
    }

    this.stats.totalRuns++
    this.stats.history.push(result)

    // Keep only last 100 results
    if (this.stats.history.length > 100) {
      this.stats.history = this.stats.history.slice(-100)
    }

    // Schedule next run
    this.scheduleDaily()
  }

  /**
   * Run weekly task: L1 → L2 consolidation
   *
   * Consolidates Level 1 entries into Level 2 summaries
   */
  private async runWeeklyTask(): Promise<void> {
    console.log('\n🔄 [Weekly Task] Running L1 → L2 consolidation...')

    const result: ScheduleResult = {
      type: 'weekly',
      timestamp: new Date(),
      success: false,
    }

    try {
      // Import consolidation module dynamically
      // Use relative path since we're in a monorepo
      const { shouldConsolidate, consolidateSummaries } =
        await import('../../../mcp-server/dist/consolidation/index.js')

      // 1. Check if consolidation is needed
      console.log('   🔍 Checking if consolidation is needed...')
      const needsConsolidation = await shouldConsolidate(this.config.storagePath)

      if (!needsConsolidation) {
        console.log('   ℹ️  Consolidation not needed yet')
        result.success = true
        result.stats = { consolidated: false }
      } else {
        console.log('   🧠 Running consolidation...')

        // 2. Run consolidation
        const consolidationResult = await consolidateSummaries(this.config.storagePath, {
          model: this.config.consolidationModel,
          verbose: false,
        })

        console.log('   ✅ Consolidation complete')
        console.log(`      - Profile: ${consolidationResult.stats.profileEntriesProcessed} entries`)
        console.log(
          `      - Knowledge: ${consolidationResult.stats.factsEntriesProcessed} facts, ${consolidationResult.stats.decisionsEntriesProcessed} decisions`
        )

        result.success = true
        result.stats = {
          consolidated: true,
          ...consolidationResult.stats,
        }

        // 3. Index long-term files if pipeline is available
        if (this.config.indexingPipeline) {
          console.log('   📊 Indexing long-term files...')
          await this.config.indexingPipeline.indexLongTermFiles({ verbose: false })
          console.log('   ✅ Indexing complete')
        }
      }

      this.stats.lastWeeklyRun = new Date()
    } catch (error) {
      console.error(`   ❌ Weekly task failed: ${error}`)
      result.error = error instanceof Error ? error.message : String(error)
      this.stats.totalErrors++
    }

    this.stats.totalRuns++
    this.stats.history.push(result)

    // Keep only last 100 results
    if (this.stats.history.length > 100) {
      this.stats.history = this.stats.history.slice(-100)
    }

    // Schedule next run
    this.scheduleWeekly()
  }

  /**
   * Run monthly task: Archive old memories
   *
   * Moves old files to archive/ directory for cold storage
   */
  private async runMonthlyTask(): Promise<void> {
    console.log('\n🔄 [Monthly Task] Running archival...')

    const result: ScheduleResult = {
      type: 'monthly',
      timestamp: new Date(),
      success: false,
    }

    try {
      const archiveStats = await this.archiveManager.archive({
        archiveDailyAfter: this.config.archiveDailyAfter,
        archiveLongTermAfter: this.config.archiveLongTermAfter,
        verbose: true,
      })

      console.log(`   ✅ Monthly task completed`)
      console.log(`      📦 Archived ${archiveStats.archivedDailyFiles} daily files`)
      console.log(`      📦 Archived ${archiveStats.archivedLongTermEntries} long-term entries`)

      result.success = true
      result.stats = archiveStats
      this.stats.lastMonthlyRun = new Date()
    } catch (error) {
      console.error(`   ❌ Monthly task failed: ${error}`)
      result.error = error instanceof Error ? error.message : String(error)
      this.stats.totalErrors++
    }

    this.stats.totalRuns++
    this.stats.history.push(result)

    // Keep only last 100 results
    if (this.stats.history.length > 100) {
      this.stats.history = this.stats.history.slice(-100)
    }

    // Schedule next run
    this.scheduleMonthly()
  }

  /**
   * Get scheduler statistics
   */
  getStats(): SchedulerStats {
    return { ...this.stats }
  }

  /**
   * Check if scheduler is running
   */
  isActive(): boolean {
    return this.running
  }

  /**
   * Run a task manually (for testing)
   */
  async runTaskManually(type: 'daily' | 'weekly' | 'monthly'): Promise<void> {
    switch (type) {
      case 'daily':
        await this.runDailyTask()
        break
      case 'weekly':
        await this.runWeeklyTask()
        break
      case 'monthly':
        await this.runMonthlyTask()
        break
    }
  }
}
