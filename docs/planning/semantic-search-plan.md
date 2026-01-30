# 语义搜索与记忆整理技术方案

## 当前状态

### 已实现
- ✅ 基础记忆记录（daily logs）
- ✅ 长期记忆存储（long_term/MEMORY.md）
- ✅ 简单关键词搜索
- ✅ 项目/客户端过滤
- ✅ 类型定义（IndexItem, EmbeddingProvider）

### 待实现
- ❌ 向量化（Embedding）
- ❌ 向量索引（Vector Index）
- ❌ 语义搜索
- ❌ 混合搜索（语义 + 关键词）
- ❌ 自动记忆整理

## 核心问题

### 1. 记忆膨胀问题

**现状**：
- 每天产生大量对话记录
- 所有记录都存储在 daily/*.md 文件中
- 搜索需要遍历所有文件，效率低下

**影响**：
- 搜索速度随时间线性下降
- 内存占用增加
- 无法快速定位相关记忆

### 2. 语义理解缺失

**现状**：
- 只能匹配关键词
- 无法理解语义相似性
- 同义词、相关概念无法匹配

**示例**：
```
查询: "如何实现用户登录"
无法匹配: "authentication 实现方案"（虽然语义相关）
```

### 3. 记忆整理缺失

**现状**：
- 长期记忆需要手动调用 `memory_update_long_term`
- 没有自动提取重要信息的机制
- 重复信息没有去重

## 技术方案

### Phase 1: 向量化基础设施 (v0.4.0)

#### 1.1 Embedding Provider 实现

**选择方案**：多提供者支持

```typescript
interface EmbeddingProvider {
  name: string;
  dimensions: number;
  generate(text: string): Promise<number[]>;
  generateBatch(texts: string[]): Promise<number[][]>;
}
```

**支持的提供者**：

| 提供者 | 模型 | 维度 | 成本 | 速度 | 推荐场景 |
|--------|------|------|------|------|----------|
| OpenAI | text-embedding-3-small | 1536 | $0.02/1M tokens | 快 | 生产环境 |
| OpenAI | text-embedding-3-large | 3072 | $0.13/1M tokens | 中 | 高精度需求 |
| Gemini | text-embedding-004 | 768 | 免费 | 快 | 免费方案 |
| Local | all-MiniLM-L6-v2 | 384 | 免费 | 慢 | 离线/隐私 |

**实现优先级**：
1. Gemini（免费，易用）
2. OpenAI（生产级）
3. Local（可选）

#### 1.2 分块策略（Chunking）

**问题**：
- 对话可能很长（几千字）
- Embedding 模型有 token 限制
- 需要合理分块以保持语义完整性

**方案**：对话级分块

```typescript
interface Chunk {
  id: string;
  content: string;
  metadata: {
    conversationId: string;
    timestamp: Date;
    project?: string;
    client?: string;
    chunkIndex: number;
    totalChunks: number;
  };
}
```

**分块规则**：
1. **基本单位**：一次完整的 User-AI 对话交换
2. **长对话处理**：
   - 如果单次对话 > 2000 tokens，按段落分块
   - 保留上下文：每个 chunk 包含对话元数据
3. **不分块的内容**：
   - 长期记忆条目（已经是精炼的）
   - 项目状态文件

**示例**：
```markdown
## 2026-01-29 10:30:15
**Project:** my-app
**Client:** claude-code
**Session:** abc123

**User:** 帮我设计一个用户认证系统，需要支持 JWT 和 OAuth2

**AI:** [3000 字的详细回复...]

→ 分成 2 个 chunks：
  - Chunk 1: User 消息 + AI 回复前半部分
  - Chunk 2: AI 回复后半部分（带上 User 消息摘要作为上下文）
```

#### 1.3 向量索引（Vector Index）

**技术选型**：sqlite-vec

**原因**：
- ✅ 单文件数据库，无需额外服务
- ✅ 支持向量相似度搜索
- ✅ 与 SQLite FTS5 结合实现混合搜索
- ✅ 跨平台，易部署

**Schema 设计**：

```sql
-- 向量索引表
CREATE TABLE memory_vectors (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding BLOB NOT NULL,  -- 向量数据
  timestamp INTEGER NOT NULL,
  project TEXT,
  client TEXT,
  session_id TEXT,
  source_file TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- 向量索引（使用 sqlite-vec）
CREATE VIRTUAL TABLE vec_index USING vec0(
  embedding float[768]  -- Gemini embedding 维度
);

-- 全文搜索索引（FTS5）
CREATE VIRTUAL TABLE memory_fts USING fts5(
  content,
  content=memory_vectors,
  content_rowid=rowid
);
```

#### 1.4 索引构建流程

**触发时机**：
1. **实时索引**：新对话记录时立即索引
2. **批量索引**：首次安装或重建索引
3. **增量索引**：定期扫描未索引的记录

**流程**：
```
1. 读取对话记录
   ↓
2. 分块（如果需要）
   ↓
3. 生成 Embedding
   ↓
4. 存入 SQLite 向量索引
   ↓
5. 更新 FTS5 全文索引
```

**性能优化**：
- 批量生成 Embedding（减少 API 调用）
- 异步索引（不阻塞记录流程）
- 缓存机制（避免重复计算）

### Phase 2: 语义搜索 (v0.4.0)

#### 2.1 搜索模式

**三种模式**：

1. **Keyword（关键词）**：
   - 使用 SQLite FTS5
   - BM25 算法
   - 快速，精确匹配

2. **Semantic（语义）**：
   - 使用向量相似度
   - 余弦相似度（Cosine Similarity）
   - 理解语义，召回率高

3. **Hybrid（混合）**：
   - 结合关键词 + 语义
   - 加权融合分数
   - 平衡精确度和召回率

#### 2.2 混合搜索算法

**RRF (Reciprocal Rank Fusion)**：

```typescript
function hybridSearch(query: string, options: SearchOptions) {
  // 1. 关键词搜索
  const keywordResults = fts5Search(query);

  // 2. 语义搜索
  const queryEmbedding = await generateEmbedding(query);
  const semanticResults = vectorSearch(queryEmbedding);

  // 3. RRF 融合
  const fusedResults = rrf(keywordResults, semanticResults, {
    keywordWeight: 0.4,
    semanticWeight: 0.6,
  });

  return fusedResults;
}

function rrf(results1, results2, weights) {
  const k = 60; // RRF 常数
  const scores = new Map();

  results1.forEach((item, rank) => {
    const score = weights.keywordWeight / (k + rank + 1);
    scores.set(item.id, (scores.get(item.id) || 0) + score);
  });

  results2.forEach((item, rank) => {
    const score = weights.semanticWeight / (k + rank + 1);
    scores.set(item.id, (scores.get(item.id) || 0) + score);
  });

  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id, score]) => ({ id, score }));
}
```

#### 2.3 搜索优化

**时间衰减**：
- 最近的记忆权重更高
- 使用指数衰减函数

```typescript
function timeDecay(timestamp: Date, halfLife: number = 30): number {
  const daysAgo = (Date.now() - timestamp.getTime()) / (1000 * 60 * 60 * 24);
  return Math.exp(-daysAgo / halfLife);
}

finalScore = baseScore * timeDecay(timestamp);
```

**项目相关性加权**：
- 当前项目的记忆权重更高
- 跨项目搜索时降低权重

### Phase 3: 自动记忆整理 (v0.5.0)

#### 3.1 整理触发机制

**触发条件**：
1. **定时触发**：每天凌晨 2 点
2. **阈值触发**：daily 日志超过 100 条
3. **手动触发**：用户调用 `memory_consolidate`

#### 3.2 整理流程

```
1. 扫描最近 N 天的对话
   ↓
2. 使用 LLM 提取关键信息
   ├─ 重要决策
   ├─ 用户偏好
   ├─ 关键事实
   └─ 联系人信息
   ↓
3. 去重和合并
   ↓
4. 更新长期记忆文件
   ↓
5. 标记已整理的对话
```

#### 3.3 LLM 提取 Prompt

```typescript
const CONSOLIDATION_PROMPT = `
分析以下对话记录，提取重要信息：

对话记录：
{conversations}

请提取：
1. **重要决策**：技术选型、架构决策、方案选择
2. **用户偏好**：编码风格、工具偏好、工作习惯
3. **关键事实**：项目信息、团队信息、业务逻辑
4. **联系人**：提到的人名、团队、组织

输出格式：
## Decisions
- [日期] 决策内容

## Preferences
- 偏好内容

## Facts
- 事实内容

## Contacts
- 联系人信息
`;
```

#### 3.4 去重策略

**相似度检测**：
- 使用向量相似度检测重复信息
- 阈值：cosine similarity > 0.9

**合并规则**：
- 保留最新、最详细的版本
- 合并补充信息
- 保留来源引用

### Phase 4: 高级特性 (v0.6.0+)

#### 4.1 记忆图谱

**概念**：
- 将记忆组织成知识图谱
- 实体识别：项目、技术、人物
- 关系提取：使用、依赖、相关

**实现**：
```typescript
interface MemoryNode {
  id: string;
  type: 'project' | 'technology' | 'person' | 'concept';
  name: string;
  properties: Record<string, any>;
}

interface MemoryEdge {
  from: string;
  to: string;
  type: 'uses' | 'depends_on' | 'related_to' | 'mentioned_in';
  weight: number;
}
```

#### 4.2 智能推荐

**场景**：
- 用户开始新项目时，推荐相关历史经验
- 遇到问题时，推荐类似问题的解决方案

**实现**：
- 基于当前上下文的向量搜索
- 结合项目相似度
- 时间衰减

#### 4.3 记忆压缩

**问题**：
- 长期积累的记忆占用空间大
- 旧记忆访问频率低

**方案**：
- 定期压缩旧记忆（> 6 个月）
- 使用 LLM 生成摘要
- 保留原始记录的引用

## 实施计划

### v0.4.0: 向量化基础（2-3 周）

**Week 1: Embedding 基础设施**
- [ ] 实现 Gemini Embedding Provider
- [ ] 实现分块逻辑
- [ ] 单元测试

**Week 2: 向量索引**
- [ ] 集成 sqlite-vec
- [ ] 实现索引构建
- [ ] 实现增量索引

**Week 3: 语义搜索**
- [ ] 实现向量搜索
- [ ] 实现混合搜索
- [ ] 性能优化

### v0.5.0: 记忆整理（1-2 周）

**Week 1: 整理流程**
- [ ] 实现整理触发机制
- [ ] 实现 LLM 提取
- [ ] 实现去重合并

**Week 2: 优化和测试**
- [ ] 整理质量优化
- [ ] 性能测试
- [ ] 用户测试

### v0.6.0: 高级特性（按需）

- [ ] 记忆图谱
- [ ] 智能推荐
- [ ] 记忆压缩

## 技术风险

### 1. Embedding 成本

**风险**：
- OpenAI Embedding API 有成本
- 大量历史记录索引成本高

**缓解**：
- 优先使用 Gemini（免费）
- 支持本地 Embedding
- 增量索引，避免重复计算

### 2. 索引性能

**风险**：
- 向量搜索可能较慢
- 大规模数据下性能下降

**缓解**：
- 使用 sqlite-vec 的优化索引
- 分层索引（热数据 vs 冷数据）
- 缓存常用查询

### 3. 整理质量

**风险**：
- LLM 提取可能不准确
- 重要信息可能丢失

**缓解**：
- 保留原始记录
- 用户可以手动修正
- 逐步优化 prompt

## 配置选项

```typescript
interface MemoryConfig {
  // Embedding 配置
  embeddingProvider: 'openai' | 'gemini' | 'local';
  embeddingModel?: string;
  embeddingDimensions: number;

  // 搜索配置
  searchMode: 'keyword' | 'semantic' | 'hybrid';
  semanticWeight: number;  // 0-1
  keywordWeight: number;   // 0-1

  // 整理配置
  consolidationEnabled: boolean;
  consolidationSchedule: 'daily' | 'weekly' | 'manual';
  consolidationDays: number;  // 整理最近 N 天

  // 性能配置
  batchSize: number;  // Embedding 批量大小
  cacheEnabled: boolean;
  indexRebuildInterval: number;  // 天
}
```

## 总结

这个方案分三个阶段实现：

1. **v0.4.0**：向量化和语义搜索（核心功能）
2. **v0.5.0**：自动记忆整理（提升体验）
3. **v0.6.0**：高级特性（锦上添花）

**关键决策**：
- ✅ 使用 Gemini Embedding（免费，易用）
- ✅ 使用 sqlite-vec（单文件，易部署）
- ✅ 对话级分块（保持语义完整性）
- ✅ 混合搜索（平衡精确度和召回率）
- ✅ 增量索引（性能优化）

**下一步**：
1. 确认技术选型
2. 实现 Gemini Embedding Provider
3. 实现分块逻辑
4. 集成 sqlite-vec
