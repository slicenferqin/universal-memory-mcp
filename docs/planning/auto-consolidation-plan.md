# 自动记忆整理方案

## 问题分析

### 当前机制的缺陷

**完全依赖 LLM 主动调用**：
```
User: "我们决定用 TypeScript"
AI: "好的，我会记住"
AI: [应该调用 memory_update_long_term，但经常忘记]
```

**问题**：
- ❌ AI 容易忘记调用
- ❌ 依赖 AI 的判断能力
- ❌ 没有兜底机制
- ❌ 重要信息可能丢失

**数据验证**：
- 今天（2026-01-29）有大量对话
- 讨论了重要决策（v0.3.1 发布、client 字段修复、技术方案）
- 但长期记忆最后更新时间：2026-01-28 11:29:08
- **结论**：今天的重要信息全部丢失！

## 解决方案对比

### 方案 1: 强化 Skill 指导（治标不治本）

**做法**：
- 在 skill 中更明确地要求 AI 调用
- 添加更多示例和场景

**优点**：
- 实现简单
- 无需额外基础设施

**缺点**：
- ❌ 仍然依赖 AI 主动性
- ❌ 无法保证 100% 执行
- ❌ 没有兜底机制

**结论**：不推荐作为主要方案

### 方案 2: Stop Hook 实时提取（实时但成本高）

**做法**：
- 在 Stop hook 中，每次对话结束后调用 LLM 提取关键信息
- 立即更新长期记忆

**流程**：
```
对话结束
  ↓
Stop Hook 触发
  ↓
1. 记录对话到 daily log
  ↓
2. 调用 LLM 分析对话
  ↓
3. 提取关键信息（决策/偏好/事实）
  ↓
4. 更新长期记忆
```

**优点**：
- ✅ 实时更新，不会丢失信息
- ✅ 100% 自动化
- ✅ 用户无感知

**缺点**：
- ❌ 每次对话都调用 LLM，成本高
- ❌ 增加响应延迟
- ❌ 可能提取很多不重要的信息

**结论**：成本太高，不推荐

### 方案 3: 定期批量整理（推荐）⭐

**做法**：
- 定期（每天凌晨）批量处理最近的对话
- 使用 LLM 一次性提取所有重要信息
- 去重、合并、更新长期记忆

**流程**：
```
定时触发（每天凌晨 2:00）
  ↓
1. 读取最近 N 天的 daily logs
  ↓
2. 过滤已处理的对话
  ↓
3. 批量调用 LLM 提取关键信息
  ↓
4. 去重和合并
  ↓
5. 更新长期记忆文件
  ↓
6. 标记已处理
```

**优点**：
- ✅ 成本低（批量处理）
- ✅ 质量高（有上下文，提取更准确）
- ✅ 可控（可以调整频率和范围）
- ✅ 不影响用户体验

**缺点**：
- ⚠️ 不是实时的（有延迟）
- ⚠️ 需要额外的调度机制

**结论**：最佳方案

### 方案 4: 混合方案（最优）⭐⭐

**做法**：
- **实时**：AI 主动调用（快速响应明显的重要信息）
- **批量**：定期自动提取（兜底保障，不遗漏）

**优点**：
- ✅ 结合两者优势
- ✅ 重要信息实时记录
- ✅ 兜底机制保证不丢失
- ✅ 成本可控

**结论**：推荐实施

## 实施方案：混合方案

### Phase 1: 定期批量整理（v0.3.2）

#### 1.1 触发机制

**方式 1: Cron Job（推荐）**

创建系统级定时任务：

```bash
# macOS/Linux: crontab -e
0 2 * * * /usr/local/bin/universal-memory-consolidate

# Windows: Task Scheduler
```

**方式 2: 内置调度器**

在 MCP Server 中内置调度器：

```typescript
import { CronJob } from 'cron';

const job = new CronJob('0 2 * * *', async () => {
  await consolidateMemories();
});

job.start();
```

**方式 3: 用户触发**

提供 MCP 工具让用户手动触发：

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'memory_consolidate') {
    await consolidateMemories();
  }
});
```

**推荐**：方式 1（Cron Job）+ 方式 3（手动触发）

#### 1.2 整理流程

```typescript
async function consolidateMemories(options: {
  days?: number;  // 处理最近 N 天，默认 1
  force?: boolean;  // 强制重新处理
}) {
  // 1. 读取最近 N 天的对话
  const conversations = await getRecentConversations(options.days || 1);

  // 2. 过滤已处理的对话
  const unprocessed = conversations.filter(c => !c.consolidated);

  if (unprocessed.length === 0) {
    console.log('No new conversations to consolidate');
    return;
  }

  // 3. 批量提取关键信息
  const extracted = await extractKeyInformation(unprocessed);

  // 4. 去重和合并
  const merged = await deduplicateAndMerge(extracted);

  // 5. 更新长期记忆
  await updateLongTermMemory(merged);

  // 6. 标记已处理
  await markAsConsolidated(unprocessed.map(c => c.id));

  console.log(`Consolidated ${unprocessed.length} conversations`);
}
```

#### 1.3 LLM 提取 Prompt

```typescript
const EXTRACTION_PROMPT = `
你是一个记忆整理助手。分析以下对话记录，提取重要信息。

# 对话记录

${conversations.map(c => `
## ${c.timestamp}
**User:** ${c.userMessage}
**AI:** ${c.aiResponse}
`).join('\n---\n')}

# 任务

提取以下类型的重要信息：

1. **Decisions（重要决策）**
   - 技术选型（选择了什么技术/框架/工具）
   - 架构决策（系统设计、模块划分）
   - 方案选择（多个方案中选择了哪个）
   - 版本发布（发布了什么版本，包含什么功能）

2. **Preferences（用户偏好）**
   - 编码风格（缩进、命名规范）
   - 工具偏好（编辑器、终端、包管理器）
   - 工作习惯（工作流程、沟通方式）
   - 语言偏好（TypeScript vs JavaScript）

3. **Facts（关键事实）**
   - 项目信息（项目名称、目的、技术栈）
   - 团队信息（团队成员、角色）
   - 业务逻辑（核心功能、业务规则）
   - 技术细节（API 端点、数据结构）

4. **Contacts（联系人）**
   - 人名（团队成员、合作伙伴）
   - 团队（部门、小组）
   - 组织（公司、开源项目）

# 输出格式

以 JSON 格式输出：

\`\`\`json
{
  "decisions": [
    {
      "content": "决策内容",
      "timestamp": "2026-01-29",
      "source_conversation_id": "abc123"
    }
  ],
  "preferences": [...],
  "facts": [...],
  "contacts": [...]
}
\`\`\`

# 注意事项

- 只提取**明确的、重要的**信息，不要过度解读
- 如果某个类别没有信息，返回空数组
- 每条信息应该简洁明了（1-2 句话）
- 保留时间戳和来源引用
- 去除重复信息

# 示例

输入：
\`\`\`
User: 我们决定用 TypeScript 重写这个项目
AI: 好的，TypeScript 可以提供更好的类型安全...
\`\`\`

输出：
\`\`\`json
{
  "decisions": [
    {
      "content": "决定用 TypeScript 重写项目",
      "timestamp": "2026-01-29",
      "source_conversation_id": "abc123"
    }
  ],
  "preferences": [
    {
      "content": "用户偏好使用 TypeScript",
      "timestamp": "2026-01-29",
      "source_conversation_id": "abc123"
    }
  ],
  "facts": [],
  "contacts": []
}
\`\`\`
`;
```

#### 1.4 去重策略

**问题**：
- 同一信息可能在多次对话中提到
- 需要识别并合并重复信息

**方案**：

```typescript
async function deduplicateAndMerge(
  extracted: ExtractedInfo[]
): Promise<ExtractedInfo[]> {
  const deduplicated: ExtractedInfo[] = [];

  for (const item of extracted) {
    // 检查是否与已有信息重复
    const existing = deduplicated.find(d =>
      isSimilar(d.content, item.content)
    );

    if (existing) {
      // 合并：保留更详细的版本
      if (item.content.length > existing.content.length) {
        existing.content = item.content;
      }
      // 添加来源引用
      existing.sources = [...existing.sources, item.source_conversation_id];
    } else {
      deduplicated.push(item);
    }
  }

  return deduplicated;
}

function isSimilar(text1: string, text2: string): boolean {
  // 简单版本：关键词匹配
  const keywords1 = extractKeywords(text1);
  const keywords2 = extractKeywords(text2);

  const intersection = keywords1.filter(k => keywords2.includes(k));
  const union = [...new Set([...keywords1, ...keywords2])];

  const similarity = intersection.length / union.length;
  return similarity > 0.7;

  // 高级版本：使用向量相似度（v0.4.0 后）
  // const embedding1 = await generateEmbedding(text1);
  // const embedding2 = await generateEmbedding(text2);
  // return cosineSimilarity(embedding1, embedding2) > 0.9;
}
```

#### 1.5 标记已处理

**方案 1: 元数据文件**

创建 `.consolidated` 文件记录已处理的对话：

```json
{
  "last_consolidation": "2026-01-29T02:00:00Z",
  "processed_conversations": [
    "abc123",
    "def456"
  ]
}
```

**方案 2: 在对话记录中添加标记**

在 daily log 中添加标记：

```markdown
## 2026-01-29 10:30:15
**Project:** my-app
**Session:** abc123
**Consolidated:** true

**User:** ...
**AI:** ...
```

**推荐**：方案 1（不修改原始记录）

#### 1.6 CLI 工具

创建独立的 CLI 工具：

```bash
# 手动触发整理
universal-memory-consolidate

# 整理最近 3 天
universal-memory-consolidate --days 3

# 强制重新处理
universal-memory-consolidate --force

# 查看整理状态
universal-memory-consolidate --status
```

### Phase 2: 实时提取优化（v0.3.3）

#### 2.1 优化 Skill 指导

在 memory-assistant skill 中添加更明确的触发条件：

```markdown
## RULE 3: Store Important Information (SPECIFIC TRIGGERS)

**MUST call memory_update_long_term when you see these patterns:**

### Decisions (决策)
- "我们决定..." / "we decided..."
- "选择..." / "choose..."
- "采用..." / "use..."
- "发布..." / "release..."
- "升级到..." / "upgrade to..."

### Preferences (偏好)
- "我喜欢..." / "I prefer..."
- "我习惯..." / "I usually..."
- "我倾向于..." / "I tend to..."

### Facts (事实)
- "这个项目是..." / "this project is..."
- "我们团队..." / "our team..."
- "API 地址是..." / "the API endpoint is..."

### Contacts (联系人)
- 提到具体人名
- 提到团队/部门名称
- 提到公司/组织名称

**Example triggers:**
- ✅ "我们决定用 TypeScript" → MUST call memory_update_long_term
- ✅ "我喜欢 2 空格缩进" → MUST call memory_update_long_term
- ✅ "这个项目叫 universal-memory" → MUST call memory_update_long_term
- ❌ "好的，我明白了" → No need to call
```

#### 2.2 添加提醒机制

在 Stop hook 中检查是否有明显的重要信息但没有调用 `memory_update_long_term`：

```javascript
// Stop hook 中添加检测
const hasDecisionKeywords = /决定|选择|采用|发布|升级|decided|choose|use|release/i.test(aiText);
const hasPreferenceKeywords = /喜欢|偏好|习惯|倾向|prefer|like|usually/i.test(aiText);

if ((hasDecisionKeywords || hasPreferenceKeywords) && !calledMemoryUpdateLongTerm) {
  console.warn('⚠️  Detected important information but memory_update_long_term was not called');
  // 可以选择：
  // 1. 只是警告
  // 2. 提示用户
  // 3. 自动调用 LLM 提取（成本高）
}
```

### Phase 3: 向量化去重（v0.4.0+）

使用向量相似度进行更准确的去重：

```typescript
async function deduplicateWithEmbeddings(
  extracted: ExtractedInfo[]
): Promise<ExtractedInfo[]> {
  const deduplicated: ExtractedInfo[] = [];

  for (const item of extracted) {
    const itemEmbedding = await generateEmbedding(item.content);

    let isDuplicate = false;
    for (const existing of deduplicated) {
      const existingEmbedding = await generateEmbedding(existing.content);
      const similarity = cosineSimilarity(itemEmbedding, existingEmbedding);

      if (similarity > 0.9) {
        // 高度相似，认为是重复
        isDuplicate = true;
        // 合并来源
        existing.sources.push(item.source_conversation_id);
        break;
      }
    }

    if (!isDuplicate) {
      deduplicated.push(item);
    }
  }

  return deduplicated;
}
```

## 实施计划

### v0.3.2: 基础批量整理（1 周）

**Week 1**:
- [ ] 实现 `consolidateMemories()` 函数
- [ ] 实现 LLM 提取逻辑
- [ ] 实现简单去重（关键词匹配）
- [ ] 创建 CLI 工具 `universal-memory-consolidate`
- [ ] 添加 Cron Job 安装脚本
- [ ] 测试和文档

**交付物**：
- 可以手动运行 `universal-memory-consolidate`
- 可以设置 Cron Job 自动运行
- 长期记忆会自动更新

### v0.3.3: 实时提取优化（3 天）

**Day 1-2**:
- [ ] 优化 memory-assistant skill 指导
- [ ] 添加明确的触发模式

**Day 3**:
- [ ] 在 Stop hook 中添加检测和警告
- [ ] 测试和文档

### v0.4.0: 向量化去重（随语义搜索一起）

- [ ] 使用向量相似度去重
- [ ] 提升整理质量

## 配置选项

```typescript
interface ConsolidationConfig {
  // 是否启用自动整理
  enabled: boolean;

  // 整理频率
  schedule: 'daily' | 'weekly' | 'manual';

  // 整理最近 N 天的对话
  days: number;

  // LLM 提供者
  llmProvider: 'anthropic' | 'openai' | 'gemini';

  // LLM 模型
  llmModel?: string;

  // 去重相似度阈值
  deduplicationThreshold: number;

  // 是否保留来源引用
  keepSources: boolean;
}
```

## 成本估算

### LLM API 成本

假设：
- 每天 20 次对话
- 每次对话平均 500 tokens
- 批量整理：20 * 500 = 10,000 tokens/天

**使用 Claude Haiku**：
- Input: $0.25 / 1M tokens
- Output: $1.25 / 1M tokens
- 每天成本：10,000 * 0.25 / 1,000,000 ≈ $0.0025
- 每月成本：$0.075（约 ¥0.5）

**使用 Gemini Flash**：
- 免费额度：每天 1500 次请求
- 成本：$0

**结论**：成本极低，可以忽略不计

## 总结

**推荐方案**：混合方案
1. **实时**：优化 Skill 指导，AI 主动调用（快速响应）
2. **批量**：定期自动整理（兜底保障）

**实施优先级**：
1. ✅ v0.3.2: 批量整理（核心功能，解决当前问题）
2. ✅ v0.3.3: 实时优化（提升体验）
3. ⏳ v0.4.0: 向量化去重（提升质量）

**下一步**：
1. 实现 `consolidateMemories()` 函数
2. 创建 CLI 工具
3. 测试整理效果
4. 发布 v0.3.2
