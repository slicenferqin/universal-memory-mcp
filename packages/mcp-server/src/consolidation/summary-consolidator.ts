/**
 * Summary Consolidator - 二次整合器
 *
 * 基于脑科学的记忆整合机制，将 Level 1 的原始条目整合为 Level 2 的结构化摘要。
 *
 * 参考：
 * - Systems Consolidation: 记忆从海马体迁移到新皮层
 * - Sleep Replay: 睡眠期间神经元重放并压缩记忆
 * - Abstraction: 记忆被重组、抽象、与现有知识整合
 */

import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export interface ConsolidationOptions {
  verbose?: boolean;
  model?: 'haiku' | 'sonnet' | 'opus';
  dryRun?: boolean;
}

export interface ConsolidationResult {
  profileSummary?: string;
  knowledgeSummary?: string;
  stats: {
    profileEntriesProcessed: number;
    preferencesEntriesProcessed: number;
    factsEntriesProcessed: number;
    decisionsEntriesProcessed: number;
  };
}

/**
 * 执行二次整合
 */
export async function consolidateSummaries(
  storagePath: string,
  options: ConsolidationOptions = {}
): Promise<ConsolidationResult> {
  const longTermDir = join(storagePath, 'long_term');

  // 读取 Level 1 文件
  const profileEntries = await readEntriesFromFile(join(longTermDir, 'profile.md'));
  const preferencesEntries = await readEntriesFromFile(join(longTermDir, 'preferences.md'));
  const factsEntries = await readEntriesFromFile(join(longTermDir, 'facts.md'));
  const decisionsEntries = await readEntriesFromFile(join(longTermDir, 'decisions.md'));

  const stats = {
    profileEntriesProcessed: profileEntries.length,
    preferencesEntriesProcessed: preferencesEntries.length,
    factsEntriesProcessed: factsEntries.length,
    decisionsEntriesProcessed: decisionsEntries.length,
  };

  console.log(`   读取到: ${profileEntries.length} 条画像, ${preferencesEntries.length} 条偏好`);
  console.log(`           ${factsEntries.length} 条事实, ${decisionsEntries.length} 条决策`);

  const result: ConsolidationResult = { stats };

  // 整合用户画像 + 偏好
  if (profileEntries.length > 0 || preferencesEntries.length > 0) {
    console.log('\n🧠 整合用户画像...');
    const profileSummary = await consolidateProfile(
      [...profileEntries, ...preferencesEntries],
      options
    );
    result.profileSummary = profileSummary;

    if (!options.dryRun && profileSummary) {
      await mkdir(longTermDir, { recursive: true });
      await writeFile(
        join(longTermDir, 'profile-summary.md'),
        profileSummary,
        'utf-8'
      );
      console.log('   ✓ 已保存 profile-summary.md');
    }
  }

  // 整合事实 + 决策
  if (factsEntries.length > 0 || decisionsEntries.length > 0) {
    console.log('\n📚 整合知识库...');
    const knowledgeSummary = await consolidateKnowledge(
      factsEntries,
      decisionsEntries,
      options
    );
    result.knowledgeSummary = knowledgeSummary;

    if (!options.dryRun && knowledgeSummary) {
      await writeFile(
        join(longTermDir, 'knowledge-summary.md'),
        knowledgeSummary,
        'utf-8'
      );
      console.log('   ✓ 已保存 knowledge-summary.md');
    }
  }

  // 更新元数据
  if (!options.dryRun) {
    await updateConsolidationMeta(longTermDir, stats);
  }

  return result;
}

/**
 * 从文件读取条目
 */
async function readEntriesFromFile(filePath: string): Promise<string[]> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const entries: string[] = [];

    for (const line of lines) {
      // 匹配 "- [时间戳] 内容" 格式
      const match = line.match(/^-\s*\[[\d\-\s:]+\]\s*(.+)$/);
      if (match) {
        entries.push(match[1].trim());
      }
    }

    return entries;
  } catch {
    return [];
  }
}

/**
 * 整合用户画像
 */
async function consolidateProfile(
  entries: string[],
  options: ConsolidationOptions
): Promise<string> {
  if (entries.length === 0) {
    return '';
  }

  const prompt = buildProfileConsolidationPrompt(entries);

  if (options.verbose) {
    console.log(`   [DEBUG] 输入 ${entries.length} 条原始条目`);
    console.log(`   [DEBUG] Prompt 长度: ${prompt.length} 字符`);
  }

  const result = await callClaudeCLI(prompt, options);
  return result;
}

/**
 * 整合知识库
 */
async function consolidateKnowledge(
  facts: string[],
  decisions: string[],
  options: ConsolidationOptions
): Promise<string> {
  if (facts.length === 0 && decisions.length === 0) {
    return '';
  }

  const prompt = buildKnowledgeConsolidationPrompt(facts, decisions);

  if (options.verbose) {
    console.log(`   [DEBUG] 输入 ${facts.length} 条事实, ${decisions.length} 条决策`);
    console.log(`   [DEBUG] Prompt 长度: ${prompt.length} 字符`);
  }

  const result = await callClaudeCLI(prompt, options);
  return result;
}

/**
 * 构建用户画像整合 prompt
 */
function buildProfileConsolidationPrompt(entries: string[]): string {
  const entriesText = entries.map((e, i) => `${i + 1}. ${e}`).join('\n');

  return `你是一个记忆整理专家。请将以下零散的用户画像和偏好条目整合成一份结构化的用户画像摘要。

## 原始条目（共 ${entries.length} 条）

${entriesText}

## 整合要求

1. **合并重复信息**：相似的描述只保留一条，选择最完整、最准确的
2. **结构化组织**：按类别分组（基本信息、技术栈、工作习惯、沟通风格）
3. **保持准确**：不要编造信息，只基于原始条目
4. **简洁表达**：每个要点用简短的短语或句子

## 输出格式

直接输出 Markdown 格式的用户画像摘要，不要其他解释：

\`\`\`markdown
# User Profile Summary

> Last consolidated: ${new Date().toISOString().split('T')[0]}
> Source entries: ${entries.length}

## 基本信息
- **职业角色**: ...
- **主要领域**: ...

## 技术栈
- **语言**: ...
- **框架/工具**: ...
- **数据库**: ...

## 工作习惯
- ...
- ...

## 沟通风格
- ...
- ...

## 当前关注
- ...
\`\`\`

直接输出 Markdown：`;
}

/**
 * 构建知识库整合 prompt
 */
function buildKnowledgeConsolidationPrompt(
  facts: string[],
  decisions: string[]
): string {
  const factsText = facts.length > 0
    ? facts.map((f, i) => `${i + 1}. ${f}`).join('\n')
    : '（无）';

  const decisionsText = decisions.length > 0
    ? decisions.map((d, i) => `${i + 1}. ${d}`).join('\n')
    : '（无）';

  return `你是一个知识整理专家。请将以下零散的事实和决策条目整合成一份结构化的知识库摘要。

## 原始事实（共 ${facts.length} 条）

${factsText}

## 原始决策（共 ${decisions.length} 条）

${decisionsText}

## 整合要求

1. **按项目/主题分组**：识别出不同的项目或主题，分别组织
2. **更新过时信息**：如果有版本号等更新，保留最新的
3. **建立关联**：将相关的事实和决策放在一起
4. **按时间排序**：决策按时间顺序排列

## 输出格式

直接输出 Markdown 格式的知识库摘要，不要其他解释：

\`\`\`markdown
# Knowledge Summary

> Last consolidated: ${new Date().toISOString().split('T')[0]}
> Source: ${facts.length} facts, ${decisions.length} decisions

## 项目: [项目名称]

### 基本信息
- **版本**: ...
- **仓库**: ...
- **技术栈**: ...

### 重要决策
1. [日期] 决策内容
2. ...

### 关键事实
- ...
- ...

## 项目: [另一个项目]
...

## 通用知识
- ...
\`\`\`

直接输出 Markdown：`;
}

/**
 * 调用 Claude CLI
 */
async function callClaudeCLI(
  prompt: string,
  options: ConsolidationOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      '-p', prompt,
      '--output-format', 'text',
    ];

    if (options.model) {
      args.push('--model', options.model);
    }

    // 移除 Claude 相关环境变量，避免嵌套实例冲突
    const cleanEnv = { ...process.env };
    delete cleanEnv.CLAUDECODE;
    delete cleanEnv.CLAUDE_CODE_ENTRYPOINT;

    const startTime = Date.now();
    const childProcess = spawn('claude', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: cleanEnv,
    });

    childProcess.stdin.end();

    let stdout = '';
    let stderr = '';

    childProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    childProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // 进度报告
    const progressInterval = setInterval(() => {
      if (options.verbose) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        console.log(`   [DEBUG] 运行中... ${elapsed}s`);
      }
    }, 10000);

    childProcess.on('close', (code) => {
      clearInterval(progressInterval);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (options.verbose) {
        console.log(`   [DEBUG] Claude CLI 完成 (${elapsed}s)`);
      }

      if (code !== 0) {
        reject(new Error(`Claude CLI 退出码 ${code}: ${stderr}`));
        return;
      }

      // 提取 Markdown 内容
      const markdown = extractMarkdown(stdout);
      resolve(markdown);
    });

    childProcess.on('error', (error) => {
      clearInterval(progressInterval);
      reject(new Error(`启动 Claude CLI 失败: ${error.message}`));
    });
  });
}

/**
 * 从输出中提取 Markdown
 */
function extractMarkdown(output: string): string {
  // 尝试提取代码块中的 markdown
  const codeBlockMatch = output.match(/```markdown\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // 尝试提取 # 开头的内容
  const headerMatch = output.match(/(#\s+[\s\S]+)/);
  if (headerMatch) {
    return headerMatch[1].trim();
  }

  // 返回原始输出
  return output.trim();
}

/**
 * 更新整合元数据
 */
async function updateConsolidationMeta(
  longTermDir: string,
  stats: ConsolidationResult['stats']
): Promise<void> {
  const metaPath = join(longTermDir, '.consolidation-meta.json');

  let meta: {
    lastConsolidation: string;
    history: Array<{
      date: string;
      stats: ConsolidationResult['stats'];
    }>;
  };

  try {
    const content = await readFile(metaPath, 'utf-8');
    meta = JSON.parse(content);
  } catch {
    meta = { lastConsolidation: '', history: [] };
  }

  meta.lastConsolidation = new Date().toISOString();
  meta.history.unshift({
    date: meta.lastConsolidation,
    stats,
  });

  // 只保留最近 30 次记录
  meta.history = meta.history.slice(0, 30);

  await writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
}

/**
 * 检查是否需要整合（基于阈值）
 */
export async function shouldConsolidate(
  storagePath: string,
  thresholds = { profile: 50, facts: 100 }
): Promise<{ needed: boolean; reason?: string }> {
  const longTermDir = join(storagePath, 'long_term');

  const profileEntries = await readEntriesFromFile(join(longTermDir, 'profile.md'));
  const preferencesEntries = await readEntriesFromFile(join(longTermDir, 'preferences.md'));
  const factsEntries = await readEntriesFromFile(join(longTermDir, 'facts.md'));

  const totalProfile = profileEntries.length + preferencesEntries.length;

  if (totalProfile > thresholds.profile) {
    return {
      needed: true,
      reason: `用户画像条目 (${totalProfile}) 超过阈值 (${thresholds.profile})`,
    };
  }

  if (factsEntries.length > thresholds.facts) {
    return {
      needed: true,
      reason: `事实条目 (${factsEntries.length}) 超过阈值 (${thresholds.facts})`,
    };
  }

  return { needed: false };
}
