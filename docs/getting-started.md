# Getting Started

## Prerequisites

- Node.js >= 20
- An AI CLI tool that supports MCP (Claude Code, OpenCode, etc.)

## Installation

### Option 1: npm (Recommended)

```bash
npm install -g universal-memory-mcp
```

### Option 2: From Source

```bash
git clone https://github.com/slicenferqin/universal-memory-mcp.git
cd universal-memory-mcp
pnpm install
pnpm build
```

## Configuration

### For Claude Desktop

1. Open your Claude Desktop configuration file:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2. Add the MCP server configuration:

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

3. Restart Claude Desktop.

### For Claude Code CLI

1. Edit your settings file at `~/.config/claude/settings.json`:

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

2. Restart Claude Code.

## Verify Installation

Once configured, you can verify the installation by asking Claude:

```
Can you check if the memory system is working?
```

Claude should be able to call the `get_session_context` tool and show you the current memory state.

## First Steps

### 1. Have a Conversation

Just chat with Claude normally. The memory system will automatically record your conversations.

```
User: Let's design a user authentication system using JWT.
AI: Great! Here's my recommendation...
```

### 2. Recall Later

In a new session (or even days later), you can recall previous discussions:

```
User: What did we decide about authentication last time?
AI: [Searches memory] Based on our previous discussion, we chose JWT because...
```

### 3. Update Long-term Memory

When you want to explicitly remember something important:

```
User: Please remember that I prefer TypeScript over JavaScript.
AI: [Updates long-term memory] Got it, I'll remember your preference for TypeScript.
```

## Directory Structure

After first use, your memory will be stored in `~/.ai_memory/`:

```
~/.ai_memory/
├── daily/                  # Daily conversation logs
│   ├── 2026-01-27.md
│   └── ...
├── long_term/              # Long-term memory
│   ├── MEMORY.md           # Main memory file
│   ├── decisions.md        # Important decisions
│   └── preferences.md      # User preferences
├── projects/               # Project-specific memory
└── config.json             # Configuration
```

## Next Steps

- [How It Works](./how-it-works.md) - Learn about the memory system architecture
- [Integration Guides](./integration/) - Detailed guides for specific tools
- [Configuration](./configuration.md) - Advanced configuration options
