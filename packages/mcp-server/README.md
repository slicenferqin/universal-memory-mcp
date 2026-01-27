# Universal Memory MCP Server

MCP Server for persistent AI memory across sessions. Works with any MCP-compatible AI CLI.

## Installation

```bash
npm install -g universal-memory-mcp
```

## Configuration

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

### Claude Code CLI

Edit `~/.config/claude/settings.json`:

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

## Tools

### memory_search

Search through conversation history and long-term memories.

```json
{
  "query": "database decision",
  "time_range": ["2026-01-01", "2026-01-31"],
  "project": "my-project",
  "limit": 10
}
```

**When to use:**
- User asks about past discussions
- User references "we talked about before"
- Need to know user preferences (search "preferences")
- Need context from previous sessions

### memory_record

Record conversation for future reference.

```json
{
  "user_message": "Help me design a REST API",
  "ai_response": "Recommended RESTful patterns with resource-based URLs...",
  "project": "my-project"
}
```

**When to use:**
- After every meaningful conversation exchange
- To ensure continuity across sessions

### memory_update_long_term

Store important information for easy retrieval.

```json
{
  "category": "preferences",
  "content": "User prefers TypeScript over JavaScript"
}
```

**Categories:**
- `preferences` - User's working style and preferences
- `decisions` - Important technical decisions
- `facts` - Key information about user/projects
- `contacts` - People and teams

## How It Works

```
User asks about past discussion
        │
        ▼
AI calls memory_search("topic")
        │
        ▼
Returns relevant memories
        │
        ▼
AI responds with context
        │
        ▼
AI calls memory_record() to save this exchange
```

## Storage

All data stored locally in `~/.ai_memory/`:

```
~/.ai_memory/
├── daily/           # Daily conversation logs (YYYY-MM-DD.md)
├── long_term/       # Important memories (MEMORY.md, preferences.md, etc.)
├── projects/        # Project-specific state
└── config.json      # Configuration
```

## Development

```bash
pnpm install
pnpm build
node dist/index.js
```
