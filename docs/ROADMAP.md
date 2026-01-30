# universal-memory-mcp 发展路线图

> **从 AI 助手到智能伙伴：记忆系统的演进路径**

**版本**: 2026.01.30
**当前状态**: v0.4.1 已发布（基础语义搜索）
**目标版本**: v1.0.0（生产级智能记忆系统）

---

## 📋 目录

1. [设计哲学与定位](#设计哲学与定位)
2. [与 OpenClaw 的差异化](#与-openclaw-的差异化)
3. [v1.0.0 终局愿景](#v10-终局愿景)
4. [版本规划路线图](#版本规划路线图)
5. [详细任务分解](#详细任务分解)
6. [验收标准](#验收标准)

---

## 设计哲学与定位

### 核心定位

**universal-memory-mcp 不是另一个 OpenClaw，而是互补的产品。**

| 维度         | OpenClaw                          | universal-memory-mcp                |
| ------------ | --------------------------------- | ----------------------------------- |
| **用户群体** | 喜欢手动编辑 Markdown 的开发者    | 使用 AI CLI 工具的开发者            |
| **记忆方式** | 文件驱动（用户主动写入）          | API 驱动（AI 自动捕获）             |
| **核心价值** | 透明性、可控性                    | 自动化、智能化                      |
| **适用场景** | 多通道记忆（WhatsApp/Discord 等） | AI 开发助手（Claude Code/OpenCode） |
| **记忆架构** | 2 层（MEMORY.md + daily）         | 3 层（L0/L1/L2 生命周期）           |

### 我们的独特优势

#### 1. 三层记忆架构（核心差异化）

```
┌─────────────────────────────────────────────────────┐
│            Level 0: Daily Logs (原始记录)            │
│  • 自动捕获对话                                      │
│  • 原始格式存储                                      │
│  • 1-7 天生命周期                                    │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│       Level 1: Extracted Facts (事实提取)           │
│  • LLM 提取关键事实                                  │
│  • 结构化存储（decisions/facts/preferences）         │
│  • 7-30 天生命周期                                   │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│      Level 2: Consolidated Summary (知识整合)        │
│  • 深度整合和总结                                    │
│  • 长期知识库                                        │
│  • 30+ 天生命周期                                    │
└─────────────────────────────────────────────────────┘
```

**为什么这很重要？**

- ✅ **模拟人脑**：感觉记忆 → 短期记忆 → 长期记忆
- ✅ **信息密度**：L1 提取的事实比 L0 更精炼
- ✅ **检索效率**：在 L1/L2 搜索比在 L0 更准确
- ✅ **存储优化**：L0 定期清理，L1/L2 长期保留

#### 2. 时间衰减 + 项目相关性（召回质量）

```typescript
// 时间衰减公式（已在 v0.4.1 实现）
decay = 0.5 ^ (age_days / half_life)

// 项目相关性提升（已在 v0.4.1 实现）
if (memory.project === current_project) {
  score *= 1.5 // 同项目记忆提升 50%
}
```

**优势**：

- ✅ 最近的记忆更相关（指数衰减）
- ✅ 同项目记忆优先（1.5x boost）
- ✅ 可配置半衰期（默认 7 天）

#### 3. AI 原生设计（自动化）

```typescript
// 用户无需手动编辑，AI 自动记录
await memory_record({
  content: '我们决定使用 ZhipuAI 作为默认 embedding provider',
  category: 'decisions',
  project: 'universal-memory-mcp',
})
```

**优势**：

- ✅ 对话中自动捕获重要信息
- ✅ 无需打断工作流
- ✅ AI 可主动识别关键决策

### 我们从 OpenClaw 学到的（生产模式）

OpenClaw 已经是生产级系统，我们借鉴其成熟模式：

| OpenClaw 特性                     | 我们何时借鉴 | 优先级 |
| --------------------------------- | ------------ | ------ |
| **异步索引**                      | v0.5.0       | 🔴 高  |
| **候选池扩大 (4x)**               | v0.5.0       | 🔴 高  |
| **文件监视器 (chokidar)**         | v0.5.0       | 🔴 高  |
| **Embedding 缓存持久化 (SQLite)** | v0.6.0       | 🟡 中  |
| **Batch API 支持**                | v0.6.0       | 🟡 中  |
| **记忆 Flush 机制**               | v0.7.0       | 🟢 低  |
| **Per-agent 单例缓存**            | v0.7.0       | 🟢 低  |

---

## 与 OpenClaw 的差异化

### 设计理念对比

```
OpenClaw: "Plain Markdown as Source of Truth"
  ↓
  用户编辑 MEMORY.md
  ↓
  文件监视器检测变化
  ↓
  异步索引到 SQLite
  ↓
  向量 + 关键词混合搜索

universal-memory-mcp: "API-Driven Memory with Lifecycle"
  ↓
  AI 调用 memory_record
  ↓
  自动捕获到 daily/
  ↓
  Pipeline 提取到 L1/L2
  ↓
  时间衰减 + 项目相关性
  ↓
  RRF 混合搜索
```

### 何时选择哪个系统？

**选择 OpenClaw 如果你：**

- ✅ 喜欢手动编辑 Markdown 管理记忆
- ✅ 需要多通道记忆（WhatsApp/Discord/邮件）
- ✅ 需要 Git 版本控制
- ✅ 追求极致的透明性和可控性

**选择 universal-memory-mcp 如果你：**

- ✅ 使用 Claude Code/OpenCode 等 AI CLI 工具
- ✅ 希望 AI 自动记录对话（无需手动）
- ✅ 需要时间衰减（旧记忆自动降权）
- ✅ 需要项目相关性（同项目记忆优先）
- ✅ 看重三层记忆架构（L0→L1→L2）

**两者可以共存：**

```typescript
// universal-memory-mcp 记录 AI 对话
await memory_record(conversation)

// 定期导出为 Markdown（兼容 OpenClaw）
await export_to_markdown()

// 用户可以在 OpenClaw 中编辑导出的 Markdown
// universal-memory-mcp 重新导入时合并
```

---

## v1.0.0 终局愿景

### 产品定位

> **"为 AI CLI 工具提供生产级记忆系统，让 AI 从工具进化为伙伴"**

### 核心能力（v1.0.0 必须具备）

#### 1. 全自动记忆生命周期

```
用户与 AI 对话
    ↓
自动捕获重要信息（L0: daily logs）
    ↓
异步提取结构化事实（L1: facts/decisions/preferences）
    ↓
深度整合长期知识（L2: profile/summary）
    ↓
智能召回（时间衰减 + 项目相关性 + 元数据过滤）
```

#### 2. 生产级性能

| 指标           | 目标               | 当前      |
| -------------- | ------------------ | --------- |
| **搜索延迟**   | < 5ms              | 2.4ms ✅  |
| **索引延迟**   | < 10s (100 chunks) | 140s ❌   |
| **缓存命中率** | > 80%              | 未统计 ❌ |
| **召回准确率** | > 70%              | ~40% ❌   |

#### 3. 企业级可靠性

- ✅ **容错性**：Embedding Provider 失败时自动 fallback
- ✅ **可观测性**：完整的日志和监控指标
- ✅ **可测试性**：单元测试覆盖率 > 80%
- ✅ **可扩展性**：支持自定义 Embedding Provider

### 技术架构（v1.0.0）

```
┌───────────────────────────────────────────────────────┐
│                   AI CLI Tools                        │
│  (Claude Code / OpenCode / Copilot / etc.)           │
└───────────────────────┬───────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────┐
│              MCP Server Layer                         │
│  • memory_record (自动捕获)                           │
│  • memory_search (智能召回)                           │
│  • memory_update_long_term (手动分类)                │
└───────────────────────┬───────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────┐
│           Memory Manager (Orchestrator)                │
│  • 三层记忆协调（L0/L1/L2）                            │
│  • 异步索引（非阻塞）                                  │
│  • 时间衰减调度器                                      │
│  • 缓存管理（LRU + SQLite）                           │
└──┬────────────┬────────────┬────────────┬────────────┘
   │            │            │            │
   ▼            ▼            ▼            ▼
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────────┐
│ Pipeline│ │Hybrid   │ │Time     │ │Embedding     │
│ (L0→L1) │ │Search   │ │Decay    │ │Cache         │
└────┬────┘ └────┬────┘ └────┬────┘ └──────┬───────┘
     │           │           │               │
     ▼           ▼           ▼               ▼
┌───────────────────────────────────────────────────────┐
│              Storage Layer                            │
│  • SQLite (chunks, chunks_fts, files, cache)          │
│  • File System (daily/, long_term/, archive/)        │
└───────────────────────────────────────────────────────┘
```

---

## 版本规划路线图

### 总览

```
v0.4.1 (当前) → v0.5.0 → v0.6.0 → v0.7.0 → v1.0.0
   ✅          🚧      📋      📋      🎯
已完成      进行中    规划中   规划中   目标
```

### 版本时间表

| 版本       | 目标日期 | 关键成果                         | 复杂度 |
| ---------- | -------- | -------------------------------- | ------ |
| **v0.5.0** | 2 周     | 性能优化（异步索引、候选池扩大） | 中     |
| **v0.6.0** | 4 周     | 三层记忆架构（L0→L1→L2）         | 高     |
| **v0.7.0** | 3 周     | 企业级特性（监控、测试、文档）   | 中     |
| **v1.0.0** | 2 周     | 生产就绪（性能优化、稳定性）     | 高     |

**总计**：约 11 周（~3 个月）

---

## 详细任务分解

### v0.5.0：性能优化与生产模式

**目标**：借鉴 OpenClaw 的成熟模式，提升性能和用户体验

#### 任务 1：异步索引（高优先级）

**问题**：当前索引是同步的，搜索时必须等待索引完成

**解决方案**：

```typescript
// packages/core/src/vectorstore/pipeline.ts
async indexRecent(days: number) {
  // 1. 立即返回（不等待）
  const job = {
    id: generateId(),
    status: 'pending',
    started_at: Date.now()
  };

  // 2. 后台执行
  setImmediate(async () => {
    try {
      await this._doIndex(days);
      job.status = 'completed';
    } catch (err) {
      job.status = 'failed';
      job.error = err.message;
    }
  });

  return job;
}
```

**验收标准**：

- ✅ `memory_search` 立即返回（< 5ms），即使索引未完成
- ✅ 索引在后台执行，不阻塞搜索
- ✅ 索引失败不影响搜索

#### 任务 2：候选池扩大（高优先级）

**问题**：混合搜索时，Top-10 可能漏掉边缘相关项

**解决方案**：

```typescript
// packages/core/src/search/enhanced.ts
async hybridSearch(query: string, opts: HybridOptions) {
  const candidates = Math.min(
    200,  // 硬上限
    Math.floor(opts.limit * opts.candidateMultiplier)  // 扩大 4x
  );

  // Step 1: 扩大检索
  const vectorResults = await this.vectorStore.semanticSearch(
    embedding,
    candidates  // 40 个候选（limit=10, multiplier=4）
  );

  const keywordResults = await this.vectorStore.keywordSearch(
    query,
    candidates  // 40 个候选
  );

  // Step 2: 合并 + 排序 + 截断
  const merged = this.mergeAndRank(vectorResults, keywordResults, opts);
  return merged.slice(0, opts.limit);  // 返回 Top-10
}
```

**验收标准**：

- ✅ 候选池扩大 4x（`candidateMultiplier: 4`）
- ✅ 召回率提升 20-30%
- ✅ 最终结果仍限制在 `limit` 内

#### 任务 3：文件监视器（高优先级）

**问题**：手动运行 Pipeline 不符合生产模式

**解决方案**：

```typescript
// packages/core/src/watcher.ts
import chokidar from 'chokidar'

export class MemoryWatcher {
  private watcher: FSWatcher

  watch(memoryPath: string, onChange: () => void) {
    this.watcher = chokidar
      .watch(memoryPath, {
        ignored: /(^|[\/\\])\../,
        persistent: true,
        ignoreInitial: true,
      })
      .on('change', debounce(onChange, 5000)) // 5s debounce
      .on('add', debounce(onChange, 5000))
  }

  close() {
    this.watcher?.close()
  }
}
```

**集成到 MemoryManager**：

```typescript
// packages/core/src/memory-manager.ts
private ensureWatcher() {
  if (this.watcher) return;

  this.watcher = new MemoryWatcher();
  this.watcher.watch(this.memoryPath, () => {
    this.dirty = true;
    void this.pipeline.indexRecent(1);  // 异步索引最近 1 天
  });
}
```

**验收标准**：

- ✅ 文件变化自动触发索引（debounce 5s）
- ✅ 新文件自动添加到索引
- ✅ 删除文件自动从索引移除

#### 任务 4：混合搜索算法优化（中优先级）

**问题**：当前使用 RRF，但 OpenClaw 的 Weighted Score 更直观

**解决方案**：

```typescript
// packages/core/src/search/hybrid.ts
export function weightedScoreMerge(
  vectorResults: SearchResult[],
  keywordResults: SearchResult[],
  opts: { vectorWeight: number; textWeight: number }
): SearchResult[] {
  const byId = new Map<string, SearchResult>()

  // 归一化向量分数
  for (const r of vectorResults) {
    byId.set(r.id, { ...r, vectorScore: r.score, textScore: 0 })
  }

  // 归一化关键词分数（BM25 rank → score）
  for (const r of keywordResults) {
    const textScore = 1 / (1 + r.rank) // BM25 rank to score
    const existing = byId.get(r.id)
    if (existing) {
      existing.textScore = textScore
    } else {
      byId.set(r.id, { ...r, vectorScore: 0, textScore })
    }
  }

  // 加权融合
  const merged = Array.from(byId.values()).map((entry) => ({
    ...entry,
    score: opts.vectorWeight * entry.vectorScore + opts.textWeight * entry.textScore,
  }))

  return merged.sort((a, b) => b.score - a.score)
}
```

**验收标准**：

- ✅ 支持 Weighted Score 和 RRF 两种算法
- ✅ 权重可配置（默认 `vectorWeight: 0.7, textWeight: 0.3`）
- ✅ 分数在 0-1 区间（归一化）

#### v0.5.0 验收标准

- ✅ 搜索延迟 < 5ms（异步索引）
- ✅ 召回率 > 60%（候选池扩大）
- ✅ 文件变化自动索引（文件监视器）
- ✅ 混合搜索支持两种算法（Weighted/RRF）
- ✅ 向后兼容 v0.4.1 API

---

### v0.6.0：三层记忆架构

**目标**：实现 L0→L1→L2 生命周期管理（核心差异化）

#### 任务 1：Level 0 → Level 1 提取（高优先级）

**问题**：当前所有数据都在 L0，需要自动提取到 L1

**解决方案**：

```typescript
// packages/core/src/pipeline/extractor.ts
export class FactExtractor {
  async extractFacts(dailyLog: MemoryFileEntry): Promise<ExtractedFact[]> {
    const content = await fs.readFile(dailyLog.absPath, 'utf-8')

    // 用 LLM 提取结构化事实
    const prompt = `
    请从以下对话中提取关键信息，输出 JSON：

    ${content}

    提取格式：
    {
      "decisions": ["决定：xxx"],
      "facts": ["事实：xxx"],
      "preferences": ["偏好：xxx"]
    }
    `

    const result = await this.llm.complete(prompt)
    const parsed = JSON.parse(result)

    return [
      ...parsed.decisions.map((d) => ({ type: 'decisions', content: d })),
      ...parsed.facts.map((f) => ({ type: 'facts', content: f })),
      ...parsed.preferences.map((p) => ({ type: 'preferences', content: p })),
    ]
  }
}
```

**存储到 L1**：

```typescript
// packages/core/src/storage/long-term.ts
export async function saveToL1(fact: ExtractedFact, project: string) {
  const categoryPath = path.join(LONG_TERM_DIR, project, `${fact.type}.md`)

  const entry = `
## ${fact.content}

- 提取时间：${new Date().toISOString()}
- 来源项目：${project}
- 访问次数：0
- 重要性：0.5
`

  await fs.appendFile(categoryPath, entry)
}
```

**验收标准**：

- ✅ Pipeline 自动提取 L0 → L1
- ✅ 支持 3 种类别（decisions/facts/preferences）
- ✅ 提取准确率 > 70%

#### 任务 2：Level 1 → Level 2 整合（高优先级）

**问题**：L1 需要深度整合为 L2（长期知识）

**解决方案**：

```typescript
// packages/core/src/pipeline/consolidator.ts
export class MemoryConsolidator {
  async consolidateToL2(category: string, project: string) {
    // 1. 读取 L1 的所有 facts
    const l1Facts = await this.loadL1Facts(category, project)

    // 2. 用 LLM 整合
    const prompt = `
    请将以下 ${category} 整合为结构化知识：

    ${l1Facts.map((f) => `- ${f.content}`).join('\n')}

    输出格式：
    ## ${category}

    ### 核心知识点
    - ...

    ### 关键决策
    - ...

    ### 用户偏好
    - ...
    `

    const summary = await this.llm.complete(prompt)

    // 3. 保存到 L2
    const l2Path = path.join(LONG_TERM_DIR, project, `${category}_consolidated.md`)
    await fs.writeFile(l2Path, summary)
  }
}
```

**验收标准**：

- ✅ L1 → L2 每周自动整合
- ✅ L2 内容结构化（Markdown 标题层次）
- ✅ L2 可读性强（用户可直接编辑）

#### 任务 3：生命周期调度器（高优先级）

**问题**：需要自动管理 L0→L1→L2 的迁移

**解决方案**：

```typescript
// packages/core/src/scheduler/lifecycle.ts
export class LifecycleScheduler {
  async run() {
    const now = Date.now()

    // 1. L0 → L1（1-7 天）
    const oldDailyLogs = await this.findDailyLogs({ age: '1-7d' })
    for (const log of oldDailyLogs) {
      const facts = await this.extractor.extractFacts(log)
      await this.saveToL1(facts, log.project)
    }

    // 2. L1 → L2（7-30 天）
    const oldL1Facts = await this.findL1Facts({ age: '7-30d' })
    for (const category of ['decisions', 'facts', 'preferences']) {
      await this.consolidator.consolidateToL2(category, project)
    }

    // 3. L0 清理（> 7 天）
    await this.cleanDailyLogs({ age: '>7d' })

    // 4. L1 清理（> 30 天）
    await this.cleanL1Facts({ age: '>30d' })
  }

  start() {
    // 每天凌晨 2 点运行
    cron.schedule('0 2 * * *', () => this.run())
  }
}
```

**验收标准**：

- ✅ L0→L1 自动迁移（1-7 天）
- ✅ L1→L2 自动整合（7-30 天）
- ✅ L0/L1 自动清理（> 7/30 天）
- ✅ 可配置时间阈值

#### 任务 4：元数据增强（中优先级）

**问题**：搜索时需要考虑元数据（项目、时间、访问频次）

**解决方案**：

```typescript
// packages/core/src/search/metadata.ts
export function applyMetadataBoost(
  results: SearchResult[],
  filters: MetadataFilters
): SearchResult[] {
  for (const result of results) {
    let boost = 1.0

    // 项目匹配：+50%
    if (result.project === filters.project) {
      boost *= 1.5
    }

    // 最近访问：+10%
    if (result.last_accessed > filters.min_date) {
      boost *= 1.1
    }

    // 高重要性：+15%
    if (result.importance > 0.8) {
      boost *= 1.15
    }

    // 高访问频次：+10%
    if (result.access_count > 10) {
      boost *= 1.1
    }

    result.score *= boost
  }

  return results.sort((a, b) => b.score - a.score)
}
```

**验收标准**：

- ✅ 支持项目、时间、重要性、访问频次加权
- ✅ 元数据可配置
- ✅ 搜索结果包含元数据

#### v0.6.0 验收标准

- ✅ 三层记忆架构完整实现（L0/L1/L2）
- ✅ L0→L1 自动提取（准确率 > 70%）
- ✅ L1→L2 自动整合（每周）
- ✅ 生命周期自动调度（每天）
- ✅ 元数据增强（项目/时间/频次）

---

### v0.7.0：企业级特性

**目标**：监控、测试、文档完善

#### 任务 1：可观测性（高优先级）

**指标收集**：

```typescript
// packages/core/src/monitoring/metrics.ts
export class MetricsCollector {
  recordSearch(query: string, duration: number, resultCount: number) {
    this.metrics.push({
      type: 'search',
      query,
      duration,
      resultCount,
      timestamp: Date.now(),
    })
  }

  recordIndexing(fileCount: number, chunkCount: number, duration: number) {
    this.metrics.push({
      type: 'indexing',
      fileCount,
      chunkCount,
      duration,
      timestamp: Date.now(),
    })
  }

  getStats() {
    return {
      avgSearchLatency: this.avg('search', 'duration'),
      avgIndexingTime: this.avg('indexing', 'duration'),
      cacheHitRate: this.cacheHitRate(),
      totalSearches: this.count('search'),
      totalIndexings: this.count('indexing'),
    }
  }
}
```

**验收标准**：

- ✅ 搜索延迟统计（P50/P95/P99）
- ✅ 索引性能统计
- ✅ 缓存命中率
- ✅ 导出 Prometheus 格式

#### 任务 2：单元测试（高优先级）

**测试覆盖**：

```typescript
// packages/core/src/search/__tests__/hybrid.test.ts
describe('HybridSearch', () => {
  it('should merge vector and keyword results', async () => {
    const vectorResults = [
      { id: '1', score: 0.8, content: 'AI 助手' },
      { id: '2', score: 0.6, content: '记忆系统' },
    ]

    const keywordResults = [
      { id: '1', rank: 0, content: 'AI 助手' },
      { id: '3', rank: 1, content: '向量搜索' },
    ]

    const merged = await hybridSearch(vectorResults, keywordResults, {
      vectorWeight: 0.7,
      textWeight: 0.3,
    })

    expect(merged).toHaveLength(3)
    expect(merged[0].id).toBe('1') // 两者都有，分数最高
  })

  it('should apply candidate multiplier', async () => {
    const results = await hybridSearch(query, {
      limit: 10,
      candidateMultiplier: 4,
    })

    // 应该检索 40 个候选
    expect(retrievedCandidates).toBe(40)
    // 但只返回 10 个
    expect(results).toHaveLength(10)
  })
})
```

**验收标准**：

- ✅ 单元测试覆盖率 > 80%
- ✅ 集成测试覆盖关键路径
- ✅ E2E 测试覆盖 MCP 工具

#### 任务 3：文档完善（中优先级）

**文档清单**：

- ✅ API 文档（所有 MCP 工具）
- ✅ 架构文档（三层记忆、混合搜索）
- ✅ 部署文档（安装、配置）
- ✅ 迁移指南（v0.4.x → v0.5.0）
- ✅ 故障排查（常见问题）

**验收标准**：

- ✅ 文档完整性（所有公开 API 有文档）
- ✅ 示例代码（每个工具有使用示例）
- ✅ 视频教程（基础功能演示）

#### 任务 4：性能基准测试（中优先级）

**基准测试套件**：

```typescript
// packages/core/src/benchmarks/search.bench.ts
import { benchmark } from 'vitest'

benchmark('hybrid search', async () => {
  await memory_search('AI 助手的设计原则', { limit: 10 })
})

benchmark('semantic search', async () => {
  await memory_search('记忆系统', {
    strategy: 'semantic',
    limit: 10,
  })
})

benchmark('keyword search', async () => {
  await memory_search('vector database', {
    strategy: 'keyword',
    limit: 10,
  })
})
```

**验收标准**：

- ✅ 搜索延迟 < 5ms（P95）
- ✅ 索引速度 > 10 chunks/s
- ✅ 缓存命中率 > 80%

#### v0.7.0 验收标准

- ✅ 监控指标完整（延迟、缓存、索引）
- ✅ 测试覆盖率 > 80%
- ✅ 文档完整（API、架构、部署）
- ✅ 性能基准通过（搜索 < 5ms）

---

### v1.0.0：生产就绪

**目标**：最后优化，发布稳定版本

#### 任务 1：Embedding 缓存持久化（高优先级）

**问题**：当前缓存是内存 LRU，重启后失效

**解决方案**：

```sql
-- 新增 embedding_cache 表
CREATE TABLE embedding_cache (
  provider TEXT NOT NULL,        -- zhipuai/gemini/openai
  model TEXT NOT NULL,           -- embedding-2
  provider_key TEXT NOT NULL,    -- endpoint fingerprint
  hash TEXT NOT NULL,            -- SHA-256 of content
  embedding TEXT NOT NULL,       -- JSON array
  dims INTEGER,                  -- 1024
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (provider, model, provider_key, hash)
);

CREATE INDEX idx_embedding_cache_updated_at
ON embedding_cache(updated_at);
```

**使用缓存**：

```typescript
// packages/core/src/embedding/provider.ts
async embed(text: string): Promise<number[]> {
  const hash = hashText(text);
  const cacheKey = { provider: this.name, model: this.model, hash };

  // 1. 检查 SQLite 缓存
  const cached = await this.db.get(
    'SELECT embedding FROM embedding_cache WHERE provider = ? AND model = ? AND hash = ?',
    [this.name, this.model, hash]
  );

  if (cached) {
    return JSON.parse(cached.embedding);
  }

  // 2. 调用 API
  const embedding = await this.callAPI(text);

  // 3. 写入缓存
  await this.db.run(
    'INSERT OR REPLACE INTO embedding_cache VALUES (?, ?, ?, ?, ?, ?, ?)',
    [this.name, this.model, this.providerKey, hash, JSON.stringify(embedding), embedding.length, Date.now()]
  );

  return embedding;
}
```

**验收标准**：

- ✅ 缓存持久化到 SQLite
- ✅ 重启后缓存仍有效
- ✅ 缓存命中率 > 80%
- ✅ 提供 `--clear-cache` 命令

#### 任务 2：Batch API 支持（中优先级）

**问题**：大规模索引时，同步 API 太慢

**解决方案**：

```typescript
// packages/core/src/embedding/batch-openai.ts
export async function runOpenAiEmbeddingBatches(params: {
  apiKey: string
  model: string
  chunks: Array<{ id: string; text: string }>
  concurrency: number
}) {
  // 1. 分批（每批 2000 个请求）
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

**验收标准**：

- ✅ 支持 OpenAI/Gemini Batch API
- ✅ 大规模索引加速 > 30%
- ✅ 成本节省 50%（Batch 折扣）

#### 任务 3：记忆 Flush 机制（中优先级）

**问题**：索引前需要清理旧数据

**解决方案**：

```typescript
// packages/core/src/vectorstore/pipeline.ts
async flushOldChunks() {
  // 1. 找出所有已被删除的文件
  const indexedFiles = await this.db
    .prepare('SELECT DISTINCT path FROM chunks')
    .all();

  for (const file of indexedFiles) {
    if (!await fs.exists(file.path)) {
      // 2. 从索引删除
      await this.db.prepare('DELETE FROM chunks WHERE path = ?').run(file.path);
      await this.db.prepare('DELETE FROM chunks_fts WHERE path = ?').run(file.path);
    }
  }

  // 3. Vacuum 数据库
  await this.db.exec('VACUUM');
}
```

**验收标准**：

- ✅ 索引前自动 flush
- ✅ 删除文件自动清理
- ✅ 数据库大小优化

#### 任务 4：稳定性优化（高优先级）

**容错机制**：

```typescript
// packages/core/src/embedding/provider.ts
async embedWithFallback(text: string): Promise<number[]> {
  const errors = [];

  // 1. 尝试主 provider
  try {
    return await this.primaryProvider.embed(text);
  } catch (err) {
    errors.push({ provider: this.primaryProvider.name, error: err });
  }

  // 2. 尝试备用 provider
  try {
    return await this.fallbackProvider.embed(text);
  } catch (err) {
    errors.push({ provider: this.fallbackProvider.name, error: err });
  }

  // 3. 全部失败，抛出错误
  throw new EmbeddingError('All providers failed', errors);
}
```

**验收标准**：

- ✅ Embedding Provider 失败自动 fallback
- ✅ 索引失败不影响搜索
- ✅ 错误日志完整

#### 任务 5：性能优化（高优先级）

**优化点**：

1. **并发索引**：

```typescript
// 并发 embedding（限制并发数）
const chunks = await Promise.all(
  chunkArray(chunks, this.concurrency).map((batch) =>
    Promise.all(batch.map((chunk) => this.embed(chunk)))
  )
)
```

2. **批量写入**：

```typescript
// 批量插入 SQLite
const stmt = this.db.prepare(`
  INSERT INTO chunks (id, path, source, start_line, end_line, hash, model, text, embedding, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const transaction = this.db.transaction(chunks => {
  for (const chunk of chunks) {
    stmt.run(...);
  }
});

transaction(chunks);
```

**验收标准**：

- ✅ 索引速度 > 20 chunks/s（当前 ~7 chunks/s）
- ✅ 搜索延迟 < 3ms（P95）
- ✅ 并发安全（多进程）

#### v1.0.0 验收标准

- ✅ 所有 v0.5.0-v0.7.0 特性稳定
- ✅ 性能达标（搜索 < 3ms，索引 > 20 chunks/s）
- ✅ 测试覆盖率 > 80%
- ✅ 文档完整
- ✅ 生产环境验证（至少 1 个真实项目使用 > 1 个月）

---

## 验收标准

### v1.0.0 最终验收

#### 功能完整性

- ✅ 三层记忆架构（L0/L1/L2）
- ✅ 混合搜索（向量 + 关键词）
- ✅ 时间衰减 + 项目相关性
- ✅ 异步索引（非阻塞）
- ✅ 文件监视器（自动索引）
- ✅ Embedding 缓存持久化
- ✅ Batch API 支持
- ✅ 生命周期自动调度

#### 性能指标

| 指标               | 目标          | 验证方法          |
| ------------------ | ------------- | ----------------- |
| **搜索延迟 (P95)** | < 3ms         | 基准测试          |
| **索引速度**       | > 20 chunks/s | 1000 chunks < 50s |
| **缓存命中率**     | > 80%         | 监控统计          |
| **召回准确率**     | > 70%         | 人工验证          |
| **并发支持**       | 10+ 并发搜索  | 压力测试          |

#### 可靠性指标

| 指标           | 目标   | 验证方法          |
| -------------- | ------ | ----------------- |
| **测试覆盖率** | > 80%  | `vitest coverage` |
| **错误率**     | < 0.1% | 监控统计          |
| **MTBF**       | > 720h | 生产环境          |
| **数据丢失率** | 0      | SQLite 事务       |

#### 用户体验

- ✅ 安装简单（`npm install -g`）
- ✅ 配置清晰（环境变量 + config file）
- ✅ 文档完整（API + 架构 + 故障排查）
- ✅ 示例丰富（每个工具有示例）
- ✅ 错误信息友好

---

## 风险与挑战

### 技术风险

| 风险                   | 影响      | 缓解措施                         |
| ---------------------- | --------- | -------------------------------- |
| **Embedding API 限流** | 索引延迟  | Batch API + 本地模型 fallback    |
| **SQLite 性能瓶颈**    | 搜索延迟  | 优化索引 + 考虑迁移到 PostgreSQL |
| **LLM 提取准确率**     | L1 质量差 | Prompt 优化 + 人工审核           |
| **文件系统冲突**       | 索引损坏  | 文件锁 + 事务                    |

### 业务风险

| 风险                 | 影响       | 缓解措施            |
| -------------------- | ---------- | ------------------- |
| **用户增长导致成本** | API 费用高 | 本地模型 + 缓存优化 |
| **竞品模仿**         | 差异化消失 | 三层架构 + 时间衰减 |
| **MCP 生态变化**     | 兼容性问题 | 模块化设计 + 适配层 |

---

## 总结

### 我们的核心竞争力

1. **三层记忆架构**：模拟人脑，L0→L1→L2 生命周期
2. **时间衰减 + 项目相关性**：智能召回，不只是向量搜索
3. **AI 原生**：API 驱动，自动捕获，无需手动编辑
4. **生产级性能**：异步索引、缓存持久化、Batch API

### 与 OpenClaw 的关系

- ✅ 借鉴生产模式（异步索引、文件监视器、候选池扩大）
- ✅ 保持差异化（三层架构、时间衰减、AI 原生）
- ✅ 可以共存（导出 Markdown，互相补充）

### 达到 v1.0.0 的保证

如果严格按照本路线图执行：

- ✅ **v0.5.0**（2 周）：性能优化，用户体验提升
- ✅ **v0.6.0**（4 周）：三层架构，核心差异化完成
- ✅ **v0.7.0**（3 周）：企业级特性，生产就绪
- ✅ **v1.0.0**（2 周）：最终优化，稳定发布

**总计 11 周（~3 个月）**，保证达到生产级标准。

---

**下一步行动**：

1. **立即开始 v0.5.0**（异步索引、候选池扩大、文件监视器）
2. **每周同步进度**（GitHub Issues + Project Board）
3. **持续集成测试**（GitHub Actions CI）
4. **社区反馈**（Discord + Discussions）

**让我们一起把 universal-memory-mcp 打造成 AI 记忆系统的标杆！** 🚀
