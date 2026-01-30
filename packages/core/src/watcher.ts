/**
 * File Watcher for Memory System
 *
 * Automatically detects file changes and triggers indexing
 */

import chokidar from 'chokidar'
import { join } from 'node:path'

export interface WatcherOptions {
  debounceDelay?: number // milliseconds (default: 5000)
  ignoreInitial?: boolean // Skip initial add events (default: true)
  persistent?: boolean // Keep process running (default: true)
}

export type FileChangeCallback = (path: string, eventType: 'add' | 'change' | 'unlink') => void

/**
 * Simple debounce implementation
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return function (this: any, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      func.apply(this, args)
      timeoutId = null
    }, delay)
  }
}

/**
 * Memory file watcher
 *
 * Monitors memory files for changes and triggers re-indexing
 */
export class MemoryWatcher {
  private watcher: ReturnType<typeof chokidar.watch> | null = null
  private storagePath: string
  private onChange: FileChangeCallback
  private options: Required<WatcherOptions>
  private debouncedCallback: (path: string, eventType: 'add' | 'change' | 'unlink') => void

  constructor(storagePath: string, onChange: FileChangeCallback, options: WatcherOptions = {}) {
    this.storagePath = storagePath
    this.onChange = onChange
    this.options = {
      debounceDelay: options.debounceDelay ?? 5000,
      ignoreInitial: options.ignoreInitial ?? true,
      persistent: options.persistent ?? true,
    }

    // Create debounced callback
    this.debouncedCallback = debounce(this.onChange, this.options.debounceDelay)
  }

  /**
   * Start watching memory files
   */
  start(): void {
    if (this.watcher) {
      console.warn('MemoryWatcher already started')
      return
    }

    // Paths to watch
    const dailyPath = join(this.storagePath, 'daily')
    const longTermPath = join(this.storagePath, 'long_term')
    const pathsToWatch = [dailyPath, longTermPath]

    // Create watcher
    this.watcher = chokidar.watch(pathsToWatch, {
      ignored: /(^|[\/\\])\../, // Ignore dotfiles
      persistent: this.options.persistent,
      ignoreInitial: this.options.ignoreInitial,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100,
      },
    })

    // Handle file changes
    this.watcher
      .on('add', (path: string) => {
        if (path.endsWith('.md')) {
          this.debouncedCallback(path, 'add')
        }
      })
      .on('change', (path: string) => {
        if (path.endsWith('.md')) {
          this.debouncedCallback(path, 'change')
        }
      })
      .on('unlink', (path: string) => {
        if (path.endsWith('.md')) {
          this.debouncedCallback(path, 'unlink')
        }
      })
      .on('error', (error: unknown) => {
        console.error('MemoryWatcher error:', error)
      })
      .on('ready', () => {
        console.log('MemoryWatcher ready, watching for changes...')
      })
  }

  /**
   * Stop watching
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
      console.log('MemoryWatcher stopped')
    }
  }

  /**
   * Check if watcher is active
   */
  isActive(): boolean {
    return this.watcher !== null
  }
}
