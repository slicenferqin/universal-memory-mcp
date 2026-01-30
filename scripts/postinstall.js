#!/usr/bin/env node

/**
 * Postinstall script for universal-memory-mcp
 *
 * Automatically configures Claude Code settings:
 * 1. Adds universal-memory MCP server
 * 2. Installs memory-assistant skill
 * 3. Adds Stop hook to remind about saving conversations
 */

import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Paths
const HOME_DIR = os.homedir()
const CLAUDE_DIR = path.join(HOME_DIR, '.claude')
const CLAUDE_JSON_FILE = path.join(HOME_DIR, '.claude.json')
const SETTINGS_FILE = path.join(CLAUDE_DIR, 'settings.json')
const SKILLS_DIR = path.join(CLAUDE_DIR, 'skills')

// OpenCode paths
const OPENCODE_CONFIG_DIR = path.join(HOME_DIR, '.config', 'opencode')
const OPENCODE_CONFIG_FILE = path.join(OPENCODE_CONFIG_DIR, 'opencode.json')

// Skill file name
const MEMORY_ASSISTANT_SKILL = 'memory-assistant.md'

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
    return true
  }
  return false
}

function readSettings(filePath) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8')
    try {
      return JSON.parse(content)
    } catch (e) {
      log(`⚠️  Warning: Could not parse ${path.basename(filePath)}, creating new one`, 'yellow')
      return {}
    }
  }
  return {}
}

function writeSettings(filePath, settings) {
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8')
}

function installSkill() {
  ensureDir(SKILLS_DIR)
  const skillPath = path.join(SKILLS_DIR, MEMORY_ASSISTANT_SKILL)

  // Only install if not exists or outdated
  const templateSkillPath = path.join(__dirname, '..', 'templates', MEMORY_ASSISTANT_SKILL)

  if (fs.existsSync(templateSkillPath)) {
    fs.copyFileSync(templateSkillPath, skillPath)
    log(`✅ Skill installed: ${MEMORY_ASSISTANT_SKILL}`, 'green')
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
`
    fs.writeFileSync(skillPath, skillContent)
    log(`✅ Skill created: ${MEMORY_ASSISTANT_SKILL}`, 'green')
  }
}

function configureMcpServer() {
  let settings = readSettings(CLAUDE_JSON_FILE)

  if (!settings.mcpServers) {
    settings.mcpServers = {}
  }

  if (!settings.mcpServers['universal-memory']) {
    settings.mcpServers['universal-memory'] = {
      command: 'npx',
      args: ['-y', 'universal-memory-mcp'],
    }
    log(`✅ MCP server configured: universal-memory`, 'green')
  } else {
    log(`ℹ️  MCP server already configured: universal-memory`, 'blue')
  }

  writeSettings(CLAUDE_JSON_FILE, settings)
}

function configureStopHook() {
  let settings = readSettings(SETTINGS_FILE)

  if (!settings.hooks) {
    settings.hooks = {}
  }

  if (!settings.hooks.Stop) {
    settings.hooks.Stop = []
  }

  const stopHooks = settings.hooks.Stop

  // Check if prompt hook already exists
  const hasMemoryPromptHook = stopHooks.some(
    (group) =>
      group.hooks &&
      group.hooks.some(
        (hook) => hook.type === 'prompt' && hook.prompt && hook.prompt.includes('memory_record')
      )
  )

  if (!hasMemoryPromptHook) {
    const newHookGroup = {
      hooks: [
        {
          type: 'prompt',
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
    }

    // Add to Stop hooks (at the beginning)
    settings.hooks.Stop.unshift(newHookGroup)
    log(`✅ Stop hook configured: memory reminder`, 'green')
  } else {
    log(`ℹ️  Stop hook already configured`, 'blue')
  }

  writeSettings(SETTINGS_FILE, settings)
}

function checkOpenCodeInstalled() {
  // Check multiple methods to detect OpenCode installation
  try {
    const { spawnSync } = require('child_process')

    // Method 1: Check if opencode command exists
    const whichResult = spawnSync('which', ['opencode'], { stdio: 'pipe' })
    if (whichResult.status === 0) {
      return true
    }

    // Method 2: Check if OpenCode config directory exists
    if (fs.existsSync(OPENCODE_CONFIG_DIR)) {
      return true
    }

    return false
  } catch (e) {
    // Fallback: just check config directory
    return fs.existsSync(OPENCODE_CONFIG_DIR)
  }
}

function configureOpenCodeMcp() {
  if (!fs.existsSync(OPENCODE_CONFIG_FILE)) {
    log(`ℹ️  OpenCode not configured, skipping`, 'blue')
    return
  }

  let config = readSettings(OPENCODE_CONFIG_FILE)

  if (!config.mcp) {
    config.mcp = {}
  }

  if (!config.mcp['universal-memory']) {
    config.mcp['universal-memory'] = {
      type: 'local',
      enabled: true,
      command: ['npx', '-y', 'universal-memory-mcp'],
    }
    log(`✅ OpenCode MCP server configured: universal-memory`, 'green')
  } else {
    log(`ℹ️  OpenCode MCP server already configured: universal-memory`, 'blue')
  }

  writeSettings(OPENCODE_CONFIG_FILE, config)
}

function configureOpenCodePlugin() {
  if (!fs.existsSync(OPENCODE_CONFIG_FILE)) {
    return
  }

  let config = readSettings(OPENCODE_CONFIG_FILE)

  if (!config.plugin) {
    config.plugin = []
  }

  // Check if plugin is already configured
  const hasPlugin = config.plugin.some(
    (p) => p === './universal-memory.mjs' || p.includes('universal-memory')
  )

  if (!hasPlugin) {
    // Copy plugin file to config directory
    const pluginSource = path.join(__dirname, '..', '.opencode', 'plugins', 'universal-memory.mjs')
    const pluginDest = path.join(OPENCODE_CONFIG_DIR, 'universal-memory.mjs')

    if (fs.existsSync(pluginSource)) {
      fs.copyFileSync(pluginSource, pluginDest)
      config.plugin.push('./universal-memory.mjs')
      log(`✅ OpenCode plugin configured: universal-memory`, 'green')
    } else {
      log(`⚠️  Plugin source file not found: ${pluginSource}`, 'yellow')
    }
  } else {
    log(`ℹ️  OpenCode plugin already configured`, 'blue')
  }

  writeSettings(OPENCODE_CONFIG_FILE, config)
}

function configureOpenCode() {
  if (!checkOpenCodeInstalled()) {
    log(`ℹ️  OpenCode not detected, skipping OpenCode configuration`, 'blue')
    return
  }

  log('\n🔧 Configuring OpenCode...', 'blue')

  // Ensure OpenCode config directory exists
  ensureDir(OPENCODE_CONFIG_DIR)

  // Configure MCP server
  configureOpenCodeMcp()

  // Configure plugin
  configureOpenCodePlugin()

  log(`📁 OpenCode config: ${OPENCODE_CONFIG_FILE}`, 'blue')
}

function main() {
  log('\n🚀 Setting up universal-memory-mcp...', 'blue')

  // Ensure .claude directory exists
  ensureDir(CLAUDE_DIR)

  // Configure MCP server (in ~/.claude.json)
  configureMcpServer()

  // Configure Stop hook (in ~/.claude/settings.json)
  configureStopHook()

  // Install skill (in ~/.claude/skills/)
  installSkill()

  log('\n✨ Claude Code setup complete!', 'green')
  log(`📁 Claude config: ${CLAUDE_JSON_FILE}`, 'blue')
  log(`📁 Settings file: ${SETTINGS_FILE}`, 'blue')
  log(`📁 Skills directory: ${SKILLS_DIR}`, 'blue')
  log('\n💡 Tip: The Stop hook will remind you to save conversations to memory.\n', 'blue')

  // Configure OpenCode if installed
  configureOpenCode()

  if (checkOpenCodeInstalled()) {
    log('\n✨ OpenCode setup complete! Restart OpenCode to activate changes.', 'green')
  }
}

main()
