#!/usr/bin/env node

/**
 * Universal Memory - SessionStart Hook
 *
 * 在会话开始时召回用户画像，注入到会话上下文中。
 *
 * 功能：
 * 1. 读取 profile-summary.md（Level 2 整合摘要）
 * 2. 如果不存在，回退到 profile.md（Level 1 原始条目）
 * 3. 输出用户画像到 stdout，Claude Code 会将其作为系统上下文
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Enable debug logging via environment variable
const DEBUG = process.env.UNIVERSAL_MEMORY_DEBUG === '1';

function debugLog(message) {
  if (DEBUG) {
    fs.appendFileSync('/tmp/universal-memory-start-hook.log', `[${new Date().toISOString()}] ${message}\n`);
  }
}

function getMemoryPath() {
  return process.env.MEMORY_PATH || path.join(os.homedir(), '.ai_memory');
}

function readProfileSummary() {
  const memoryPath = getMemoryPath();
  const longTermDir = path.join(memoryPath, 'long_term');

  // 优先读取 Level 2 整合摘要
  const summaryPath = path.join(longTermDir, 'profile-summary.md');
  if (fs.existsSync(summaryPath)) {
    debugLog(`Reading profile summary from: ${summaryPath}`);
    const content = fs.readFileSync(summaryPath, 'utf-8');
    return { source: 'profile-summary.md', content };
  }

  // 回退到 Level 1 原始条目
  const profilePath = path.join(longTermDir, 'profile.md');
  if (fs.existsSync(profilePath)) {
    debugLog(`Reading profile from: ${profilePath}`);
    const content = fs.readFileSync(profilePath, 'utf-8');
    return { source: 'profile.md', content };
  }

  debugLog('No profile found');
  return null;
}

function readKnowledgeSummary() {
  const memoryPath = getMemoryPath();
  const longTermDir = path.join(memoryPath, 'long_term');

  const summaryPath = path.join(longTermDir, 'knowledge-summary.md');
  if (fs.existsSync(summaryPath)) {
    debugLog(`Reading knowledge summary from: ${summaryPath}`);
    const content = fs.readFileSync(summaryPath, 'utf-8');
    return { source: 'knowledge-summary.md', content };
  }

  return null;
}

function formatOutput(profile, knowledge) {
  const parts = [];

  parts.push('<user-memory>');
  parts.push('以下是从长期记忆中召回的用户信息，请在对话中参考：');
  parts.push('');

  if (profile) {
    parts.push(`<!-- Source: ${profile.source} -->`);
    parts.push(profile.content);
    parts.push('');
  }

  // 知识库摘要可能太长，只包含前 2000 字符
  if (knowledge) {
    const truncated = knowledge.content.length > 2000
      ? knowledge.content.substring(0, 2000) + '\n\n[... 更多内容请使用 memory_search 查询]'
      : knowledge.content;
    parts.push(`<!-- Source: ${knowledge.source} -->`);
    parts.push(truncated);
    parts.push('');
  }

  parts.push('</user-memory>');

  return parts.join('\n');
}

function main() {
  debugLog('Start hook triggered');

  // 读取 stdin（Claude Code 会传入 hook 输入）
  let hookInput = {};
  try {
    const raw = fs.readFileSync(0, 'utf8');
    if (raw.trim()) {
      hookInput = JSON.parse(raw);
      debugLog(`Hook input: ${JSON.stringify(hookInput).substring(0, 200)}`);
    }
  } catch (err) {
    debugLog(`Failed to parse hook input: ${err.message}`);
  }

  // 读取用户画像
  const profile = readProfileSummary();

  // 可选：读取知识库摘要（如果需要的话）
  // const knowledge = readKnowledgeSummary();
  const knowledge = null; // 暂时不包含知识库，避免上下文过长

  if (!profile && !knowledge) {
    debugLog('No memory to recall, exiting');
    process.exit(0);
  }

  // 输出到 stdout
  const output = formatOutput(profile, knowledge);
  debugLog(`Output length: ${output.length} chars`);

  // 输出 JSON 格式，包含要注入的内容
  const result = {
    result: output,
  };

  console.log(JSON.stringify(result));
}

main();
