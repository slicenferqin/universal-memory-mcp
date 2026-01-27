# Universal Memory MCP

> 让任何 AI CLI 工具拥有长期记忆，成为你的个人大管家

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 这是什么？

**Universal Memory MCP** 是一个通用的记忆系统，通过 Model Context Protocol (MCP) 为任何 AI CLI 工具提供：

- **长期记忆**：记住所有对话，跨会话、跨项目
- **智能检索**：语义搜索 + 关键词搜索，秒级找到相关历史
- **完全自动**：无需 AI 主动调用，透明化记录
- **即插即用**：支持 Claude Code、OpenCode、Gemini CLI 等

## 核心理念

### 上下文 ≠ 记忆

| 特性 | 上下文（Context） | 记忆（Memory） |
|-----|------------------|---------------|
| **生命周期** | 单次会话 | 永久持久化 |
| **容量** | 受限于窗口（128K-200K tokens） | 无限制 |
| **成本** | 每次传输都计费 | 只在检索时计费 |
| **可操作性** | 只能读取 | 可读、可写、可搜索 |

### 工作原理

```
┌─────────────────────────────────────────────────────────┐
│  User ←→ AI CLI (Claude Code / OpenCode / Gemini)       │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────┐
│  Universal Memory MCP Server                            │
│  ├── 自动拦截所有对话                                    │
│  ├── 写入 daily/*.md（每日流水）                        │
│  ├── 建立向量索引                                       │
│  └── 提供搜索工具                                       │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────┐
│  ~/.ai_memory/                                          │
│  ├── daily/              # 每日对话流水                  │
│  │   ├── 2026-01-27.md                                  │
│  │   └── ...                                            │
│  ├── long_term/          # 长期记忆                      │
│  │   ├── MEMORY.md       # 主记忆文件                    │
│  │   ├── decisions.md    # 重要决策                      │
│  │   └── preferences.md  # 用户偏好                      │
│  ├── projects/           # 项目级记忆                    │
│  │   └── <project-name>/                                │
│  └── index.db            # 向量索引（SQLite）            │
└─────────────────────────────────────────────────────────┘
```

## 与其他方案的对比

| 方案 | 记忆范围 | 自动化 | 检索能力 | 通用性 |
|-----|---------|--------|---------|--------|
| **Universal Memory** | 用户级（所有对话） | ✅ 完全自动 | ✅ 混合搜索 | ✅ 支持所有 CLI |
| Clawdbot | 多渠道（WhatsApp/Telegram） | ✅ 完全自动 | ✅ 混合搜索 | ❌ 独立应用 |
| 原生上下文 | 单会话 | ✅ 自动 | ❌ 无检索 | ✅ 内置 |

## 快速开始

### 安装

```bash
npm install -g universal-memory-mcp
```

### 配置 Claude Code

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

### 使用

```bash
# 第一次对话
$ claude "帮我设计一个用户认证系统"
AI: [设计方案...]
# ✅ 自动记录到 ~/.ai_memory/daily/2026-01-27.md

# 第二天
$ claude "昨天我们讨论的认证系统，JWT 部分能详细说说吗？"
AI: [自动搜索记忆] 根据昨天的讨论，我们选择了 JWT + Refresh Token...

# 一周后
$ claude "我之前所有关于认证的讨论都有哪些？"
AI: [搜索所有相关记忆] 我找到了 3 次相关讨论：
   1. 2026-01-27: JWT vs Session 的选择
   2. 2026-01-29: Refresh Token 的实现
   3. 2026-01-30: 安全性考虑

# 跨项目
$ cd ~/other-project
$ claude "我在之前的项目里用的是什么认证方案？"
AI: [搜索跨项目记忆] 在你的其他项目中...
```

## MCP 工具

### search_memory

搜索历史对话记忆。

```typescript
search_memory({
  query: "API 设计方案",
  options: {
    time_range: ["2026-01-01", "2026-01-31"],  // 可选
    project: "my-project",                      // 可选
    limit: 10                                   // 可选，默认 10
  }
})
```

### get_session_context

获取会话上下文（最近对话 + 长期记忆）。

```typescript
get_session_context({
  include_recent_days: 2,     // 最近几天的对话
  include_long_term: true,    // 是否包含长期记忆
  project: "my-project"       // 可选，项目名称
})
```

### update_long_term_memory

更新长期记忆（AI 主动调用，用于重要信息）。

```typescript
update_long_term_memory({
  category: "decisions",  // decisions | preferences | contacts
  content: "选择了 PostgreSQL 作为主数据库，因为..."
})
```

## 记忆结构

### 每日流水 (daily/*.md)

```markdown
## 2026-01-27 10:30:15

**Project:** universal-memory-mcp
**Session:** abc123

**User:** 帮我设计一个用户认证系统

**AI:** 好的，我来帮你设计...

---

## 2026-01-27 11:45:22

**Project:** universal-memory-mcp
**Session:** abc123

**User:** JWT 的过期时间设置多少合适？

**AI:** 根据安全性和用户体验的平衡...

---
```

### 长期记忆 (long_term/MEMORY.md)

```markdown
# Long-term Memory

## User Preferences

- 偏好使用 TypeScript
- 喜欢简洁的解释
- 代码风格：2 空格缩进

## Important Decisions

- 2026-01-27: 选择 JWT + Refresh Token 认证方案
- 2026-01-28: 数据库使用 PostgreSQL
- 2026-01-29: 前端框架选择 React

## Key Contacts

- Alice (alice@example.com) - 设计负责人
- Bob (bob@example.com) - 后端工程师
```

## 技术架构

### 核心组件

- **Memory Manager**: 记忆管理（记录、存储、检索）
- **MCP Server**: MCP 协议实现（工具暴露）
- **Index Database**: 向量索引（sqlite-vec）
- **Search Engine**: 混合搜索（语义 + 关键词）

### 技术选型

| 组件 | 技术选择 | 原因 |
|-----|---------|------|
| 索引数据库 | sqlite-vec | 单文件、无依赖、支持向量搜索 |
| 全文搜索 | SQLite FTS5 | 内置、高效 BM25 |
| Embedding | 可配置 | 支持 OpenAI / Local / Gemini |
| 存储 | 文件系统 | 透明、可迁移、用户可控 |

## 文档

- [快速开始](./docs/getting-started.md)
- [工作原理](./docs/how-it-works.md)
- [架构设计](./ARCHITECTURE.md)
- [集成指南](./docs/integration/)
  - [Claude Code](./docs/integration/claude-code.md)
  - [OpenCode](./docs/integration/opencode.md)
  - [Gemini CLI](./docs/integration/gemini-cli.md)

## 开发

### 环境要求

- Node.js >= 20
- pnpm >= 8

### 本地开发

```bash
# 克隆仓库
git clone git@github.com:slicenferqin/universal-memory-mcp.git
cd universal-memory-mcp

# 安装依赖
pnpm install

# 构建
pnpm build

# 运行测试
pnpm test

# 本地开发
pnpm dev
```

### 项目结构

```
universal-memory-mcp/
├── packages/
│   ├── core/           # 核心逻辑
│   ├── mcp-server/     # MCP Server 实现
│   └── cli/            # 独立 CLI 工具
├── docs/               # 文档
├── examples/           # 示例
└── tests/              # 测试
```

## 路线图

- [x] v0.1.0: 基础记忆系统（自动记录 + 简单搜索）
- [ ] v0.2.0: 向量索引（语义搜索）
- [ ] v0.3.0: 混合搜索（语义 + 关键词）
- [ ] v0.4.0: 长期记忆自动整理
- [ ] v1.0.0: 稳定版本

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License - 详见 [LICENSE](./LICENSE)

## 致谢

本项目受以下工作启发：
- [Clawdbot](https://github.com/clawdbot/clawdbot) - 记忆系统设计理念
- [Cursor](https://cursor.com/) - 动态上下文发现
- [Manus](https://manus.im/) - 可恢复压缩
- [InfiAgent](https://github.com/polyuiislab/infiAgent) - 十步策略

---

**核心公式**：
```
AI 效果 = AI 能力 × 上下文质量 × 记忆深度
```

AI 能力是固定的，但上下文质量和记忆深度是你可以控制的变量。
