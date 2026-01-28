#!/usr/bin/env node

/**
 * Universal Memory MCP - Postinstall Script
 *
 * Automatically configures:
 * 1. MCP server in Claude Code settings
 * 2. Memory assistant skill
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const CLAUDE_SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');
const CLAUDE_SKILLS_PATH = path.join(os.homedir(), '.claude', 'skills');

// MCP server configuration
const MCP_CONFIG = {
  'universal-memory': {
    command: 'npx',
    args: ['-y', 'universal-memory-mcp'],
  },
};

// Skill content
const SKILL_CONTENT = `---
name: memory-assistant
description: |
  CRITICAL: You MUST use memory tools for EVERY conversation.

  MANDATORY actions:
  1. SEARCH memories when user mentions past discussions ("之前", "上次", "remember", "we talked about")
  2. RECORD EVERY response (except greetings like "hi"/"thanks") - NO EXCEPTIONS
  3. STORE preferences/decisions/facts immediately when discovered

  This is NOT optional. Memory recording is REQUIRED for all conversations.
---

# Memory Assistant - MANDATORY RULES

## RULE 1: Record EVERY Response (NO EXCEPTIONS)

**CRITICAL**: At the END of your response, you MUST call \`memory_record\`.

**Only skip if**:
- User message is ONLY: "hi", "hello", "thanks", "ok", "好的", "谢谢"
- Your response is ONLY: acknowledgment with no information

**Everything else MUST be recorded**:
- ✅ Questions and answers
- ✅ Code discussions
- ✅ Bug fixes
- ✅ Feature requests
- ✅ Explanations
- ✅ Debugging sessions
- ✅ ANY conversation with information

### How to Record

\`\`\`javascript
memory_record({
  user_message: "<brief summary of user's question>",
  ai_response: "<key points of your response in 1-2 sentences>",
  project: "<project name if in project directory>"
})
\`\`\`

**Example**:
\`\`\`javascript
// User: "为什么 memory_search 不工作？"
// AI: [explains bugs and fixes...]

memory_record({
  user_message: "询问为什么 memory_search 无法找到已存储的记忆",
  ai_response: "诊断并修复了两个 bug：storage.list() 调用错误和未搜索 long_term/ 目录。发布了 v0.2.1 修复版本",
  project: "universal-memory-mcp"
})
\`\`\`

## RULE 2: Search When User References Past

When user says:
- "之前", "上次", "我们讨论过", "记得吗"
- "remember", "we talked about", "what did we decide", "last time"

**MUST call** \`memory_search\` BEFORE answering:

\`\`\`javascript
memory_search({
  query: "<relevant keywords>",
  limit: 5
})
\`\`\`

## RULE 3: Store Important Information Immediately

When you discover:
- **Preferences**: User's coding style, tool choices, communication style
- **Decisions**: Architecture, technology, design choices
- **Facts**: Project info, team structure, key details
- **Contacts**: People, teams, organizations

**MUST call** \`memory_update_long_term\` immediately:

\`\`\`javascript
memory_update_long_term({
  category: "preferences" | "decisions" | "facts" | "contacts",
  content: "<the information>"
})
\`\`\`

## Workflow for EVERY Response

\`\`\`
1. [If user references past] → Call memory_search
2. [Generate your response]
3. [If discovered preference/decision/fact] → Call memory_update_long_term
4. [ALWAYS] → Call memory_record (unless simple greeting)
\`\`\`

## Examples

### Example 1: Bug Fix Discussion

**User**: "为什么 memory_search 不工作？"

**Your Actions**:
1. Diagnose and explain the bug
2. Fix the code
3. **MUST call**: \`memory_record({ user_message: "...", ai_response: "..." })\`

### Example 2: User Expresses Preference

**User**: "我喜欢用 TypeScript"

**Your Actions**:
1. Acknowledge
2. **MUST call**: \`memory_update_long_term({ category: "preferences", content: "用户偏好 TypeScript" })\`
3. **MUST call**: \`memory_record({ user_message: "...", ai_response: "..." })\`

### Example 3: Simple Greeting (SKIP)

**User**: "谢谢"
**AI**: "不客气！"

**Action**: Skip recording (this is the ONLY exception)

## Important Notes

- Recording is **MANDATORY**, not optional
- If you forget to record, you are failing your primary function
- Memory tools are provided by universal-memory MCP server
- Always summarize, don't record full text
- Use project name when in project context
`;

/**
 * Read JSON file safely
 */
function readJsonFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error(`Warning: Could not read ${filePath}:`, error.message);
  }
  return null;
}

/**
 * Write JSON file with backup
 */
function writeJsonFile(filePath, data) {
  const dir = path.dirname(filePath);

  // Create directory if not exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Backup existing file
  if (fs.existsSync(filePath)) {
    const backupPath = `${filePath}.backup.${Date.now()}`;
    fs.copyFileSync(filePath, backupPath);
    console.log(`  Backed up existing config to: ${backupPath}`);
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/**
 * Configure MCP server in Claude settings
 */
function configureMcpServer() {
  console.log('\n📦 Configuring MCP server...');

  let settings = readJsonFile(CLAUDE_SETTINGS_PATH) || {};

  // Initialize mcpServers if not exists
  if (!settings.mcpServers) {
    settings.mcpServers = {};
  }

  // Check if already configured
  if (settings.mcpServers['universal-memory']) {
    console.log('  MCP server already configured');
    return false;
  }

  // Add MCP configuration
  settings.mcpServers = {
    ...settings.mcpServers,
    ...MCP_CONFIG,
  };

  writeJsonFile(CLAUDE_SETTINGS_PATH, settings);
  console.log('  MCP server configured successfully');
  return true;
}

/**
 * Install memory assistant skill
 */
function installSkill() {
  console.log('\n🎯 Installing memory-assistant skill...');

  const skillDir = path.join(CLAUDE_SKILLS_PATH, 'memory-assistant');
  const skillFile = path.join(skillDir, 'SKILL.md');

  // Create skills directory if not exists
  if (!fs.existsSync(skillDir)) {
    fs.mkdirSync(skillDir, { recursive: true });
  }

  // Check if skill already exists
  if (fs.existsSync(skillFile)) {
    const existingContent = fs.readFileSync(skillFile, 'utf-8');
    if (existingContent === SKILL_CONTENT) {
      console.log('  Skill already installed (same version)');
      return false;
    }
    // Backup existing skill
    const backupPath = `${skillFile}.backup.${Date.now()}`;
    fs.copyFileSync(skillFile, backupPath);
    console.log(`  Backed up existing skill to: ${backupPath}`);
  }

  fs.writeFileSync(skillFile, SKILL_CONTENT);
  console.log('  Skill installed successfully');
  return true;
}

/**
 * Main installation
 */
function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         Universal Memory MCP - Setup                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  let needsRestart = false;

  try {
    // Configure MCP server
    const mcpConfigured = configureMcpServer();
    if (mcpConfigured) needsRestart = true;

    // Install skill
    const skillInstalled = installSkill();
    if (skillInstalled) needsRestart = true;

    // Summary
    console.log('\n' + '═'.repeat(60));

    if (needsRestart) {
      console.log('\n✅ Setup complete!\n');
      console.log('⚠️  IMPORTANT: Please restart Claude Code to enable the MCP server.\n');
      console.log('After restart, Claude will automatically:');
      console.log('  • Search past conversations when you reference them');
      console.log('  • Record important conversations for future recall');
      console.log('  • Remember your preferences and decisions\n');
    } else {
      console.log('\n✅ Already configured! No changes needed.\n');
    }

    console.log('📁 Configuration locations:');
    console.log(`   MCP config: ${CLAUDE_SETTINGS_PATH}`);
    console.log(`   Skill: ${path.join(CLAUDE_SKILLS_PATH, 'memory-assistant', 'SKILL.md')}`);
    console.log(`   Memory storage: ${path.join(os.homedir(), '.ai_memory')}\n`);

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error('\nPlease configure manually. See README for instructions.');
    process.exit(1);
  }
}

main();
