# How It Works

## Core Concept: Context vs Memory

Traditional AI assistants have a fundamental limitation: they can only remember what's in their "context window" - the current conversation. When you start a new session, everything is forgotten.

**Universal Memory** solves this by separating two concepts:

| Aspect | Context | Memory |
|--------|---------|--------|
| Lifetime | Single session | Permanent |
| Capacity | Limited (128K-200K tokens) | Unlimited |
| Cost | Charged per token | Only charged when retrieved |
| Location | AI's working memory | Your local files |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     AI CLI Tool                              │
│              (Claude Code / OpenCode / etc.)                │
└─────────────────────────┬───────────────────────────────────┘
                          │ MCP Protocol
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Universal Memory MCP Server                     │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Recorder   │  │  Searcher   │  │ Consolidator│         │
│  │             │  │             │  │             │         │
│  │ Auto-save   │  │ Keyword +   │  │ Extract     │         │
│  │ all talks   │  │ Semantic    │  │ important   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                          │                                   │
│              ┌───────────┴───────────┐                      │
│              │    Memory Manager     │                      │
│              └───────────┬───────────┘                      │
└──────────────────────────┼──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    ~/.ai_memory/                             │
│                                                              │
│  ├── daily/           # Every conversation, by date          │
│  ├── long_term/       # Important stuff, summarized         │
│  ├── projects/        # Project-specific memory             │
│  └── index.db         # Search index                        │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Recording Conversations

Every conversation is automatically saved to a daily log file:

```markdown
## 2026-01-27 10:30:15

**Project:** my-app
**Session:** abc123

**User:** Help me design a REST API for user management.

**AI:** I'll help you design a RESTful API for user management...

---
```

**Key points:**
- Automatic - no need to manually save
- Organized by date
- Plain Markdown - human readable and editable
- Includes metadata (project, session, timestamp)

### 2. Searching Memories

When you ask about something from the past, the system searches:

```
User: "What did we discuss about authentication?"
         │
         ▼
┌─────────────────────────────────────┐
│         Search Engine               │
│                                     │
│  1. Parse query                     │
│  2. Search daily logs               │
│  3. Search long-term memory         │
│  4. Rank by relevance               │
│  5. Return top results              │
└─────────────────────────────────────┘
         │
         ▼
AI: "Based on our previous discussions..."
```

**Current search (v0.1):**
- Keyword-based search
- Time-range filtering
- Project filtering

**Planned search (v0.2+):**
- Semantic (vector) search
- BM25 full-text search
- Hybrid ranking

### 3. Long-term Memory Consolidation

Important information gets extracted to long-term memory:

```markdown
# Long-term Memory (MEMORY.md)

## User Preferences
- Prefers TypeScript over JavaScript
- Likes concise explanations
- Uses 2-space indentation

## Important Decisions
- [2026-01-27] Chose JWT for authentication
- [2026-01-28] Selected PostgreSQL for database

## Key Facts
- Working on e-commerce platform
- Team uses GitHub for version control
```

**How it works:**
- AI explicitly calls `update_long_term_memory` when it recognizes important info
- Categorized into: decisions, preferences, contacts, facts
- Always available for context

## Why Markdown?

We chose Markdown for storage because:

1. **Transparency** - You can read and edit your memories directly
2. **Version Control** - Works great with Git
3. **Portability** - Move to another system anytime
4. **Simplicity** - No complex database to manage

## Privacy & Security

All data stays on your machine:
- Stored in `~/.ai_memory/`
- No cloud upload
- You control everything

## Future Plans

### Phase 2: Vector Search
- Semantic understanding of queries
- sqlite-vec for local vector storage
- Better relevance ranking

### Phase 3: Smart Consolidation
- Automatic extraction of important info
- Periodic summarization of old logs
- Intelligent deduplication

### Phase 4: Multi-modal
- Image memory (screenshots, diagrams)
- File attachments
- Link previews
