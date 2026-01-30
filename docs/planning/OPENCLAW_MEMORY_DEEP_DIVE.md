# OpenClaw Memory System 深度剖析

> **面向生产环境的个人AI记忆系统 - 从设计思想到工程实践**

**版本**: 2026.1.29
**作者**: 基于开源代码分析
**目标**: 指导 universal-memory-mcp v0.5.x/v1.0.0 迭代

---

## 📋 目录

1. [设计思想](#设计思想)
2. [架构设计](#架构设计)
3. [数据流与编排](#数据流与编排)
4. [核心实现深度剖析](#核心实现深度剖析)
5. [性能优化策略](#性能优化策略)
6. [设计决策分析](#设计决策分析)
7. [与 universal-memory-mcp 对比](#与-universal-memory-mcp-对比)
8. [可借鉴的设计模式](#可借鉴的设计模式)
9. [改进建议](#改进建议)

---

## 1. 设计思想

### 1.1 核心理念：Plain Markdown as Source of Truth

**哲学**：

> "The files are the source of truth; the model only 'remembers' what gets written to disk."

**三个关键原则**：

#### 1.1.1 透明性 (Transparency)

```
用户可读的 Markdown  ←  →  机器可读的 Embedding
     ↓                        ↓
  直接编辑               自动索引
  随时检查               语义搜索
```

**优势**：

- 用户可以直接查看、编辑记忆内容
- 不依赖黑盒，数据完全可控
- 可以用任何文本工具处理

#### 1.1.2 简洁性 (Simplicity)

```markdown
~/.openclaw/workspace/
├── MEMORY.md # 长期记忆
└── memory/
└── 2026-01-30.md # 每日日志
```

**为什么这样设计**：

- ✅ 不需要复杂的数据库schema
- ✅ 可以用git版本控制
- ✅ 容易迁移和备份
- ✅ 多工具兼容

#### 1.1.3 持久化优先 (Persistence-First)

```
RAM (易失)              Disk (持久)
   ↓                      ↓
 临时思考          →      写入记忆
 Session数据      →      归档到文件
```

**设计原则**：

> "If someone says 'remember this,' write it down (do not keep it in RAM)."

---

### 1.2 问题域分析

**1.2.1 记忆的三个维度**

| 维度         | 问题                 | OpenClaw方案               |
| ------------ | -------------------- | -------------------------- |
| **时效性**   | 短期vs长期           | 双层：每日日志 + MEMORY.md |
| **结构化**   | 自然语言vs结构化数据 | Markdown + 标题层次        |
| **访问模式** | 浏览vs搜索           | 文件浏览 + 语义搜索        |

**1.2.2 搜索的两难困境**

```
问题：如何同时满足"语义理解"和"精确匹配"？

┌─────────────────────────────────────────┐
│ 查询："Mac Studio gateway host"        │
├─────────────────────────────────────────┤
│ 向量搜索: "运行gateway的机器" ✅         │
│           但找不到ID "a828e60" ❌         │
│                                         │
│ BM25搜索: 找到ID "a828e60" ✅           │
│           但理解不了同义词 ❌             │
└─────────────────────────────────────────┘

解决方案：混合搜索（Hybrid Search）
```

---

### 1.3 设计目标

**1.3.1 功能目标**

- ✅ 语义搜索：理解自然语言查询
- ✅ 关键词搜索：精确匹配ID、代码符号
- ✅ 自动索引：文件变化自动更新
- ✅ 低延迟：搜索不影响响应速度

**1.3.2 非功能目标**

- ⚡ 性能：大规模数据下的快速检索
- 🔒 隐离：Per-agent 数据隔离
- 🛡️ 容错：Provider失败时的fallback
- 📈 可扩展：支持新的embedding provider

---

## 2. 架构设计

### 2.1 分层架构

```
┌─────────────────────────────────────────────────┐
│               User Interface                    │
│  (AI Assistant / CLI Tools / Plugins)          │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│             Memory Tools Layer                  │
│  ┌──────────────┐      ┌──────────────┐        │
│  │memory_search │      │ memory_get   │        │
│  └──────────────┘      └──────────────┘        │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│          MemoryManager (Orchestrator)           │
│  • Sync management     • Search orchestration   │
│  • Cache coordination   • Provider selection    │
└──┬──────────────┬──────────────┬───────────────┘
   │              │              │
┌──▼──────────┐ ┌▼───────────┐ ┌▼──────────────┐
│  Vector     │ │   FTS5     │ │  Embedding    │
│  Search     │ │  (BM25)    │ │  Provider     │
└──┬──────────┘ └────────────┘ └──┬─────────────┘
   │                                │
┌──▼────────────────────────────────▼───────────┐
│            Storage Layer (SQLite)              │
│  • chunks (向量)   • chunks_fts (全文)        │
│  • files (元数据)  • embedding_cache          │
└──┬─────────────────────────────────────────────┘
   │
┌──▼─────────────────────────────────────────────┐
│         File System (Markdown)                  │
│  MEMORY.md  +  memory/YYYY-MM-DD.md            │
└─────────────────────────────────────────────────┘
```

---

### 2.2 核心组件

#### 2.2.1 MemoryManager (75KB)

**职责**：

- 🔁 索引同步协调
- 🔍 搜索编排
- 💾 缓存管理
- 🔄 Provider选择与fallback

**单例模式**：

```typescript
// Per-agent singleton cache
private static INDEX_CACHE = new Map<string, MemoryManager>();

static async create(params: { ... }): Promise<MemoryManager> {
  const key = buildCacheKey(cfg, agentId, workspaceDir);
  const cached = INDEX_CACHE.get(key);
  if (cached) return cached;

  const manager = new MemoryManager(params);
  INDEX_CACHE.set(key, manager);
  return manager;
}
```

#### 2.2.2 EmbeddingProvider

**策略模式**：支持多种embedding后端

```
                    EmbeddingProvider (interface)
                            ↑
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   OpenAIProvider    GeminiProvider      LocalProvider
   (远程API)         (免费API)         (node-llama-cpp)
```

**自动选择逻辑**：

```typescript
1. Local:    if local.modelPath exists
2. OpenAI:   if OpenAI key resolvable
3. Gemini:   if Gemini key resolvable
4. Disabled: until configured
```

---

### 2.3 数据模型

#### 2.3.1 数据库Schema

**files表**（文件元数据）：

```sql
CREATE TABLE files (
  path TEXT PRIMARY KEY,        -- 文件路径
  source TEXT NOT NULL,         -- memory/sessions
  hash TEXT NOT NULL,           -- SHA-256
  mtime INTEGER NOT NULL,       -- 修改时间
  size INTEGER NOT NULL         -- 文件大小
);
```

**chunks表**（向量索引）：

```sql
CREATE TABLE chunks (
  id TEXT PRIMARY KEY,          -- UUID
  path TEXT NOT NULL,           -- 所属文件
  source TEXT NOT NULL,         -- memory/sessions
  start_line INTEGER NOT NULL,  -- 起始行
  end_line INTEGER NOT NULL,    -- 结束行
  hash TEXT NOT NULL,           -- 内容hash
  model TEXT NOT NULL,          -- embedding模型
  text TEXT NOT NULL,           -- 原文
  embedding TEXT NOT NULL,      -- JSON数组
  updated_at INTEGER NOT NULL   -- 更新时间
);
```

**embedding_cache表**（缓存）：

```sql
CREATE TABLE embedding_cache (
  provider TEXT NOT NULL,       -- openai/gemini/local
  model TEXT NOT NULL,          -- 模型名称
  provider_key TEXT NOT NULL,   -- endpoint指纹
  hash TEXT NOT NULL,           -- 内容hash
  embedding TEXT NOT NULL,      -- 向量JSON
  dims INTEGER,                 -- 维度
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (provider, model, provider_key, hash)
);
```

**chunks_fts表**（全文搜索）：

```sql
CREATE VIRTUAL TABLE chunks_fts USING fts5(
  text,                         -- 全文索引
  id UNINDEXED,                  -- 不索引
  path UNINDEXED,
  source UNINDEXED,
  model UNINDEXED,
  start_line UNINDEXED,
  end_line UNINDEXED
);
```

#### 2.3.2 内存模型

**MemoryFileEntry**：

```typescript
{
  path: string,        // 相对路径
  absPath: string,     // 绝对路径
  mtimeMs: number,     // 修改时间戳
  size: number,        // 文件大小
  hash: string         // SHA-256
}
```

**MemoryChunk**：

```typescript
{
  startLine: number,   // 起始行号
  endLine: number,     // 结束行号
  text: string,        // 文本内容
  hash: string         // SHA-256
}
```

**MemorySearchResult**：

```typescript
{
  path: string,        // 文件路径
  startLine: number,   // 起始行
  endLine: number,     // 结束行
  score: number,       // 相关度分数
  snippet: string,     // 摘录(max 700 chars)
  source: string       // memory/sessions
}
```

---

## 3. 数据流与编排

### 3.1 索引同步流程

```
┌─────────────────────────────────────────────────────┐
│                索引生命周期                          │
└─────────────────────────────────────────────────────┘

触发条件：
  1. Session开始  →  warmSession()
  2. 文件变化    →  file watcher (debounce 1.5s)
  3. 搜索请求    →  sync on search (可选)
  4. 定时器      →  interval sync
  5. Session更新  →  delta threshold (sessions)

┌──────────────┐
│  文件扫描     │  ← listMemoryFiles()
│  MemoryFiles  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  变更检测     │  ← hash/mtime对比
│  Dirty Files  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  分块处理     │  ← chunkMarkdown(400 tokens, 80 overlap)
│  Chunks       │
└──────┬───────┘
       │
       ├─────────────────────────┐
       │                         │
       ▼                         ▼
┌──────────────┐         ┌──────────────┐
│  Embedding    │         │  Cache检查   │
│  Provider     │         │  (缓存优化)  │
└──────┬───────┘         └──────┬───────┘
       │                         │
       └──────────┬────────────────┘
                  │
                  ▼
         ┌──────────────┐
         │  批量API调用  │  ← OpenAI/Gemini Batch API
         │  (可选优化)   │
         └──────┬───────┘
                │
                ▼
         ┌──────────────┐
         │  SQLite写入   │  ← chunks + chunks_fts + cache
         └──────────────┘
```

**关键设计点**：

1. **异步非阻塞**：索引在后台运行，搜索不等待
2. **增量更新**：只处理dirty files（hash/mtime变化）
3. **去重机制**：基于hash避免重复embedding
4. **批处理优化**：支持OpenAI/Gemini Batch API

---

### 3.2 搜索流程

```
┌─────────────────────────────────────────────────────┐
│                 搜索请求                            │
│  memory_search("Mac Studio gateway", {maxResults: 5})│
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│              预处理                                 │
│  • Warm session (可选)                              │
│  • Trigger sync if dirty (可选)                     │
│  • Clean query                                      │
└────────────────────┬────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│  向量化查询       │    │  构建BM25查询    │
│  embedQuery()    │    │  buildFtsQuery() │
└──────┬───────────┘    └──────┬───────────┘
       │                       │
       ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│  向量搜索         │    │  关键词搜索      │
│  searchVector()   │    │  searchKeyword() │
│  (cosine sim)     │    │  (FTS5 BM25)     │
└──────┬───────────┘    └──────┬───────────┘
       │                       │
       │  Top-N*Multiplier      │  Top-N*Multiplier
       │    (200 candidates)    │    (200 candidates)
       │                       │
       └───────────┬───────────┘
                   ▼
         ┌──────────────────┐
         │  候选池合并       │  ← Union by chunk.id
         │  Merge Candidates│
         └────────┬─────────┘
                  │
                  ▼
         ┌──────────────────┐
         │  归一化 + 加权    │
         │  vectorScore*0.7  │
         │  textScore*0.3    │
         └────────┬─────────┘
                  │
                  ▼
         ┌──────────────────┐
         │  排序 + 截断      │
         │  Sort + Limit    │
         └────────┬─────────┘
                  │
                  ▼
         ┌──────────────────┐
         │  Snippet提取      │  ← max 700 chars
         │  元数据组装       │
         └────────┬─────────┘
                  │
                  ▼
         ┌──────────────────┐
         │  返回结果         │
         │  MemorySearchResult[]
         └──────────────────┘
```

**关键设计点**：

1. **双路检索**：并行执行向量和关键词搜索
2. **候选扩大**：`candidateMultiplier: 4` 提高召回
3. **分数归一化**：BM25 rank → 0-1 score
4. **加权融合**：`vectorWeight: 0.7, textWeight: 0.3`
5. **非阻塞**：sync在后台，搜索立即返回（可能略旧）

---

### 3.3 文件监视机制

```
┌─────────────────────────────────────────────────────┐
│               文件监视器 (chokidar)                  │
└─────────────────────────────────────────────────────┘

监视路径：
  • workspace/MEMORY.md
  • workspace/memory/*.md
  • extraPaths (额外配置)

事件监听：
  • add     →  标记dirty
  • change  →  标记dirty (debounce 1.5s)
  • unlink  →  从索引删除

Debounce机制：
  ┌─────┐   ┌───┐   ┌───┐   ┌─────┐
  │Change│   │Chg│   │Chg│   │Sync │
  └─────┘   └───┘   └───┘   └─────┘
  ↑      ↑   ↑    ↑
  └──────┴───┴────┘
   1.5秒窗口内合并

状态管理：
  dirty: boolean      →  memory/目录需要sync
  sessionsDirty: Map  →  session需要sync (per-session delta)
```

---

## 4. 核心实现深度剖析

### 4.1 混合搜索算法

#### 4.1.1 BM25分数归一化

**问题**：FTS5返回的BM25 rank越小越好，需要转换为0-1分数

**方案**：

```typescript
export function bm25RankToScore(rank: number): number {
  const normalized = Number.isFinite(rank) ? Math.max(0, rank) : 999
  return 1 / (1 + normalized)
}
```

**分析**：

```
rank=0  → score=1.0    (完美匹配)
rank=1  → score=0.5    (优秀)
rank=4  → score=0.2    (良好)
rank=9  → score=0.1    (一般)
rank=99 → score=0.01   (较差)
rank=999→ score=0.001  (差)
```

**优势**：

- 单调递减：rank越小，分数越高
- 有界输出：区间(0, 1]
- 平滑过渡：避免阶梯函数

---

#### 4.1.2 候选合并策略

**Union by ID**：

```typescript
const byId = new Map<
  string,
  {
    id: string
    path: string
    startLine: number
    endLine: number
    source: string
    snippet: string
    vectorScore: number // 向量分数
    textScore: number // BM25分数
  }
>()

// 1. 向量结果：先填入
for (const r of vectorResults) {
  byId.set(r.id, {
    ...r,
    vectorScore: r.vectorScore,
    textScore: 0, // 暂无关键词分数
  })
}

// 2. 关键词结果：更新或插入
for (const r of keywordResults) {
  const existing = byId.get(r.id)
  if (existing) {
    existing.textScore = r.textScore // 更新
    if (r.snippet) existing.snippet = r.snippet // 优先用关键词snippet
  } else {
    byId.set(r.id, {
      ...r,
      vectorScore: 0, // 暂无向量分数
      textScore: r.textScore,
    })
  }
}
```

**设计考虑**：

- **Union**：两个结果集都保留（提高召回）
- **ID作为key**：避免重复chunks
- **Snippet优先级**：关键词snippet通常更精确（高亮匹配词）

---

#### 4.1.3 加权融合

```typescript
const merged = Array.from(byId.values()).map((entry) => {
  const score = vectorWeight * entry.vectorScore + textWeight * entry.textScore
  return { ...entry, score }
})

// 降序排序
return merged.sort((a, b) => b.score - a.score)
```

**参数分析**：

```
vectorWeight=0.7, textWeight=0.3

场景1：纯语义查询 ("理解同义词")
  vectorScore=0.8, textScore=0.1
  → final = 0.7*0.8 + 0.3*0.1 = 0.56 + 0.03 = 0.59

场景2：纯关键词查询 ("查找ID")
  vectorScore=0.1, textScore=0.9
  → final = 0.7*0.1 + 0.3*0.9 = 0.07 + 0.27 = 0.34

场景3：混合查询 ("Mac Studio gateway")
  vectorScore=0.7, textScore=0.5
  → final = 0.7*0.7 + 0.3*0.5 = 0.49 + 0.15 = 0.64
```

**为什么70:30**？

- 语义搜索理解意图（更重要）
- 关键词补充精确匹配（辅助）
- 经验权重，可配置调整

---

### 4.2 分块策略

#### 4.2.1 Chunking算法

```typescript
export function chunkMarkdown(
  content: string,
  chunking: { tokens: number; overlap: number }
): MemoryChunk[] {
  const lines = content.split('\n')
  const maxChars = chunking.tokens * 4 // 1 token ≈ 4 chars
  const overlapChars = chunking.overlap * 4

  let current: Array<{ line: string; lineNo: number }> = []
  let currentChars = 0

  const flush = () => {
    if (current.length === 0) return
    const text = current.map((e) => e.line).join('\n')
    chunks.push({
      startLine: current[0].lineNo,
      endLine: current[current.length - 1].lineNo,
      text,
      hash: hashText(text),
    })
  }

  const carryOverlap = () => {
    // 保留最后N个字符的重叠
    let acc = 0
    const kept = []
    for (let i = current.length - 1; i >= 0; i--) {
      acc += current[i].line.length + 1
      kept.unshift(current[i])
      if (acc >= overlapChars) break
    }
    current = kept
    currentChars = acc
  }

  // 逐行添加
  for (const line of lines) {
    // 超长行切分
    const segments = splitLine(line, maxChars)
    for (const seg of segments) {
      if (currentChars + seg.length > maxChars) {
        flush() // 输出当前chunk
        carryOverlap() // 保留重叠
      }
      current.push({ line: seg, lineNo })
      currentChars += seg.length + 1
    }
  }
  flush() // 输出最后一个chunk
  return chunks
}
```

**关键特性**：

1. **基于行**：保留行号（可追溯）
2. **滑动窗口**：overlap tokens重叠
3. **超长行切分**：避免单行过大
4. **内容hash**：用于去重和变更检测

**示例**：

```
原文 (10行, 400 tokens):
[1] Introduction
[2] This is a test
[3] with multiple lines
[4] ...
[10] Conclusion

Chunking (400 tokens, 80 overlap):
  Chunk 1: [1-8]   (400 tokens)
  Chunk 2: [6-10]  (overlap [6-8] from Chunk 1)
```

---

#### 4.2.2 Chunk参数选择

**为什么400 tokens？**

```
考虑因素：
  1. 精度：太小→碎片化，太大→噪声多
  2. 性能：embedding成本 vs 查询精度
  3. 上下文：一个chunk包含完整思想

经验值：
  100-200: 太小，上下文不足
  400-500: ✅ 平衡点（OpenClaw选择）
  800-1000: 太大，混合内容
```

**为什么80 overlap？**

```
目的：避免边界截断

示例：
  [Chunk 1] ... "The function is called"
  [Chunk 2] "The function is called 'memory_search'" ✅

  无overlap → [Chunk 1] "... called" / [Chunk 2] "The function ..." ❌

Overlap计算：
  overlap / chunk = 80 / 400 = 20%
  经验：15-25%合理
```

---

### 4.3 Embedding缓存

#### 4.3.1 缓存Key设计

```typescript
// 复合主键
const cacheKey = {
  provider: "openai" | "gemini" | "local",
  model: "text-embedding-3-small",
  provider_key: "api endpoint fingerprint",
  hash: "SHA-256 of chunk text"
};

// SQLite表定义
PRIMARY KEY (provider, model, provider_key, hash)
```

**为什么这样设计？**

1. **Provider隔离**：不同provider的向量不可比较
2. **Model隔离**：不同模型的embedding空间不同
3. **Endpoint指纹**：API变更自动失效
4. **Content hash**：相同内容只embed一次

---

#### 4.3.2 缓存淘汰策略

```typescript
cache: {
  enabled: true,
  maxEntries: 50000  // LRU上限
}
```

**实现**：

- SQLite表自带的DELETE WHEN FULL
- 或手动LRU：删除最旧的`updated_at`

**为什么50000？**

```
估算：
  1 chunk ≈ 400 tokens ≈ 1600 chars
  1 embedding ≈ 1536 dims * 4 bytes ≈ 6KB
  50000 entries ≈ 300MB (可接受)

TTL策略：
  没有！OpenClaw用maxEntries而非TTL
  原因：markdown文件编辑模式，旧内容仍可能被搜索
```

---

### 4.4 批量索引优化

#### 4.4.1 OpenAI Batch API

```typescript
// 准备批量请求
const batchRequests: OpenAiBatchRequest[] = []

for (const chunk of chunks) {
  const cached = await checkCache(chunk)
  if (cached) continue // 跳过已缓存

  batchRequests.push({
    custom_id: chunk.id,
    method: 'POST',
    url: '/v1/embeddings',
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: chunk.text,
    }),
  })
}

// 提交批量任务
const jobId = await submitBatch(batchRequests)

// 轮询结果
while (true) {
  const status = await pollJob(jobId)
  if (status === 'completed') break
  await sleep(pollIntervalMs)
}

// 批量写入缓存
const results = await downloadResults(jobId)
for (const result of results) {
  await writeToCache(result)
}
```

**优势分析**：

```
同步方式：
  1000 chunks * 0.1s/chunk = 100s

批量方式：
  提交: 1s
  处理: 60s (异步)
  下载: 1s
  ───────────────────────
  总计: 62s (节省38%)

费用：
  同步: $0.02/1M tokens
  批量: $0.01/1M tokens (50%折扣)
```

**并发控制**：

```typescript
remote: {
  batch: {
    enabled: true,
    concurrency: 2,  // 最多2个batch同时运行
    pollIntervalMs: 1000,
    timeoutMinutes: 30
  }
}
```

---

#### 4.4.2 Gemini Batch API

```typescript
// Gemini使用异步端点
const batchRequest = {
  requests: chunks.map((chunk) => ({
    model: 'models/' + model,
    content: {
      parts: [{ text: chunk.text }],
    },
  })),
}

// 提交到batch endpoint
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContentBatch`,
  { method: 'POST', body: JSON.stringify(batchRequest) }
)

// 等待异步完成
const jobId = response.id
const result = await pollJob(jobId)
```

**差异**：

- Gemini Batch不是HTTP轮询，是gRPC流
- 需要特殊处理
- OpenClaw在`batch-gemini.ts`中实现

---

### 4.5 向量相似度计算

#### 4.5.1 手动实现Cosine Similarity

```typescript
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0

  const len = Math.min(a.length, b.length)
  let dot = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0
    const bv = b[i] ?? 0
    dot += av * bv
    normA += av * av
    normB += bv * bv
  }

  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}
```

**为什么不用sqlite-vec？**

```
Fallback策略：
  1. 优先：sqlite-vec (C扩展，快速)
  2. 备用：JavaScript计算 (兼容性好)

何时使用JS实现？
  • sqlite-vec不可用
  • 平台不支持C扩展
  • 向量维度不匹配
```

---

#### 4.5.2 向量存储格式

```typescript
// 存储为JSON文本
const embedding = JSON.stringify(vector) // "[0.1,0.2,...]"

// 从数据库读取
const stored = db.prepare('SELECT embedding FROM chunks WHERE id = ?').get(id)
const vector = JSON.parse(stored.embedding)

// 计算相似度
const score = cosineSimilarity(queryVector, vector)
```

**为什么不用BLOB？**

```
设计权衡：
  BLOB:
    ✅ 紧凑（4 bytes/dim）
    ❌ 不可读（二进制）
    ❌ 需要序列化代码
    ❌ 跨平台问题（字节序）

  TEXT (JSON):
    ❌ 冗余（字符编码）
    ✅ 可读（调试方便）
    ✅ 兼容性（JSON标准）
    ✅ 简单（无需序列化）

OpenClaw选择：TEXT（简单性 > 空间效率）
```

---

## 5. 性能优化策略

### 5.1 索引优化

#### 5.1.1 增量索引

**策略**：只索引dirty files

```typescript
// 1. 计算文件hash
const currentHash = hashText(content)

// 2. 对比数据库记录
const existing = db.prepare('SELECT hash FROM files WHERE path = ?').get(path)

// 3. 只处理变化的文件
if (!existing || existing.hash !== currentHash) {
  await indexFile(path, content)
}
```

**收益**：

```
场景：100个文件，只有1个修改

无优化：100次embedding
增量：1次embedding

节省：99%
```

---

#### 5.1.2 异步索引

```typescript
// MemoryManager.search()
async search(query: string, opts?: SearchOptions) {
  // 1. 立即返回（可能略旧）
  if (this.settings.sync.onSearch && (this.dirty || this.sessionsDirty)) {
    // 2. 后台触发sync（不等待）
    void this.sync({ reason: "search" }).catch(err => {
      log.warn(`memory sync failed: ${err}`);
    });
  }

  // 3. 执行搜索（立即）
  return await this.performSearch(query, opts);
}
```

**优势**：

- 搜索响应快（不等待索引）
- 索引在后台更新
- 用户无感知

**代价**：

- 搜索结果可能略旧（可接受）
- 需要dirty标志协调

---

### 5.2 搜索优化

#### 5.2.1 候选池扩大

```typescript
query: {
  hybrid: {
    candidateMultiplier: 4  // 关键参数
  }
}

// 计算候选数量
const candidates = Math.min(
  200,  // 硬上限
  Math.max(1, Math.floor(maxResults * candidateMultiplier))
);

// 示例
maxResults=10 → candidates=40  (扩大4倍)
maxResults=50 → candidates=200 (达到上限)
```

**为什么需要？**

```
问题：向量搜索和关键词搜索的Top-K可能不同

示例查询："Mac Studio gateway host"

向量Top-10:
  [1] "运行gateway的机器"      ✅
  [2] "本地开发服务器"         ❌
  [3] "测试环境配置"           ❌
  ...

关键词Top-10:
  [1] "错误日志a828e60"       ❌
  [2] "配置文件路径"           ❌
  [3] "Mac Studio设置"        ✅
  [4] "gateway安装"           ✅
  ...

合并后Top-10:
  ✅ "运行gateway的机器" (vector高)
  ✅ "Mac Studio设置" (keyword高)
  ⚠️ "gateway安装" (混合高，但不在原Top-10)
  ⚠️ "错误日志a828e60" (keyword高，但可能相关)

→ 需要扩大候选池，避免漏掉"在Top-40但不在Top-10"的项
```

---

#### 5.2.2 Score过滤

```typescript
const minScore = opts?.minScore ?? this.settings.query.minScore

// 合并后的过滤
const filtered = merged.filter((r) => r.score >= minScore)

// 应用maxResults
const limited = filtered.slice(0, maxResults)
```

**两层过滤**：

```
1. 候选池扩大：candidateMultiplier (召回优先)
2. Score过滤：minScore (排序后截断，精排优先)

示例：
  candidates=40, minScore=0.3, maxResults=10

  Step 1: 检索40个候选
  Step 2: 合并+排序
  Step 3: 过滤score>=0.3 → 假设25个
  Step 4: 取Top-10 → 返回10个结果
```

---

### 5.3 数据库优化

#### 5.3.1 索引设计

```sql
-- 路径索引（按文件查询）
CREATE INDEX idx_chunks_path ON chunks(path);

-- 来源索引（按source过滤）
CREATE INDEX idx_chunks_source ON chunks(source);

-- 缓存时间索引（LRU淘汰）
CREATE INDEX idx_embedding_cache_updated_at ON embedding_cache(updated_at);
```

**查询优化示例**：

```typescript
// 无索引：全表扫描
SELECT * FROM chunks WHERE path = 'MEMORY.md';

// 有索引：B-Tree查找 (O(log N))
SELECT * FROM chunks WHERE path = 'MEMORY.md'
  → 使用idx_chunks_path
```

---

#### 5.3.2 FTS5配置

```sql
CREATE VIRTUAL TABLE chunks_fts USING fts5(
  text,              -- 全文索引内容
  id UNINDEXED,       -- 不索引（只用于join）
  path UNINDEXED,
  source UNINDEXED,
  model UNINDEXED,
  start_line UNINDEXED,
  end_line UNINDEXED
);
```

**为什么UNINDEXED？**

```
FTS5只用于全文检索text字段
其他字段用于：
  • Join到chunks表
  • 结果过滤
  • 元数据展示

不索引它们：
  • 减少FTS索引大小
  • 提高insert速度
  • 主查询在chunks表（有索引）
```

---

### 5.4 内存优化

#### 5.4.1 Per-Agent单例缓存

```typescript
private static INDEX_CACHE = new Map<string, MemoryManager>();

static async create(params): Promise<MemoryManager> {
  const key = buildCacheKey(cfg, agentId, workspaceDir);
  const cached = INDEX_CACHE.get(key);
  if (cached) return cached;

  const manager = new MemoryManager(params);
  INDEX_CACHE.set(key, manager);
  return manager;
}
```

**收益**：

```
场景：10个并发请求，同一个agent

无缓存：
  创建10个MemoryManager实例
  打开10个数据库连接
  10个索引状态

有缓存：
  创建1个MemoryManager实例
  打开1个数据库连接
  共享索引状态

节省：90%内存和连接
```

---

#### 5.4.2 连接池管理

```typescript
private db: DatabaseSync;

private constructor(params) {
  // 单个同步连接（SQLite推荐）
  this.db = new DatabaseSync(indexPath, {
    readonly: false
  });
}
```

**为什么不用连接池？**

```
SQLite特性：
  • 单文件数据库
  • 写锁（同一时间只能一个写者）
  • 读锁（多个读者）

MemoryManager模式：
  • Per-Agent单例
  • 单个同步连接足够
  • 避免锁竞争

何时需要连接池？
  • 多进程访问
  • 高并发写入
  • WAL模式（OpenClaw未使用）
```

---

## 6. 设计决策分析

### 6.1 为什么选择SQLite？

**对比分析**：

| 维度   | SQLite        | PostgreSQL  | Vector DB (Milvus) |
| ------ | ------------- | ----------- | ------------------ |
| 部署   | 单文件        | 服务器集群  | 服务器集群         |
| 复杂度 | 低            | 中          | 高                 |
| FTS    | ✅ 内置       | ✅ 扩展     | ❌ 需额外          |
| Vector | ⚠️ sqlite-vec | ✅ pgvector | ✅ 原生            |
| 备份   | 复制文件      | pg_dump     | 专用工具           |
| 隔离性 | Per-agent     | 需权限      | 需权限             |
| 适用   | 个人助手      | 企业应用    | 大规模             |

**OpenClaw选择SQLite的原因**：

1. **零配置**：单文件，无需安装服务
2. **Per-agent隔离**：每个agent独立数据库
3. **FTS5内置**：全文搜索无需额外依赖
4. **本地优先**：隐私、性能、可控
5. **可扩展性**：通过sqlite-vec支持向量

---

### 6.2 为什么选择Markdown？

**对比分析**：

| 格式     | 结构化 | 可读性 | 工具支持 | 编辑友好 |
| -------- | ------ | ------ | -------- | -------- |
| Markdown | ⚠️ 弱  | ✅ 高  | ✅ 广泛  | ✅ 是    |
| JSON     | ✅ 强  | ❌ 低  | ✅ 广泛  | ❌ 否    |
| SQLite   | ✅ 强  | ❌ 无  | ⚠️ 有限  | ❌ 否    |
| Notion   | ✅ 强  | ✅ 高  | ❌ 专有  | ❌ 依赖  |

**OpenClaw选择Markdown的原因**：

1. **用户控制**：直接编辑，无需API
2. **Git友好**：版本控制、diff、merge
3. **多工具兼容**：任何文本编辑器
4. **结构化**：标题、列表、代码块
5. **可扩展**：可以添加元数据

**记忆结构设计**：

```
MEMORY.md (长期知识)
  ## User Preferences
  - 偏好使用TypeScript
  - 工作习惯：先规划后实施

  ## Key Decisions
  - v0.4.0使用ZhipuAI embedding
  - 选择sqlite-vec作为向量库

memory/YYYY-MM-DD.md (每日日志)
  ### 2026-01-30 10:30
  **Project:** universal-memory-mcp

  **User:** 开始实现向量索引

  **AI:** 好的，我来实现...
```

---

### 6.3 为什么使用混合搜索？

**理论分析**：

```
信息检索两难：

向量搜索：
  ✅ 语义理解（"mac" ≈ "apple computer"）
  ❌ 精确匹配（ID、版本号）

关键词搜索：
  ✅ 精确匹配（"a828e60"）
  ❌ 语义理解（"mac" ≠ "apple computer"）
```

**RRF vs Weighted Score**：

| 算法     | 公式                  | 复杂度 | OpenClaw选择 |
| -------- | --------------------- | ------ | ------------ |
| RRF      | Σ 1/(k+rank)          | 中     | ❌           |
| Weighted | w1*score1 + w2*score2 | 低     | ✅           |

**OpenClaw选择Weighted的原因**：

1. **简单**：公式直观，易调参
2. **可控**：权重可配置（0.7/0.3）
3. **稳定**：不依赖rank分布
4. **可解释**：用户理解"70%语义+30%关键词"

**何时需要RRF？**

- 多路召回（>2）
- Rank分布不均匀
- 需要理论最优

---

### 6.4 为什么使用Batch API？

**性能对比**：

```
场景：1000 chunks需要embedding

同步API：
  请求1 → 等待 → 请求2 → 等待 → ...
  总耗时：1000 * 100ms = 100s

Batch API：
  提交1000个请求（1s） → 等待处理（60s） → 下载结果（1s）
  总耗时：62s

节省：38%
```

**费用对比**：

| 模式 | OpenAI定价      | 1000 chunks费用 |
| ---- | --------------- | --------------- |
| 同步 | $0.02/1M tokens | $0.02           |
| 批量 | $0.01/1M tokens | $0.01           |

**节省**：50%

**OpenClaw支持Batch的原因**：

1. **大规模回填**：首次索引大量历史数据
2. **成本优化**：长期使用的embedding成本
3. **性能提升**：减少等待时间
4. **用户体验**：后台异步，不阻塞

---

## 7. 与 universal-memory-mcp 对比

### 7.1 功能对比

| 功能              | OpenClaw                | universal-memory-mcp   |
| ----------------- | ----------------------- | ---------------------- |
| **记忆层级**      | 2层 (Memory.md + daily) | 3层 (L0/L1/L2)         |
| **数据源**        | 文件写入                | 自动记录 (Hook/Plugin) |
| **混合搜索**      | ✅ Weighted Score       | ✅ RRF                 |
| **时间衰减**      | ❌                      | ✅ 指数衰减            |
| **项目相关性**    | ❌                      | ✅ 1.5x/1.2x boost     |
| **Embedding缓存** | ✅ SQLite               | ✅ LRU (内存)          |
| **批量索引**      | ✅ OpenAI/Gemini Batch  | ❌                     |
| **文件监视**      | ✅ chokidar             | ❌                     |
| **自动索引**      | ✅ watch + async        | ❌ Pipeline (手动)     |
| **Session索引**   | ✅ (实验性)             | ❌                     |
| **记忆Flush**     | ✅ Pre-compaction       | ❌                     |
| **Provider**      | OpenAI/Gemini/Local     | ZhipuAI/Gemini/OpenAI  |
| **向量维度**      | 可变 (模型决定)         | 固定 (1024)            |

---

### 7.2 架构对比

#### 7.2.1 数据流

**OpenClaw**：

```
用户编辑 Markdown
    ↓
文件监视器检测变化
    ↓
异步索引 (不阻塞)
    ↓
SQLite更新
    ↓
搜索立即返回 (可能略旧)
```

**universal-memory-mcp**：

```
AI调用 memory_record
    ↓
写入 daily log
    ↓
手动/定时运行 Pipeline
    ↓
批量索引
    ↓
搜索时已同步
```

**差异**：

- OpenClaw：文件驱动（用户主动）
- universal-memory-mcp：API驱动（AI主动）

---

#### 7.2.2 搜索算法

**OpenClaw (Weighted Score)**：

```typescript
finalScore = vectorWeight * vectorScore + textWeight * textScore
```

**universal-memory-mcp (RRF)**：

```typescript
rrfScore = 1 / (k + vectorRank) + 1 / (k + textRank)
```

**对比**：

```
场景：向量rank=2, 文本rank=10

OpenClaw (0.7/0.3):
  vectorScore=1/(1+2)=0.33
  textScore=1/(1+10)=0.09
  final = 0.7*0.33 + 0.3*0.09 = 0.23 + 0.03 = 0.26

RRF (k=60):
  rrf = 1/(60+2) + 1/(60+10) = 0.016 + 0.014 = 0.030

归一化差异：
  OpenClaw: 0-1区间，直观
  RRF: 0-0.1区间，需归一化
```

---

### 7.3 性能对比

#### 7.3.1 索引性能

| 操作         | OpenClaw           | universal-memory-mcp |
| ------------ | ------------------ | -------------------- |
| **首次索引** | Batch API (62s/1K) | 同步API (140s/1K)    |
| **增量索引** | 文件监视器         | 手动触发             |
| **缓存命中** | SQLite持久化       | 内存LRU (进程级)     |
| **并发**     | 异步非阻塞         | 同步阻塞             |

#### 7.3.2 搜索性能

| 指标           | OpenClaw    | universal-memory-mcp |
| -------------- | ----------- | -------------------- |
| **向量搜索**   | 2-3ms       | 2.4ms                |
| **关键词搜索** | 0.1ms       | 0.1ms                |
| **混合搜索**   | 3-5ms       | 未测试               |
| **缓存**       | 100x (warm) | 100x (warm)          |

---

### 7.4 用户体验对比

#### 7.4.1 记忆方式

**OpenClaw**：

```
用户：记住这个决策
AI：写入 MEMORY.md (用户可编辑)
```

**universal-memory-mcp**：

```
用户：记住这个决策
AI：调用 memory_update_long_term (自动分类)
```

**差异**：

- OpenClaw：用户可控，需主动
- universal-memory-mcp：AI分类，自动

---

#### 7.4.2 搜索体验

**OpenClaw**：

```
用户：搜索关于mac的讨论
AI：memory_search("mac")
→ 立即返回（可能略旧）
→ 后台更新索引
```

**universal-memory-mcp**：

```
用户：搜索关于mac的讨论
AI：memory_search("mac", {time_decay: true})
→ 返回最新结果（已同步）
```

---

### 7.5 适用场景

**OpenClaw适合**：

- ✅ 喜欢手动编辑Markdown
- ✅ 需要Git版本控制
- ✅ 大规模历史数据回填
- ✅ 多通道（WhatsApp/Discord等）
- ✅ Per-agent严格隔离

**universal-memory-mcp适合**：

- ✅ AI CLI工具（Claude Code/OpenCode）
- ✅ 自动记录对话
- ✅ 时间衰减需求
- ✅ 项目相关性
- ✅ 三层记忆架构

---

## 8. 可借鉴的设计模式

### 8.1 文件驱动记忆

**模式**：

```
Plain Markdown → Embedding → Vector Search
      ↑                    ↓
      └────── User Edit ────┘
```

**优势**：

1. **透明性**：用户可查看、编辑记忆
2. **可控性**：数据完全由用户掌握
3. **兼容性**：任何文本工具可操作
4. **可审计**：Git历史、diff工具

**借鉴建议**：

- universal-memory-mcp可增加Markdown导出
- 支持用户直接编辑长期记忆
- 添加Markdown到L2的同步工具

---

### 8.2 异步索引策略

**模式**：

```
File Change (detected)
    ↓
Mark Dirty (flag)
    ↓
Async Sync (background)
    ↓
Search Returns (immediate, maybe stale)
```

**关键代码**：

```typescript
async search(query) {
  // 1. 触发后台sync（不等待）
  if (this.dirty) {
    void this.sync().catch(log.error);
  }

  // 2. 立即返回搜索结果
  return await this.performSearch(query);
}
```

**优势**：

1. **低延迟**：搜索不等待索引
2. **高可用**：索引失败不影响搜索
3. **用户体验**：响应快，容忍略旧

**借鉴建议**：

- universal-memory-mcp的IndexingPipeline改为异步
- 添加dirty标志机制
- 搜索时返回"可能略旧"的结果

---

### 8.3 批量API优化

**模式**：

```
大量Embedding需求
    ↓
构建Batch Request
    ↓
提交到Batch API
    ↓
异步处理（服务端）
    ↓
轮询完成状态
    ↓
批量写入缓存
```

**关键代码**：

```typescript
// 1. 准备批量请求
const requests = chunks.map((c) => ({
  custom_id: c.id,
  url: '/v1/embeddings',
  body: JSON.stringify({ input: c.text }),
}))

// 2. 提交
const job = await submitBatch(requests)

// 3. 轮询
while (job.status !== 'completed') {
  await sleep(1000)
  job = await pollJob(job.id)
}

// 4. 批量写入
await batchWriteCache(job.results)
```

**优势**：

1. **性能**：异步并行，减少等待
2. **成本**：50%折扣
3. **可靠性**：服务端重试机制

**借鉴建议**：

- universal-memory-mcp增加Batch API支持
- 大规模索引时优先使用Batch
- 提供`--batch`标志切换模式

---

### 8.4 候选池扩大策略

**模式**：

```
用户请求 Top-K
    ↓
扩大候选池 Top-(K*M)
    ↓
合并多路结果
    ↓
排序 + 截断 Top-K
```

**公式**：

```typescript
const candidates = Math.min(
  MAX_CANDIDATES, // 硬上限（如200）
  maxResults * candidateMultiplier // 扩大倍数（如4）
)
```

**优势**：

1. **召回提升**：不漏掉"在Top-40但不在Top-10"的项
2. **精确度**：通过minScore过滤低分项
3. **可控**：candidateMultiplier可调节

**借鉴建议**：

- universal-memory-mcp增加candidateMultiplier参数
- 在hybridSearch中实现候选池扩大
- 提供调节指南（默认4x）

---

### 8.5 Embedding缓存持久化

**模式**：

```
Chunk Text
    ↓
Compute SHA-256
    ↓
Check SQLite Cache
    ↓ (miss)
Call Embedding API
    ↓
Write to Cache (persistent)
```

**Schema**：

```sql
CREATE TABLE embedding_cache (
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  provider_key TEXT NOT NULL,
  hash TEXT NOT NULL,
  embedding TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (provider, model, provider_key, hash)
);
```

**优势**：

1. **持久化**：重启进程缓存仍有效
2. **共享**：多进程共享缓存
3. **去重**：相同内容只embed一次
4. **可监控**：查看缓存命中率

**借鉴建议**：

- universal-memory-mcp的内存LRU改为SQLite
- 添加缓存统计（hits/misses/hit_rate）
- 提供`--clear-cache`命令

---

### 8.6 文件监视器自动同步

**模式**：

```
chokidar.watch(['MEMORY.md', 'memory/*.md'])
    .on('change', (path) => {
      markDirty(path);
      debouncedSync();
    });
```

**优势**：

1. **实时性**：文件变化自动触发索引
2. **低开销**：debounce合并批量变化
3. **可靠性**：不依赖手动触发

**借鉴建议**：

- universal-memory-mcp增加chokidar监视
- 监视daily/和long_term/目录
- Debounce 5s合并批量变化

---

## 9. 改进建议

### 9.1 短期优化 (v0.5.x)

#### 9.1.1 添加文件监视器

**目标**：自动检测Markdown变化并更新索引

**实现**：

```typescript
// packages/core/src/watcher.ts
import chokidar from 'chokidar'

export class MemoryWatcher {
  private watcher: FSWatcher

  watch(memoryPath: string, onChange: () => void) {
    this.watcher = chokidar
      .watch(memoryPath, {
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        persistent: true,
        ignoreInitial: true,
      })
      .on('change', debounce(onChange, 5000))
      .on('add', debounce(onChange, 5000))
  }

  close() {
    this.watcher?.close()
  }
}
```

**集成到MemoryManager**：

```typescript
private ensureWatcher() {
  if (this.watcher) return;

  this.watcher = new MemoryWatcher();
  this.watcher.watch(this.memoryPath, () => {
    this.dirty = true;
    void this.sync({ reason: 'file-change' });
  });
}
```

**预期收益**：

- 用户编辑Markdown后自动索引
- 无需手动触发Pipeline
- 用户体验提升

---

#### 9.1.2 实现异步索引

**目标**：搜索不等待索引完成

**实现**：

```typescript
// packages/core/src/search/enhanced.ts
async search(query: string, opts?: SearchOptions) {
  // 1. 触发后台sync（不等待）
  if (this.dirty) {
    void this.pipeline.indexRecent(1).catch(err => {
      console.warn(`Background sync failed: ${err}`);
    });
  }

  // 2. 立即搜索
  return await this.performSearch(query, opts);
}
```

**标志管理**：

```typescript
// packages/core/src/vectorstore/pipeline.ts
private dirty: boolean = false;

async indexFile(file: MemoryFileEntry) {
  await this.embedAndIndex(file);
  this.dirty = false;  // 重置标志
}
```

**预期收益**：

- 搜索响应快（不等待索引）
- 索引在后台更新
- 容忍略旧结果

---

#### 9.1.3 添加候选池扩大

**目标**：提高混合搜索召回率

**实现**：

```typescript
// packages/core/src/search/enhanced.ts
interface HybridOptions {
  vectorWeight: number;
  textWeight: number;
  candidateMultiplier: number;  // 新增
}

async hybridSearch(query: string, opts: HybridOptions) {
  const candidates = Math.min(
    200,  // 硬上限
    Math.floor(opts.limit * opts.candidateMultiplier)
  );

  // 扩大检索
  const vectorResults = await this.vectorStore
    .semanticSearch(embedding, candidates);

  const keywordResults = await this.vectorStore
    .keywordSearch(query, candidates);

  // 合并 + 排序 + 截断
  return this.mergeAndRank(vectorResults, keywordResults, opts);
}
```

**配置**：

```typescript
const DEFAULT_OPTIONS = {
  vectorWeight: 0.7,
  textWeight: 0.3,
  candidateMultiplier: 4, // 扩大4倍
}
```

**预期收益**：

- 召回率提升20-30%
- 不漏掉边缘相关结果
- 可通过multiplier调节

---

### 9.2 中期优化 (v0.6.x)

#### 9.2.1 实现Batch API支持

**目标**：加速大规模索引

**OpenAI Batch实现**：

```typescript
// packages/core/src/embedding/batch-openai.ts
export async function runOpenAiEmbeddingBatches(params: {
  apiKey: string
  model: string
  chunks: Array<{ id: string; text: string }>
  concurrency: number
}) {
  // 1. 分批（每批2000个请求）
  const batches = chunkArray(params.chunks, 2000)

  // 2. 并发提交
  const jobs = await Promise.all(
    batches
      .slice(0, params.concurrency)
      .map((batch) => submitBatch(batch, params.apiKey, params.model))
  )

  // 3. 轮询完成
  const results = await Promise.all(jobs.map((job) => pollJobUntilComplete(job)))

  // 4. 批量写入缓存
  await writeBatchResults(results)

  return results
}
```

**Gemini Batch实现**：

```typescript
// packages/core/src/embedding/batch-gemini.ts
export async function runGeminiEmbeddingBatches(params: {
  apiKey: string
  model: string
  chunks: Array<{ id: string; text: string }>
}) {
  // Gemini使用异步端点
  const batchRequest = {
    requests: params.chunks.map((chunk) => ({
      model: `models/${params.model}`,
      content: { parts: [{ text: chunk.text }] },
    })),
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:embedContentBatch?key=${params.apiKey}`,
    { method: 'POST', body: JSON.stringify(batchRequest) }
  )

  return await response.json()
}
```

**CLI集成**：

```bash
# 批量索引模式
universal-memory-index --batch --concurrency 2

# 默认模式
universal-memory-index
```

**预期收益**：

- 大规模索引速度提升40%
- 成本降低50%
- 用户体验改善

---

#### 9.2.2 添加Embedding持久化缓存

**目标**：重启进程后缓存仍有效

**实现**：

```typescript
// packages/core/src/cache/sqlite-cache.ts
export class SqliteEmbeddingCache {
  private db: Database

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.ensureSchema()
  }

  private ensureSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS embedding_cache (
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        hash TEXT NOT NULL,
        embedding TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (provider, model, hash)
      );
    `)
  }

  async get(provider: string, model: string, hash: string): Promise<number[] | null> {
    const row = this.db
      .prepare('SELECT embedding FROM embedding_cache WHERE provider=? AND model=? AND hash=?')
      .get(provider, model, hash)

    return row ? JSON.parse(row.embedding) : null
  }

  async set(provider: string, model: string, hash: string, embedding: number[]): Promise<void> {
    this.db
      .prepare(
        'INSERT OR REPLACE INTO embedding_cache (provider, model, hash, embedding, updated_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(provider, model, hash, JSON.stringify(embedding), Date.now())
  }

  async clear(): Promise<void> {
    this.db.prepare('DELETE FROM embedding_cache').run()
  }

  getStats(): { count: number; size: number } {
    const count = this.db.prepare('SELECT COUNT(*) as count FROM embedding_cache').get() as {
      count: number
    }
    return { count: count.count, size: 0 } // TODO: 计算实际大小
  }
}
```

**集成到CachedEmbeddingProvider**：

```typescript
// packages/core/src/embedding/cached.ts
export class CachedEmbeddingProvider implements EmbeddingProvider {
  private cache: SqliteEmbeddingCache // 改为SQLite

  constructor(provider: EmbeddingProvider, cachePath: string) {
    this.provider = provider
    this.cache = new SqliteEmbeddingCache(cachePath)
  }

  async generate(text: string): Promise<number[]> {
    const hash = hashText(text)

    // 检查缓存
    const cached = await this.cache.get(this.provider.name, this.provider.model, hash)
    if (cached) {
      this.stats.hits++
      return cached
    }

    // Cache miss
    this.stats.misses++
    const embedding = await this.provider.generate(text)

    // 写入缓存
    await this.cache.set(this.provider.name, this.provider.model, hash, embedding)

    return embedding
  }

  getStats(): CacheStats {
    return {
      ...this.stats,
      ...this.cache.getStats(), // 持久化统计
    }
  }
}
```

**预期收益**：

- 重启后缓存仍有效
- 多进程共享缓存
- 节省embedding成本

---

#### 9.2.3 添加向量加速

**目标**：使用sqlite-vec加速向量搜索

**实现**：

```typescript
// packages/core/src/vectorstore/sqlite-vec.ts
import sqliteVec from 'sqlite-vec'

export function enableSqliteVec(db: Database): boolean {
  try {
    db.loadExtension(sqliteVec)
    return true
  } catch (err) {
    console.warn('sqlite-vec not available:', err.message)
    return false
  }
}

// 创建虚拟表
export function createVecIndex(db: Database, tableName: string, dimensions: number) {
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS ${tableName} USING vec0(
      embedding float[${dimensions}]
    );
  `)
}

// 插入向量
export function insertVector(db: Database, tableName: string, id: string, embedding: number[]) {
  const stmt = db.prepare(`INSERT INTO ${tableName} (rowid, embedding) VALUES (?, ?)`)
  stmt.run(id, JSON.stringify(embedding))
}

// 向量搜索
export function searchVectors(
  db: Database,
  tableName: string,
  query: number[],
  limit: number
): Array<{ id: number; score: number }> {
  const stmt = db.prepare(`
    SELECT
      rowid as id,
      distance
    FROM ${tableName}
    WHERE embedding MATCH ?
    ORDER BY distance
    LIMIT ?
  `)

  return stmt.all(JSON.stringify(query), limit)
}
```

**集成到VectorStore**：

```typescript
// packages/core/src/vectorstore/store.ts
export class VectorStore {
  private sqliteVecEnabled: boolean = false

  constructor(config: VectorStoreConfig) {
    this.db = new Database(config.dbPath)
    this.sqliteVecEnabled = enableSqliteVec(this.db)

    if (this.sqliteVecEnabled) {
      createVecIndex(this.db, 'chunks_vec', config.dimensions)
    }
  }

  async semanticSearch(embedding: number[], limit: number): Promise<SearchResult[]> {
    if (this.sqliteVecEnabled) {
      return this.searchWithSqliteVec(embedding, limit)
    } else {
      return this.searchWithJS(embedding, limit) // Fallback
    }
  }

  private searchWithSqliteVec(embedding: number[], limit: number): SearchResult[] {
    const results = searchVectors(this.db, 'chunks_vec', embedding, limit * 4)

    // Join with chunks表获取元数据
    return results.map((r) => {
      const chunk = this.db.prepare('SELECT * FROM chunks WHERE id = ?').get(r.id)
      return {
        ...chunk,
        score: 1 - r.score, // distance → similarity
      }
    })
  }
}
```

**预期收益**：

- 向量搜索速度提升5-10倍
- 大规模数据（>100K chunks）性能更好
- 降低CPU使用率

---

### 9.3 长期优化 (v1.0.x)

#### 9.3.1 实现Session索引

**目标**：索引对话历史，支持搜索session

**实现**：

```typescript
// packages/core/src/memory/session-indexer.ts
export class SessionIndexer {
  async indexSessions(sessionsDir: string, deltaThreshold: number) {
    const sessionFiles = await glob(`${sessionsDir}/*.jsonl`)

    for (const file of sessionFiles) {
      const stat = await fs.stat(file)

      // 检查delta
      const indexed = this.getIndexedSession(file)
      if (indexed && stat.size - indexed.size < deltaThreshold) {
        continue // 跳过小变化
      }

      // 索引session
      await this.indexSession(file)

      // 更新记录
      this.markIndexed(file, stat)
    }
  }

  private async indexSession(file: string) {
    const content = await fs.readFile(file, 'utf-8')
    const messages = content.split('\n').map(JSON.parse)

    // 提取对话文本
    const chunks = this.extractConversationChunks(messages)

    // Embedding
    for (const chunk of chunks) {
      const embedding = await this.provider.generate(chunk.text)
      await this.store.insert({
        id: chunk.id,
        path: file,
        source: 'sessions',
        text: chunk.text,
        embedding,
        metadata: chunk.metadata,
      })
    }
  }

  private extractConversationChunks(messages: Message[]): MemoryChunk[] {
    // 按对话轮次分组
    const turns = this.groupByTurn(messages)

    // 每个turn作为一个chunk
    return turns.map((turn, i) => ({
      id: `turn-${i}`,
      text: turn.map((m) => `${m.role}: ${m.content}`).join('\n'),
      startLine: turn[0].line,
      endLine: turn[turn.length - 1].line,
      metadata: { sessionId: turn[0].sessionId },
    }))
  }
}
```

**MemoryManager集成**：

```typescript
async sync(options?: { reason?: string }) {
  // Memory索引
  if (this.dirty) {
    await this.indexMemoryFiles();
    this.dirty = false;
  }

  // Session索引（实验性）
  if (this.experimental?.sessionMemory) {
    await this.sessionIndexer.indexSessions(
      this.sessionsDir,
      this.sync.deltaBytes  // 100KB threshold
    );
  }
}
```

**搜索支持**：

```typescript
async search(query: string, opts?: SearchOptions): Promise<SearchResult[]> {
  const results = await this.hybridSearch(query, opts);

  // 过滤source
  if (opts.sources?.includes('sessions')) {
    return results.filter(r => r.source === 'sessions');
  }

  return results;
}
```

**预期收益**：

- 搜索历史对话
- 上下文更丰富
- 记忆更完整

---

#### 9.3.2 添加记忆Flush提示

**目标**：在session接近compaction时提示AI写入记忆

**实现**：

```typescript
// packages/mcp-server/src/hooks/memory-flush.ts
export class MemoryFlushHook {
  constructor(config: { reserveTokens: number; threshold: number }) {
    this.reserveTokens = config.reserveTokens
    this.threshold = config.threshold
  }

  shouldFlush(context: { tokensUsed: number }): boolean {
    const remaining = context.maxTokens - context.tokensUsed
    return remaining < this.reserveTokens + this.threshold
  }

  async triggerFlush(agent: Agent): Promise<void> {
    const systemPrompt = 'Session nearing compaction. Store durable memories now.'
    const userPrompt =
      'Write any lasting notes to memory/YYYY-MM-DD.md; reply with NO_REPLY if nothing to store.'

    // 静默AI turn
    await agent.processTurn({
      system: { content: systemPrompt, role: 'system' },
      user: { content: userPrompt, role: 'user' },
    })
  }
}
```

**Claude Code集成**：

```typescript
// ~/.claude/hooks/memory-flush.mjs
export async function onStop(ctx, agent) {
  const flusher = new MemoryFlushHook({
    reserveTokens: 20000,
    threshold: 4000,
  })

  if (flusher.shouldFlush(ctx)) {
    await flusher.triggerFlush(agent)
  }
}
```

**预期收益**：

- 重要信息不丢失
- 自动化记忆管理
- 用户无感知

---

#### 9.3.3 实现Markdown导出

**目标**：将L2长期记忆导出为Markdown

**实现**：

```typescript
// packages/core/src/memory/export.ts
export class MemoryExporter {
  async exportToMarkdown(config: {
    outputPath: string
    categories: string[] // ['profile', 'decisions', 'facts']
  }): Promise<void> {
    const chunks = []

    for (const category of config.categories) {
      const memories = await this.longTermMemory.getByCategory(category)

      chunks.push(`# ${category.toUpperCase()}\n`)

      for (const memory of memories) {
        const date = new Date(memory.timestamp).toLocaleDateString('zh-CN')
        chunks.push(`\n- [${date}] ${memory.content}`)
      }

      chunks.push('\n---\n')
    }

    await fs.writeFile(config.outputPath, chunks.join('\n'))
  }

  async exportDailyToMarkdown(date: Date): Promise<void> {
    const dateStr = formatDate(date)
    const conversations = await this.daily.getConversations(dateStr)

    const content = [`# ${dateStr}\n`]

    for (const conv of conversations) {
      content.push(`## ${conv.timestamp}\n`)
      content.push(`**Project:** ${conv.project}\n`)
      content.push(`**User:** ${conv.userMessage}\n`)
      content.push(`**AI:** ${conv.aiResponse}\n`)
      content.push('\n---\n')
    }

    const outputPath = join(this.memoryPath, 'daily', `${dateStr}.md`)
    await fs.writeFile(outputPath, content.join('\n'))
  }
}
```

**CLI命令**：

```bash
# 导出长期记忆
universal-memory-export --categories profile,decisions --output MEMORY.md

# 导出每日日志
universal-memory-export --daily --date 2026-01-30
```

**预期收益**：

- 用户可查看/编辑记忆
- Git版本控制
- 多工具兼容

---

## 10. 总结

### 10.1 OpenClaw的核心优势

1. **简单性**：Markdown作为数据源，透明可控
2. **自动化**：文件监视器 + 异步索引
3. **性能**：Batch API + sqlite-vec + 持久化缓存
4. **可靠性**：多级fallback + 增量索引
5. **可扩展**：插件化Provider + Per-agent隔离

### 10.2 可直接借鉴的模式

1. ✅ 文件驱动记忆（Markdown优先）
2. ✅ 异步索引（搜索不等待）
3. ✅ 批量API（大规模优化）
4. ✅ 候选池扩大（提高召回）
5. ✅ 持久化缓存（重启有效）
6. ✅ 文件监视器（自动同步）
7. ✅ Weighted Score（简单可控）

### 10.3 改进路线图

**v0.5.x**（短期）：

- 文件监视器
- 异步索引
- 候选池扩大

**v0.6.x**（中期）：

- Batch API支持
- SQLite持久化缓存
- sqlite-vec加速

**v1.0.x**（长期）：

- Session索引
- 记忆Flush
- Markdown导出

---

**通过借鉴OpenClaw的成熟设计，universal-memory-mcp可以在保持简洁的同时，大幅提升性能和用户体验！** 🚀
