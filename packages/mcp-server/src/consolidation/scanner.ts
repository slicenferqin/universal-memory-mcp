/**
 * Scanner - 扫描 daily 日志，提取未整理的对话
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

export interface Conversation {
  id: string;
  timestamp: Date;
  project?: string;
  client?: string;
  sessionId: string;
  userMessage: string;
  aiResponse: string;
  consolidated: boolean;
}

export interface ScanOptions {
  days: number;
  force?: boolean;
}

export interface ScanResult {
  conversations: Conversation[];
  totalScanned: number;
  skipped: number;
}

/**
 * 扫描 daily 日志，提取未整理的对话
 */
export async function scanDailyLogs(
  storagePath: string,
  options: ScanOptions
): Promise<ScanResult> {
  const dailyDir = join(storagePath, 'daily');
  const consolidatedPath = join(storagePath, '.consolidated.json');

  // 1. 获取已整理的对话 ID
  const consolidated = await loadConsolidatedIds(consolidatedPath);

  // 2. 计算日期范围
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - options.days);

  // 3. 扫描日志文件
  let files: string[];
  try {
    files = await readdir(dailyDir);
  } catch {
    return { conversations: [], totalScanned: 0, skipped: 0 };
  }

  const conversations: Conversation[] = [];
  let totalScanned = 0;
  let skipped = 0;

  for (const file of files) {
    if (!file.endsWith('.md')) continue;

    // 检查日期范围
    const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})\.md$/);
    if (!dateMatch) continue;

    const fileDate = new Date(dateMatch[1]);
    if (fileDate < startDate || fileDate > endDate) continue;

    // 解析文件内容
    const filePath = join(dailyDir, file);
    try {
      const content = await readFile(filePath, 'utf-8');
      const parsed = parseConversations(content, file);

      for (const conv of parsed) {
        totalScanned++;

        // 检查是否已整理
        if (!options.force && consolidated.has(conv.id)) {
          skipped++;
          conv.consolidated = true;
        } else {
          conv.consolidated = false;
          conversations.push(conv);
        }
      }
    } catch {
      // 跳过无法读取的文件
      continue;
    }
  }

  return { conversations, totalScanned, skipped };
}

/**
 * 解析 markdown 文件中的对话
 */
function parseConversations(content: string, fileName: string): Conversation[] {
  const conversations: Conversation[] = [];
  const blocks = content.split(/^---$/m);

  for (const block of blocks) {
    if (!block.trim()) continue;

    // 提取时间戳
    const timestampMatch = block.match(/## (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
    if (!timestampMatch) continue;

    const timestamp = new Date(timestampMatch[1].replace(' ', 'T'));

    // 提取项目
    const projectMatch = block.match(/\*\*Project:\*\* (.+)/);
    const project = projectMatch ? projectMatch[1].trim() : undefined;

    // 提取客户端
    const clientMatch = block.match(/\*\*Client:\*\* (.+)/);
    const client = clientMatch ? clientMatch[1].trim() : undefined;

    // 提取会话 ID
    const sessionMatch = block.match(/\*\*Session:\*\* (.+)/);
    const sessionId = sessionMatch ? sessionMatch[1].trim() : '';

    // 提取用户消息和 AI 回复
    const userMatch = block.match(/\*\*User:\*\* ([\s\S]*?)(?=\n\n\*\*AI:\*\*|$)/);
    const aiMatch = block.match(/\*\*AI:\*\* ([\s\S]*?)$/);

    const userMessage = userMatch ? userMatch[1].trim() : '';
    const aiResponse = aiMatch ? aiMatch[1].trim() : '';

    if (!userMessage || !aiResponse) continue;

    // 生成唯一 ID
    const id = `${fileName}-${timestamp.getTime()}-${sessionId.substring(0, 8)}`;

    conversations.push({
      id,
      timestamp,
      project,
      client,
      sessionId,
      userMessage,
      aiResponse,
      consolidated: false,
    });
  }

  return conversations;
}

/**
 * 加载已整理的对话 ID
 */
async function loadConsolidatedIds(path: string): Promise<Set<string>> {
  try {
    const content = await readFile(path, 'utf-8');
    const data = JSON.parse(content);
    return new Set(data.processedIds || []);
  } catch {
    return new Set();
  }
}
