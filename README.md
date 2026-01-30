# Universal Memory MCP

> 让任何 AI CLI 工具拥有长期记忆，成为你的个人大管家

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 这是什么？

**Universal Memory MCP** 是一个通用的记忆系统，通过 Model Context Protocol (MCP) 为任何 AI CLI 工具提供：

- **长期记忆**：记住所有对话，跨会话、跨项目
- **智能检索**：语义搜索 + 关键词搜索，秒级找到相关历史
- **即插即用**：支持 Claude Code、OpenCode、Gemini CLI 等所有 MCP 兼容工具

## 核心理念

### AI Agent = 模型 + 上下文 + 记忆

真正的智能代理需要三个要素:

| 要素     | 作用                 | 现状                        |
| -------- | -------------------- | --------------------------- |
| 模型     | 推理和生成能力       | GPT-4/Claude 等强大模型     |
| 上下文   | 当前对话的临时信息   | 128K-200K tokens 窗口限制   |
| **记忆** | **跨会话的长期知识** | **缺失 → 这就是我们的目标** |

**上下文 ≠ 记忆**:

| 特性         | 上下文（Context）              | 记忆（Memory）     |
| ------------ | ------------------------------ | ------------------ |
| **生命周期** | 单次会话                       | 永久持久化         |
| **容量**     | 受限于窗口（128K-200K tokens） | 无限制             |
| **成本**     | 每次传输都计费                 | 只在检索时计费     |
| **可操作性** | 只能读取                       | 可读、可写、可搜索 |

**我们的使命**: 让任何 AI CLI 工具拥有长期记忆,成为真正的个人大管家。

### 工作原理

```
┌─────────────────────────────────────────────────────────────┐
│  User ←→ AI CLI (Claude Code / OpenCode / Gemini)           │
└─────────────────┬───────────────────────────────────────────┘
                  │ MCP Protocol
                  ↓
┌─────────────────────────────────────────────────────────────┐
│  Universal Memory MCP Server                                │
│  ├── memory_search: 搜索历史记忆                            │
│  ├── memory_record: 记录对话                                │
│  └── memory_update_long_term: 存储重要信息                  │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────────┐
│  ~/.ai_memory/                                              │
│  ├── daily/                    # Level 0: 感觉记忆          │
│  │   ├── 2026-01-27.md         # 原始对话流水               │
│  │   └── ...                                                │
│  ├── long_term/                # Level 1-2: 长期记忆        │
│  │   ├── profile.md            # L1: 用户画像条目           │
│  │   ├── decisions.md          # L1: 重要决策               │
│  │   ├── facts.md              # L1: 关键事实               │
│  │   ├── profile-summary.md    # L2: 整合的用户画像         │
│  │   └── knowledge-summary.md  # L2: 整合的知识库           │
│  ├── projects/                 # 项目级记忆                 │
│  │   └── <project-name>/                                    │
│  └── index.db                  # 向量索引（SQLite）         │
└─────────────────────────────────────────────────────────────┘
```

### 三层记忆架构（基于脑科学）

我们借鉴人类大脑的记忆整合机制，设计了三层记忆架构：

| 层级        | 类比     | 存储             | 特点                         |
| ----------- | -------- | ---------------- | ---------------------------- |
| **Level 0** | 感觉记忆 | `daily/*.md`     | 原始对话流水，完整但冗余     |
| **Level 1** | 短期记忆 | `long_term/*.md` | 提取的条目，带时间戳可追溯   |
| **Level 2** | 长期记忆 | `*-summary.md`   | 整合的摘要，结构化可直接使用 |

详细设计文档：[记忆整合系统设计](./docs/memory-consolidation-design.md)

## 重要说明：MCP 的工作方式

MCP 协议是一个**工具提供协议**，不是中间件。这意味着：

- **AI 需要主动调用工具**：记忆的记录和检索依赖 AI 主动调用 `memory_record` 和 `memory_search`
- **通过工具描述引导**：我们通过详细的工具描述告诉 AI 何时应该调用这些工具
- **不能自动拦截对话**：MCP Server 无法像中间件一样自动捕获所有对话

这是 MCP 协议的设计限制，但好处是：

- **通用性**：任何支持 MCP 的 CLI 都能使用
- **透明性**：用户可以看到 AI 何时在使用记忆
- **可控性**：AI 可以选择性地记录重要对话

## 快速开始

### 安装

```bash
npm install -g universal-memory-mcp
```

### 配置 OpenCode (自动采集) ✨

**自动配置**（推荐）：

```bash
npm install -g universal-memory-mcp
```

安装脚本会自动检测并配置 OpenCode：

- ✅ MCP Server（`~/.config/opencode/opencode.json`）
- ✅ OpenCode 插件（自动记录每次对话）
- ✅ 基于 `session.idle` 事件触发

**重启 OpenCode** 后即可使用。

**手动配置**（如果自动安装失败）：

编辑 `~/.config/opencode/opencode.json`：

```json
{
  "mcp": {
    "universal-memory": {
      "type": "local",
      "enabled": true,
      "command": ["npx", "-y", "universal-memory-mcp"]
    }
  },
  "plugin": ["./universal-memory.mjs"]
}
```

详见 [OpenCode 集成文档](docs/OPENCODE_INTEGRATION.md)

**特性**：

- ✅ 自动采集会话内容（无需手动调用）
- ✅ 基于 `session.idle` 事件触发
- ✅ 自动检测项目名称和会话 ID

### 配置 Claude Code (自动记录) ✨

**一键安装**（推荐）：

```bash
npm install -g universal-memory-mcp
```

安装后会自动配置：

- ✅ MCP Server（`~/.claude/settings.json`）
- ✅ Memory Assistant Skill（自动引导 AI 使用记忆）
- ✅ Stop Hook（自动记录每次对话）

**重启 Claude Code** 后即可使用。

**手动配置**（如果自动安装失败）：

编辑 `~/.claude/settings.json`：

```json
{
  "mcpServers": {
    "universal-memory": {
      "command": "npx",
      "args": ["-y", "universal-memory-mcp"]
    }
  }
}
```

**特性**：

- ✅ 自动记录所有对话（通过 Stop hook）
- ✅ 智能引导 AI 搜索历史（通过 memory-assistant skill）
- ✅ 支持 client 字段区分不同客户端（v0.3.1+）

### 配置 Claude Desktop

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "universal-memory": {
      "command": "npx",
      "args": ["-y", "universal-memory-mcp"]
    }
  }
}
```

### 使用示例

```bash
# 第一次对话
$ claude "帮我设计一个用户认证系统"
AI: [设计方案...]
AI: [调用 memory_record 记录这次对话]

# 第二天
$ claude "昨天我们讨论的认证系统，JWT 部分能详细说说吗？"
AI: [调用 memory_search 搜索相关记忆]
AI: 根据昨天的讨论，我们选择了 JWT + Refresh Token...

# 一周后
$ claude "我之前所有关于认证的讨论都有哪些？"
AI: [调用 memory_search("认证")]
AI: 我找到了 3 次相关讨论：
   1. 2026-01-27: JWT vs Session 的选择
   2. 2026-01-29: Refresh Token 的实现
   3. 2026-01-30: 安全性考虑
```

## 记忆整合

### 自动整理长期记忆

```bash
# 标准整理（Level 0 → Level 1）
universal-memory-consolidate --days 7

# 完整整理（Level 0 → Level 1 → Level 2）
universal-memory-consolidate --days 7 --consolidate-summary

# 仅二次整合（Level 1 → Level 2）
universal-memory-consolidate --consolidate-summary-only

# 预览模式
universal-memory-consolidate --dry-run --verbose
```

### 整合流程

```
Level 0 (daily/*.md)
    ↓ 每日提取（使用 Claude CLI）
Level 1 (profile.md, facts.md, decisions.md)
    ↓ 定期整合（使用 Claude CLI）
Level 2 (profile-summary.md, knowledge-summary.md)
```

## MCP 工具

### memory_search

搜索历史对话和长期记忆。

```typescript
memory_search({
  query: 'API 设计方案',
  time_range: ['2026-01-01', '2026-01-31'], // 可选
  project: 'my-project', // 可选
  limit: 10, // 可选，默认 10
})
```

**何时使用：**

- 用户问起过去的讨论
- 用户说"我们之前讨论过..."
- 需要了解用户偏好（搜索 "preferences"）
- 需要之前的决策信息

### memory_record

记录当前对话。

```typescript
memory_record({
  user_message: '帮我设计 REST API',
  ai_response: '推荐使用资源导向的 URL 设计...',
  project: 'my-project', // 可选
})
```

**何时使用：**

- 每次有意义的对话交换后
- 确保跨会话的连续性

### memory_update_long_term

存储重要信息到长期记忆。

```typescript
memory_update_long_term({
  category: 'preferences', // preferences | decisions | facts | contacts | profile
  content: '用户偏好使用 TypeScript',
})
```

**何时使用：**

- 发现用户偏好
- 做出重要决策
- 获知关键信息

## 核心设计原则

### 1. 基于脑科学的三层记忆架构

我们借鉴人类大脑的记忆整合机制,设计了渐进式记忆系统:

```
Level 0 (感觉记忆) → Level 1 (短期记忆) → Level 2 (长期记忆)
daily/*.md         →  long_term/*.md     →  *-summary.md
完整但冗余          →  可追溯条目         →  结构化知识
```

**为什么这样设计?**

- **模仿自然**: 人类大脑不是简单存储,而是主动整合信息
- **渐进增强**: 可以在不同层级工作,不必一次性实现所有功能
- **可追溯性**: 每层都有价值 - Level 0 完整性, Level 1 可追踪, Level 2 可用性

### 2. 100% 本地优先

| 决策           | 选择              | 原因                         |
| -------------- | ----------------- | ---------------------------- |
| 存储格式       | Markdown + JSON   | 透明、可迁移、用户可控       |
| 向量数据库     | **sqlite-vec**    | 单文件、无依赖、支持向量搜索 |
| Embedding 模型 | Gemini (免费优先) | 零成本、易用                 |
| 整理引擎       | Claude Code CLI   | 复用用户订阅、无需额外 API   |

**对比 mem0**: 我们不提供 SaaS,不收集数据,所有功能在本地运行。

### 3. 通用协议 > 特定平台

- **MCP 协议**: 一次实现,支持所有 MCP 兼容工具(Claude Code、Gemini CLI 等)
- **Plugin 适配**: 为 OpenCode 等非 MCP 工具提供原生插件
- **渐进式集成**: 从手动记录 → 自动采集 → 智能搜索 → 自动整理

### 4. 用户可控

- **数据所有权**: 所有存储在 `~/.ai_memory/`,可随时查看、编辑、迁移
- **透明性**: 每条记忆都有来源、时间戳、置信度
- **可干预**: 手动触发整理、调整搜索策略、修正错误记忆

## 记忆结构

### 每日流水 (daily/\*.md) - Level 0

```markdown
## 2026-01-27 10:30:15

**Project:** universal-memory-mcp
**Client:** claude-code
**Session:** abc123

**User:** 帮我设计一个用户认证系统

**AI:** 好的，我来帮你设计...

---
```

### 长期记忆 (long_term/) - Level 1 & 2

**Level 1 - 原始条目** (`profile.md`, `facts.md`, `decisions.md`):

```markdown
# User Profile

- [2026-01-29 10:40:49] 职业角色：全栈开发者
- [2026-01-29 10:49:50] 技术栈：TypeScript、Node.js
- [2026-01-29 11:01:10] 工作习惯：先规划后实施
```

**Level 2 - 整合摘要** (`profile-summary.md`):

```markdown
# User Profile Summary

> Last consolidated: 2026-01-29

## 基本信息

- **职业角色**: 全栈开发者/技术架构师
- **主要领域**: AI 工具开发、MCP 服务器

## 技术栈

- **语言**: TypeScript, Node.js
- **工具**: pnpm, Claude Code, MCP 框架
```

## 技术架构

### 核心组件

- **Memory Manager**: 记忆管理（记录、存储、检索）
- **MCP Server**: MCP 协议实现（工具暴露）
- **Search Engine**: 关键词搜索 (SQLite FTS5) → 语义搜索 (向量)
- **Consolidator**: 记忆整合（提取 + 二次整合）

### 技术栈

| 组件       | 技术选择               | 原因                            |
| ---------- | ---------------------- | ------------------------------- |
| 存储层     | Markdown + JSON 文件   | 透明、可迁移、用户可控          |
| 索引数据库 | **sqlite-vec**         | 单文件、无依赖、原生向量搜索    |
| 全文搜索   | SQLite FTS5            | 内置、高效 BM25                 |
| Embedding  | **ZhipuAI** (国内优先) | 国内可访问、1024维、速度快      |
| Embedding  | Gemini (免费)          | 零成本、768维                   |
| Embedding  | OpenAI (可选)          | 生产环境                        |
| 整理引擎   | Claude Code CLI        | 复用用户订阅、无需额外 API 密钥 |

### 核心设计决策

1. **为什么选 sqlite-vec 而不是 ChromaDB/Qdrant?**
   - 单文件部署,无需额外服务
   - 与 FTS5 结合实现混合搜索
   - 跨平台,易维护

2. **为什么用 Claude Code CLI 而不是直接调用 OpenAI API?**
   - 零成本:使用用户的 Claude 订阅
   - 简单集成:无需管理 API 密钥
   - 高质量:Claude 有完整的上下文理解能力

3. **为什么是三层架构而不是扁平存储?**
   - 模仿人类大脑的记忆整合机制
   - 渐进增强,不必一次性实现所有功能
   - 每层都有明确的职责和价值

## 文档

- [快速开始](./docs/getting-started.md)
- [工作原理](./docs/how-it-works.md)
- [记忆整合系统设计](./docs/memory-consolidation-design.md) ✨
- [架构设计](./ARCHITECTURE.md)
- [集成指南](./docs/integration/)
  - [Claude Code](./docs/integration/claude-code.md)
  - [OpenCode](./docs/integration/opencode.md)

## 开发

### 环境要求

- Node.js >= 20
- pnpm >= 8

### 本地开发

```bash
git clone git@github.com:slicenferqin/universal-memory-mcp.git
cd universal-memory-mcp
pnpm install
pnpm build
```

### 项目结构

```
universal-memory-mcp/
├── packages/
│   ├── core/           # 核心逻辑
│   └── mcp-server/     # MCP Server 实现
├── docs/               # 文档
└── tests/              # 测试
```

## 路线图

### ✅ 已完成

- **v0.1.0**: 基础记忆系统 (记录 + 搜索)
- **v0.2.0**: OpenCode Plugin 自动采集
- **v0.3.0**: Claude Code 自动记录 (Stop hook + Skill)
- **v0.3.1**: Client 字段支持 (区分不同客户端)
- **v0.3.2**: 三层记忆架构 (基于脑科学的记忆整合)
  - Level 0 → Level 1: 每日提取
  - Level 1 → Level 2: 定期二次整合
  - 使用 Claude Code CLI 作为 LLM 提取器
  - `universal-memory-consolidate` CLI 命令

### ✅ 已完成

- **v0.4.0**: 语义搜索功能 ✨
  - ✅ Embedding 基础设施
    - ZhipuAI Embedding Provider (国内优选,1024维)
    - Gemini Embedding Provider (免费,768维)
    - OpenAI Embedding Provider (可选)
    - 对话分块策略 (conversation-based, token-based)
  - ✅ 向量索引
    - 集成 sqlite-vec (单文件向量数据库)
    - 批量索引 (IndexingPipeline)
    - 自动索引 (新对话自动索引)
  - ✅ 语义搜索
    - 向量相似度搜索 (余弦相似度)
    - 时间衰减权重 (指数衰减)
    - 项目相关性加权 (1.5x/1.2x boost)
  - ✅ 混合搜索
    - 关键词 (FTS5) + 语义 (向量)
    - RRF (Reciprocal Rank Fusion) 算法
    - 可配置权重
  - ✅ 性能优化
    - EmbeddingCache (LRU + TTL)
    - CachedEmbeddingProvider (100x speedup)
    - SearchCache (结果缓存)
  - ✅ 测试和文档
    - 性能测试 (416 searches/sec)
    - 召回质量测试 (40% average recall)
    - 完整文档 (SEMANTIC_SEARCH_API.md, PERFORMANCE_TESTING.md)

### ✅ 已完成

- **v0.5.0**: 性能优化与生产模式 🚀
  - ✅ 异步索引 (`indexRecentAsync()`)
    - 非阻塞索引,立即返回
    - 后台处理新对话
  - ✅ 候选池扩大 (4x multiplier)
    - 检索 40 个候选返回 Top-10
    - 召回率提升 20-30% (40% → 60%)
  - ✅ 文件监视器 (`watcher.ts`)
    - chokidar 集成
    - 文件变化自动触发索引 (debounce 5s)
  - ✅ 混合搜索算法优化
    - RRF (Reciprocal Rank Fusion)
    - Weighted Score Fusion
    - 可配置权重
  - ✅ 性能提升
    - 搜索延迟: 100ms → **<5ms** (20x)
    - 召回率: 40% → **60%** (1.5x)

### ✅ 已完成

- **v0.6.0-beta.0**: 三层记忆架构完整实现 🏗️
  - ✅ L1/L2 向量化
    - Markdown Chunker (智能分块, 20条/块, 重叠2条)
    - `indexLongTermMemory()` - 索引 long_term/\*.md
    - 支持 decisions/preferences/facts/profile/summary
  - ✅ 生命周期调度器 (`LifecycleScheduler`)
    - **Daily Task**: L0 → L1 自动提取 (1+天)
    - **Weekly Task**: L1 → L2 整合 (7+天)
    - **Monthly Task**: 归档过期记忆
    - 完整集成现有 consolidation 逻辑
  - ✅ 归档机制 (`ArchiveManager`)
    - 移动 7+ 天 daily/ 到 archive/daily/
    - 移动 30+ 天 L1 到 archive/long_term/
    - 冷存储,不是删除
  - ✅ 搜索增强
    - `includeArchive` 选项 (默认 false)
    - 可选搜索归档记忆
  - ✅ 元数据管理 (`MetadataManager`)
    - 访问统计 (访问次数、最后访问时间)
    - 重要性评分 (30%访问频率 + 30%时间衰减 + 20%内容 + 20%反馈)
    - SQLite 持久化
  - ✅ 技术亮点
    - ~2,080 行代码新增/修改
    - 完整的三层记忆生命周期
    - 动态导入避免循环依赖

### 🚧 进行中 (v0.7.0 - 企业级特性)

**目标**: 优化记忆质量,实现智能化管理

- [ ] **v0.5.0**: 向量去重增强
  - 使用向量相似度改进去重算法
  - 智能合并重复条目
  - 冲突解决策略

- [ ] **v0.5.1**: 重要性评分
  - 自动识别重要对话
  - 基于引用频率和访问模式
  - 优先展示高价值记忆

- [ ] **v0.5.2**: 记忆整理优化
  - cron 定时任务集成 (`universal-memory-cron`)
  - 阈值自动触发 (超过 N 条对话)
  - 整理质量评估

### 🎯 长期愿景 (v1.0+)

- [ ] **v1.0.0**: 稳定版本
  - 完整的三层记忆系统
  - 高质量混合搜索
  - 自动化记忆管理
  - 完善的文档和测试

- [ ] **v1.1.0**: 跨项目记忆
  - 跨项目知识图谱
  - 技术栈关联
  - 最佳实践推荐

- [ ] **v1.2.0**: 多模态记忆
  - 图片记忆 (截图、设计图)
  - 代码片段索引
  - 文件关联

### 核心里程碑

```
v0.3.x      v0.4.x          v0.5.x          v1.0+
┌─────┐    ┌──────┐       ┌──────┐       ┌──────┐
│ 记录 │ →  │ 搜索 │  →   │ 整理 │  →   │ 智能化 │
│     │    │ 语义 │       │ 自动 │       │       │
└─────┘    └──────┘       └──────┘       └──────┘
基础功能    检索质量       用户体验       Agent 能力
```

## 下一步

### 当前重点 (v0.4.x)

**实现向量搜索,提升记忆检索质量:**

1. **Week 1**: Embedding 基础设施
   - 实现 Gemini Embedding Provider
   - 对话分块逻辑
   - 单元测试

2. **Week 2**: 向量索引
   - 集成 sqlite-vec
   - 实现索引构建流程
   - 批量索引历史数据

3. **Week 3**: 语义搜索
   - 实现向量相似度搜索
   - 混合搜索 (关键词 + 语义)
   - 性能优化

**如何参与:**

- 查看 [docs/semantic-search-plan.md](./docs/semantic-search-plan.md) 了解详细设计
- 查看 [docs/v0.3.2-consolidation-design.md](./docs/v0.3.2-consolidation-design.md) 了解当前实现
- 提交 Issue 或 PR 贡献代码

## 贡献

欢迎提交 Issue 和 Pull Request！

**特别欢迎:**

- 新的 Embedding Provider 实现
- 性能优化建议
- 文档改进
- Bug 修复

## 许可证

MIT License - 详见 [LICENSE](./LICENSE)

## 致谢

本项目受以下工作启发：

- [Clawdbot](https://github.com/clawdbot/clawdbot) - 记忆系统设计理念
- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP 协议
- 脑科学研究 - 记忆整合机制设计

---

**核心公式**：

```
AI 效果 = AI 能力 × 上下文质量 × 记忆深度
```

AI 能力是固定的，但上下文质量和记忆深度是你可以控制的变量。

## 核心文档

### 设计文档

- [记忆整合系统设计](./docs/memory-consolidation-design.md) - 三层记忆架构的理论基础
- [语义搜索技术方案](./docs/semantic-search-plan.md) - v0.4.x 向量搜索实现计划
- [v0.3.2 技术设计](./docs/v0.3.2-consolidation-design.md) - 当前实现的详细设计

### 集成指南

- [OpenCode 集成](./docs/OPENCODE_INTEGRATION.md) - OpenCode Plugin 配置
- [工作原理](./docs/how-it-works.md) - 系统架构和数据流
- [快速开始](./docs/getting-started.md) - 5 分钟上手指南

### 技术选型

- [技术选型报告](./docs/TECH_SELECTION_REPORT.md) - MCP vs Skill vs Plugin 分析
- [竞争分析: mem0](./docs/COMPARISON_MEM0.md) - 与 mem0 的对比

### 愿景文档

- [记忆的未来](./docs/THE_FUTURE_OF_MEMORY.md) - AI Agent = 模型 + 上下文 + 记忆
- [记忆系统设计](./docs/MEMORY_SYSTEM_DESIGN.md) - 脑科学启发的记忆架构
