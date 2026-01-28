#!/usr/bin/env node

import { createMemoryManager } from 'universal-memory-core';

type RecordInput = {
  user_message?: string;
  ai_response?: string;
  project?: string;
  client?: string;
  session_id?: string;
  working_directory?: string;
  storage_path?: string;
};

function getArgValue(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  const value = args[idx + 1];
  if (!value || value.startsWith('--')) return undefined;
  return value;
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function usage(): string {
  return [
    'Usage:',
    '  universal-memory-record --user <text> --ai <text> [--project <name>] [--client <name>] [--session-id <id>] [--cwd <path>]',
    '  universal-memory-record --json',
    '',
    'JSON mode reads stdin with fields:',
    '  { "user_message": "...", "ai_response": "...", "project": "...", "client": "...", "session_id": "...", "working_directory": "...", "storage_path": "..." }',
    '',
    'Storage path resolution priority:',
    '  --storage-path / JSON.storage_path > env.MEMORY_PATH > default (~/.ai_memory)',
  ].join('\n');
}

function normalizeInput(argv: string[]): RecordInput {
  if (hasFlag(argv, '--json')) {
    return {};
  }

  const user_message = getArgValue(argv, '--user');
  const ai_response = getArgValue(argv, '--ai');
  const project = getArgValue(argv, '--project');
  const client = getArgValue(argv, '--client');
  const session_id = getArgValue(argv, '--session-id');
  const working_directory = getArgValue(argv, '--cwd');
  const storage_path = getArgValue(argv, '--storage-path');

  return {
    user_message,
    ai_response,
    project,
    client,
    session_id,
    working_directory,
    storage_path,
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (hasFlag(argv, '--help') || hasFlag(argv, '-h')) {
    process.stdout.write(`${usage()}\n`);
    process.exit(0);
  }

  let input = normalizeInput(argv);
  if (hasFlag(argv, '--json')) {
    const raw = await readStdin();
    if (!raw.trim()) {
      process.stderr.write('Error: --json provided but stdin is empty\n');
      process.stderr.write(`${usage()}\n`);
      process.exit(1);
    }
    input = JSON.parse(raw) as RecordInput;
  }

  const userMessage = input.user_message;
  const aiResponse = input.ai_response;

  if (!userMessage || !aiResponse) {
    process.stderr.write('Error: missing required fields user_message/ai_response (or --user/--ai)\n');
    process.stderr.write(`${usage()}\n`);
    process.exit(1);
  }

  const storagePath =
    input.storage_path || process.env.MEMORY_PATH || undefined;

  const memoryManager = createMemoryManager(
    storagePath ? { storagePath } : undefined
  );

  const conversation = await memoryManager.recordConversation(
    userMessage,
    aiResponse,
    {
      project: input.project,
      client: input.client,
      sessionId: input.session_id,
      workingDirectory: input.working_directory,
    } as any
  );

  process.stdout.write(`${conversation.id}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Fatal error: ${message}\n`);
  process.exit(1);
});
