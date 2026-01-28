import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const pkgDir = path.join(repoRoot, 'packages', 'opencode-universal-memory');
const tmpDir = path.join(repoRoot, '.tmp_opencode_npm_pack_install_verify');

fs.rmSync(tmpDir, { recursive: true, force: true });
fs.mkdirSync(tmpDir, { recursive: true });

const pack = spawnSync('npm', ['pack', '--silent'], {
  cwd: pkgDir,
  encoding: 'utf8',
});
if (pack.status !== 0) {
  process.stderr.write(`npm pack failed: ${pack.stderr || pack.stdout}\n`);
  process.exit(1);
}

const tarballName = pack.stdout.trim().split('\n').filter(Boolean).pop();
if (!tarballName) {
  process.stderr.write('npm pack failed: missing tarball name\n');
  process.exit(1);
}

const tarballPath = path.join(pkgDir, tarballName);
const list = spawnSync('tar', ['-tf', tarballPath], { encoding: 'utf8' });
if (list.status !== 0) {
  process.stderr.write(`tar list failed: ${list.stderr || list.stdout}\n`);
  process.exit(1);
}
const entries = list.stdout.split('\n').filter(Boolean);
const mustHave = [
  'package/package.json',
  'package/dist/index.js',
  'package/scripts/postinstall.cjs',
  'package/README.md',
  'package/LICENSE',
];
for (const name of mustHave) {
  if (!entries.includes(name)) {
    process.stderr.write(`verify failed: tarball missing ${name}\n`);
    process.exit(1);
  }
}

const pkgJson = spawnSync('tar', ['-xOf', tarballPath, 'package/package.json'], { encoding: 'utf8' });
if (pkgJson.status !== 0) {
  process.stderr.write(`tar read package.json failed: ${pkgJson.stderr || pkgJson.stdout}\n`);
  process.exit(1);
}
const parsed = JSON.parse(pkgJson.stdout);
if (parsed.name !== '@slicenferqin/opencode-universal-memory') {
  process.stderr.write(`verify failed: unexpected package name ${parsed.name}\n`);
  process.exit(1);
}

process.stdout.write('verify ok\n');
