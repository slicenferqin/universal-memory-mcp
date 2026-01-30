# Universal Memory MCP

<div align="center">

**A universal memory system that gives any AI CLI tool long-term memory and becomes your super personal assistant**

English | [简体中文](./README.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://badge.fury.io/js/universal-memory-mcp.svg)](https://www.npmjs.com/package/universal-memory-mcp)
[![npm beta](https://badge.fury.io/js/universal-memory-mcp.svg)](https://www.npmjs.com/package/universal-memory-mcp?v=beta)

[Features](#-core-features) • [Quick Start](#-quick-start) • [Why Universal Memory](#-why-universal-memory) • [Documentation](#-documentation)

</div>

---

## ✨ Core Features

- 🌍 **Universal** - Works with all AI CLI tools via MCP protocol
- 🔄 **Cross-Project** - Unified memory and knowledge across all your projects
- 🔌 **Cross-CLI** - Supports Claude Code, OpenCode, Copilot, Gemini CLI, and more
- 🤖 **Super Personal Assistant** - Transforms AI from a tool into an intelligent partner that truly knows you
- 🔒 **Super Privacy** - Zero data collection, zero telemetry, fully encrypted storage
- 💻 **100% Local & Private** - Everything runs locally, no cloud services, no API keys required for core features

## 🚀 Quick Start

### Installation

```bash
npm install -g universal-memory-mcp
```

### Configure Claude Code (Auto-Setup)

The installation script will automatically configure:

- ✅ MCP Server (`~/.claude/settings.json`)
- ✅ Memory Assistant Skill (guides AI to use memory)
- ✅ Stop Hook (auto-records conversations)

Restart Claude Code, and you're ready to go!

### Configure OpenCode (Auto-Setup)

```bash
npm install -g universal-memory-mcp
```

The installation script will automatically configure:

- ✅ MCP Server (`~/.config/opencode/opencode.json`)
- ✅ OpenCode Plugin (auto-records conversations)
- ✅ Auto-capture based on `session.idle` event

Restart OpenCode, and you're ready to go!

### Configure Any MCP-Compatible CLI

Edit your CLI's MCP config file:

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

## 🎯 Why Universal Memory?

### The Problem: AI Tools Lack Long-Term Memory

| Aspect        | Current AI Tools                   | What You Need                  |
| ------------- | ---------------------------------- | ------------------------------ |
| **Memory**    | ❌ No memory across sessions       | ✅ Remembers everything        |
| **Context**   | ❌ Limited to current conversation | ✅ Accesses all past knowledge |
| **Privacy**   | ❌ Data sent to cloud APIs         | ✅ 100% local, private storage |
| **Projects**  | ❌ Isolated per project            | ✅ Unified across all projects |
| **Ownership** | ❌ Locked in specific tools        | ✅ Works with any AI CLI       |

### Our Solution: Three-Tier Memory Architecture

Inspired by human brain science, we've designed a memory system that mimics how memories are formed and consolidated:

```
┌─────────────────────────────────────────────────────────────┐
│  Level 0: Sensory Memory (daily/*.md)                       │
│  • Captures raw conversations                               │
│  • 0-7 days lifecycle                                       │
│  • Complete but redundant                                   │
└────────────────────┬────────────────────────────────────────┘
                     │ Auto-extraction (daily)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Level 1: Short-Term Memory (long_term/*.md)               │
│  • Extracted facts, decisions, preferences                  │
│  • 7-30 days lifecycle                                      │
│  • Structured, traceable                                    │
└────────────────────┬────────────────────────────────────────┘
                     │ Consolidation (weekly)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Level 2: Long-Term Memory (*-summary.md)                   │
│  • Integrated knowledge base                                │
│  • 30+ days lifecycle                                       │
│  • Ready to use, high value                                 │
└─────────────────────────────────────────────────────────────┘
```

**Benefits**:

- 🧠 **Natural Memory Flow** - Mimics human memory consolidation
- 📈 **Increasing Information Density** - L0 (raw) → L1 (facts) → L2 (knowledge)
- ⚡ **Efficient Retrieval** - Search L1/L2 for relevant facts, not raw logs
- 💾 **Smart Storage** - Archive old memories, keep recent ones

### What Makes Us Different

| Feature            | Universal Memory  | mem0          | Other Solutions |
| ------------------ | ----------------- | ------------- | --------------- |
| **Architecture**   | 3-tier (L0/L1/L2) | 2-tier (flat) | Various         |
| **Privacy**        | 100% local        | Cloud/SaaS    | Mixed           |
| **Cross-CLI**      | ✅ All MCP tools  | ❌ Specific   | ❌ Locked       |
| **Cross-Project**  | ✅ Unified        | ❌ Isolated   | ❌ No           |
| **Data Ownership** | You own it        | They control  | Varies          |
| **Cost**           | Free (local)      | Paid tiers    | Varies          |
| **Open Source**    | MIT License       | Apache 2.0    | Various         |

## 📖 How It Works

### Architecture

```
User ←→ AI CLI (Claude Code / OpenCode / Gemini / Copilot)
             │
             │ MCP Protocol
             ↓
┌───────────────────────────────────────────────────────────┐
│  Universal Memory MCP Server                               │
│  ├── memory_search: Search historical memory              │
│  ├── memory_record: Record conversations                  │
│  └── memory_update_long_term: Store important information │
└───────────────────────┬───────────────────────────────────┘
                        │
                        ↓
┌───────────────────────────────────────────────────────────┐
│  ~/.universal-memory/                                     │
│  ├── daily/              # Level 0: Sensory memory        │
│  ├── long_term/          # Level 1-2: Long-term memory    │
│  ├── archive/            # Cold storage (7+ / 30+ days)   │
│  └── index.db           # Vector index (SQLite)           │
└───────────────────────────────────────────────────────────┘
```

### Memory Lifecycle

**Automatic Management**:

1. **Capture** - Every conversation is recorded to `daily/` (Level 0)
2. **Extract** - Daily task extracts facts to `long_term/` (Level 1)
3. **Consolidate** - Weekly task integrates to summaries (Level 2)
4. **Archive** - Monthly task moves old memories to `archive/`
5. **Search** - Semantic + keyword search with time decay and project relevance

**All automated!** You just use your AI tools as normal.

## 🔍 Key Features (v0.6.0-beta.0)

### Three-Tier Memory Architecture ✨

- **Level 0 (daily/\*.md)**: Raw conversation logs (0-7 days)
- **Level 1 (long_term/\*.md)**: Extracted facts, decisions, preferences (7-30 days)
- **Level 2 (long_term/\*-summary.md)**: Consolidated knowledge base (30+ days)

### Intelligent Search

- **Semantic Search** - Vector-based similarity search with time decay
- **Keyword Search** - Fast FTS5 full-text search
- **Hybrid Search** - Combines both with RRF algorithm
- **Project Relevance** - Boosts same-project memories by 1.5x
- **Archive Support** - Optional search of archived memories

### Performance

- ⚡ Search latency: **<5ms** (P95)
- 📈 Recall rate: **60%** (4x improvement over v0.4.0)
- 🚀 Async indexing - Non-blocking, background processing
- 📁 File watcher - Auto-index on file changes

### Privacy & Security

- 🔒 **100% Local** - All data stored locally in `~/.universal-memory/`
- 🚫 **No Cloud** - No telemetry, no data collection, no analytics
- 👤 **No Account** - Works offline, no sign-up required
- 🔐 **Your Data** - You own and control everything

## 📚 Documentation

### Design Documents

- [Memory Consolidation Design](./docs/memory-consolidation-design.md) - Three-tier architecture theory
- [Scheduler Design](./docs/SCHEDULER_DESIGN.md) - Automatic lifecycle management
- [Code Review (v0.6.0)](./docs/CODE_REVIEW_v0.6.0.md) - Architecture assessment

### Integration Guides

- [Claude Code Integration](./docs/integration/claude-code.md) - Configuration for Claude Code
- [OpenCode Integration](./docs/OPENCODE_INTEGRATION.md) - Configuration for OpenCode
- [Quick Start Guide](./docs/getting-started.md) - 5-minute setup guide

### Technical Docs

- [Architecture](./ARCHITECTURE.md) - System architecture and data flow
- [Semantic Search API](./docs/SEMANTIC_SEARCH_API.md) - Complete search API documentation
- [Performance Testing](./docs/PERFORMANCE_TESTING.md) - Benchmarks and optimization

### Roadmap

- [Development Roadmap](./docs/ROADMAP.md) - Version planning and milestones
- [v0.7.0 Tasks](./docs/v0.7.0_TASKS.md) - Next version task breakdown

## 🗺️ Roadmap

### ✅ Completed

- **v0.1.0**: Basic memory system (record + search)
- **v0.2.0**: OpenCode Plugin auto-capture
- **v0.3.0**: Claude Code integration (Stop hook + Skill)
- **v0.4.0**: Semantic search (vector indexing)
- **v0.5.0**: Performance optimization (async indexing, 4x candidates)
- **v0.6.0-beta.0**: Three-tier architecture (L0→L1→L2 lifecycle)

### 🚧 In Progress

- **v0.7.0**: Enterprise features (testing >80%, monitoring, docs)

### 🎯 Planned

- **v1.0.0**: Production-ready (all features stable, benchmarks met)

**Timeline**: ~3 months total (6 weeks completed, 5 weeks remaining)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

**High Priority Areas**:

- Unit tests (coverage >80%)
- Error retry mechanism
- Performance optimizations
- Documentation improvements
- Bug fixes

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details

## 🙏 Acknowledgments

Inspired by:

- [Clawdbot](https://github.com/clawdbot/clawdbot) - Memory system design concepts
- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP protocol
- Brain science research - Memory consolidation mechanisms

## 💡 Core Philosophy

```
AI Effectiveness = AI Capability × Context Quality × Memory Depth
```

AI capability is fixed, but context quality and memory depth are within your control.

**Universal Memory MCP** unlocks the memory dimension for any AI CLI tool.

---

<div align="center">

**[⬆ Back to Top](#universal-memory-mcp)**

Made with ❤️ by [slicenferqin](https://github.com/slicenferqin)

[Star ⭐](https://github.com/slicenferqin/universal-memory-mcp) • [Fork 🔱](https://github.com/slicenferqin/universal-memory-mcp/fork) • [Issue 🐛](https://github.com/slicenferqin/universal-memory-mcp/issues)

</div>
