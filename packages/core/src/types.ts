/**
 * Core type definitions for Universal Memory MCP
 */

/**
 * 对话上下文
 */
export interface ConversationContext {
  /** 时间戳 */
  timestamp: Date
  /** 项目名称（可选） */
  project?: string
  /** 来源客户端（可选），如 claude-code / opencode / trae */
  client?: string
  /** 会话 ID */
  sessionId: string
  /** 工作目录 */
  workingDirectory?: string
}

/**
 * 对话记录
 */
export interface Conversation {
  /** 唯一 ID */
  id: string
  /** 用户消息 */
  userMessage: string
  /** AI 响应 */
  aiResponse: string
  /** 上下文 */
  context: ConversationContext
}

/**
 * 搜索选项
 */
export interface SearchOptions {
  /** 时间范围 */
  timeRange?: [Date, Date]
  /** 项目过滤 */
  project?: string
  /** 客户端过滤 */
  client?: string
  /** 返回数量限制 */
  limit?: number
  /** 最低相关性分数 */
  minScore?: number
  /** 搜索模式 */
  mode?: 'semantic' | 'keyword' | 'hybrid'
  /** 是否包含归档记忆（默认：false） */
  includeArchive?: boolean
}

/**
 * 搜索结果
 */
export interface SearchResult {
  /** 内容 */
  content: string
  /** 相关性分数 */
  score: number
  /** 时间戳 */
  timestamp: Date
  /** 项目 */
  project?: string
  /** 来源文件 */
  sourcePath: string
  /** 行号范围 */
  lineRange?: [number, number]
}

/**
 * 会话上下文
 */
export interface SessionContext {
  /** 最近对话 */
  recentConversations: Conversation[]
  /** 长期记忆 */
  longTermMemory?: string
  /** 项目状态 */
  projectState?: string
}

/**
 * 记忆分类
 */
export type MemoryCategory = 'decisions' | 'preferences' | 'contacts' | 'facts' | 'profile'

/**
 * 长期记忆条目
 */
export interface LongTermMemoryEntry {
  /** 分类 */
  category: MemoryCategory
  /** 内容 */
  content: string
  /** 创建时间 */
  createdAt: Date
  /** 来源对话 ID */
  sourceConversationId?: string
}

/**
 * 索引项
 */
export interface IndexItem {
  /** 内容 */
  content: string
  /** 向量 embedding */
  embedding?: number[]
  /** 元数据 */
  metadata: {
    timestamp: Date
    project?: string
    sessionId: string
    filePath: string
    lineStart?: number
    lineEnd?: number
  }
}

/**
 * 配置选项
 */
export interface MemoryConfig {
  /** 存储路径 */
  storagePath: string
  /** 每日日志保留天数 */
  dailyRetentionDays: number
  /** 自动清理 */
  autoCleanup: boolean
  /** Embedding 提供者 */
  embeddingProvider: 'openai' | 'local' | 'gemini' | 'none'
  /** Embedding 模型 */
  embeddingModel?: string
  /** Embedding 维度 */
  embeddingDimensions: number
  /** 语义搜索权重 */
  semanticWeight: number
  /** 关键词搜索权重 */
  keywordWeight: number
  /** 默认返回数量 */
  defaultLimit: number
  /** 最低分数阈值 */
  minScore: number
  /** 是否启用整理 */
  consolidationEnabled: boolean
  /** 整理计划 */
  consolidationSchedule: 'daily' | 'weekly' | 'manual'
  /** 项目标记文件 */
  projectMarkers: string[]
}

/**
 * Embedding 提供者接口
 */
export interface EmbeddingProvider {
  /** 提供者名称 */
  name: string
  /** 向量维度 */
  dimensions: number
  /** 生成单个文本的 embedding */
  generate(text: string): Promise<number[]>
  /** 批量生成 embedding */
  generateBatch(texts: string[]): Promise<number[][]>
}

/**
 * Storage backend interface
 */
export interface StorageBackend {
  /** Read file */
  read(path: string): Promise<string>
  /** Write file */
  write(path: string, content: string): Promise<void>
  /** Append content */
  append(path: string, content: string): Promise<void>
  /** List files in directory */
  list(dirPath: string, extension?: string): Promise<string[]>
  /** Delete file */
  delete(path: string): Promise<void>
  /** Check if file exists */
  exists(path: string): Promise<boolean>
}
