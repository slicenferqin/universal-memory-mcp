# Claude Code Integration

## Overview

Universal Memory MCP integrates seamlessly with Claude Code CLI, giving you persistent memory across all your coding sessions.

## Installation

### 1. Install the MCP Server

```bash
npm install -g universal-memory-mcp
```

### 2. Configure Claude Code

Edit your Claude Code settings file at `~/.config/claude/settings.json`:

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

### 3. Restart Claude Code

```bash
# If running, stop and restart
claude
```

## Usage

### Automatic Recording

Every conversation is automatically recorded. Just use Claude Code normally:

```bash
$ claude "Help me refactor this function to use async/await"
```

The conversation is saved to `~/.ai_memory/daily/YYYY-MM-DD.md`.

### Searching Past Conversations

Ask Claude to recall previous discussions:

```bash
$ claude "What approach did we take for error handling last week?"
```

Claude will automatically search your memory and provide context.

### Project-Aware Memory

When you're in a project directory, conversations are tagged with the project name:

```bash
$ cd ~/projects/my-app
$ claude "Let's add user authentication"
# This conversation is tagged with project: my-app

$ cd ~/projects/another-app
$ claude "What authentication approach did we use in my-app?"
# Claude can recall from other projects
```

### Updating Long-term Memory

Ask Claude to remember important decisions:

```bash
$ claude "Please remember that we chose PostgreSQL for this project because of its JSON support"
```

Claude will store this in long-term memory for future reference.

## Example Session

```bash
# Day 1: Design discussion
$ cd ~/projects/my-saas
$ claude "Let's design the database schema for a multi-tenant SaaS app"
AI: Here's my recommendation for the schema...
    [Conversation recorded to daily log]

# Day 2: Continue work
$ claude "What schema did we decide on yesterday?"
AI: [Searches memory] Based on our discussion yesterday, we decided on...

# Day 3: In a different project
$ cd ~/projects/another-project
$ claude "I want to use a similar multi-tenant approach as my-saas"
AI: [Searches cross-project memory] In your my-saas project, you used...
```

## Tips

### 1. Be Explicit About Important Decisions

```bash
$ claude "Let's record that we chose Redis for session storage"
```

This helps Claude know what to store in long-term memory.

### 2. Use Project Directories

Working within project directories helps organize memories:

```bash
$ cd ~/projects/specific-project
$ claude "..."
```

### 3. Review Your Memories

You can directly browse your memory files:

```bash
$ cat ~/.ai_memory/daily/2026-01-27.md
$ cat ~/.ai_memory/long_term/MEMORY.md
```

### 4. Edit Memories If Needed

Since memories are plain Markdown, you can edit them:

```bash
$ vim ~/.ai_memory/long_term/preferences.md
```

## Troubleshooting

### Memory not being recorded

1. Check if the MCP server is running:
   ```bash
   ps aux | grep universal-memory
   ```

2. Check the storage directory exists:
   ```bash
   ls -la ~/.ai_memory/
   ```

3. Check Claude Code logs for errors.

### Search not finding results

1. Verify conversations are being saved:
   ```bash
   cat ~/.ai_memory/daily/$(date +%Y-%m-%d).md
   ```

2. Try more specific search terms.

3. Check if the time range is correct.

## Advanced Configuration

### Custom Storage Path

Set a custom storage path via environment variable:

```json
{
  "mcpServers": {
    "universal-memory": {
      "command": "npx",
      "args": ["-y", "universal-memory-mcp"],
      "env": {
        "MEMORY_PATH": "/custom/path/to/memory"
      }
    }
  }
}
```

### Disable for Specific Sessions

If you want a "private" session without recording:

```bash
$ claude --no-mcp "sensitive conversation here"
```

(Note: This flag may vary depending on Claude Code version)
