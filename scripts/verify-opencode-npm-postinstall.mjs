import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const tmpDir = path.join(repoRoot, '.tmp_opencode_npm_postinstall_verify');
fs.rmSync(tmpDir, { recursive: true, force: true });
fs.mkdirSync(tmpDir, { recursive: true });

const configPath = path.join(tmpDir, 'opencode.json');
fs.writeFileSync(
  configPath,
  JSON.stringify({ $schema: 'https://opencode.ai/config.json', plugin: ['foo'] }, null, 2) + '\n',
  'utf8'
);

const scriptPath = path.join(
  repoRoot,
  'packages',
  'opencode-universal-memory',
  'scripts',
  'postinstall.cjs'
);

const res = spawnSync('node', [scriptPath], {
  encoding: 'utf8',
  env: {
    ...process.env,
    OPENCODE_CONFIG_PATH: configPath,
    OPENCODE_PLUGIN_AUTOINSTALL: '1',
    HOME: os.homedir(),
  },
});

if (res.status !== 0) {
  process.stderr.write(`postinstall failed: ${res.stderr || res.stdout}\n`);
  process.exit(1);
}

const updated = JSON.parse(fs.readFileSync(configPath, 'utf8'));
if (!Array.isArray(updated.plugin) || !updated.plugin.includes('@slicenferqin/opencode-universal-memory')) {
  process.stderr.write('verify failed: plugin not enabled in config\n');
  process.exit(1);
}

process.stdout.write('verify ok\n');
