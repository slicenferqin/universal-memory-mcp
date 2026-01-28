const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PLUGIN_NAME = '@slicenferqin/opencode-universal-memory';

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function stripJsonc(input) {
  const withoutBlock = input.replace(/\/\*[\s\S]*?\*\//g, '');
  const withoutLine = withoutBlock.replace(/(^|[^:])\/\/.*$/gm, '$1');
  return withoutLine;
}

function readConfigFile(configPath) {
  const raw = fs.readFileSync(configPath, 'utf8');
  try {
    return { raw, parsed: JSON.parse(raw), isJsonc: false };
  } catch {
    const stripped = stripJsonc(raw);
    return { raw, parsed: JSON.parse(stripped), isJsonc: true };
  }
}

function writeConfigFile(configPath, obj) {
  const json = JSON.stringify(obj, null, 2) + '\n';
  fs.writeFileSync(configPath, json, 'utf8');
}

function backupConfigFile(configPath) {
  const dir = path.dirname(configPath);
  const base = path.basename(configPath);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(dir, `${base}.bak.${stamp}`);
  fs.copyFileSync(configPath, backupPath);
  return backupPath;
}

function ensurePluginEnabled(config) {
  if (!config || typeof config !== 'object') return config;
  if (!Array.isArray(config.plugin)) config.plugin = [];
  if (!config.plugin.includes(PLUGIN_NAME)) {
    config.plugin.push(PLUGIN_NAME);
  }
  return config;
}

function main() {
  if (process.env.OPENCODE_PLUGIN_AUTOINSTALL === '0') return;

  const explicitPath = process.env.OPENCODE_CONFIG_PATH;
  const candidates = [];

  if (isNonEmptyString(explicitPath)) candidates.push(explicitPath);

  const configDir = path.join(os.homedir(), '.config', 'opencode');
  candidates.push(path.join(configDir, 'opencode.json'));
  candidates.push(path.join(configDir, 'opencode.jsonc'));

  const configPath = candidates.find((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  });

  if (!configPath) {
    const target = path.join(configDir, 'opencode.json');
    fs.mkdirSync(configDir, { recursive: true });
    const config = ensurePluginEnabled({ $schema: 'https://opencode.ai/config.json', plugin: [] });
    writeConfigFile(target, config);
    process.stdout.write(`Configured OpenCode plugin in ${target}\n`);
    return;
  }

  let parsed;
  try {
    const { parsed: p } = readConfigFile(configPath);
    parsed = p;
  } catch (error) {
    process.stderr.write(`Failed to parse OpenCode config at ${configPath}\n`);
    process.stderr.write(`Please add "${PLUGIN_NAME}" to the "plugin" array manually.\n`);
    return;
  }

  const updated = ensurePluginEnabled(parsed);
  try {
    backupConfigFile(configPath);
  } catch {
    process.stderr.write(`Warning: failed to create backup for ${configPath}\n`);
  }
  writeConfigFile(configPath, updated);
  process.stdout.write(`Enabled OpenCode plugin "${PLUGIN_NAME}" in ${configPath}\n`);
}

main();
