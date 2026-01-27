# Universal Memory MCP Server

MCP Server implementation for universal AI memory system.

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

## Available Tools

### search_memory

Search through conversation history.

```json
{
  "query": "API design",
  "time_range": ["2026-01-01", "2026-01-31"],
  "project": "my-project",
  "limit": 10
}
```

### get_session_context

Get session context including recent conversations and long-term memory.

```json
{
  "include_recent_days": 2,
  "include_long_term": true,
  "project": "my-project"
}
```

### update_long_term_memory

Update long-term memory with important information.

```json
{
  "category": "decisions",
  "content": "Chose PostgreSQL for the database because..."
}
```

### record_conversation

Record a conversation (usually called automatically).

```json
{
  "user_message": "Help me design...",
  "ai_response": "Sure, here's my suggestion...",
  "project": "my-project"
}
```

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run locally
node dist/index.js
```
