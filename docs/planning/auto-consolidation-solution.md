# 长期记忆自动整理解决方案

## 问题分析

### 当前机制的问题

**现状**：
- ✅ Stop hook 自动记录每次对话到 daily/*.md
- ❌ 长期记忆更新完全依赖 LLM 主动调用 `memory_update_long_term`
- ❌ LLM 经常忘记调用，导致长期记忆不更新

**数据验证**：
```bash
# 长期记忆最后更新时间
$ stat ~/.ai_memory/long_term/MEMORY.md
2026-01-28 11:29:08  # 昨天

# 今天的对话记录
$ wc -l ~/.ai_memory/daily/2026-01-29.md
313 lines  # 大量对话，但没有提取到长期记忆
```

**根本原因**：
1. **依赖 LLM 主动性**：Skill 只是"建议"，不是强制
2. **判断困难**：LLM 难以判断什么信息"重要到需要存入长期记忆"
3. **时机不对**：在对话中调用会打断流程，LLM 倾向于跳过

## 解决方案对比

### 方案 1: 强化 Skill 指导（短期）⚠️

**思路**：更强的 prompt 引导

**优点**：
- 实现简单，只需修改 SKILL.md
- 不需要额外基础设施

**缺点**：
- ❌ 治标不治本，LLM 仍可能忘记
- ❌ 增加 LLM 负担，每次都要判断
- ❌ 打断对话流程

**结论**：不推荐作为主要方案

### 方案 2: 后台自动整理（推荐）✅

**思路**：定期自动分析 daily 日志，提取关键信息

**架构**：
```
┌─────────────────────────────────────────┐
│  对话发生                                │
│  ↓                                      │
│  Stop Hook 自动记录到 daily/*.md        │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  后台整理服务（定时触发）                │
│  ├─ 扫描最近 N 天的 daily 日志           │
│  ├─ 使用 LLM 批量提取关键信息            │
│  ├─ 去重、合并                          │
│  └─ 更新 long_term/MEMORY.md            │
└─────────────────────────────────────────┘
```

**优点**：
- ✅ 不依赖 LLM 主动性
- ✅ 不打断对话流程
- ✅ 批量处理，效率高
- ✅ 可以优化提取质量

**缺点**：
- 需要额外的后台服务
- 有延迟（但可接受）

**结论**：推荐作为主要方案

### 方案 3: 混合方案（最佳）🎯

**思路**：方案 1 + 方案 2

1. **实时提取**（可选）：LLM 在对话中发现明显的重要信息时立即调用
2. **定期整理**（必须）：后台服务定期批量提取

**优点**：
- ✅ 兼顾实时性和可靠性
- ✅ 重要信息不会遗漏
- ✅ 不完全依赖 LLM

## 实施方案：后台自动整理

### 架构设计

#### 1. 触发机制

**三种触发方式**：

```typescript
enum ConsolidationTrigger {
  SCHEDULED = 'scheduled',  // 定时触发（推荐）
  THRESHOLD = 'threshold',  // 阈值触发
  MANUAL = 'manual',        // 手动触发
}
```

**定时触发**（推荐）：
```typescript
// 使用 cron 表达式
const schedule = {
  daily: '0 2 * * *',      // 每天凌晨 2 点
  weekly: '0 2 * * 0',     // 每周日凌晨 2 点
  manual: null,            // 手动触发
};
```

**阈值触发**：
```typescript
// 当满足条件时触发
const threshold = {
  newConversations: 50,    // 新增 50 条对话
  daysSinceLastRun: 7,     // 距离上次运行 7 天
};
```

#### 2. 整理流程

```typescript
async function consolidateMemories(options: ConsolidationOptions) {
  // 1. 扫描待整理的对话
  const conversations = await scanUnconsolidatedConversations({
    days: options.days || 7,
    minConversations: options.minConversations || 10,
  });

  if (conversations.length === 0) {
    console.log('No new conversations to consolidate');
    return;
  }

  // 2. 批量提取关键信息
  const extracted = await extractKeyInformation(conversations);

  // 3. 去重和合并
  const deduplicated = await deduplicateAndMerge(extracted);

  // 4. 更新长期记忆
  await updateLongTermMemory(deduplicated);

  // 5. 标记已整理
  await markAsConsolidated(conversations);

  console.log(`Consolidated ${conversations.length} conversations`);
}
```

#### 3. LLM 提取 Prompt

**关键设计**：
- 批量处理（一次处理多条对话）
- 结构化输出（JSON 格式）
- 明确的提取规则

```typescript
const EXTRACTION_PROMPT = `
你是一个记忆整理助手。分析以下对话记录，提取重要信息。

## 对话记录

{conversations}

## 提取规则

### 1. Preferences（用户偏好）
提取用户的：
- 编程语言偏好（如 TypeScript、Python）
- 工具选择（如 VSCode、Vim）
- 代码风格（如缩进、命名）
- 沟通风格（如简洁、详细）

### 2. Decisions（重要决策）
提取技术决策：
- 架构选择（如微服务、单体）
- 技术栈选择（如 React、Vue）
- 设计模式（如 MVC、MVVM）
- 方案对比和选择理由

### 3. Facts（关键事实）
提取项目信息：
- 项目名称和描述
- 技术栈和依赖
- 团队结构
- 业务逻辑

### 4. Contacts（联系人）
提取提到的：
- 人名和角色
- 团队名称
- 组织机构

## 输出格式

返回 JSON 格式：

\`\`\`json
{
  "preferences": [
    {
      "content": "用户偏好使用 TypeScript 而非 JavaScript",
      "confidence": 0.9,
      "source_conversation_id": "abc123",
      "timestamp": "2026-01-29T10:30:00Z"
    }
  ],
  "decisions": [
    {
      "content": "选择 PostgreSQL 作为主数据库，因为需要复杂查询和事务支持",
      "confidence": 0.95,
      "source_conversation_id": "def456",
      "timestamp": "2026-01-29T11:00:00Z"
    }
  ],
  "facts": [...],
  "contacts": [...]
}
\`\`\`

## 注意事项

1. **只提取明确的信息**：不要推测或假设
2. **保留上下文**：包含足够的背景信息
3. **标注置信度**：0-1 之间，表示信息的可靠性
4. **去重**：如果多条对话提到相同信息，只保留最详细的一条
5. **忽略琐碎信息**：如简单问候、确认等

现在开始提取：
`;
```

#### 4. 去重策略

**问题**：
- 多条对话可能提到相同的信息
- 需要合并和去重

**方案**：基于语义相似度

```typescript
async function deduplicateAndMerge(
  extracted: ExtractedInfo[]
): Promise<ExtractedInfo[]> {
  const deduplicated: ExtractedInfo[] = [];

  for (const item of extracted) {
    // 查找相似的已有条目
    const similar = await findSimilarEntry(item, deduplicated);

    if (similar && similar.similarity > 0.85) {
      // 合并：保留更详细的版本
      const merged = mergeEntries(similar.entry, item);
      deduplicated[similar.index] = merged;
    } else {
      // 新条目
      deduplicated.push(item);
    }
  }

  return deduplicated;
}

async function findSimilarEntry(
  item: ExtractedInfo,
  existing: ExtractedInfo[]
): Promise<{ entry: ExtractedInfo; index: number; similarity: number } | null> {
  // 使用向量相似度（如果有 embedding）
  if (embeddingEnabled) {
    const itemEmbedding = await generateEmbedding(item.content);

    for (let i = 0; i < existing.length; i++) {
      const existingEmbedding = await generateEmbedding(existing[i].content);
      const similarity = cosineSimilarity(itemEmbedding, existingEmbedding);

      if (similarity > 0.85) {
        return { entry: existing[i], index: i, similarity };
      }
    }
  }

  // 降级方案：关键词匹配
  for (let i = 0; i < existing.length; i++) {
    const similarity = keywordSimilarity(item.content, existing[i].content);
    if (similarity > 0.8) {
      return { entry: existing[i], index: i, similarity };
    }
  }

  return null;
}

function mergeEntries(
  existing: ExtractedInfo,
  newItem: ExtractedInfo
): ExtractedInfo {
  // 保留更详细的版本
  const longerContent = existing.content.length > newItem.content.length
    ? existing.content
    : newItem.content;

  // 合并来源
  const sources = [
    ...existing.source_conversation_ids || [existing.source_conversation_id],
    newItem.source_conversation_id,
  ];

  return {
    ...existing,
    content: longerContent,
    confidence: Math.max(existing.confidence, newItem.confidence),
    source_conversation_ids: [...new Set(sources)],
    updated_at: new Date(),
  };
}
```

#### 5. 更新长期记忆

**格式**：保持现有的 Markdown 格式

```typescript
async function updateLongTermMemory(extracted: ExtractedInfo[]) {
  const memoryPath = join(storagePath, 'long_term', 'MEMORY.md');

  // 读取现有内容
  const existing = await readFile(memoryPath, 'utf-8');

  // 按分类组织
  const byCategory = groupByCategory(extracted);

  // 更新每个分类
  for (const [category, items] of Object.entries(byCategory)) {
    const section = formatSection(category, items);
    existing = updateSection(existing, category, section);
  }

  // 写回文件
  await writeFile(memoryPath, existing, 'utf-8');
}

function formatSection(category: string, items: ExtractedInfo[]): string {
  const title = {
    preferences: 'User Preferences',
    decisions: 'Important Decisions',
    facts: 'Key Facts',
    contacts: 'Contacts',
  }[category];

  let section = `## ${title}\n\n`;

  if (items.length === 0) {
    section += `_No ${category} recorded yet._\n\n`;
  } else {
    for (const item of items) {
      const timestamp = formatDate(item.timestamp);
      section += `- [${timestamp}] ${item.content}\n`;

      // 可选：添加来源引用
      if (item.source_conversation_ids?.length > 1) {
        section += `  _Sources: ${item.source_conversation_ids.length} conversations_\n`;
      }
      section += '\n';
    }
  }

  return section;
}
```

### 实现方式

#### 方式 1: CLI 命令（简单）

**实现**：
```bash
# 添加新命令
universal-memory-consolidate [options]

# 选项
--days <n>          # 整理最近 N 天（默认 7）
--min <n>           # 最少对话数（默认 10）
--dry-run           # 预览不执行
--force             # 强制执行
```

**使用**：
```bash
# 手动触发
$ universal-memory-consolidate

# 配合 cron 定时执行
$ crontab -e
0 2 * * * universal-memory-consolidate --days 7
```

**优点**：
- 实现简单
- 用户可控
- 易于调试

**缺点**：
- 需要用户配置 cron
- 不够自动化

#### 方式 2: 后台服务（完整）

**实现**：
```typescript
// packages/consolidation-service/
class ConsolidationService {
  private scheduler: NodeSchedule;
  private config: ConsolidationConfig;

  async start() {
    // 启动定时任务
    this.scheduler.scheduleJob(this.config.schedule, async () => {
      await this.consolidate();
    });

    console.log('Consolidation service started');
  }

  async consolidate() {
    try {
      const result = await consolidateMemories(this.config);
      console.log('Consolidation completed:', result);
    } catch (error) {
      console.error('Consolidation failed:', error);
    }
  }
}
```

**启动方式**：
```bash
# 作为系统服务运行
$ universal-memory-service start

# 或者在 postinstall 时自动启动
```

**优点**：
- 完全自动化
- 可靠性高
- 可以添加监控

**缺点**：
- 实现复杂
- 需要进程管理

#### 方式 3: MCP Tool 触发（混合）

**实现**：
```typescript
// 添加新的 MCP tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'memory_consolidate') {
    const { days = 7, force = false } = args;

    const result = await consolidateMemories({ days, force });

    return {
      content: [{
        type: 'text',
        text: `Consolidated ${result.count} conversations into long-term memory`,
      }],
    };
  }
});
```

**使用**：
```javascript
// LLM 可以主动调用
memory_consolidate({ days: 7 })

// 或者用户手动触发
$ claude "请整理最近一周的记忆"
```

**优点**：
- 灵活性高
- 可以按需触发
- 与现有架构一致

**缺点**：
- 仍需要主动触发
- 不够自动

### 推荐实施路径

#### Phase 1: CLI 命令（v0.3.2）

**目标**：快速验证整理效果

1. 实现 `universal-memory-consolidate` 命令
2. 实现 LLM 提取逻辑
3. 实现去重合并
4. 手动测试

**时间**：1-2 天

#### Phase 2: MCP Tool（v0.4.0）

**目标**：集成到 MCP 工具链

1. 添加 `memory_consolidate` tool
2. 更新 Skill 指导（建议定期整理）
3. 添加配置选项

**时间**：1 天

#### Phase 3: 自动定时（v0.5.0）

**目标**：完全自动化

1. 实现定时调度
2. 添加配置界面
3. 添加通知机制

**时间**：2-3 天

## 配置选项

```typescript
interface ConsolidationConfig {
  // 触发配置
  trigger: 'scheduled' | 'threshold' | 'manual';
  schedule?: string;  // cron 表达式
  threshold?: {
    newConversations: number;
    daysSinceLastRun: number;
  };

  // 整理配置
  days: number;  // 整理最近 N 天
  minConversations: number;  // 最少对话数
  batchSize: number;  // 批量处理大小

  // LLM 配置
  llmProvider: 'anthropic' | 'openai' | 'gemini';
  llmModel?: string;
  temperature?: number;

  // 去重配置
  deduplicationEnabled: boolean;
  similarityThreshold: number;  // 0-1

  // 通知配置
  notifyOnComplete: boolean;
  notifyOnError: boolean;
}
```

## 总结

### 核心问题
- ❌ 当前完全依赖 LLM 主动调用，不可靠
- ❌ 长期记忆长时间不更新

### 解决方案
- ✅ 后台自动整理（定期批量提取）
- ✅ 不依赖 LLM 主动性
- ✅ 批量处理，效率高

### 实施路径
1. **v0.3.2**：CLI 命令（快速验证）
2. **v0.4.0**：MCP Tool（集成）
3. **v0.5.0**：自动定时（完全自动化）

### 下一步
1. 实现 `universal-memory-consolidate` CLI 命令
2. 设计 LLM 提取 prompt
3. 测试整理效果
4. 迭代优化
