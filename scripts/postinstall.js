#!/usr/bin/env node

/**
 * Postinstall script for universal-memory-mcp
 *
 * Automatically configures Claude Code settings:
 * 1. Adds universal-memory MCP server
 * 2. Installs memory-assistant skill
 * 3. Adds Stop hook to remind about saving conversations
 */

import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const HOME_DIR = os.homedir();
const CLAUDE_DIR = path.join(HOME_DIR, ".claude");
const CLAUDE_JSON_FILE = path.join(HOME_DIR, ".claude.json");
const SETTINGS_FILE = path.join(CLAUDE_DIR, "settings.json");
const SKILLS_DIR = path.join(CLAUDE_DIR, "skills");

// Skill file name
const MEMORY_ASSISTANT_SKILL = "memory-assistant.md";

// ANSI color codes for better output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    return true;
  }
  return false;
}

function readSettings(filePath) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, "utf-8");
    try {
      return JSON.parse(content);
    } catch (e) {
      log(
        `⚠️  Warning: Could not parse ${path.basename(filePath)}, creating new one`,
        "yellow",
      );
      return {};
    }
  }
  return {};
}

function writeSettings(filePath, settings) {
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), "utf-8");
}

function installSkill() {
  ensureDir(SKILLS_DIR);
  const skillPath = path.join(SKILLS_DIR, MEMORY_ASSISTANT_SKILL);

  // Only install if not exists or outdated
  const templateSkillPath = path.join(
    __dirname,
    "..",
    "templates",
    MEMORY_ASSISTANT_SKILL,
  );

  if (fs.existsSync(templateSkillPath)) {
    fs.copyFileSync(templateSkillPath, skillPath);
    log(`✅ Skill installed: ${MEMORY_ASSISTANT_SKILL}`, "green");
  } else {
    // Fallback: create skill directly
    const skillContent = `# Memory Assistant Skill

CRITICAL: You MUST use memory tools for EVERY conversation.

## MANDATORY Actions

1. **SEARCH memories first** - Before answering, search for relevant past conversations using \`memory_search\`
2. **RECORD EVERY response** - After helping user (except simple greetings like "hi"/"thanks"), call \`memory_record\` with:
   - \`user_message\`: Brief summary of user's question
   - \`ai_response\**: Key points of your response
   - \`project\`: Current project name (from working directory)

3. **STORE important decisions** - Use \`memory_update_long_term\` for:
   - Architectural decisions
   - Important configuration changes
   - Key insights or lessons learned
   - Parameters: \`category\` (decisions/architecture/best_practices), \`content\`

## When to Use Memory

ALWAYS use memory when:
- User asks something that relates to previous work
- You provide code explanations or solutions
- User asks about project status or decisions
- You make recommendations or suggestions

NEVER skip memory recording when conversation has substance.

## Examples

\`\`\`javascript
// After helping user with a bug fix
await callTool('memory_record', {
  user_message: 'Fix failing test in authentication module',
  ai_response: '1) Found issue with JWT token validation; 2) Added missing null check; 3) Test now passes',
  project: 'auth-service'
});
\`\`\`

This is NOT optional. Memory recording is REQUIRED for all meaningful conversations.
`;
    fs.writeFileSync(skillPath, skillContent);
    log(`✅ Skill created: ${MEMORY_ASSISTANT_SKILL}`, "green");
  }
}

function configureMcpServer() {
  let settings = readSettings(CLAUDE_JSON_FILE);

  if (!settings.mcpServers) {
    settings.mcpServers = {};
  }

  if (!settings.mcpServers["universal-memory"]) {
    settings.mcpServers["universal-memory"] = {
      command: "npx",
      args: ["-y", "universal-memory-mcp"],
    };
    log(`✅ MCP server configured: universal-memory`, "green");
  } else {
    log(`ℹ️  MCP server already configured: universal-memory`, "blue");
  }

  writeSettings(CLAUDE_JSON_FILE, settings);
}

function configureStopHook() {
  let settings = readSettings(SETTINGS_FILE);

  if (!settings.hooks) {
    settings.hooks = {};
  }

  if (!settings.hooks.Stop) {
    settings.hooks.Stop = [];
  }

  const stopHooks = settings.hooks.Stop;

  // Check if prompt hook already exists
  const hasMemoryPromptHook = stopHooks.some(
    (group) =>
      group.hooks &&
      group.hooks.some(
        (hook) =>
          hook.type === "prompt" &&
          hook.prompt &&
          hook.prompt.includes("memory_record"),
      ),
  );

  if (!hasMemoryPromptHook) {
    const newHookGroup = {
      hooks: [
        {
          type: "prompt",
          prompt: `You are checking if the conversation should be recorded to memory. Analyze the input below.

Input: $ARGUMENTS

Rules:
1. If the conversation is just a simple greeting (hi/thanks/ok), respond: {"ok": true}
2. Check if mcp__universal-memory__memory_record was called in this session
3. If it was a meaningful conversation but memory_record was NOT called, respond: {"ok": false, "reason": "IMPORTANT: You must call memory_record to save this conversation before stopping. Use memory_record with user_message (brief summary of user's question) and ai_response (key points of your response)."}
4. Otherwise respond: {"ok": true}`,
          timeout: 30,
        },
      ],
    };

    // Add to Stop hooks (at the beginning)
    settings.hooks.Stop.unshift(newHookGroup);
    log(`✅ Stop hook configured: memory reminder`, "green");
  } else {
    log(`ℹ️  Stop hook already configured`, "blue");
  }

  writeSettings(SETTINGS_FILE, settings);
}

function main() {
  log("\n🚀 Setting up universal-memory-mcp...", "blue");

  // Ensure .claude directory exists
  ensureDir(CLAUDE_DIR);

  // Configure MCP server (in ~/.claude.json)
  configureMcpServer();

  // Configure Stop hook (in ~/.claude/settings.json)
  configureStopHook();

  // Install skill (in ~/.claude/skills/)
  installSkill();

  log("\n✨ Setup complete! Restart Claude Code to activate changes.", "green");
  log(`\n📁 Claude config: ${CLAUDE_JSON_FILE}`, "blue");
  log(`📁 Settings file: ${SETTINGS_FILE}`, "blue");
  log(`📁 Skills directory: ${SKILLS_DIR}`, "blue");
  log(
    "\n💡 Tip: The Stop hook will remind you to save conversations to memory.\n",
    "blue",
  );
}

main();
