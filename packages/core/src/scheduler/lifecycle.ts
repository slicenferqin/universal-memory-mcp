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

export interface SchedulerConfig {
  storagePath: string
  // Schedule intervals (in milliseconds)
  dailyInterval?: number // Default: 24 hours
  weeklyInterval?: number // Default: 7 days
  monthlyInterval?: number // Default: 30 days
  // Archive thresholds (in days)
  archiveDailyAfter?: number // Default: 7 days
  archiveLongTermAfter?: number // Default: 30 days
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

  constructor(config: SchedulerConfig) {
    this.config = {
      dailyInterval: 24 * 60 * 60 * 1000, // 24 hours
      weeklyInterval: 7 * 24 * 60 * 60 * 1000, // 7 days
      monthlyInterval: 30 * 24 * 60 * 60 * 1000, // 30 days
      archiveDailyAfter: 7, // 7 days
      archiveLongTermAfter: 30, // 30 days
      ...config,
    }
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
   * This is a placeholder - the actual implementation would call the
   * consolidation module (scanner + extractor + updater)
   */
  private async runDailyTask(): Promise<void> {
    console.log('\n🔄 [Daily Task] Running L0 → L1 extraction...')

    const result: ScheduleResult = {
      type: 'daily',
      timestamp: new Date(),
      success: false,
    }

    try {
      // TODO: Call actual consolidation logic
      // This would involve:
      // 1. Scan daily/ for files older than 1 day
      // 2. Extract facts using extractor.ts
      // 3. Update long_term/*.md using updater.ts
      // 4. Index long_term files using indexLongTermFiles()

      console.log('   ✅ Daily task completed (placeholder)')

      result.success = true
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
   * This is a placeholder - the actual implementation would call
   * consolidateSummaries from summary-consolidator.ts
   */
  private async runWeeklyTask(): Promise<void> {
    console.log('\n🔄 [Weekly Task] Running L1 → L2 consolidation...')

    const result: ScheduleResult = {
      type: 'weekly',
      timestamp: new Date(),
      success: false,
    }

    try {
      // TODO: Call actual consolidation logic
      // This would involve:
      // 1. Check if consolidation is needed (shouldConsolidate)
      // 2. Call consolidateSummaries()
      // 3. Index the new summary files

      console.log('   ✅ Weekly task completed (placeholder)')

      result.success = true
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
   * This is a placeholder - the actual implementation would move
   * old files to archive/ directory
   */
  private async runMonthlyTask(): Promise<void> {
    console.log('\n🔄 [Monthly Task] Running archival...')

    const result: ScheduleResult = {
      type: 'monthly',
      timestamp: new Date(),
      success: false,
    }

    try {
      // TODO: Call actual archival logic
      // This would involve:
      // 1. Move daily/ files older than 7 days to archive/daily/
      // 2. Move long_term/ entries older than 30 days to archive/long_term/
      // 3. Update vector store to remove archived chunks

      console.log('   ✅ Monthly task completed (placeholder)')

      result.success = true
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
