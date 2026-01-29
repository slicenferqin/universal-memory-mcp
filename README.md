# Universal Memory MCP

> 让任何 AI CLI 工具拥有长期记忆，成为你的个人大管家

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 这是什么？

**Universal Memory MCP** 是一个通用的记忆系统，通过 Model Context Protocol (MCP) 为任何 AI CLI 工具提供：

- **长期记忆**：记住所有对话，跨会话、跨项目
- **智能检索**：语义搜索 + 关键词搜索，秒级找到相关历史
- **即插即用**：支持 Claude Code、OpenCode、Gemini CLI 等所有 MCP 兼容工具

## 核心理念

### 上下文 ≠ 记忆

| 特性         | 上下文（Context）              | 记忆（Memory）     |
| ------------ | ------------------------------ | ------------------ |
| **生命周期** | 单次会话                       | 永久持久化         |
| **容量**     | 受限于窗口（128K-200K tokens） | 无限制             |
| **成本**     | 每次传输都计费                 | 只在检索时计费     |
| **可操作性** | 只能读取                       | 可读、可写、可搜索 |

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

| 层级 | 类比 | 存储 | 特点 |
|------|------|------|------|
| **Level 0** | 感觉记忆 | `daily/*.md` | 原始对话流水，完整但冗余 |
| **Level 1** | 短期记忆 | `long_term/*.md` | 提取的条目，带时间戳可追溯 |
| **Level 2** | 长期记忆 | `*-summary.md` | 整合的摘要，结构化可直接使用 |

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

### 配置 OpenCode (自动采集)

编辑 `~/.config/opencode/opencode.json`：

```json
{
  "plugin": ["@slicenferqin/opencode-universal-memory"]
}
```

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
- **Search Engine**: 搜索引擎（关键词 + 语义）
- **Consolidator**: 记忆整合（提取 + 二次整合）

### 技术选型

| 组件       | 技术选择    | 原因                         |
| ---------- | ----------- | ---------------------------- |
| 索引数据库 | sqlite-vec  | 单文件、无依赖、支持向量搜索 |
| 全文搜索   | SQLite FTS5 | 内置、高效 BM25              |
| Embedding  | 可配置      | 支持 OpenAI / Local / Gemini |
| 存储       | 文件系统    | 透明、可迁移、用户可控       |

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

- [x] v0.1.0: 基础记忆系统（记录 + 搜索）
- [x] v0.2.0: OpenCode Plugin 自动采集
- [x] v0.3.0: Claude Code 自动记录（Stop hook + Skill）
- [x] v0.3.1: Client 字段支持（区分不同客户端）
- [x] v0.3.2: 三层记忆架构（基于脑科学的记忆整合）
- [ ] v0.4.0: 向量索引（语义搜索）
- [ ] v0.5.0: 混合搜索（语义 + 关键词）
- [ ] v1.0.0: 稳定版本

## 贡献

欢迎提交 Issue 和 Pull Request！

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
