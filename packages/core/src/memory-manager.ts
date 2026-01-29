/**
 * Memory Manager - Core memory management functionality
 */

import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type {
  Conversation,
  ConversationContext,
  MemoryConfig,
  SearchOptions,
  SearchResult,
  SessionContext,
  MemoryCategory,
  LongTermMemoryEntry,
} from './types.js';
import { loadConfig, getDailyLogPath, formatTimestamp, formatDate } from './config.js';
import { LocalFileStorage, initializeStorage } from './storage.js';
import { SearchEngine, searchLongTermMemory } from './search.js';

/**
 * 记忆管理器
 *
 * 负责：
 * - 记录对话
 * - 搜索记忆
 * - 管理长期记忆
 * - 获取会话上下文
 */
export class MemoryManager {
  private config: MemoryConfig;
  private storage: LocalFileStorage;
  private searchEngine: SearchEngine;
  private initialized: boolean = false;

  constructor(customConfig?: Partial<MemoryConfig>) {
    this.config = loadConfig(customConfig);
    this.storage = new LocalFileStorage();
    this.searchEngine = new SearchEngine(this.config);
  }

  /**
   * 初始化记忆系统
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await initializeStorage(this.config.storagePath);
    this.initialized = true;
  }

  /**
   * 记录对话
   */
  async recordConversation(
    userMessage: string,
    aiResponse: string,
    context: Partial<ConversationContext> = {}
  ): Promise<Conversation> {
    await this.initialize();

    const fullContext: ConversationContext = {
      timestamp: new Date(),
      sessionId: context.sessionId || randomUUID(),
      project: context.project,
      client: context.client,
      workingDirectory: context.workingDirectory,
      ...context,
    };

    const conversation: Conversation = {
      id: randomUUID(),
      userMessage,
      aiResponse,
      context: fullContext,
    };

    // 写入每日日志
    await this.appendToDailyLog(conversation);

    // TODO: 建立索引（Phase 2）

    return conversation;
  }

  /**
   * 追加到每日日志
   */
  private async appendToDailyLog(conversation: Conversation): Promise<void> {
    const logPath = getDailyLogPath(this.config, conversation.context.timestamp);

    const entry = this.formatConversationEntry(conversation);
    await this.storage.append(logPath, entry);
  }

  /**
   * 格式化对话条目
   */
  private formatConversationEntry(conversation: Conversation): string {
    const { userMessage, aiResponse, context } = conversation;
    const timestamp = formatTimestamp(context.timestamp);

    let entry = `\n## ${timestamp}\n\n`;

    if (context.project) {
      entry += `**Project:** ${context.project}\n`;
    }
    if (context.client) {
      entry += `**Client:** ${context.client}\n`;
    }
    entry += `**Session:** ${context.sessionId}\n\n`;

    entry += `**User:** ${userMessage}\n\n`;
    entry += `**AI:** ${aiResponse}\n\n`;
    entry += `---\n`;

    return entry;
  }

  /**
   * 搜索记忆
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    await this.initialize();
    return this.searchEngine.search(query, options);
  }

  /**
   * 获取会话上下文
   */
  async getSessionContext(options: {
    includeRecentDays?: number;
    includeLongTerm?: boolean;
    project?: string;
  } = {}): Promise<SessionContext> {
    await this.initialize();

    const {
      includeRecentDays = 2,
      includeLongTerm = true,
      project,
    } = options;

    // 获取最近几天的对话
    const recentConversations = await this.getRecentConversations(
      includeRecentDays,
      project
    );

    // 获取长期记忆
    let longTermMemory: string | undefined;
    if (includeLongTerm) {
      const memoryPath = join(this.config.storagePath, 'long_term', 'MEMORY.md');
      const content = await this.storage.read(memoryPath);
      if (content) {
        longTermMemory = content;
      }
    }

    // 获取项目状态
    let projectState: string | undefined;
    if (project) {
      const projectPath = join(
        this.config.storagePath,
        'projects',
        project,
        'state.md'
      );
      const content = await this.storage.read(projectPath);
      if (content) {
        projectState = content;
      }
    }

    return {
      recentConversations,
      longTermMemory,
      projectState,
    };
  }

  /**
   * 获取最近的对话
   */
  private async getRecentConversations(
    days: number,
    project?: string
  ): Promise<Conversation[]> {
    const conversations: Conversation[] = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      const logPath = getDailyLogPath(this.config, date);
      const content = await this.storage.read(logPath);

      if (content) {
        const parsed = this.parseDailyLog(content, date, project);
        conversations.push(...parsed);
      }
    }

    return conversations;
  }

  /**
   * 解析每日日志
   */
  private parseDailyLog(
    content: string,
    date: Date,
    projectFilter?: string
  ): Conversation[] {
    const conversations: Conversation[] = [];
    const blocks = content.split(/^---$/m);

    for (const block of blocks) {
      if (!block.trim()) continue;

      // 提取时间戳
      const timestampMatch = block.match(/## (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
      const timestamp = timestampMatch ? new Date(timestampMatch[1]) : date;

      // 提取项目
      const projectMatch = block.match(/\*\*Project:\*\* (.+)/);
      const project = projectMatch ? projectMatch[1].trim() : undefined;

      // 项目过滤
      if (projectFilter && project !== projectFilter) {
        continue;
      }

      // 提取客户端
      const clientMatch = block.match(/\*\*Client:\*\* (.+)/);
      const client = clientMatch ? clientMatch[1].trim() : undefined;

      // 提取会话 ID
      const sessionMatch = block.match(/\*\*Session:\*\* (.+)/);
      const sessionId = sessionMatch ? sessionMatch[1].trim() : randomUUID();

      // 提取用户消息和 AI 响应
      const userMatch = block.match(/\*\*User:\*\* ([\s\S]*?)(?=\*\*AI:\*\*)/);
      const aiMatch = block.match(/\*\*AI:\*\* ([\s\S]*?)$/);

      if (userMatch && aiMatch) {
        conversations.push({
          id: randomUUID(),
          userMessage: userMatch[1].trim(),
          aiResponse: aiMatch[1].trim(),
          context: {
            timestamp,
            sessionId,
            project,
            client,
          },
        });
      }
    }

    return conversations;
  }

  /**
   * 更新长期记忆
   */
  async updateLongTermMemory(
    category: MemoryCategory,
    content: string
  ): Promise<void> {
    await this.initialize();

    const categoryPath = join(
      this.config.storagePath,
      'long_term',
      `${category}.md`
    );

    const timestamp = formatTimestamp(new Date());
    const entry = `\n- [${timestamp}] ${content}\n`;

    await this.storage.append(categoryPath, entry);

    // 同时更新主记忆文件
    const memoryPath = join(this.config.storagePath, 'long_term', 'MEMORY.md');
    const memoryContent = await this.storage.read(memoryPath);

    // 找到对应分类并追加
    const categoryHeaders: Record<MemoryCategory, string> = {
      decisions: '## Important Decisions',
      preferences: '## User Preferences',
      contacts: '## Key Contacts',
      facts: '## Key Facts',
      profile: '## User Profile',
    };

    const header = categoryHeaders[category];
    if (memoryContent.includes(header)) {
      const updated = memoryContent.replace(
        header,
        `${header}\n\n- [${timestamp}] ${content}`
      );
      await this.storage.write(memoryPath, updated);
    }
  }

  /**
   * 获取配置
   */
  getConfig(): MemoryConfig {
    return { ...this.config };
  }

  /**
   * 获取存储路径
   */
  getStoragePath(): string {
    return this.config.storagePath;
  }
}

/**
 * 创建默认的记忆管理器实例
 */
export function createMemoryManager(
  customConfig?: Partial<MemoryConfig>
): MemoryManager {
  return new MemoryManager(customConfig);
}
