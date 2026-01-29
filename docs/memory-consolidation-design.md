# 记忆整合系统设计

> 基于脑科学的三层记忆架构

## 设计背景

在开发 Universal Memory MCP 的过程中，我们发现一个问题：从每日对话中提取的记忆条目存在大量重复和冗余。例如，用户画像中可能出现多条类似的记录：

```
- [2026-01-29 10:40:49] 职业角色：全栈开发者
- [2026-01-29 10:49:50] 职业角色：全栈开发者，专注于 Node.js/TypeScript
- [2026-01-29 11:01:10] 职业角色：全栈开发者/技术架构师
```

这些条目虽然都是正确的，但缺乏整合，无法形成一个清晰、统一的用户画像。

我们开始思考：**人类的大脑是如何处理这个问题的？**

## 脑科学启发

通过研究神经科学文献，我们发现人类记忆系统有一套精妙的整合机制：

### 记忆整合的核心机制

| 脑科学概念 | 描述 | 应用到 AI 记忆系统 |
|-----------|------|-------------------|
| **系统整合** | 记忆从海马体（临时存储）逐渐迁移到新皮层（永久存储） | 原始条目 → 结构化摘要 |
| **睡眠重放** | 睡眠期间，神经元重放白天的经历，压缩并强化记忆 | 定期运行整合任务 |
| **抽象与泛化** | 记忆不是简单存储，而是被重组、抽象、与现有知识整合 | 合并重复项，提炼模式 |
| **两阶段过程** | 早期获取（快速、不稳定）→ 后期稳定（缓慢、持久） | 每日提取 → 定期整合 |

### 关键研究发现

**1. 系统整合理论 (Systems Consolidation)**

> "Memory consolidation is the process by which a temporary, labile memory is transformed into a more stable, long-lasting form."
> — Squire et al., Cold Spring Harbor Perspectives in Biology, 2015

记忆整合是将临时的、不稳定的记忆转化为更稳定、更持久形式的过程。这个过程涉及：
- 信息从海马体向新皮层的逐渐转移
- 神经连接的重组和强化
- 与现有知识结构的整合

**2. 睡眠与记忆整合**

> "During sleep, newly acquired memories—which are initially stored in the hippocampus—are gradually transferred and integrated into cortical networks, where they become more permanent."
> — Kim & Park, BMB Reports, 2025

睡眠期间的关键活动：
- **慢波振荡 (Slow Oscillations)**: 协调大脑区域间的信息传递
- **睡眠纺锤波 (Sleep Spindles)**: 促进突触可塑性和记忆处理
- **尖波涟漪 (Sharp-wave Ripples)**: 压缩并重放记忆内容

**3. 记忆的重组与抽象**

> "Through repeated reactivation and refinement, memories become more structured and interconnected, which enhances their accessibility and utility in novel situations."
> — Kim & Park, BMB Reports, 2025

记忆不是被动存储，而是主动重组：
- 重复的信息被合并
- 模式被提取和抽象
- 新旧知识被整合

## 三层记忆架构

基于以上脑科学原理，我们设计了三层记忆架构：

```
┌─────────────────────────────────────────────────────────────┐
│  Level 0: 感觉记忆 (Sensory Memory)                          │
│  ─────────────────────────────────────────                   │
│  类比：人类的感觉记忆，持续时间极短                            │
│                                                             │
│  实现：daily/*.md                                           │
│  - 原始对话流水，完整上下文                                   │
│  - 保留期：30天（可配置）                                     │
│  - 特点：完整但冗余，用于追溯和审计                           │
└─────────────────────────────────────────────────────────────┘
                              ↓ 每日提取（类似睡眠期间的记忆重放）
┌─────────────────────────────────────────────────────────────┐
│  Level 1: 短期记忆 (Short-term Memory)                       │
│  ─────────────────────────────────────────                   │
│  类比：海马体中的临时存储                                     │
│                                                             │
│  实现：long_term/                                           │
│  ├── profile.md      # 用户画像条目（带时间戳）               │
│  ├── preferences.md  # 偏好条目                              │
│  ├── decisions.md    # 决策条目                              │
│  ├── facts.md        # 事实条目                              │
│  └── contacts.md     # 联系人条目                            │
│                                                             │
│  特点：                                                      │
│  - 每条带时间戳，可追溯来源                                   │
│  - 存在重复和冗余                                            │
│  - 快速写入，不做复杂处理                                     │
└─────────────────────────────────────────────────────────────┘
                              ↓ 定期整合（类似系统整合过程）
┌─────────────────────────────────────────────────────────────┐
│  Level 2: 长期记忆 (Long-term Memory)                        │
│  ─────────────────────────────────────────                   │
│  类比：新皮层中的永久存储                                     │
│                                                             │
│  实现：long_term/                                           │
│  ├── profile-summary.md     # 结构化用户画像                  │
│  ├── knowledge-summary.md   # 整合的事实+决策（按项目分组）    │
│  └── .consolidation-meta.json                               │
│                                                             │
│  特点：                                                      │
│  - 去重、结构化、可直接使用                                   │
│  - AI 对话时优先读取这层                                      │
│  - 定期更新，保持最新                                        │
└─────────────────────────────────────────────────────────────┘
```

## 整合策略

### 用户画像整合 (Profile Consolidation)

**输入**: `profile.md` + `preferences.md`

**输出**: `profile-summary.md`

**策略**:
1. 读取所有原始条目
2. 使用 LLM 进行语义理解和合并
3. 按类别组织（职业、技术栈、工作习惯、沟通风格）
4. 保留最新、最准确的信息
5. 生成结构化的 Markdown 文档

**示例输出**:
```markdown
# User Profile Summary

> Last consolidated: 2026-01-29 15:30:00
> Source entries: 45 → Consolidated items: 15

## 基本信息
- **职业角色**: 全栈开发者/技术架构师
- **主要领域**: AI 工具开发、MCP 服务器、记忆系统

## 技术栈
- **语言**: TypeScript, JavaScript, Node.js
- **工具**: pnpm, Claude Code, MCP 框架
- **数据库**: SQLite, 向量数据库

## 工作习惯
- 重视测试验证和调试日志
- 先规划后实施，追求幂等性
- 增量式问题解决

## 沟通风格
- 中英文混用
- 偏好简洁直接的技术讨论
- 使用表格和代码示例
```

### 知识库整合 (Knowledge Consolidation)

**输入**: `facts.md` + `decisions.md`

**输出**: `knowledge-summary.md`

**策略**:
1. 按项目/主题分组
2. 更新过时信息（如版本号）
3. 建立决策与事实的关联
4. 按时间线组织重要决策

**示例输出**:
```markdown
# Knowledge Summary

> Last consolidated: 2026-01-29 15:30:00

## 项目: universal-memory-mcp

### 基本信息
- **当前版本**: v0.3.2
- **仓库**: github.com/slicenferqin/universal-memory-mcp
- **技术栈**: TypeScript, Node.js, MCP 框架

### 重要决策
1. [2026-01-28] 选择 sqlite-vec 作为向量数据库
2. [2026-01-29] 采用三层记忆架构
3. [2026-01-29] 使用 Claude CLI 进行记忆提取

### 关键事实
- Stop hook 脚本位置: ~/.claude/hooks/universal-memory-stop-hook.mjs
- 记忆存储位置: ~/.ai_memory/
```

## 触发机制

### 1. 每日自动整合

```bash
# 通过 cron 定时任务
0 2 * * * universal-memory-consolidate --days 1
```

- 每天凌晨 2 点运行
- 处理前一天的对话
- 自动提取 + 整合

### 2. 手动触发

```bash
# 完整整合（提取 + 二次整合）
universal-memory-consolidate --days 7 --consolidate-summary

# 仅二次整合（不重新提取）
universal-memory-consolidate --consolidate-summary-only
```

### 3. 阈值触发

当 Level 1 条目数超过阈值时自动触发二次整合：
- `profile.md` 条目 > 50
- `facts.md` 条目 > 100

## 预期效果

### 1. 更清晰的用户画像

**之前** (Level 1):
```
- [2026-01-29 10:40] 职业角色：全栈开发者
- [2026-01-29 10:49] 职业角色：全栈开发者，专注于 Node.js
- [2026-01-29 11:01] 职业角色：全栈开发者/技术架构师
- [2026-01-29 11:03] Technical role: Developer working on MCP
- [2026-01-29 14:35] 职业角色：全栈开发者/技术工程师
```

**之后** (Level 2):
```
## 基本信息
- **职业角色**: 全栈开发者/技术架构师
- **主要领域**: AI 工具开发、MCP 服务器、记忆系统
```

### 2. 更高效的记忆检索

- AI 优先读取 Level 2 摘要
- 减少 token 消耗
- 更快的响应速度

### 3. 更好的上下文理解

- 结构化的知识便于 AI 理解
- 按项目分组的信息更有条理
- 时间线清晰的决策历史

## 设计哲学

### 1. 模仿自然

我们的设计直接借鉴了人类大脑的记忆机制：
- 不是简单的数据存储，而是主动的信息处理
- 不是一次性写入，而是渐进式整合
- 不是保留所有细节，而是提炼核心模式

### 2. 分层处理

每一层都有其存在的价值：
- Level 0: 完整性（可追溯、可审计）
- Level 1: 可追踪性（带时间戳、可溯源）
- Level 2: 可用性（结构化、去重、直接可用）

### 3. 渐进增强

系统可以在不同层级工作：
- 最简模式：只有 Level 0（原始对话）
- 标准模式：Level 0 + Level 1（提取但不整合）
- 完整模式：三层全开（完整的记忆系统）

## 参考文献

1. Squire, L. R., Genzel, L., Wixted, J. T., & Morris, R. G. (2015). Memory Consolidation. *Cold Spring Harbor Perspectives in Biology*, 7(8), a021766.

2. Kim, J., & Park, M. (2025). Systems memory consolidation during sleep: oscillations, neuromodulators, and synaptic remodeling. *BMB Reports*, 58(10), 425-436.

3. Klinzing, J. G., Niethard, N., & Born, J. (2019). Mechanisms of systems memory consolidation during sleep. *Nature Neuroscience*, 22, 1598-1610.

4. Geva-Sagiv, M., et al. (2023). Augmenting hippocampal–prefrontal neuronal synchrony during sleep enhances memory consolidation in humans. *Nature Neuroscience*, 26, 1100-1110.

---

*本文档记录了 Universal Memory MCP 记忆整合系统的设计思想，基于 2026-01-29 的脑科学研究和讨论。*
