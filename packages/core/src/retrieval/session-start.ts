/**
 * Session Start Retrieval - 会话启动时的记忆召回
 *
 * 三层召回策略：
 * 1. 用户画像（profile-summary.md 优先，降级到 profile.md）
 * 2. 项目最近讨论（facts.md + decisions.md，按项目过滤）
 * 3. 全局最近讨论（补充，如果项目讨论不足）
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

export interface SessionStartContext {
  userProfile: string
  projectRecent: Array<{
    content: string
    timestamp: Date
    source: 'facts' | 'decisions' | 'global'
  }>
  globalRecent: Array<{ content: string; timestamp: Date; source: string }>
  currentProject?: string
  greeting: string
}

export interface SessionStartOptions {
  currentProject?: string
  profileLimit?: number
  projectRecentLimit?: number
  globalRecentLimit?: number
  shouldGenerateGreeting?: boolean
  greetingModel?: 'haiku' | 'sonnet' | 'opus'
}

/**
 * 会话启动时的召回
 */
export async function retrieveOnSessionStart(
  storagePath: string,
  options: SessionStartOptions = {}
): Promise<SessionStartContext> {
  const {
    currentProject,
    profileLimit = 10,
    projectRecentLimit = 5,
    globalRecentLimit = 3,
    shouldGenerateGreeting = true,
    greetingModel = 'haiku',
  } = options

  const result: SessionStartContext = {
    userProfile: '',
    projectRecent: [],
    globalRecent: [],
    currentProject,
    greeting: '',
  }

  // ========== Step 1: 召回用户画像（L2 优先，降级到 L1） ==========

  try {
    // 优先从 L2 读取
    result.userProfile = await readFile(join(storagePath, 'long_term/profile-summary.md'), 'utf-8')
  } catch {
    try {
      // 降级到 L1
      result.userProfile = await readFile(join(storagePath, 'long_term/profile.md'), 'utf-8')
    } catch {
      result.userProfile = '# User Profile\n（暂无用户画像）'
    }
  }

  // ========== Step 2: 召回项目最近讨论 ==========

  if (currentProject) {
    const projectFacts = await retrieveByProject(
      storagePath,
      'facts',
      currentProject,
      projectRecentLimit
    )
    const projectDecisions = await retrieveByProject(
      storagePath,
      'decisions',
      currentProject,
      projectRecentLimit
    )

    result.projectRecent = [
      ...projectFacts.map((f) => ({ ...f, source: 'facts' as const })),
      ...projectDecisions.map((d) => ({ ...d, source: 'decisions' as const })),
    ]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, projectRecentLimit)
  }

  // ========== Step 3: 召回全局最近讨论（补充） ==========

  const totalProjectDiscussions = result.projectRecent.length

  if (totalProjectDiscussions < 5) {
    const globalFacts = await retrieveRecent(storagePath, 'facts', globalRecentLimit * 2)
    const globalDecisions = await retrieveRecent(storagePath, 'decisions', globalRecentLimit * 2)

    // 过滤掉当前项目的条目（避免重复）
    result.globalRecent = [...globalFacts, ...globalDecisions]
      .filter((entry) => {
        if (!currentProject) return true
        return !matchesProject(entry.content, [currentProject])
      })
      .map((entry) => ({
        ...entry,
        source: entry.source || 'global',
      }))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, globalRecentLimit)
  }

  // ========== Step 4: 生成开场白 ==========

  if (shouldGenerateGreeting) {
    result.greeting = await generateGreeting(result, greetingModel)
  }

  return result
}

/**
 * 按项目检索记忆
 */
async function retrieveByProject(
  storagePath: string,
  category: 'facts' | 'decisions',
  project: string,
  limit: number
): Promise<Array<{ content: string; timestamp: Date }>> {
  const filePath = join(storagePath, 'long_term', `${category}.md`)

  try {
    const content = await readFile(filePath, 'utf-8')
    const entries = parseFactEntries(content)

    // 文本匹配过滤项目
    const projectKeywords = [
      project,
      project.replace(/-/g, ' '),
      project.replace(/^@?[\w-]+\//, ''),
    ]

    return entries.filter((entry) => matchesProject(entry.content, projectKeywords)).slice(0, limit)
  } catch {
    return []
  }
}

/**
 * 检索最近记忆（不限项目）
 */
async function retrieveRecent(
  storagePath: string,
  category: 'facts' | 'decisions',
  limit: number
): Promise<Array<{ content: string; timestamp: Date; source: string }>> {
  const filePath = join(storagePath, 'long_term', `${category}.md`)

  try {
    const content = await readFile(filePath, 'utf-8')
    const entries = parseFactEntries(content)

    return entries.slice(0, limit).map((entry) => ({
      ...entry,
      source: category,
    }))
  } catch {
    return []
  }
}

/**
 * 解析 facts/decisions 文件条目
 */
function parseFactEntries(content: string): Array<{ content: string; timestamp: Date }> {
  const lines = content.split('\n')
  const entries: Array<{ content: string; timestamp: Date }> = []

  for (const line of lines) {
    const match = line.match(/^\-\s*\[(.+?)\]\s*(.+)$/)
    if (match) {
      const timestamp = new Date(match[1])
      const text = match[2].trim()
      if (!isNaN(timestamp.getTime()) && text.length > 5) {
        entries.push({ content: text, timestamp })
      }
    }
  }

  return entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
}

/**
 * 文本匹配：判断条目是否匹配项目
 */
function matchesProject(content: string, keywords: string[]): boolean {
  const lowerContent = content.toLowerCase()

  for (const keyword of keywords) {
    const lowerKeyword = keyword.toLowerCase()

    // 精确匹配
    if (lowerContent.includes(lowerKeyword)) {
      return true
    }

    // 匹配 "项目：xxx" 或 "xxx 项目" 或 "xxx project"
    if (
      lowerContent.includes(`${lowerKeyword} 项目`) ||
      lowerContent.includes(`项目：${lowerKeyword}`) ||
      lowerContent.includes(`项目:${lowerKeyword}`) ||
      lowerContent.includes(`${lowerKeyword} project`)
    ) {
      return true
    }
  }

  return false
}

/**
 * 生成开场白
 */
async function generateGreeting(
  context: Pick<
    SessionStartContext,
    'userProfile' | 'currentProject' | 'projectRecent' | 'globalRecent'
  >,
  model: 'haiku' | 'sonnet' | 'opus' = 'haiku'
): Promise<string> {
  const { userProfile, currentProject, projectRecent, globalRecent } = context

  // 提取关键信息
  const lastProjectFact = projectRecent[0]
  const lastGlobalFact = globalRecent[0]

  // 如果没有任何记忆，返回简单问候
  if (projectRecent.length === 0 && globalRecent.length === 0) {
    return '你好！很高兴见到你，需要我帮你做什么吗？'
  }

  // 构建记忆摘要
  const profileSummary = extractProfileSummary(userProfile)
  const recentSummary = buildRecentSummary(lastProjectFact, lastGlobalFact, currentProject)

  // 构建 prompt
  const prompt = `你是一个有记忆的AI助手。根据以下召回的记忆，生成一个自然、友好的开场白。

## 用户画像（摘要）
${profileSummary}

## 当前项目
${currentProject || '无'}

## 最近讨论
${recentSummary}

## 你的任务
生成一个开场白（不超过100字），要求：
1. 体现记忆：提到最近的讨论、进度
2. 体现上下文感知：知道是否换了项目
3. 体现主动性：询问下一步计划
4. 简洁友好
5. 中英文混用（根据用户画像风格）

## 场景示例

### 场景1：换了项目
"你好，slicenfer！刚才我们在 universal-memory-mcp 项目实现了错误重试机制。现在进入了新项目 ${currentProject}，需要我先分析一下这个项目吗？"

### 场景2：同项目继续
"你好，slicenfer，又见面了！在这个项目中，我们刚实现了${lastProjectFact?.content.substring(0, 30)}...。现在是要继续推进，还是有别的吩咐呢？"

### 场景3：首次启动
"你好！很高兴认识你。我看到你是一名软件工程师，正在开发多个项目。需要我帮你做什么呢？"

---

现在，请生成开场白（直接输出，不要额外解释）：`

  try {
    const greeting = await callClaudeCLI(prompt, model)
    return greeting.trim()
  } catch (error) {
    // 失败时返回简单模板
    if (currentProject && lastProjectFact) {
      return `你好！我们最近在 ${currentProject} 项目中讨论了${lastProjectFact.content.substring(0, 30)}...。需要我继续做什么吗？`
    }
    return '你好！很高兴见到你，需要我帮你做什么吗？'
  }
}

/**
 * 提取用户画像摘要（简化版）
 */
function extractProfileSummary(profile: string): string {
  const lines = profile.split('\n')
  const keyInfo: string[] = []

  for (const line of lines) {
    if (line.startsWith('##') || line.startsWith('- **') || line.startsWith('  - **')) {
      keyInfo.push(line)
      if (keyInfo.length >= 10) break // 限制长度
    }
  }

  return keyInfo.join('\n').substring(0, 500)
}

/**
 * 构建最近讨论摘要
 */
function buildRecentSummary(
  lastProjectFact?: { content: string; timestamp: Date },
  lastGlobalFact?: { content: string; timestamp: Date },
  currentProject?: string
): string {
  const parts: string[] = []

  if (lastProjectFact) {
    const timeAgo = formatTimeAgo(lastProjectFact.timestamp)
    parts.push(`当前项目: ${timeAgo} - ${lastProjectFact.content.substring(0, 80)}...`)
  }

  if (lastGlobalFact && (!currentProject || lastGlobalFact.content !== lastProjectFact?.content)) {
    const timeAgo = formatTimeAgo(lastGlobalFact.timestamp)
    parts.push(`其他: ${timeAgo} - ${lastGlobalFact.content.substring(0, 80)}...`)
  }

  return parts.length > 0 ? parts.join('\n') : '（暂无最近讨论）'
}

/**
 * 格式化时间差
 */
function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}天前`
  if (hours > 0) return `${hours}小时前`
  return '刚才'
}

/**
 * 调用 Claude CLI
 */
async function callClaudeCLI(prompt: string, model: 'haiku' | 'sonnet' | 'opus'): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ['-p', prompt, '--model', model, '--output-format', 'text']

    // 移除 Claude 相关环境变量，避免嵌套实例冲突
    const cleanEnv = { ...process.env }
    delete cleanEnv.CLAUDECODE
    delete cleanEnv.CLAUDE_CODE_ENTRYPOINT

    const childProcess = spawn('claude', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: cleanEnv,
    })

    childProcess.stdin.end()

    let stdout = ''
    let stderr = ''

    childProcess.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    childProcess.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    childProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Claude CLI 退出码 ${code}: ${stderr}`))
        return
      }

      // 提取文本内容
      const text = stdout.trim()
      resolve(text)
    })

    childProcess.on('error', (error) => {
      reject(new Error(`启动 Claude CLI 失败: ${error.message}`))
    })
  })
}
