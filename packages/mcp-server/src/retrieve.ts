#!/usr/bin/env node

/**
 * Universal Memory - Retrieve Command
 *
 * 在会话启动时召回相关记忆。
 *
 * 使用方式：
 *   universal-memory-retrieve [--project <name>] [--profile-limit <n>] [--project-recent-limit <n>] [--global-recent-limit <n>]
 *
 * 示例：
 *   universal-memory-retrieve
 *   universal-memory-retrieve --project universal-memory-mcp
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface RetrieveOptions {
  currentProject?: string
  profileLimit?: number
  projectRecentLimit?: number
  globalRecentLimit?: number
  shouldGenerateGreeting?: boolean
  greetingModel?: 'haiku' | 'sonnet' | 'opus'
}

function parseArgs(): RetrieveOptions & { help?: boolean } {
  const args = process.argv.slice(2)
  const options: RetrieveOptions & { help?: boolean } = {
    profileLimit: 10,
    projectRecentLimit: 5,
    globalRecentLimit: 3,
    shouldGenerateGreeting: true,
    greetingModel: 'haiku',
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    switch (arg) {
      case '--help':
      case '-h':
        options.help = true
        break
      case '--project':
      case '-p':
        options.currentProject = args[++i]
        break
      case '--profile-limit':
        options.profileLimit = parseInt(args[++i], 10)
        break
      case '--project-recent-limit':
        options.projectRecentLimit = parseInt(args[++i], 10)
        break
      case '--global-recent-limit':
        options.globalRecentLimit = parseInt(args[++i], 10)
        break
      case '--no-greeting':
        options.shouldGenerateGreeting = false
        break
      case '--greeting-model':
        options.greetingModel = args[++i] as 'haiku' | 'sonnet' | 'opus'
        break
    }
  }

  return options
}

function printHelp() {
  console.log(`
Universal Memory - Retrieve Command

在会话启动时召回相关记忆。

使用方式：
  universal-memory-retrieve [options]

选项：
  -p, --project <name>              当前项目名称（可选，自动检测）
  --profile-limit <n>               用户画像条目限制（默认：10）
  --project-recent-limit <n>        项目最近讨论限制（默认：5）
  --global-recent-limit <n>         全局最近讨论限制（默认：3）
  --no-greeting                     不生成 greeting
  --greeting-model <model>          Greeting 模型：haiku|sonnet|opus（默认：haiku）
  -h, --help                        显示帮助信息

示例：
  # 自动检测项目
  universal-memory-retrieve

  # 指定项目名称
  universal-memory-retrieve --project universal-memory-mcp

  # 不生成 greeting
  universal-memory-retrieve --no-greeting
`)
}

async function callClaudeAPI(
  prompt: string,
  model: 'haiku' | 'sonnet' | 'opus' = 'haiku'
): Promise<string> {
  const modelMap = {
    haiku: 'claude-3-5-haiku-20241022',
    sonnet: 'claude-3-5-sonnet-20241022',
    opus: 'claude-3-5-sonnet-20241022',
  }

  const modelName = modelMap[model] || modelMap.haiku

  const response = spawnSync(
    'curl',
    [
      'https://api.anthropic.com/v1/messages',
      '-X',
      'POST',
      '-H',
      'Content-Type: application/json',
      '-H',
      'x-api-key: $ANTHROPIC_API_KEY',
      '-H',
      'anthropic-version: 2023-06-01',
      '-d',
      JSON.stringify({
        model: modelName,
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    ],
    {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  )

  if (response.status !== 0) {
    throw new Error(`Claude API call failed: ${response.stderr}`)
  }

  try {
    const result = JSON.parse(response.stdout)
    return result.content?.[0]?.text || ''
  } catch (error) {
    throw new Error(`Failed to parse Claude API response: ${error}`)
  }
}

async function generateGreeting(
  userProfile: string,
  projectRecent: Array<{ content: string; timestamp: Date }>,
  currentProject: string | undefined,
  model: 'haiku' | 'sonnet' | 'opus' = 'haiku'
): Promise<string> {
  const prompt = `你是一个友好的 AI 助手。根据以下用户信息，生成一个简短的欢迎消息（不超过 100 字）。

用户画像：
${userProfile}

${currentProject ? `当前项目：${currentProject}` : ''}

${projectRecent.length > 0 ? `最近讨论：\n${projectRecent.map((item) => `- ${item.content}`).join('\n')}` : ''}

要求：
1. 友好、自然
2. 简洁（不超过 100 字）
3. 如果有最近讨论，可以提及
4. 如果没有最近讨论，可以询问最近进展

请直接输出欢迎消息，不要加任何前言或后言。`

  try {
    return await callClaudeAPI(prompt, model)
  } catch (error) {
    console.error('[UniversalMemory] Failed to generate greeting:', error)
    return '你好！很高兴见到你。'
  }
}

async function retrieveOnSessionStart(
  storagePath: string,
  options: RetrieveOptions = {}
): Promise<{
  userProfile: string
  projectRecent: Array<{ content: string; timestamp: Date; source: string }>
  globalRecent: Array<{ content: string; timestamp: Date; source: string }>
  currentProject?: string
  greeting: string
}> {
  const {
    currentProject,
    profileLimit = 10,
    projectRecentLimit = 5,
    globalRecentLimit = 3,
    shouldGenerateGreeting = true,
    greetingModel = 'haiku',
  } = options

  const result = {
    userProfile: '',
    projectRecent: [] as Array<{ content: string; timestamp: Date; source: string }>,
    globalRecent: [] as Array<{ content: string; timestamp: Date; source: string }>,
    currentProject,
    greeting: '',
  }

  try {
    // 1. 读取用户画像（优先 profile-summary.md）
    const profileSummaryPath = join(storagePath, 'long_term', 'profile-summary.md')
    const profilePath = join(storagePath, 'long_term', 'profile.md')

    try {
      result.userProfile = await readFile(profileSummaryPath, 'utf8')
    } catch {
      try {
        result.userProfile = await readFile(profilePath, 'utf8')
      } catch {
        // No profile found
      }
    }

    // 2. 读取项目最近讨论（facts.md + decisions.md）
    const factsPath = join(storagePath, 'long_term', 'facts.md')
    const decisionsPath = join(storagePath, 'long_term', 'decisions.md')

    const loadFacts = async () => {
      try {
        const content = await readFile(factsPath, 'utf8')
        return content.split('\n\n').filter(Boolean)
      } catch {
        return []
      }
    }

    const loadDecisions = async () => {
      try {
        const content = await readFile(decisionsPath, 'utf8')
        return content.split('\n\n').filter(Boolean)
      } catch {
        return []
      }
    }

    const [facts, decisions] = await Promise.all([loadFacts(), loadDecisions()])

    // 按项目过滤（简单文本匹配）
    const projectFilter = (item: string): boolean => {
      if (!currentProject) return true
      const lowerItem = item.toLowerCase()
      return (
        lowerItem.includes(`项目：${currentProject}`) ||
        lowerItem.includes(`${currentProject} project`) ||
        lowerItem.includes(`${currentProject} 项目`)
      )
    }

    const projectItems = [
      ...facts.filter(projectFilter).map((content) => ({
        content,
        timestamp: new Date(),
        source: 'facts' as const,
      })),
      ...decisions.filter(projectFilter).map((content) => ({
        content,
        timestamp: new Date(),
        source: 'decisions' as const,
      })),
    ]

    result.projectRecent = projectItems.slice(0, projectRecentLimit)

    // 3. 补充全局最近讨论（如果项目讨论不足）
    if (result.projectRecent.length < projectRecentLimit) {
      const globalItems = [
        ...facts
          .filter((item) => !projectFilter(item))
          .map((content) => ({
            content,
            timestamp: new Date(),
            source: 'facts' as const,
          })),
        ...decisions
          .filter((item) => !projectFilter(item))
          .map((content) => ({
            content,
            timestamp: new Date(),
            source: 'decisions' as const,
          })),
      ]

      result.globalRecent = globalItems.slice(0, globalRecentLimit)
    }

    // 4. 生成 greeting
    if (shouldGenerateGreeting) {
      result.greeting = await generateGreeting(
        result.userProfile,
        result.projectRecent,
        currentProject,
        greetingModel
      )
    }
  } catch (error) {
    console.error('[UniversalMemory] Error during retrieval:', error)
  }

  return result
}

async function detectProjectName(cwd: string): Promise<string | undefined> {
  const { spawnSync: spawnSync2 } = await import('node:child_process')

  // Try git remote
  const gitRemote = spawnSync2('git', ['remote', '-v'], { cwd, stdio: 'pipe' })
  if (gitRemote.status === 0) {
    const output = gitRemote.stdout.toString()
    const match = output.match(/[:/]([^/]+\/[^/]+)\.git/)
    if (match) {
      return match[1].replace('/', '-')
    }
  }

  // Try package.json
  try {
    const packagePath = join(cwd, 'package.json')
    const content = await readFile(packagePath, 'utf8')
    const pkg = JSON.parse(content)
    return pkg.name
  } catch {
    return undefined
  }
}

async function main() {
  const options = parseArgs()

  if (options.help) {
    printHelp()
    process.exit(0)
  }

  const storagePath = process.env.MEMORY_PATH || join(homedir(), '.ai_memory')
  const cwd = process.cwd()

  // Auto-detect project if not specified
  if (!options.currentProject) {
    options.currentProject = await detectProjectName(cwd)
  }

  try {
    const result = await retrieveOnSessionStart(storagePath, options)

    // Output JSON (plain JSON, not pretty-printed for easier parsing)
    console.log(JSON.stringify(result))
  } catch (error) {
    console.error('[UniversalMemory] Retrieve failed:', error)
    process.exit(1)
  }
}

main()
