#!/usr/bin/env node

/**
 * Universal Memory - SessionStart Hook
 *
 * 在会话开始时召回用户画像和项目相关讨论，注入到会话上下文中。
 *
 * 功能：
 * 1. 调用 universal-memory-retrieve 命令
 * 2. 检测当前项目
 * 3. 输出用户画像和项目讨论到 stdout
 */

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

// Enable debug logging via environment variable
const DEBUG = process.env.UNIVERSAL_MEMORY_DEBUG === '1'

function debugLog(message) {
  if (DEBUG) {
    fs.appendFileSync(
      '/tmp/universal-memory-start-hook.log',
      `[${new Date().toISOString()}] ${message}\n`
    )
  }
}

function findRetrieveScript() {
  try {
    const scriptDir = path.dirname(new URL(import.meta.url).pathname)
    const retrievePath = path.join(scriptDir, '..', 'dist', 'retrieve.js')
    if (fs.existsSync(retrievePath)) {
      return retrievePath
    }
  } catch (err) {
    debugLog(`Failed to find retrieve script: ${err.message}`)
  }
  return null
}

function runRetrieveCommand(cwd, projectName) {
  const args = ['--json']

  if (projectName) {
    args.push('--project', projectName)
  }

  debugLog(`Running: universal-memory-retrieve ${args.join(' ')}`)

  // Try direct command first
  const direct = spawnSync('universal-memory-retrieve', args, {
    encoding: 'utf8',
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  if (direct.status === 0) {
    return { ok: true, output: direct.stdout }
  }

  debugLog(`Direct command failed: ${direct.stderr}`)

  // Try npx
  const npx = spawnSync(
    'npx',
    ['-y', '--package', 'universal-memory-mcp', 'universal-memory-retrieve', ...args],
    {
      encoding: 'utf8',
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  )

  if (npx.status === 0) {
    return { ok: true, output: npx.stdout }
  }

  debugLog(`NPX command failed: ${npx.stderr}`)

  // Try local fallback
  const fallbackPath = findRetrieveScript()
  if (fallbackPath) {
    debugLog(`Using local retrieve script: ${fallbackPath}`)
    const fallback = spawnSync('node', [fallbackPath, ...args], {
      encoding: 'utf8',
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    if (fallback.status === 0) {
      return { ok: true, output: fallback.stdout }
    }
    debugLog(`Fallback script failed: ${fallback.stderr}`)
  }

  return {
    ok: false,
    error: direct.stderr || npx.stderr || 'retrieve command not available',
  }
}

function detectProjectName(cwd) {
  try {
    // Try git remote
    const gitRemote = spawnSync('git', ['remote', '-v'], {
      cwd,
      stdio: 'pipe',
      encoding: 'utf8',
    })
    if (gitRemote.status === 0) {
      const output = gitRemote.stdout
      const match = output.match(/[:/]([^/]+\/[^/]+)\.git/)
      if (match) {
        const projectName = match[1].replace('/', '-')
        debugLog(`Detected project from git: ${projectName}`)
        return projectName
      }
    }

    // Try package.json
    const packagePath = path.join(cwd, 'package.json')
    if (fs.existsSync(packagePath)) {
      const content = fs.readFileSync(packagePath, 'utf8')
      const pkg = JSON.parse(content)
      if (pkg.name) {
        debugLog(`Detected project from package.json: ${pkg.name}`)
        return pkg.name
      }
    }
  } catch (err) {
    debugLog(`Failed to detect project: ${err.message}`)
  }

  debugLog('No project detected')
  return undefined
}

function formatOutput(context) {
  const parts = []

  parts.push('<user-memory>')
  parts.push('以下是从长期记忆中召回的用户信息，请在对话中参考：')
  parts.push('')

  // User profile
  if (context.userProfile) {
    parts.push('## 用户画像')
    parts.push(context.userProfile)
    parts.push('')
  }

  // Project recent discussions
  if (context.projectRecent && context.projectRecent.length > 0) {
    parts.push(`## 项目最近讨论 (${context.currentProject || 'Unknown'})`)
    context.projectRecent.forEach((item, index) => {
      parts.push(`${index + 1}. ${item.content}`)
    })
    parts.push('')
  }

  // Global recent discussions
  if (context.globalRecent && context.globalRecent.length > 0) {
    parts.push('## 其他最近讨论')
    context.globalRecent.forEach((item, index) => {
      parts.push(`${index + 1}. ${item.content}`)
    })
    parts.push('')
  }

  // Greeting
  if (context.greeting) {
    parts.push('## 欢迎')
    parts.push(context.greeting)
    parts.push('')
  }

  parts.push('</user-memory>')

  return parts.join('\n')
}

function main() {
  debugLog('Start hook triggered')

  // 读取 stdin（Claude Code 会传入 hook 输入）
  let hookInput = {}
  let cwd = process.cwd()

  try {
    const raw = fs.readFileSync(0, 'utf8')
    if (raw.trim()) {
      hookInput = JSON.parse(raw)
      debugLog(`Hook input: ${JSON.stringify(hookInput).substring(0, 200)}`)
      cwd = hookInput.cwd || cwd
    }
  } catch (err) {
    debugLog(`Failed to parse hook input: ${err.message}`)
  }

  // Detect project name
  const projectName = detectProjectName(cwd)

  // Run retrieve command
  const res = runRetrieveCommand(cwd, projectName)

  if (!res.ok) {
    debugLog(`Retrieve failed: ${res.error}`)
    process.exit(0)
  }

  let context
  try {
    context = JSON.parse(res.output)
  } catch (err) {
    debugLog(`Failed to parse retrieve output: ${err.message}`)
    process.exit(0)
  }

  if (!context || (!context.userProfile && !context.greeting)) {
    debugLog('No memory to recall')
    process.exit(0)
  }

  // Format output
  const output = formatOutput(context)
  debugLog(`Output length: ${output.length} chars`)

  // Output JSON format (for Claude Code hook)
  const result = {
    result: output,
  }

  console.log(JSON.stringify(result))
}

main()
