/**
 * Updater - 更新长期记忆文件
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { ExtractedInfo } from './extractor.js';
import type { DeduplicationResult } from './deduplicator.js';

/**
 * 更新长期记忆文件
 */
export async function updateLongTermMemory(
  storagePath: string,
  deduplicated: DeduplicationResult,
  processedIds: string[]
): Promise<void> {
  const longTermDir = join(storagePath, 'long_term');

  // 确保目录存在
  await mkdir(longTermDir, { recursive: true });

  // 1. 更新 MEMORY.md
  await updateMemoryFile(
    join(longTermDir, 'MEMORY.md'),
    deduplicated
  );

  // 2. 更新分类文件
  if (deduplicated.decisions.length > 0) {
    await updateCategoryFile(
      join(longTermDir, 'decisions.md'),
      'Important Decisions',
      deduplicated.decisions
    );
  }

  if (deduplicated.facts.length > 0) {
    await updateCategoryFile(
      join(longTermDir, 'facts.md'),
      'Key Facts',
      deduplicated.facts
    );
  }

  // 3. 更新用户画像文件
  if (deduplicated.profile.length > 0) {
    await updateCategoryFile(
      join(longTermDir, 'profile.md'),
      'User Profile',
      deduplicated.profile
    );
  }

  // 4. 更新已处理记录
  await updateConsolidatedRecord(
    join(storagePath, '.consolidated.json'),
    processedIds
  );
}

/**
 * 更新主记忆文件
 */
async function updateMemoryFile(
  filePath: string,
  deduplicated: DeduplicationResult
): Promise<void> {
  let content: string;

  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    // 创建新文件
    content = `# Long-term Memory

This file contains important information extracted from conversations.

## User Profile

_No profile recorded yet._

## User Preferences

_No preferences recorded yet._

## Important Decisions

_No decisions recorded yet._

## Key Facts

_No facts recorded yet._
`;
  }

  // 添加新的用户画像
  if (deduplicated.profile.length > 0) {
    content = insertEntries(
      content,
      '## User Profile',
      deduplicated.profile
    );
  }

  // 添加新的偏好
  if (deduplicated.preferences.length > 0) {
    content = insertEntries(
      content,
      '## User Preferences',
      deduplicated.preferences
    );
  }

  // 添加新的决策
  if (deduplicated.decisions.length > 0) {
    content = insertEntries(
      content,
      '## Important Decisions',
      deduplicated.decisions
    );
  }

  // 添加新的事实
  if (deduplicated.facts.length > 0) {
    content = insertEntries(
      content,
      '## Key Facts',
      deduplicated.facts
    );
  }

  await writeFile(filePath, content, 'utf-8');
}

/**
 * 在指定部分插入新条目
 */
function insertEntries(
  content: string,
  sectionHeader: string,
  entries: ExtractedInfo[]
): string {
  const sectionRegex = new RegExp(
    `(${escapeRegex(sectionHeader)}\n\n?)([\\s\\S]*?)(?=\n## |$)`,
    'm'
  );

  const match = content.match(sectionRegex);

  if (!match) {
    // 部分不存在，添加到末尾
    const newSection = `\n${sectionHeader}\n\n${formatEntries(entries)}\n`;
    return content + newSection;
  }

  const [fullMatch, header, existingContent] = match;

  // 移除 "_No xxx recorded yet._" 占位符
  let cleanedContent = existingContent
    .replace(/_No \w+ recorded yet\._\n*/g, '')
    .trim();

  // 添加新条目（新条目在前）
  const newEntries = formatEntries(entries);
  const updatedContent = newEntries + (cleanedContent ? '\n\n' + cleanedContent : '');

  return content.replace(fullMatch, `${header}\n${updatedContent}\n\n`);
}

/**
 * 格式化条目为 markdown
 */
function formatEntries(entries: ExtractedInfo[]): string {
  return entries
    .map(entry => {
      const dateStr = formatDate(entry.timestamp);
      return `- [${dateStr}] ${entry.content}`;
    })
    .join('\n');
}

/**
 * 格式化日期
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

/**
 * 更新分类文件
 */
async function updateCategoryFile(
  filePath: string,
  title: string,
  entries: ExtractedInfo[]
): Promise<void> {
  if (entries.length === 0) return;

  let content: string;

  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    content = `# ${title}\n\n`;
  }

  // 移除占位符
  content = content.replace(/_No \w+ recorded yet\._\n*/g, '');

  // 找到标题行后插入新条目
  const lines = content.split('\n');
  let insertIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('# ')) {
      insertIndex = i + 1;
      // 跳过空行
      while (insertIndex < lines.length && lines[insertIndex].trim() === '') {
        insertIndex++;
      }
      break;
    }
  }

  // 插入新条目
  const newEntries = formatEntries(entries).split('\n');
  lines.splice(insertIndex, 0, ...newEntries, '');

  await writeFile(filePath, lines.join('\n'), 'utf-8');
}

/**
 * 更新已处理记录
 */
async function updateConsolidatedRecord(
  filePath: string,
  newIds: string[]
): Promise<void> {
  let data: { processedIds: string[]; lastRun: string };

  try {
    const content = await readFile(filePath, 'utf-8');
    data = JSON.parse(content);
  } catch {
    data = { processedIds: [], lastRun: '' };
  }

  // 添加新的 ID（保留最近 2000 个）
  const allIds = [...new Set([...newIds, ...data.processedIds])];
  data.processedIds = allIds.slice(0, 2000);
  data.lastRun = new Date().toISOString();

  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
