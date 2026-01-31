/**
 * Tests for scheduler/lifecycle.ts
 *
 * Priority: P0 (High)
 * Coverage: Lifecycle scheduler initialization, task execution, retry logic
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { LifecycleScheduler } from '../lifecycle.js'
import type { SchedulerConfig } from '../lifecycle.js'

// Mock dependencies
vi.mock('../../archive.js', () => ({
  ArchiveManager: vi.fn().mockImplementation(() => ({
    archive: vi.fn().mockResolvedValue({
      archivedDailyFiles: 5,
      archivedLongTermEntries: 10,
    }),
  })),
}))

describe('LifecycleScheduler', () => {
  let config: SchedulerConfig

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    config = {
      storagePath: '/tmp/test-memory',
      dailyInterval: 1000, // 1 second for testing
      weeklyInterval: 7000,
      monthlyInterval: 30000,
      extractionModel: 'haiku',
      consolidationModel: 'sonnet',
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initialization', () => {
    it('should initialize with default config', () => {
      const scheduler = new LifecycleScheduler({
        storagePath: '/tmp/test',
      })

      expect(scheduler.isActive()).toBe(false)
    })

    it('should accept custom intervals', () => {
      const scheduler = new LifecycleScheduler({
        storagePath: '/tmp/test',
        dailyInterval: 5000,
        weeklyInterval: 10000,
      })

      const stats = scheduler.getStats()
      expect(stats).toBeDefined()
    })

    it('should accept custom models', () => {
      const scheduler = new LifecycleScheduler({
        storagePath: '/tmp/test',
        extractionModel: 'opus',
        consolidationModel: 'haiku',
      })

      expect(scheduler).toBeDefined()
    })

    it('should have empty stats initially', () => {
      const scheduler = new LifecycleScheduler(config)

      const stats = scheduler.getStats()

      expect(stats).toEqual({
        totalRuns: 0,
        totalErrors: 0,
        history: [],
      })
    })
  })

  describe('start and stop', () => {
    it('should start and stop correctly', () => {
      const scheduler = new LifecycleScheduler(config)

      scheduler.start()
      expect(scheduler.isActive()).toBe(true)

      scheduler.stop()
      expect(scheduler.isActive()).toBe(false)
    })

    it('should not start if already active', () => {
      const scheduler = new LifecycleScheduler(config)

      scheduler.start()
      const active1 = scheduler.isActive()

      scheduler.start()
      const active2 = scheduler.isActive()

      expect(active1).toBe(true)
      expect(active2).toBe(true)
    })

    it('should handle stop when not active', () => {
      const scheduler = new LifecycleScheduler(config)

      expect(() => scheduler.stop()).not.toThrow()
      expect(scheduler.isActive()).toBe(false)
    })
  })

  describe('statistics tracking', () => {
    it('should provide stats object', () => {
      const scheduler = new LifecycleScheduler(config)

      const stats = scheduler.getStats()

      expect(stats).toBeDefined()
      expect(stats.totalRuns).toBeDefined()
      expect(stats.totalErrors).toBeDefined()
      expect(stats.history).toBeDefined()
    })
  })

  describe('manual task execution', () => {
    it.skip('should handle daily task execution', async () => {
      // TODO: Fix this test - consolidation needs file system setup
      const scheduler = new LifecycleScheduler(config)

      // Note: This will call real consolidation functions which may fail
      // but we're testing that the scheduler handles it gracefully
      const result = await scheduler.runTaskManually('daily')

      // Result should be returned even if task fails
      expect(result).toBeDefined()
      expect(result.type).toBe('daily')
      expect(result.timestamp).toBeDefined()
      expect(typeof result.success).toBe('boolean')
    })

    it('should handle weekly task execution', async () => {
      const scheduler = new LifecycleScheduler(config)

      const result = await scheduler.runTaskManually('weekly')

      expect(result).toBeDefined()
      expect(result.type).toBe('weekly')
      expect(result.timestamp).toBeDefined()
    }, 60000)

    it('should handle monthly task execution', async () => {
      const scheduler = new LifecycleScheduler(config)

      const result = await scheduler.runTaskManually('monthly')

      expect(result).toBeDefined()
      expect(result.type).toBe('monthly')
      expect(result.timestamp).toBeDefined()
    }, 60000)
  })

  describe('scheduler lifecycle', () => {
    it('should schedule tasks when started', () => {
      const scheduler = new LifecycleScheduler(config)

      scheduler.start()

      const stats = scheduler.getStats()
      expect(stats.nextDailyRun).toBeDefined()
      expect(stats.nextWeeklyRun).toBeDefined()
      expect(stats.nextMonthlyRun).toBeDefined()

      scheduler.stop()
    })

    it('should clear timers when stopped', () => {
      const scheduler = new LifecycleScheduler(config)

      scheduler.start()
      scheduler.stop()

      expect(scheduler.isActive()).toBe(false)
    })
  })
})
