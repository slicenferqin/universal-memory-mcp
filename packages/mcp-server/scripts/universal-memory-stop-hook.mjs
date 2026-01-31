#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Enable debug logging via environment variable
const DEBUG = process.env.UNIVERSAL_MEMORY_DEBUG === '1';

function debugLog(message) {
  if (DEBUG) {
    fs.appendFileSync('/tmp/universal-memory-stop-hook.log', `[${new Date().toISOString()}] ${message}\n`);
  }
}

function readStdinSync() {
  return fs.readFileSync(0, 'utf8');
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function contentToText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && typeof item.text === 'string') return item.text;
        if (item && typeof item === 'object' && typeof item.content === 'string') return item.content;
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  if (content && typeof content === 'object') {
    if (typeof content.text === 'string') return content.text;
    if (typeof content.content === 'string') return content.content;
  }
  return '';
}

function extractMessages(transcriptJson) {
  if (!transcriptJson || typeof transcriptJson !== 'object') return [];

  if (Array.isArray(transcriptJson.messages)) return transcriptJson.messages;
  if (Array.isArray(transcriptJson.turns)) return transcriptJson.turns;
  if (Array.isArray(transcriptJson.events)) return transcriptJson.events;
  if (Array.isArray(transcriptJson.transcript)) return transcriptJson.transcript;

  if (transcriptJson.conversation && Array.isArray(transcriptJson.conversation.messages)) {
    return transcriptJson.conversation.messages;
  }

  return [];
}

function extractLastExchange(messages) {
  const normalized = messages
    .map((m) => {
      if (!m || typeof m !== 'object') return null;
      const role = m.role || m.author || m.type;
      const content = m.content ?? m.text ?? m.message ?? m.data?.content;
      return {
        role: typeof role === 'string' ? role : '',
        text: contentToText(content),
      };
    })
    .filter(Boolean)
    .filter((m) => isNonEmptyString(m.role) && isNonEmptyString(m.text));

  const roleNorm = (r) => String(r).toLowerCase();
  const lastUserIdx = (() => {
    for (let i = normalized.length - 1; i >= 0; i--) {
      if (roleNorm(normalized[i].role) === 'user') return i;
    }
    return -1;
  })();

  const lastAssistantIdxAfterUser = (() => {
    if (lastUserIdx === -1) return -1;
    for (let i = lastUserIdx + 1; i < normalized.length; i++) {
      if (roleNorm(normalized[i].role) === 'assistant') return i;
    }
    return -1;
  })();

  const lastAssistantIdx = (() => {
    for (let i = normalized.length - 1; i >= 0; i--) {
      if (roleNorm(normalized[i].role) === 'assistant') return i;
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

  return { userText, aiText };
}

function truncate(text, maxChars) {
  if (!isNonEmptyString(text)) return '';
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + `\n\n[truncated to ${maxChars} chars]`;
}

function findUp(startDir, relativeTarget) {
  let dir = startDir;
  for (;;) {
    const candidate = path.join(dir, relativeTarget);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function runRecordCommand(payload, cwd) {
  const input = JSON.stringify(payload);

  const direct = spawnSync('universal-memory-record', ['--json'], {
    input,
    encoding: 'utf8',
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (direct.status === 0) return { ok: true, id: direct.stdout.trim() };

  const npx = spawnSync(
    'npx',
    ['-y', '--package', 'universal-memory-mcp', 'universal-memory-record', '--json'],
    {
      input,
      encoding: 'utf8',
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  );
  if (npx.status === 0) return { ok: true, id: npx.stdout.trim() };

  const distPath = findUp(cwd, path.join('packages', 'mcp-server', 'dist', 'record.js'));
  if (!distPath) {
    return {
      ok: false,
      error: 'universal-memory-record not found (PATH/npx) and dist/record.js not found',
    };
  }

  const fallback = spawnSync('node', [distPath, '--json'], {
    input,
    encoding: 'utf8',
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (fallback.status === 0) return { ok: true, id: fallback.stdout.trim() };
  return { ok: false, error: fallback.stderr || fallback.stdout || 'record command failed' };
}

function detectProjectName(cwd) {
  try {
    const gitDir = findUp(cwd, '.git');
    if (gitDir) return path.basename(path.dirname(gitDir));
  } catch {
    return undefined;
  }
  return undefined;
}

function main() {
  debugLog('Stop hook triggered');

  const raw = readStdinSync();
  if (!raw.trim()) {
    debugLog('No stdin input, exiting');
    process.exit(0);
  }

  debugLog(`Received input: ${raw.substring(0, 200)}...`);

  let hookInput;
  try {
    hookInput = JSON.parse(raw);
  } catch (err) {
    debugLog(`Failed to parse input JSON: ${err.message}`);
    process.exit(0);
  }

  const cwd = hookInput.cwd || process.cwd();
  const transcriptPath = hookInput.transcript_path || hookInput.transcriptPath;
  const sessionId = hookInput.session_id || hookInput.sessionId;

  debugLog(`transcript_path: ${transcriptPath}`);

  if (!isNonEmptyString(transcriptPath)) {
    debugLog('No transcript_path, exiting');
    process.exit(0);
  }

  let messages;
  try {
    const transcriptContent = fs.readFileSync(transcriptPath, 'utf8');

    // Parse JSONL format (one JSON object per line)
    const lines = transcriptContent.trim().split('\n').filter(line => line.trim());
    const entries = lines.map(line => JSON.parse(line));

    debugLog(`Successfully read ${entries.length} transcript entries`);

    // Extract messages from JSONL entries
    messages = entries
      .filter(entry => entry.type === 'user' || entry.type === 'assistant')
      .map(entry => ({
        role: entry.type === 'user' ? 'user' : 'assistant',
        content: entry.message?.content || entry.content
      }));

    debugLog(`Extracted ${messages.length} messages from JSONL`);
  } catch (err) {
    debugLog(`Failed to read transcript: ${err.message}`);
    process.exit(0);
  }

  const { userText, aiText } = extractLastExchange(messages);
  debugLog(`userText length: ${userText.length}, aiText length: ${aiText.length}`);

  if (!isNonEmptyString(userText) || !isNonEmptyString(aiText)) {
    debugLog('Empty user or AI text, exiting');
    process.exit(0);
  }

  // Determine client - default to 'claude-code' if not provided
  const client = isNonEmptyString(hookInput.client) ? hookInput.client : 'claude-code';

  const payload = {
    user_message: truncate(userText, 8000),
    ai_response: truncate(aiText, 20000),
    project: detectProjectName(cwd),
    client: client,
    session_id: isNonEmptyString(sessionId) ? sessionId : undefined,
    working_directory: cwd,
  };

  debugLog(`Payload: client=${client}, project=${payload.project}, session_id=${payload.session_id}`);

  const res = runRecordCommand(payload, cwd);
  if (!res.ok) {
    const errorMsg = `universal-memory stop hook warning: ${res.error}\n`;
    process.stderr.write(errorMsg);
    debugLog(`Error: ${res.error}`);
  } else {
    debugLog(`Successfully saved memory: ${res.id}`);
  }
}

main();
