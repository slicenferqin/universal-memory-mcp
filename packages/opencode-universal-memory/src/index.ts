import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

type AnyRecord = Record<string, any>

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function roleNorm(role: unknown): string {
  return String(role ?? '').toLowerCase()
}

function joinPartsText(parts: unknown): string {
  if (!Array.isArray(parts)) return ''
  return parts
    .map((p) => {
      if (!p || typeof p !== 'object') return ''
      const obj = p as AnyRecord
      if (typeof obj.text === 'string') return obj.text
      if (typeof obj.content === 'string') return obj.content
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

function truncate(text: string, maxChars: number): string {
  if (!isNonEmptyString(text)) return ''
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars) + `\n\n[truncated to ${maxChars} chars]`
}

function hashExchange(userText: string, aiText: string): string {
  return createHash('sha256').update(userText).update('\n---\n').update(aiText).digest('hex')
}

function findUp(startDir: string, relativeTarget: string): string | null {
  let dir = startDir
  for (;;) {
    const candidate = path.join(dir, relativeTarget)
    if (fs.existsSync(candidate)) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

function runCommand(
  command: string,
  args: string[],
  input: string,
  cwd: string
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => (stdout += d.toString('utf8')))
    child.stderr.on('data', (d) => (stderr += d.toString('utf8')))
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }))
    child.stdin.write(input)
    child.stdin.end()
  })
}

async function recordViaUniversalMemory(payload: AnyRecord, cwd: string) {
  const input = JSON.stringify(payload)

  if (isNonEmptyString(process.env.UNIVERSAL_MEMORY_RECORD_COMMAND)) {
    const cmd = process.env.UNIVERSAL_MEMORY_RECORD_COMMAND
    const args = isNonEmptyString(process.env.UNIVERSAL_MEMORY_RECORD_ARGS)
      ? process.env.UNIVERSAL_MEMORY_RECORD_ARGS.split(/\s+/).filter(Boolean)
      : []
    const res = await runCommand(cmd, args, input, cwd)
    if (res.code === 0) return { ok: true as const, id: res.stdout.trim() }
  }

  const direct = await runCommand('universal-memory-record', ['--json'], input, cwd)
  if (direct.code === 0) return { ok: true as const, id: direct.stdout.trim() }

  const npx = await runCommand(
    'npx',
    ['-y', '--package', 'universal-memory-mcp', 'universal-memory-record', '--json'],
    input,
    cwd
  )
  if (npx.code === 0) return { ok: true as const, id: npx.stdout.trim() }

  const distPath = findUp(cwd, path.join('packages', 'mcp-server', 'dist', 'record.js'))
  if (!distPath) {
    return {
      ok: false as const,
      error: direct.stderr || npx.stderr || 'record command not available',
    }
  }

  const fallback = await runCommand('node', [distPath, '--json'], input, cwd)
  if (fallback.code === 0) return { ok: true as const, id: fallback.stdout.trim() }

  return {
    ok: false as const,
    error:
      fallback.stderr || fallback.stdout || direct.stderr || npx.stderr || 'record command failed',
  }
}

async function fetchLastExchange(client: AnyRecord, sessionId: string) {
  process.stderr.write(`[UniversalMemory] Fetching messages for session: ${sessionId}\n`);
  
  const response = await client.session.messages({ path: { id: sessionId } });
  
  process.stderr.write(`[UniversalMemory] Response type: ${typeof response}\n`);
  process.stderr.write(`[UniversalMemory] Response keys: ${Object.keys(response || {})}\n`);
  
  const items = Array.isArray(response?.data)
    ? response.data
    : Array.isArray(response)
      ? response
      : [];
  
  process.stderr.write(`[UniversalMemory] Items count: ${items.length}\n`);
  
  const normalized = items
    .map((item: AnyRecord) => {
      const info = item?.info ?? item?.message ?? item?.data?.info ?? item?.data?.message;
      const parts = item?.parts ?? item?.data?.parts;
      const role = info?.role ?? info?.type ?? info?.author;
      const text = joinPartsText(parts) || (typeof info?.text === 'string' ? info.text : '');
      return { role: roleNorm(role), text: String(text).trim() };
    })
    .filter((m: { role: string; text: string }) => m.role && isNonEmptyString(m.text));

  process.stderr.write(`[UniversalMemory] Normalized messages: ${normalized.length}\n`);
  
  const lastUserIdx = (() => {
    for (let i = normalized.length - 1; i >= 0; i--) {
      if (normalized[i].role === 'user') return i;
    }
    return -1;
  })();

  const lastAssistantIdxAfterUser = (() => {
    if (lastUserIdx === -1) return -1;
    for (let i = lastUserIdx + 1; i < normalized.length; i++) {
      if (normalized[i].role === 'assistant') return i;
    }
    return -1;
  })();

  const lastAssistantIdx = (() => {
    for (let i = normalized.length - 1; i >= 0; i--) {
      if (normalized[i].role === 'assistant') return i;
    }
    return -1;
  })();

  const userText = lastUserIdx !== -1 ? normalized[lastUserIdx].text : '';
  const aiText =
    lastAssistantIdxAfterUser !== -1
      ? normalized[lastAssistantIdxAfterUser].text
      : lastAssistantIdx !== -1
        ? normalized[lastAssistantIdx].text
        : '';
  
  process.stderr.write(`[UniversalMemory] User text length: ${userText.length}, AI text length: ${aiText.length}\n`);

  return { userText, aiText };
}
    return -1
  })()

  const lastAssistantIdxAfterUser = (() => {
    if (lastUserIdx === -1) return -1
    for (let i = lastUserIdx + 1; i < normalized.length; i++) {
      if (normalized[i].role === 'assistant') return i
    }
    return -1
  })()

  const lastAssistantIdx = (() => {
    for (let i = normalized.length - 1; i >= 0; i--) {
      if (normalized[i].role === 'assistant') return i
    }
    return -1
  })()

  const userText = lastUserIdx !== -1 ? normalized[lastUserIdx].text : ''
  const aiText =
    lastAssistantIdxAfterUser !== -1
      ? normalized[lastAssistantIdxAfterUser].text
      : lastAssistantIdx !== -1
        ? normalized[lastAssistantIdx].text
        : ''

  return { userText, aiText }
}

export default async function UniversalMemoryPlugin(ctx: AnyRecord) {
  const { project, client, directory, worktree } = ctx || {}
  const lastRecorded = new Map<string, string>()

  const projectName =
    (project && (project.name || project.slug || project.id)) ||
    path.basename(worktree || directory || process.cwd())

  const sessionEvents = [
    'session.idle',
    'session.updated',
    'session.diff',
    'session.status',
    'session.created',
    'session.deleted',
  ]

  return {
    event: async ({ event }: AnyRecord) => {
      try {
        if (!event) {
          return
        }

        if (sessionEvents.includes(event.type)) {
          const sessionId = event.session_id || event.sessionID || event.sessionId

          if (event.type === 'session.idle') {
            if (!isNonEmptyString(sessionId)) {
              return
            }

            const { userText, aiText } = await fetchLastExchange(client, sessionId)

            if (!isNonEmptyString(userText) || !isNonEmptyString(aiText)) {
              return
            }

            const userMessage = truncate(userText, 8000)
            const aiResponse = truncate(aiText, 20000)
            const exchangeHash = hashExchange(userMessage, aiResponse)

            if (lastRecorded.get(sessionId) === exchangeHash) {
              return
            }
            lastRecorded.set(sessionId, exchangeHash)

            const payload = {
              user_message: userMessage,
              ai_response: aiResponse,
              project: projectName,
              client: 'opencode',
              session_id: sessionId,
              working_directory: directory || process.cwd(),
            }

            const res = await recordViaUniversalMemory(payload, directory || process.cwd())
            if (!res.ok) {
              process.stderr.write(`opencode-universal-memory warning: ${res.error}\n`)
            }
          } else if (event.type === 'session.updated' || event.type === 'session.diff') {
            // Track when session is updated or diffed to avoid duplicate recording
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('[UniversalMemory] Error:', message)
        console.error('[UniversalMemory] Stack:', error instanceof Error ? error.stack : '')
        process.stderr.write(`opencode-universal-memory error: ${message}\n`)
      }
    },
  }
}
