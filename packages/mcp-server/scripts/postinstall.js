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
  Automatic conversation memory management using universal-memory MCP.

  ALWAYS activate this skill to:
  1. SEARCH memories when user mentions: "之前", "上次", "我们讨论过", "remember", "we talked about", "what did we decide"
  2. RECORD conversations at the END of EVERY meaningful response
  3. STORE long-term info when discovering: user preferences, important decisions, key facts

  This skill ensures AI maintains persistent memory across all sessions.
---

# Memory Assistant

You have access to persistent memory through the universal-memory MCP tools. Use them proactively.

## Core Rules

### 1. Always Search Before Answering (When Relevant)

When user references past conversations or asks about previous decisions:

\`\`\`
Call memory_search with relevant keywords
\`\`\`

Trigger phrases:
- "之前", "上次", "我们讨论过", "记得吗"
- "remember", "we talked about", "what did we decide", "last time"
- Any reference to past discussions or decisions

### 2. Always Record After Responding

At the END of EVERY meaningful conversation exchange, call:

\`\`\`
memory_record({
  user_message: "<summarize user's question/request>",
  ai_response: "<key points of your response>",
  project: "<current project name if applicable>"
})
\`\`\`

What counts as "meaningful":
- Technical discussions or decisions
- Problem-solving conversations
- User preferences expressed
- Any information worth remembering

What to skip:
- Simple greetings ("hi", "thanks")
- Trivial clarifications

### 3. Store Important Long-term Information

When you identify important information, immediately call:

\`\`\`
memory_update_long_term({
  category: "preferences" | "decisions" | "facts" | "contacts",
  content: "<the information>"
})
\`\`\`

Categories:
- **preferences**: User's coding style, tool preferences, communication style
- **decisions**: Architecture choices, technology selections, design decisions
- **facts**: Key information about user, projects, team structure
- **contacts**: People, teams, organizations mentioned

## Examples

### Example 1: User References Past Discussion

**User**: "我们之前讨论的认证方案是什么来着？"

**Action**:
1. Call \`memory_search({ query: "认证方案 authentication" })\`
2. Use search results to answer
3. Call \`memory_record\` to log this exchange

### Example 2: User Expresses Preference

**User**: "我喜欢用 TypeScript，不要给我 JavaScript 代码"

**Action**:
1. Acknowledge the preference
2. Call \`memory_update_long_term({ category: "preferences", content: "用户偏好 TypeScript，不使用 JavaScript" })\`
3. Call \`memory_record\` to log this exchange

### Example 3: Technical Decision Made

**User**: "好，我们就用 PostgreSQL 作为主数据库"

**Action**:
1. Confirm the decision
2. Call \`memory_update_long_term({ category: "decisions", content: "选择 PostgreSQL 作为主数据库" })\`
3. Call \`memory_record\` to log this exchange

## Important Notes

- Memory tools are provided by the universal-memory MCP server
- If tools are not available, inform user to restart Claude Code
- Always summarize, don't record full conversation text
- Use project name when in a project context for better organization
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
