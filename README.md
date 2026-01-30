# Universal Memory MCP

<div align="center">

**让任何 AI CLI 工具拥有长期记忆，成为你的超级个人助理**

简体中文 | [English](./README_EN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://badge.fury.io/js/universal-memory-mcp.svg)](https://www.npmjs.com/package/universal-memory-mcp)
[![npm beta](https://badge.fury.io/js/universal-memory-mcp.svg)](https://www.npmjs.com/package/universal-memory-mcp?v=beta)

[功能特性](#-核心特性) • [快速开始](#-快速开始) • [为什么选择](#-为什么选择) • [文档](#-文档)

</div>

---

## ✨ 核心特性

- 🌍 **通用** - 基于 MCP 协议，支持所有 AI CLI 工具
- 🔄 **跨项目** - 统一管理所有项目的记忆和知识
- 🔌 **跨 CLI** - 支持 Claude Code、OpenCode、Copilot、Gemini CLI 等
- 🤖 **超级个人助理** - 让 AI 从工具进化为真正了解你的智能伙伴
- 🔒 **超级隐私** - 零数据收集、零遥测，完全加密存储
- 💻 **100% 本地私有** - 全部本地运行，无云服务，核心功能无需 API 密钥

## 🚀 快速开始

### 安装

```bash
npm install -g universal-memory-mcp
```

### 配置 Claude Code（自动设置）

安装脚本会自动配置：

- ✅ MCP Server（`~/.claude/settings.json`）
- ✅ Memory Assistant Skill（引导 AI 使用记忆）
- ✅ Stop Hook（自动记录对话）

重启 Claude Code 即可使用！

### 配置 OpenCode（自动设置）

```bash
npm install -g universal-memory-mcp
```

安装脚本会自动配置：

- ✅ MCP Server（`~/.config/opencode/opencode.json`）
- ✅ OpenCode 插件（自动记录对话）
- ✅ 基于 `session.idle` 事件自动捕获

重启 OpenCode 即可使用！

### 配置任何 MCP 兼容的 CLI

编辑你的 CLI 配置文件：

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

## 🎯 为什么选择 Universal Memory？

### 问题：AI 工具缺乏长期记忆

| 方面       | 当前 AI 工具          | 你的需求               |
| ---------- | --------------------- | ---------------------- |
| **记忆**   | ❌ 跨会话无记忆       | ✅ 记住一切            |
| **上下文** | ❌ 仅限当前对话       | ✅ 访问所有历史知识    |
| **隐私**   | ❌ 数据发送到云端 API | ✅ 100% 本地，私有存储 |
| **项目**   | ❌ 每个项目孤立       | ✅ 跨所有项目统一      |
| **所有权** | ❌ 锁定在特定工具     | ✅ 适用于任何 AI CLI   |

### 我们的方案：三层记忆架构

借鉴人类脑科学，我们设计了模拟记忆形成和整合机制的系统：

```
┌─────────────────────────────────────────────────────────────┐
│  Level 0: 感觉记忆 (daily/*.md)                            │
│  • 捕获原始对话                                            │
│  • 0-7 天生命周期                                          │
│  • 完整但冗余                                              │
└────────────────────┬────────────────────────────────────────┘
                     │ 自动提取（每日）
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Level 1: 短期记忆 (long_term/*.md)                        │
│  • 提取的事实、决策、偏好                                  │
│  • 7-30 天生命周期                                         │
│  • 结构化、可追溯                                          │
└────────────────────┬────────────────────────────────────────┘
                     │ 整合（每周）
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Level 2: 长期记忆 (*-summary.md)                          │
│  • 整合的知识库                                            │
│  • 30+ 天生命周期                                          │
│  • 可直接使用，高价值                                      │
└─────────────────────────────────────────────────────────────┘
```

**优势**：

- 🧠 **自然记忆流程** - 模拟人类记忆整合
- 📈 **信息密度递增** - L0（原始）→ L1（事实）→ L2（知识）
- ⚡ **高效检索** - 在 L1/L2 搜索相关事实，而非原始日志
- 💾 **智能存储** - 归档旧记忆，保留新记忆

### 我们的不同之处

| 特性           | Universal Memory | mem0         | 其他方案 |
| -------------- | ---------------- | ------------ | -------- |
| **架构**       | 3 层 (L0/L1/L2)  | 2 层（扁平） | 各异     |
| **隐私**       | 100% 本地        | 云服务/SaaS  | 混合     |
| **跨 CLI**     | ✅ 所有 MCP 工具 | ❌ 特定工具  | ❌ 锁定  |
| **跨项目**     | ✅ 统一管理      | ❌ 孤立      | ❌ 无    |
| **数据所有权** | 你拥有           | 他们控制     | 各异     |
| **成本**       | 免费（本地）     | 付费分层     | 各异     |
| **开源协议**   | MIT License      | Apache 2.0   | 各异     |

## 📖 工作原理

### 架构

```
用户 ←→ AI CLI (Claude Code / OpenCode / Gemini / Copilot)
              │
              │ MCP 协议
              ↓
┌───────────────────────────────────────────────────────────┐
│  Universal Memory MCP 服务器                              │
│  ├── memory_search: 搜索历史记忆                          │
│  ├── memory_record: 记录对话                              │
│  └── memory_update_long_term: 存储重要信息                │
└───────────────────────┬───────────────────────────────────┘
                        │
                        ↓
┌───────────────────────────────────────────────────────────┐
│  ~/.universal-memory/                                     │
│  ├── daily/              # Level 0: 感觉记忆              │
│  ├── long_term/          # Level 1-2: 长期记忆            │
│  ├── archive/            # 冷存储（7+ / 30+ 天）          │
│  └── index.db           # 向量索引（SQLite）              │
└───────────────────────────────────────────────────────────┘
```

### 记忆生命周期

**自动化管理**：

1. **捕获** - 每次对话记录到 `daily/`（Level 0）
2. **提取** - 每日任务提取事实到 `long_term/`（Level 1）
3. **整合** - 每周任务整合为摘要（Level 2）
4. **归档** - 每月任务移动旧记忆到 `archive/`
5. **搜索** - 语义 + 关键词搜索，时间衰减 + 项目相关性

**全自动化！** 你只需正常使用 AI 工具即可。

## 🔍 核心功能（v0.6.0-beta.0）

### 三层记忆架构 ✨

- **Level 0 (daily/\*.md)**: 原始对话日志（0-7 天）
- **Level 1 (long_term/\*.md)**: 提取的事实、决策、偏好（7-30 天）
- **Level 2 (long_term/\*-summary.md)**: 整合的知识库（30+ 天）

### 智能搜索

- **语义搜索** - 基于向量的相似度搜索 + 时间衰减
- **关键词搜索** - 快速 FTS5 全文搜索
- **混合搜索** - RRF 算法结合两者
- **项目相关性** - 同项目记忆提升 1.5x 权重
- **归档支持** - 可选搜索归档记忆

### 性能

- ⚡ 搜索延迟：**<5ms** (P95)
- 📈 召回率：**60%**（相比 v0.4.0 提升 4 倍）
- 🚀 异步索引 - 非阻塞，后台处理
- 📁 文件监视器 - 文件变化自动索引

### 隐私与安全

- 🔒 **100% 本地** - 所有数据本地存储在 `~/.universal-memory/`
- 🚫 **无云服务** - 无遥测、无数据收集、无分析
- 👤 **无需账号** - 离线工作，无需注册
- 🔐 **你的数据** - 你拥有并控制一切

## 📚 文档

### 设计文档

- [记忆整合系统设计](./docs/memory-consolidation-design.md) - 三层架构理论基础
- [调度器设计](./docs/SCHEDULER_DESIGN.md) - 自动化生命周期管理
- [代码审查 (v0.6.0)](./docs/CODE_REVIEW_v0.6.0.md) - 架构评估

### 集成指南

- [Claude Code 集成](./docs/integration/claude-code.md) - Claude Code 配置
- [OpenCode 集成](./docs/OPENCODE_INTEGRATION.md) - OpenCode 配置
- [快速开始指南](./docs/getting-started.md) - 5 分钟上手指南

### 技术文档

- [系统架构](./ARCHITECTURE.md) - 系统架构和数据流
- [语义搜索 API](./docs/SEMANTIC_SEARCH_API.md) - 完整搜索 API 文档
- [性能测试](./docs/PERFORMANCE_TESTING.md) - 基准测试和优化

### 路线图

- [开发路线图](./docs/ROADMAP.md) - 版本规划和里程碑
- [v0.7.0 任务](./docs/v0.7.0_TASKS.md) - 下一版本任务分解

## 🗺️ 发展路线

### ✅ 已完成

- **v0.1.0**: 基础记忆系统（记录 + 搜索）
- **v0.2.0**: OpenCode 插件自动采集
- **v0.3.0**: Claude Code 集成（Stop hook + Skill）
- **v0.4.0**: 语义搜索（向量索引）
- **v0.5.0**: 性能优化（异步索引、4x 候选池）
- **v0.6.0-beta.0**: 三层架构（L0→L1→L2 生命周期）

### 🚧 进行中

- **v0.7.0**: 企业级特性（测试 >80%、监控、文档）

### 🎯 计划中

- **v1.0.0**: 生产就绪（所有功能稳定、基准测试达标）

**时间线**：总计 ~3 个月（已完成 6 周，剩余 5 周）

## 🤝 贡献

欢迎贡献！请查看我们的[贡献指南](./CONTRIBUTING.md)。

**高优先级领域**：

- 单元测试（覆盖率 >80%）
- 错误重试机制
- 性能优化
- 文档改进
- Bug 修复

## 📄 开源协议

MIT License - 详见 [LICENSE](./LICENSE)

## 🙏 致谢

受以下项目启发：

- [Clawdbot](https://github.com/clawdbot/clawdbot) - 记忆系统设计理念
- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP 协议
- 脑科学研究 - 记忆整合机制

## 💡 核心理念

```
AI 效果 = AI 能力 × 上下文质量 × 记忆深度
```

AI 能力是固定的，但上下文质量和记忆深度是你可以控制的变量。

**Universal Memory MCP** 为任何 AI CLI 工具解锁了记忆维度。

---

<div align="center">

**[⬆ 返回顶部](#universal-memory-mcp)**

由 [slicenferqin](https://github.com/slicenferqin) 用 ❤️ 制作

[Star ⭐](https://github.com/slicenferqin/universal-memory-mcp) • [Fork 🔱](https://github.com/slicenferqin/universal-memory-mcp/fork) • [Issue 🐛](https://github.com/slicenferqin/universal-memory-mcp/issues)

</div>
