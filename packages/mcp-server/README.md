# Universal Memory MCP Server

MCP Server for persistent AI memory across sessions. Works with any MCP-compatible AI CLI.

## Features

- **Automatic Setup**: Installs MCP server and memory-assistant skill automatically
- **Persistent Memory**: Remember conversations across sessions
- **Smart Recall**: AI automatically searches past discussions when relevant
- **Long-term Storage**: Store preferences, decisions, and important facts

## Quick Start

```bash
npm install -g universal-memory-mcp
```

That's it! The installer will:
1. Configure MCP server in `~/.claude/settings.json`
2. Install memory-assistant skill to `~/.claude/skills/`
3. Prompt you to restart Claude Code

**After restart**, Claude will automatically:
- Search past conversations when you reference them
- Record important conversations for future recall
- Remember your preferences and decisions

## Manual Configuration

If automatic setup doesn't work, configure manually:

### Claude Code CLI

Edit `~/.claude/settings.json`:

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

## How It Works

### Memory Assistant Skill

The installed skill guides Claude to use memory tools automatically:

| Trigger | Action |
|---------|--------|
| User mentions "之前", "上次", "remember", "we talked about" | Search past memories |
| End of meaningful conversation | Record the exchange |
| User expresses preference or makes decision | Store in long-term memory |

### MCP Tools

#### memory_search

Search through conversation history and long-term memories.

```json
{
  "query": "database decision",
  "time_range": ["2026-01-01", "2026-01-31"],
  "project": "my-project",
  "limit": 10
}
```

#### memory_record

Record conversation for future reference.

```json
{
  "user_message": "Help me design a REST API",
  "ai_response": "Recommended RESTful patterns with resource-based URLs...",
  "project": "my-project"
}
```

#### memory_update_long_term

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

## Storage

All data stored locally in `~/.ai_memory/`:

```
~/.ai_memory/
├── daily/           # Daily conversation logs (YYYY-MM-DD.md)
├── long_term/       # Important memories (MEMORY.md, preferences.md, etc.)
├── projects/        # Project-specific state
└── config.json      # Configuration
```

## Troubleshooting

### MCP tools not available

1. Ensure you've restarted Claude Code after installation
2. Check `~/.claude/settings.json` contains the MCP configuration
3. Try running `npx universal-memory-mcp` directly to test

### Skill not triggering

1. Check `~/.claude/skills/memory-assistant/SKILL.md` exists
2. Restart Claude Code to reload skills
3. Try explicitly asking Claude to "search my memories for X"

## Development

```bash
git clone https://github.com/slicenferqin/universal-memory-mcp.git
cd universal-memory-mcp
pnpm install
pnpm build
```

## License

MIT
