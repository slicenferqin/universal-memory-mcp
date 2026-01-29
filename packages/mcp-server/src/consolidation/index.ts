/**
 * Consolidation module - 长期记忆自动整理
 *
 * 基于脑科学的三层记忆架构：
 * - Level 0: 感觉记忆 (daily/*.md) - 原始对话流水
 * - Level 1: 短期记忆 (long_term/*.md) - 提取的条目
 * - Level 2: 长期记忆 (long_term/*-summary.md) - 整合的摘要
 */

export { scanDailyLogs, type Conversation, type ScanOptions, type ScanResult } from './scanner.js';
export { extractWithClaudeCLI, checkClaudeCLI, type ExtractedInfo, type ExtractionResult } from './extractor.js';
export { deduplicateResults, type DeduplicationResult } from './deduplicator.js';
export { updateLongTermMemory } from './updater.js';
export {
  consolidateSummaries,
  shouldConsolidate,
  type ConsolidationOptions,
  type ConsolidationResult,
} from './summary-consolidator.js';
