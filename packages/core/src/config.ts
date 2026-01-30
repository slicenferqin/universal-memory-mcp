/**
 * Configuration management
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import type { MemoryConfig } from './types.js';

/**
 * 默认配置
 */
export const DEFAULT_CONFIG: MemoryConfig = {
  storagePath: join(homedir(), '.ai_memory'),
  dailyRetentionDays: 365,
  autoCleanup: true,
  embeddingProvider: 'none', // 默认不启用 embedding，使用简单搜索
  embeddingModel: undefined,
  embeddingDimensions: 1536,
  semanticWeight: 0.7,
  keywordWeight: 0.3,
  defaultLimit: 10,
  minScore: 0.3,
  consolidationEnabled: false, // 默认关闭自动整理
  consolidationSchedule: 'weekly',
  projectMarkers: ['.git', 'package.json', 'Cargo.toml', 'pyproject.toml', 'go.mod'],
};

/**
 * 加载配置
 */
export function loadConfig(customConfig?: Partial<MemoryConfig>): MemoryConfig {
  // TODO: 从文件加载配置
  // const configPath = join(DEFAULT_CONFIG.storagePath, 'config.json');

  const envStoragePath = process.env.MEMORY_PATH || process.env.AI_MEMORY_PATH;

  return {
    ...DEFAULT_CONFIG,
    ...(envStoragePath ? { storagePath: envStoragePath } : {}),
    ...customConfig,
  };
}

/**
 * 获取每日日志路径
 */
export function getDailyLogPath(config: MemoryConfig, date: Date = new Date()): string {
  const dateStr = formatDate(date);
  return join(config.storagePath, 'daily', `${dateStr}.md`);
}

/**
 * 获取长期记忆路径
 */
export function getLongTermPath(config: MemoryConfig, category?: string): string {
  if (category) {
    return join(config.storagePath, 'long_term', `${category}.md`);
  }
  return join(config.storagePath, 'long_term', 'MEMORY.md');
}

/**
 * 获取项目记忆路径
 */
export function getProjectPath(config: MemoryConfig, projectName: string): string {
  return join(config.storagePath, 'projects', projectName);
}

/**
 * 获取索引数据库路径
 */
export function getIndexDbPath(config: MemoryConfig): string {
  return join(config.storagePath, 'index.db');
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 格式化时间为 HH:mm:ss
 */
export function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * 格式化完整时间戳
 */
export function formatTimestamp(date: Date): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}
