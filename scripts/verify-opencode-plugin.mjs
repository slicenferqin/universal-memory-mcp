import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const tmpDir = path.join(repoRoot, '.tmp_opencode_plugin_verify');
const outDir = path.join(tmpDir, 'out');

fs.rmSync(tmpDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const fakeRecordPath = path.join(tmpDir, 'fake-record.mjs');
fs.writeFileSync(
  fakeRecordPath,
  [
    "import fs from 'node:fs';",
    "const input = fs.readFileSync(0, 'utf8');",
    "fs.writeFileSync(process.env.UM_OUTFILE, input);",
    "process.stdout.write('ok\\n');",
    '',
  ].join('\n'),
  'utf8'
);

process.env.UNIVERSAL_MEMORY_RECORD_COMMAND = 'node';
process.env.UNIVERSAL_MEMORY_RECORD_ARGS = `${fakeRecordPath} --json`;
process.env.UM_OUTFILE = path.join(outDir, 'payload.json');

const pluginUrl = pathToFileURL(
  path.join(repoRoot, '.opencode', 'plugins', 'universal-memory.mjs')
).toString();
const mod = await import(pluginUrl);
const pluginFn = mod.default || mod.UniversalMemoryPlugin;

const fakeClient = {
  session: {
    messages: async () => {
      return {
        data: [
          { info: { role: 'user' }, parts: [{ text: 'hello from user' }] },
          { info: { role: 'assistant' }, parts: [{ text: 'hello from assistant' }] },
        ],
      };
    },
  },
};

const plugin = await pluginFn({
  project: { name: 'demo-project' },
  client: fakeClient,
  directory: repoRoot,
  worktree: repoRoot,
});

await plugin.event({ event: { type: 'session.idle', session_id: 'ses_demo' } });

const payloadPath = process.env.UM_OUTFILE;
if (!payloadPath || !fs.existsSync(payloadPath)) {
  process.stderr.write('verify failed: payload not written\n');
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
if (payload.client !== 'opencode') {
  process.stderr.write(`verify failed: expected client=opencode, got ${payload.client}\n`);
  process.exit(1);
}
if (!payload.user_message || !payload.ai_response) {
  process.stderr.write('verify failed: missing user_message/ai_response\n');
  process.exit(1);
}

process.stdout.write('verify ok\n');
