/**
 * Search engine implementation
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SearchOptions, SearchResult, MemoryConfig } from './types.js';
import { LocalFileStorage } from './storage.js';

/**
 * 简单的关键词搜索引擎（MVP 版本）
 *
 * 后续版本会添加：
 * - sqlite-vec 向量搜索
 * - BM25 全文搜索
 * - 混合搜索
 */
export class SearchEngine {
  private storage: LocalFileStorage;
  private config: MemoryConfig;

  constructor(config: MemoryConfig) {
    this.config = config;
    this.storage = new LocalFileStorage();
  }

  /**
   * 搜索记忆
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const { timeRange, project, limit = this.config.defaultLimit } = options;

    // 获取所有每日日志文件
    const dailyDir = join(this.config.storagePath, 'daily');
    const files = await this.storage.list(dailyDir, '.md');

    // 过滤时间范围
    const filteredFiles = this.filterByTimeRange(files, timeRange);

    // 搜索每个文件
    const results: SearchResult[] = [];

    for (const file of filteredFiles) {
      const content = await this.storage.read(file);
      const matches = this.searchInContent(content, query, file, project);
      results.push(...matches);
    }

    // 同时搜索长期记忆
    const longTermResults = await this.searchLongTermMemories(query);
    results.push(...longTermResults);

    // 排序并限制返回数量
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * 根据时间范围过滤文件
   */
  private filterByTimeRange(
    files: string[],
    timeRange?: [Date, Date]
  ): string[] {
    if (!timeRange) {
      return files;
    }

    const [start, end] = timeRange;
    const startStr = this.formatDateStr(start);
    const endStr = this.formatDateStr(end);

    return files.filter((file) => {
      const match = file.match(/(\d{4}-\d{2}-\d{2})\.md$/);
      if (!match) return false;
      const dateStr = match[1];
      return dateStr >= startStr && dateStr <= endStr;
    });
  }

  /**
   * 在内容中搜索
   */
  private searchInContent(
    content: string,
    query: string,
    filePath: string,
    projectFilter?: string
  ): SearchResult[] {
    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(Boolean);

    // 按对话块分割
    const blocks = content.split(/^---$/m);

    for (const block of blocks) {
      if (!block.trim()) continue;

      // 检查项目过滤
      if (projectFilter) {
        const projectMatch = block.match(/\*\*Project:\*\* (.+)/);
        if (!projectMatch || projectMatch[1] !== projectFilter) {
          continue;
        }
      }

      // 计算相关性分数
      const blockLower = block.toLowerCase();
      let score = 0;

      for (const term of queryTerms) {
        if (blockLower.includes(term)) {
          // 基础匹配分数
          score += 1;

          // 完整词匹配加分
          const wordRegex = new RegExp(`\\b${this.escapeRegex(term)}\\b`, 'gi');
          const matches = blockLower.match(wordRegex);
          if (matches) {
            score += matches.length * 0.5;
          }
        }
      }

      // 如果有匹配，添加到结果
      if (score > 0) {
        // 提取时间戳
        const timestampMatch = block.match(/## (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
        const timestamp = timestampMatch
          ? new Date(timestampMatch[1])
          : this.extractDateFromPath(filePath);

        // 提取项目
        const projectMatch = block.match(/\*\*Project:\*\* (.+)/);
        const project = projectMatch ? projectMatch[1] : undefined;

        // 归一化分数
        const normalizedScore = Math.min(score / queryTerms.length, 1);

        results.push({
          content: block.trim(),
          score: normalizedScore,
          timestamp,
          project,
          sourcePath: filePath,
        });
      }
    }

    return results;
  }

  /**
   * 从文件路径提取日期
   */
  private extractDateFromPath(filePath: string): Date {
    const match = filePath.match(/(\d{4}-\d{2}-\d{2})\.md$/);
    if (match) {
      return new Date(match[1]);
    }
    return new Date();
  }

  /**
   * 格式化日期字符串
   */
  private formatDateStr(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 转义正则表达式特殊字符
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 搜索长期记忆文件
   */
  private async searchLongTermMemories(query: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const longTermDir = join(this.config.storagePath, 'long_term');
    const files = await this.storage.list(longTermDir, '.md');

    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(Boolean);

    for (const file of files) {
      const content = await this.storage.read(file);
      if (!content) continue;

      const contentLower = content.toLowerCase();
      let score = 0;

      // 计算匹配分数
      for (const term of queryTerms) {
        if (contentLower.includes(term)) {
          score += 1;
          const wordRegex = new RegExp(`\\b${this.escapeRegex(term)}\\b`, 'gi');
          const matches = contentLower.match(wordRegex);
          if (matches) {
            score += matches.length * 0.5;
          }
        }
      }

      if (score > 0) {
        const normalizedScore = Math.min(score / queryTerms.length, 1);
        results.push({
          content: content.trim(),
          score: normalizedScore,
          timestamp: new Date(),
          sourcePath: file,
        });
      }
    }

    return results;
  }
}

/**
 * 搜索长期记忆
 */
export async function searchLongTermMemory(
  config: MemoryConfig,
  query: string
): Promise<string | null> {
  const storage = new LocalFileStorage();
  const memoryPath = join(config.storagePath, 'long_term', 'MEMORY.md');

  try {
    const content = await storage.read(memoryPath);
    if (!content) return null;

    // 简单检查是否包含查询词
    const queryLower = query.toLowerCase();
    if (content.toLowerCase().includes(queryLower)) {
      return content;
    }

    return null;
  } catch {
    return null;
  }
}
