/**
 * Deduplicator - 去重提取结果
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ExtractedInfo, ExtractionResult } from './extractor.js';

export interface DeduplicationResult {
  decisions: ExtractedInfo[];
  preferences: ExtractedInfo[];
  facts: ExtractedInfo[];
  contacts: ExtractedInfo[];
  profile: ExtractedInfo[];
  duplicatesRemoved: number;
}

/**
 * 去重提取结果
 */
export async function deduplicateResults(
  extracted: ExtractionResult,
  storagePath: string
): Promise<DeduplicationResult> {
  // 1. 加载现有长期记忆
  const existing = await loadExistingMemory(storagePath);

  let duplicatesRemoved = 0;

  // 2. 对每个类别进行去重
  const deduplicateCategory = (
    items: ExtractedInfo[],
    existingContent: string[]
  ): ExtractedInfo[] => {
    const result: ExtractedInfo[] = [];
    const seen = new Set<string>();

    for (const item of items) {
      if (!item.content || item.content.length < 5) {
        duplicatesRemoved++;
        continue;
      }

      // 提取关键词用于比较
      const keywords = extractKeywords(item.content);
      const keyStr = keywords.slice(0, 5).join('|');

      // 检查是否与已有内容重复
      const isDuplicateWithExisting = existingContent.some(
        ec => calculateSimilarity(item.content, ec) > 0.7
      );

      // 检查是否与本批次内容重复
      const isDuplicateInBatch = [...seen].some(
        s => calculateSimilarity(item.content, s) > 0.8
      );

      if (isDuplicateWithExisting || isDuplicateInBatch) {
        duplicatesRemoved++;
        continue;
      }

      seen.add(item.content);
      result.push(item);
    }

    return result;
  };

  return {
    decisions: deduplicateCategory(extracted.decisions, existing.decisions),
    preferences: deduplicateCategory(extracted.preferences, existing.preferences),
    facts: deduplicateCategory(extracted.facts, existing.facts),
    contacts: deduplicateCategory(extracted.contacts, existing.contacts),
    profile: deduplicateCategory(extracted.profile || [], existing.profile),
    duplicatesRemoved,
  };
}

/**
 * 加载现有长期记忆内容
 */
async function loadExistingMemory(storagePath: string): Promise<{
  decisions: string[];
  preferences: string[];
  facts: string[];
  contacts: string[];
  profile: string[];
}> {
  const result = {
    decisions: [] as string[],
    preferences: [] as string[],
    facts: [] as string[],
    contacts: [] as string[],
    profile: [] as string[],
  };

  // 读取 MEMORY.md
  try {
    const memoryPath = join(storagePath, 'long_term', 'MEMORY.md');
    const content = await readFile(memoryPath, 'utf-8');

    // 解析各个部分
    const sections = content.split(/^## /m);

    for (const section of sections) {
      const lines = section.split('\n')
        .filter(line => line.startsWith('- '))
        .map(line => line.replace(/^- \[\d{4}-\d{2}-\d{2}[^\]]*\]\s*/, '').trim());

      if (section.startsWith('Important Decisions') || section.startsWith('User Decisions')) {
        result.decisions.push(...lines);
      } else if (section.startsWith('User Preferences') || section.startsWith('Preferences')) {
        result.preferences.push(...lines);
      } else if (section.startsWith('Key Facts') || section.startsWith('Facts')) {
        result.facts.push(...lines);
      } else if (section.startsWith('Contacts')) {
        result.contacts.push(...lines);
      } else if (section.startsWith('User Profile') || section.startsWith('Profile')) {
        result.profile.push(...lines);
      }
    }
  } catch {
    // 文件不存在，返回空
  }

  // 读取分类文件
  try {
    const decisionsPath = join(storagePath, 'long_term', 'decisions.md');
    const content = await readFile(decisionsPath, 'utf-8');
    const lines = content.split('\n')
      .filter(line => line.startsWith('- '))
      .map(line => line.replace(/^- \[\d{4}-\d{2}-\d{2}[^\]]*\]\s*/, '').trim());
    result.decisions.push(...lines);
  } catch {
    // 文件不存在
  }

  try {
    const factsPath = join(storagePath, 'long_term', 'facts.md');
    const content = await readFile(factsPath, 'utf-8');
    const lines = content.split('\n')
      .filter(line => line.startsWith('- '))
      .map(line => line.replace(/^- \[\d{4}-\d{2}-\d{2}[^\]]*\]\s*/, '').trim());
    result.facts.push(...lines);
  } catch {
    // 文件不存在
  }

  // 读取 profile.md
  try {
    const profilePath = join(storagePath, 'long_term', 'profile.md');
    const content = await readFile(profilePath, 'utf-8');
    const lines = content.split('\n')
      .filter(line => line.startsWith('- '))
      .map(line => line.replace(/^- \[\d{4}-\d{2}-\d{2}[^\]]*\]\s*/, '').trim());
    result.profile.push(...lines);
  } catch {
    // 文件不存在
  }

  return result;
}

/**
 * 提取关键词
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    // 中文停用词
    '的', '了', '是', '在', '和', '与', '或', '到', '从', '为', '以', '被', '把', '对', '等',
    '这', '那', '个', '些', '之', '于', '而', '但', '如', '果', '所', '以', '因', '为',
    '我', '你', '他', '她', '它', '我们', '你们', '他们', '这个', '那个',
    // 英文停用词
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'from', 'with', 'for', 'of', 'in', 'on', 'at',
    'and', 'or', 'but', 'if', 'then', 'else', 'when', 'where', 'how', 'what', 'which', 'who',
    'this', 'that', 'these', 'those', 'it', 'its', 'be', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can',
  ]);

  return text
    .toLowerCase()
    .split(/[\s,，。.!！?？;；:：、\-_/\\()（）\[\]【】{}]+/)
    .filter(word => word.length > 1 && !stopWords.has(word))
    .slice(0, 15);
}

/**
 * 计算文本相似度（Jaccard 相似度）
 */
function calculateSimilarity(text1: string, text2: string): number {
  const keywords1 = new Set(extractKeywords(text1));
  const keywords2 = new Set(extractKeywords(text2));

  if (keywords1.size === 0 || keywords2.size === 0) return 0;

  const intersection = [...keywords1].filter(k => keywords2.has(k)).length;
  const union = new Set([...keywords1, ...keywords2]).size;

  return intersection / union;
}
