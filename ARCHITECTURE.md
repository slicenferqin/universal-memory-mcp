# Architecture

## Overview

Universal Memory MCP 是一个通用的 AI 记忆系统，通过 MCP 协议为任何 AI CLI 工具提供长期记忆能力。

## Design Principles

### 1. 透明胜过黑盒

所有记忆都是纯 Markdown 文件，用户可以：
- 直接读取和编辑
- 使用 Git 进行版本控制
- 轻松备份和迁移

### 2. 搜索胜过注入

不把所有记忆塞进上下文，而是：
- 按需搜索相关记忆
- 只返回最相关的片段
- 保持上下文窗口高效

### 3. 自动胜过手动

- 对话自动记录，无需 AI 主动调用
- 索引自动建立，实时更新
- 用户无感知，体验流畅

### 4. 用户级而非项目级

- 记忆存储在用户目录（~/.ai_memory/）
- 跨项目共享记忆
- 成为真正的"个人大管家"

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        AI CLI Tools                              │
│         (Claude Code / OpenCode / Gemini CLI / ...)             │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              │ MCP Protocol
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Universal Memory MCP Server                   │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Recorder   │  │   Searcher   │  │  Consolidator│          │
│  │              │  │              │  │              │          │
│  │ - Intercept  │  │ - Vector     │  │ - Extract    │          │
│  │ - Parse      │  │ - BM25       │  │ - Summarize  │          │
│  │ - Store      │  │ - Hybrid     │  │ - Organize   │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         └─────────────────┼─────────────────┘                   │
│                           │                                      │
│  ┌────────────────────────┴────────────────────────────────┐    │
│  │                   Memory Manager                         │    │
│  │                                                          │    │
│  │  - Daily Log Management                                  │    │
│  │  - Long-term Memory Management                           │    │
│  │  - Project Memory Management                             │    │
│  │  - Index Management                                      │    │
│  └────────────────────────┬────────────────────────────────┘    │
│                           │                                      │
└───────────────────────────┼──────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Storage Layer                                 │
│                                                                  │
│  ~/.ai_memory/                                                   │
│  ├── daily/                 # Daily conversation logs            │
│  │   ├── 2026-01-27.md                                          │
│  │   └── ...                                                     │
│  ├── long_term/             # Long-term memory                   │
│  │   ├── MEMORY.md          # Main memory file                   │
│  │   ├── decisions.md       # Important decisions                │
│  │   └── preferences.md     # User preferences                   │
│  ├── projects/              # Project-level memory               │
│  │   └── <project-name>/                                        │
│  │       ├── goals.md                                           │
│  │       └── state.md                                           │
│  └── index.db               # SQLite vector index                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Memory Manager

负责所有记忆的生命周期管理。

```typescript
interface MemoryManager {
  // 记录对话
  recordConversation(
    userMessage: string,
    aiResponse: string,
    context: ConversationContext
  ): Promise<void>;

  // 搜索记忆
  search(
    query: string,
    options: SearchOptions
  ): Promise<SearchResult[]>;

  // 获取会话上下文
  getSessionContext(
    options: SessionContextOptions
  ): Promise<SessionContext>;

  // 更新长期记忆
  updateLongTermMemory(
    category: MemoryCategory,
    content: string
  ): Promise<void>;
}
```

### 2. Index Database

使用 SQLite + sqlite-vec 实现向量索引和全文搜索。

```typescript
interface IndexDatabase {
  // 插入记录
  insert(item: IndexItem): Promise<void>;

  // 向量搜索
  vectorSearch(
    embedding: number[],
    topK: number
  ): Promise<SearchResult[]>;

  // BM25 搜索
  bm25Search(
    query: string,
    topK: number
  ): Promise<SearchResult[]>;

  // 混合搜索
  hybridSearch(
    query: string,
    embedding: number[],
    weights: [number, number]
  ): Promise<SearchResult[]>;
}
```

### 3. MCP Server

实现 MCP 协议，暴露工具给 AI CLI。

```typescript
interface MCPServer {
  // 工具定义
  tools: {
    search_memory: Tool;
    get_session_context: Tool;
    update_long_term_memory: Tool;
  };

  // 处理工具调用
  handleToolCall(
    tool: string,
    args: unknown
  ): Promise<unknown>;
}
```

## Data Flow

### Recording Flow

```
User Input
    ↓
AI CLI sends request
    ↓
MCP Server intercepts
    ↓
┌───────────────────────────────────────┐
│  Recorder                              │
│  1. Parse user message and AI response │
│  2. Extract metadata (project, time)   │
│  3. Append to daily log                │
│  4. Generate embedding                 │
│  5. Insert into index                  │
└───────────────────────────────────────┘
    ↓
Response returned to AI CLI
```

### Search Flow

```
AI needs to recall
    ↓
Calls search_memory tool
    ↓
┌───────────────────────────────────────┐
│  Searcher                              │
│  1. Parse query                        │
│  2. Generate query embedding           │
│  3. Vector search (semantic)           │
│  4. BM25 search (keyword)              │
│  5. Merge and rank results             │
│  6. Return top K                       │
└───────────────────────────────────────┘
    ↓
Results returned to AI
    ↓
AI uses results to respond
```

### Consolidation Flow

```
Triggered periodically (e.g., weekly)
    ↓
┌───────────────────────────────────────┐
│  Consolidator                          │
│  1. Read recent daily logs             │
│  2. Extract important information      │
│     - Decisions                        │
│     - Preferences                      │
│     - Key facts                        │
│  3. Update long-term memory            │
│  4. Optionally summarize old logs      │
└───────────────────────────────────────┘
```

## Database Schema

### SQLite Tables

```sql
-- 记忆索引表
CREATE TABLE memory_index (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  timestamp DATETIME NOT NULL,
  project TEXT,
  session_id TEXT,
  file_path TEXT NOT NULL,
  line_start INTEGER,
  line_end INTEGER,
  hash TEXT UNIQUE
);

-- 向量表 (sqlite-vec)
CREATE VIRTUAL TABLE memory_vec USING vec0(
  id INTEGER PRIMARY KEY,
  embedding FLOAT[1536]  -- 维度取决于 embedding 模型
);

-- 全文搜索表 (FTS5)
CREATE VIRTUAL TABLE memory_fts USING fts5(
  content,
  content='memory_index',
  content_rowid='id'
);

-- Embedding 缓存表
CREATE TABLE embedding_cache (
  hash TEXT PRIMARY KEY,
  embedding BLOB,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Configuration

### Config File (~/.ai_memory/config.json)

```json
{
  "version": "1.0.0",

  "storage": {
    "path": "~/.ai_memory",
    "daily_retention_days": 365,
    "auto_cleanup": true
  },

  "embedding": {
    "provider": "openai",
    "model": "text-embedding-3-small",
    "dimensions": 1536
  },

  "search": {
    "semantic_weight": 0.7,
    "keyword_weight": 0.3,
    "default_limit": 10,
    "min_score": 0.5
  },

  "consolidation": {
    "enabled": true,
    "schedule": "weekly",
    "auto_summarize_after_days": 30
  },

  "projects": {
    "auto_detect": true,
    "markers": [".git", "package.json", "Cargo.toml"]
  }
}
```

## Security Considerations

### Data Privacy

1. **本地存储**：所有数据存储在用户本地，不上传云端
2. **用户控制**：用户可以随时删除、编辑任何记忆
3. **透明格式**：Markdown 文件，用户可以直接查看

### Embedding Privacy

1. **可选本地模型**：支持本地 embedding 模型（如 ollama）
2. **缓存 embedding**：减少 API 调用次数
3. **敏感内容过滤**：可配置不索引某些内容

## Performance Considerations

### Indexing

1. **增量索引**：每次对话后立即建立索引
2. **异步执行**：不阻塞主流程
3. **批量重建**：定期优化索引

### Search

1. **缓存热门查询**：TTL 1 小时
2. **限制返回数量**：默认 top 10
3. **并行搜索**：向量和关键词搜索并行执行

### Storage

1. **文件分片**：每日一个文件，避免单文件过大
2. **定期清理**：可配置保留天数
3. **压缩旧文件**：可选 gzip 压缩

## Extension Points

### Custom Embedding Provider

```typescript
interface EmbeddingProvider {
  name: string;
  dimensions: number;
  generate(text: string): Promise<number[]>;
  generateBatch(texts: string[]): Promise<number[][]>;
}
```

### Custom Storage Backend

```typescript
interface StorageBackend {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  append(path: string, content: string): Promise<void>;
  list(pattern: string): Promise<string[]>;
  delete(path: string): Promise<void>;
}
```

### Custom Consolidator

```typescript
interface Consolidator {
  extract(conversations: Conversation[]): Promise<ExtractedInfo[]>;
  summarize(conversations: Conversation[]): Promise<string>;
}
```

## Future Considerations

### Multi-device Sync

- 可选的云同步（用户自己的云存储）
- 冲突解决策略
- 增量同步

### Multi-modal Memory

- 图片记忆（截图、草图）
- 音频记忆（语音对话）
- 文件记忆（附件、文档）

### Collaborative Memory

- 团队共享记忆
- 权限控制
- 记忆继承
