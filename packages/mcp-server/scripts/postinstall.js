#!/usr/bin/env node

/**
 * Universal Memory MCP - Postinstall Script
 *
 * Automatically configures:
 * 1. MCP server in Claude Code settings
 * 2. Memory assistant skill
 */

import fs from 'fs'
import path from 'path'
import os from 'os'
import { execSync } from 'node:child_process'
import { buildNodeCommand, resolveBundledScriptPath } from './postinstall-helpers.js'

const CLAUDE_DIR = path.join(os.homedir(), '.claude')
const CLAUDE_SETTINGS_PATH = path.join(CLAUDE_DIR, 'settings.json')
const CLAUDE_SKILLS_PATH = path.join(CLAUDE_DIR, 'skills')
const CLAUDE_HOOKS_PATH = path.join(CLAUDE_DIR, 'hooks')

// MCP server configuration
const MCP_CONFIG = {
  'universal-memory': {
    command: 'npx',
    args: ['-y', 'universal-memory-mcp'],
  },
}

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
`

/**
 * Check if Claude Code is installed
 */
function checkClaudeCodeInstalled() {
  if (!fs.existsSync(CLAUDE_DIR)) {
    console.log('\n⚠️  Claude Code not detected!\n')
    console.log('Please install Claude Code first:')
    console.log('  https://code.claude.com/\n')
    console.log('After installing Claude Code, run:')
    console.log('  npm install -g universal-memory-mcp\n')
    return false
  }
  return true
}

/**
 * Read JSON file safely
 */
function readJsonFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8')
      return JSON.parse(content)
    }
  } catch (error) {
    console.error(`Warning: Could not read ${filePath}:`, error.message)
  }
  return null
}

/**
 * Write JSON file with backup
 */
function writeJsonFile(filePath, data) {
  const dir = path.dirname(filePath)

  // Create directory if not exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  // Backup existing file
  if (fs.existsSync(filePath)) {
    const backupPath = `${filePath}.backup.${Date.now()}`
    fs.copyFileSync(filePath, backupPath)
    console.log(`  Backed up existing config to: ${backupPath}`)
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

/**
 * Configure MCP server in Claude settings
 */
function configureMcpServer() {
  console.log('\n📦 Configuring MCP server...')

  let settings = readJsonFile(CLAUDE_SETTINGS_PATH) || {}

  // Initialize mcpServers if not exists
  if (!settings.mcpServers) {
    settings.mcpServers = {}
  }

  // Check if already configured
  if (settings.mcpServers['universal-memory']) {
    console.log('  MCP server already configured')
    return false
  }

  // Add MCP configuration
  settings.mcpServers = {
    ...settings.mcpServers,
    ...MCP_CONFIG,
  }

  writeJsonFile(CLAUDE_SETTINGS_PATH, settings)
  console.log('  MCP server configured successfully')
  return true
}

/**
 * Install memory assistant skill
 */
function installSkill() {
  console.log('\n🎯 Installing memory-assistant skill...')

  const skillDir = path.join(CLAUDE_SKILLS_PATH, 'memory-assistant')
  const skillFile = path.join(skillDir, 'SKILL.md')

  // Create skills directory if not exists
  if (!fs.existsSync(skillDir)) {
    fs.mkdirSync(skillDir, { recursive: true })
  }

  // Check if skill already exists
  if (fs.existsSync(skillFile)) {
    const existingContent = fs.readFileSync(skillFile, 'utf-8')
    if (existingContent === SKILL_CONTENT) {
      console.log('  Skill already installed (same version)')
      return false
    }
    // Backup existing skill
    const backupPath = `${skillFile}.backup.${Date.now()}`
    fs.copyFileSync(skillFile, backupPath)
    console.log(`  Backed up existing skill to: ${backupPath}`)
  }

  fs.writeFileSync(skillFile, SKILL_CONTENT)
  console.log('  Skill installed successfully')
  return true
}

/**
 * Install Stop hook script
 */
function installStopHook() {
  console.log('\n🪝 Installing Stop hook...')

  const hookScriptPath = path.join(CLAUDE_HOOKS_PATH, 'universal-memory-stop-hook.mjs')

  // Create hooks directory if not exists
  if (!fs.existsSync(CLAUDE_HOOKS_PATH)) {
    fs.mkdirSync(CLAUDE_HOOKS_PATH, { recursive: true })
    console.log('  Created hooks directory')
  }

  // Get source script path (in the same directory as this postinstall script)
  const sourceScript = resolveBundledScriptPath('universal-memory-stop-hook.mjs')

  // Check if hook already exists
  if (fs.existsSync(hookScriptPath)) {
    const existingContent = fs.readFileSync(hookScriptPath, 'utf-8')
    const newContent = fs.readFileSync(sourceScript, 'utf-8')

    if (existingContent === newContent) {
      console.log('  Stop hook already installed (same version)')
      return false
    }

    // Backup existing hook
    const backupPath = `${hookScriptPath}.backup.${Date.now()}`
    fs.copyFileSync(hookScriptPath, backupPath)
    console.log(`  Backed up existing hook to: ${backupPath}`)
  }

  fs.copyFileSync(sourceScript, hookScriptPath)
  fs.chmodSync(hookScriptPath, 0o755) // Make executable
  console.log('  Stop hook installed successfully')
  return true
}

/**
 * Install SessionStart hook script
 */
function installStartHook() {
  console.log('\n🚀 Installing SessionStart hook...')

  const hookScriptPath = path.join(CLAUDE_HOOKS_PATH, 'universal-memory-start-hook.mjs')

  // Create hooks directory if not exists
  if (!fs.existsSync(CLAUDE_HOOKS_PATH)) {
    fs.mkdirSync(CLAUDE_HOOKS_PATH, { recursive: true })
    console.log('  Created hooks directory')
  }

  // Get source script path (in the same directory as this postinstall script)
  const sourceScript = resolveBundledScriptPath('universal-memory-start-hook.mjs')

  // Check if source exists
  if (!fs.existsSync(sourceScript)) {
    console.log('  Start hook source not found, skipping')
    return false
  }

  // Check if hook already exists
  if (fs.existsSync(hookScriptPath)) {
    const existingContent = fs.readFileSync(hookScriptPath, 'utf-8')
    const newContent = fs.readFileSync(sourceScript, 'utf-8')

    if (existingContent === newContent) {
      console.log('  Start hook already installed (same version)')
      return false
    }

    // Backup existing hook
    const backupPath = `${hookScriptPath}.backup.${Date.now()}`
    fs.copyFileSync(hookScriptPath, backupPath)
    console.log(`  Backed up existing hook to: ${backupPath}`)
  }

  fs.copyFileSync(sourceScript, hookScriptPath)
  fs.chmodSync(hookScriptPath, 0o755) // Make executable
  console.log('  Start hook installed successfully')
  return true
}

/**
 * Configure Stop hook in Claude settings
 */
function configureStopHook() {
  console.log('\n⚙️  Configuring Stop hook...')

  let settings = readJsonFile(CLAUDE_SETTINGS_PATH) || {}

  // Initialize hooks if not exists
  if (!settings.hooks) {
    settings.hooks = {}
  }

  // Initialize Stop hook array if not exists
  if (!settings.hooks.Stop) {
    settings.hooks.Stop = []
  }

  // Check if our hook is already configured
  const hookScriptPath = path.join(
    os.homedir(),
    '.claude',
    'hooks',
    'universal-memory-stop-hook.mjs'
  )
  const hookCommand = buildNodeCommand(hookScriptPath)
  const alreadyConfigured = settings.hooks.Stop.some((entry) =>
    entry.hooks?.some(
      (hook) => hook.type === 'command' && hook.command.includes('universal-memory-stop-hook')
    )
  )

  if (alreadyConfigured) {
    console.log('  Stop hook already configured')
    return false
  }

  // Add Stop hook configuration
  settings.hooks.Stop.push({
    hooks: [
      {
        type: 'command',
        command: hookCommand,
      },
    ],
  })

  writeJsonFile(CLAUDE_SETTINGS_PATH, settings)
  console.log('  Stop hook configured successfully')
  return true
}

/**
 * Install cron job for daily memory consolidation
 */
function installCronJob() {
  console.log('\n⏰ Installing daily memory consolidation cron job...')

  try {
    // Run universal-memory-cron install
    const result = execSync('universal-memory-cron install', {
      encoding: 'utf8',
      stdio: 'pipe',
    })

    console.log('  Cron job installed successfully')
    console.log(`  Output: ${result.trim()}`)
    return true
  } catch (error) {
    // Try with npx
    try {
      const result = execSync('npx -y universal-memory-mcp universal-memory-cron install', {
        encoding: 'utf8',
        stdio: 'pipe',
      })

      console.log('  Cron job installed successfully (via npx)')
      console.log(`  Output: ${result.trim()}`)
      return true
    } catch (npxError) {
      console.log('  ⚠️  Cron job installation failed (this is optional)')
      console.log(`     Error: ${npxError.message}`)
      console.log('     You can manually install later: universal-memory-cron install')
      return false
    }
  }
}

/**
 * Configure SessionStart hook in Claude settings
 */
function configureStartHook() {
  console.log('\n⚙️  Configuring SessionStart hook...')

  let settings = readJsonFile(CLAUDE_SETTINGS_PATH) || {}

  // Initialize hooks if not exists
  if (!settings.hooks) {
    settings.hooks = {}
  }

  // Initialize SessionStart hook array if not exists
  if (!settings.hooks.SessionStart) {
    settings.hooks.SessionStart = []
  }

  // Check if our hook is already configured
  const hookScriptPath = path.join(
    os.homedir(),
    '.claude',
    'hooks',
    'universal-memory-start-hook.mjs'
  )
  const hookCommand = buildNodeCommand(hookScriptPath)
  const alreadyConfigured = settings.hooks.SessionStart.some((entry) =>
    entry.hooks?.some(
      (hook) => hook.type === 'command' && hook.command.includes('universal-memory-start-hook')
    )
  )

  if (alreadyConfigured) {
    console.log('  SessionStart hook already configured')
    return false
  }

  // Add SessionStart hook configuration
  settings.hooks.SessionStart.push({
    hooks: [
      {
        type: 'command',
        command: hookCommand,
      },
    ],
  })

  writeJsonFile(CLAUDE_SETTINGS_PATH, settings)
  console.log('  SessionStart hook configured successfully')
  return true
}

/**
 * Main installation
 */
function main() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║         Universal Memory MCP - Setup                       ║')
  console.log('╚════════════════════════════════════════════════════════════╝')

  // Check Claude Code installation
  if (!checkClaudeCodeInstalled()) {
    process.exit(0)
  }

  let needsRestart = false

  try {
    // 1. Configure MCP server
    const mcpConfigured = configureMcpServer()
    if (mcpConfigured) needsRestart = true

    // 2. Install skill
    const skillInstalled = installSkill()
    if (skillInstalled) needsRestart = true

    // 3. Install Stop hook script
    const stopHookInstalled = installStopHook()
    if (stopHookInstalled) needsRestart = true

    // 4. Configure Stop hook
    const stopHookConfigured = configureStopHook()
    if (stopHookConfigured) needsRestart = true

    // 5. Install SessionStart hook script
    const startHookInstalled = installStartHook()
    if (startHookInstalled) needsRestart = true

    // 6. Configure SessionStart hook
    const startHookConfigured = configureStartHook()
    if (startHookConfigured) needsRestart = true

    // 7. Install cron job
    const cronInstalled = installCronJob()
    if (cronInstalled) needsRestart = true

    // Summary
    console.log('\n' + '═'.repeat(60))

    if (needsRestart) {
      console.log('\n✅ Setup complete!\n')
      console.log('⚠️  IMPORTANT: Please restart Claude Code to enable all features.\n')
      console.log('After restart, Claude will automatically:')
      console.log('  • Recall your profile at session start (via SessionStart hook)')
      console.log('  • Search past conversations when you reference them')
      console.log('  • Record EVERY conversation automatically (via Stop hook)')
      console.log('  • Remember your preferences and decisions\n')
    } else {
      console.log('\n✅ Already configured! No changes needed.\n')
    }

    console.log('📁 Configuration locations:')
    console.log(`   MCP config: ${CLAUDE_SETTINGS_PATH}`)
    console.log(`   Skill: ${path.join(CLAUDE_SKILLS_PATH, 'memory-assistant', 'SKILL.md')}`)
    console.log(`   Stop hook: ${path.join(CLAUDE_HOOKS_PATH, 'universal-memory-stop-hook.mjs')}`)
    console.log(`   Start hook: ${path.join(CLAUDE_HOOKS_PATH, 'universal-memory-start-hook.mjs')}`)
    console.log(`   Memory storage: ${path.join(os.homedir(), '.ai_memory')}\n`)

    console.log('⏰ Cron job: Daily memory consolidation at 2:00 AM')
    console.log('   # Check cron job:')
    console.log('   crontab -l | grep universal-memory\n')
    console.log('   # Manual consolidation:')
    console.log('   universal-memory-consolidate --days 7\n')
    console.log('   # Full consolidation (with re-consolidation):')
    console.log('   universal-memory-consolidate --days 7 --consolidate-summary\n')
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message)
    console.error('\nPlease configure manually. See README for instructions.')
    process.exit(1)
  }
}

main()
