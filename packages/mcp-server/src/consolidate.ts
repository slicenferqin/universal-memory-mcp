#!/usr/bin/env node

/**
 * universal-memory-consolidate - 长期记忆自动整理 CLI
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import {
  scanDailyLogs,
  extractWithClaudeCLI,
  checkClaudeCLI,
  deduplicateResults,
  updateLongTermMemory,
  consolidateSummaries,
  shouldConsolidate,
} from './consolidation/index.js';

interface Options {
  days: number;
  dryRun: boolean;
  verbose: boolean;
  force: boolean;
  output?: string;
  model?: 'haiku' | 'sonnet' | 'opus';
  batchSize?: number;
  // 二次整合选项
  consolidateSummary: boolean;      // 提取后执行二次整合
  consolidateSummaryOnly: boolean;  // 仅执行二次整合（跳过提取）
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    days: 7,
    dryRun: false,
    verbose: false,
    force: false,
    model: 'haiku',  // 默认使用 haiku 加速
    batchSize: 5,    // 默认每批 5 条
    consolidateSummary: false,
    consolidateSummaryOnly: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    switch (arg) {
      case '--days':
        options.days = parseInt(argv[++i], 10) || 7;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--force':
      case '-f':
        options.force = true;
        break;
      case '--output':
      case '-o':
        options.output = argv[++i];
        break;
      case '--model':
      case '-m':
        options.model = argv[++i] as 'haiku' | 'sonnet' | 'opus';
        break;
      case '--batch-size':
        options.batchSize = parseInt(argv[++i], 10) || 5;
        break;
      case '--consolidate-summary':
        options.consolidateSummary = true;
        break;
      case '--consolidate-summary-only':
        options.consolidateSummaryOnly = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
universal-memory-consolidate - 自动整理长期记忆

使用方法:
  universal-memory-consolidate [选项]

选项:
  --days <n>        整理最近 N 天的对话（默认: 7）
  --model, -m       使用的模型: haiku/sonnet/opus（默认: haiku）
  --batch-size      每批处理的对话数（默认: 5）
  --dry-run         预览模式，不实际写入
  --verbose, -v     详细输出（含调试信息）
  --force, -f       强制重新处理已整理的对话
  --output, -o      输出提取结果到文件（JSON）
  --consolidate-summary       提取后执行二次整合（生成摘要）
  --consolidate-summary-only  仅执行二次整合（跳过提取步骤）
  --help, -h        显示帮助信息

示例:
  # 标准整理（Level 0 → Level 1）
  universal-memory-consolidate --days 7

  # 完整整理（Level 0 → Level 1 → Level 2）
  universal-memory-consolidate --days 7 --consolidate-summary

  # 仅二次整合（Level 1 → Level 2）
  universal-memory-consolidate --consolidate-summary-only

  # 预览模式
  universal-memory-consolidate --dry-run --verbose

三层记忆架构:
  Level 0: 感觉记忆 (daily/*.md)         - 原始对话流水
  Level 1: 短期记忆 (long_term/*.md)     - 提取的条目（带时间戳）
  Level 2: 长期记忆 (*-summary.md)       - 整合的结构化摘要

说明:
  此命令会分析最近的对话记录，使用 Claude Code CLI 提取
  重要信息（决策、偏好、事实、用户画像），并更新长期记忆文件。
  使用 --consolidate-summary 选项可进一步整合为结构化摘要。

  需要已安装并登录 Claude Code CLI。
`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const storagePath = process.env.MEMORY_PATH || join(homedir(), '.ai_memory');

  console.log('🧠 Universal Memory - 长期记忆整理\n');

  // 0. 检查 Claude CLI
  console.log('🔍 检查 Claude Code CLI...');
  const cliCheck = await checkClaudeCLI();
  if (!cliCheck.available) {
    console.error(`\n❌ ${cliCheck.error}`);
    console.error('\n请先安装并登录 Claude Code:');
    console.error('  curl -fsSL https://claude.ai/install.sh | bash');
    console.error('  claude login\n');
    process.exit(1);
  }
  console.log('   ✓ Claude Code CLI 可用\n');

  // 如果仅执行二次整合
  if (options.consolidateSummaryOnly) {
    console.log('📊 执行二次整合（Level 1 → Level 2）...\n');

    try {
      const result = await consolidateSummaries(storagePath, {
        verbose: options.verbose,
        model: options.model,
        dryRun: options.dryRun,
      });

      console.log('\n✅ 二次整合完成！');
      console.log(`   处理: ${result.stats.profileEntriesProcessed} 画像 + ${result.stats.preferencesEntriesProcessed} 偏好`);
      console.log(`         ${result.stats.factsEntriesProcessed} 事实 + ${result.stats.decisionsEntriesProcessed} 决策`);

      if (options.dryRun) {
        console.log('\n📝 [预览模式] 生成的摘要:\n');
        if (result.profileSummary) {
          console.log('--- profile-summary.md ---');
          console.log(result.profileSummary.substring(0, 1000) + '...\n');
        }
        if (result.knowledgeSummary) {
          console.log('--- knowledge-summary.md ---');
          console.log(result.knowledgeSummary.substring(0, 1000) + '...\n');
        }
      }
    } catch (error) {
      console.error(`\n❌ 二次整合失败: ${(error as Error).message}`);
      process.exit(1);
    }

    return;
  }

  // 1. 扫描 daily 日志
  console.log(`📂 扫描最近 ${options.days} 天的对话...`);

  const scanResult = await scanDailyLogs(storagePath, {
    days: options.days,
    force: options.force,
  });

  console.log(`   找到 ${scanResult.totalScanned} 条对话`);
  console.log(`   已跳过 ${scanResult.skipped} 条已整理的对话`);
  console.log(`   待处理 ${scanResult.conversations.length} 条新对话\n`);

  if (scanResult.conversations.length === 0) {
    console.log('✅ 没有新对话需要整理');

    // 检查是否需要二次整合
    if (options.consolidateSummary) {
      const check = await shouldConsolidate(storagePath);
      if (check.needed) {
        console.log(`\n📊 检测到需要二次整合: ${check.reason}`);
        await runSummaryConsolidation(storagePath, options);
      }
    }
    return;
  }

  // 2. 调用 Claude CLI 提取
  console.log('🤖 调用 Claude Code CLI 提取关键信息...');
  console.log(`   模型: ${options.model}, 批次大小: ${options.batchSize}\n`);

  let extracted;
  try {
    extracted = await extractWithClaudeCLI(scanResult.conversations, {
      verbose: options.verbose,
      model: options.model,
      batchSize: options.batchSize,
    });
  } catch (error) {
    console.error(`\n❌ 提取失败: ${(error as Error).message}`);
    process.exit(1);
  }

  const totalExtracted =
    extracted.decisions.length +
    extracted.preferences.length +
    extracted.facts.length +
    extracted.contacts.length +
    extracted.profile.length;

  console.log(`\n   提取到: ${extracted.decisions.length} 个决策`);
  console.log(`           ${extracted.preferences.length} 个偏好`);
  console.log(`           ${extracted.facts.length} 个事实`);
  console.log(`           ${extracted.contacts.length} 个联系人`);
  console.log(`           ${extracted.profile.length} 个用户画像\n`);

  // 保存原始提取结果（如果指定）
  if (options.output) {
    await writeFile(options.output, JSON.stringify(extracted, null, 2), 'utf-8');
    console.log(`   提取结果已保存到: ${options.output}\n`);
  }

  if (totalExtracted === 0) {
    console.log('✅ 没有提取到新的关键信息');
    return;
  }

  // 3. 去重
  console.log('🔍 去重...');

  const deduplicated = await deduplicateResults(extracted, storagePath);

  const totalAfterDedup =
    deduplicated.decisions.length +
    deduplicated.preferences.length +
    deduplicated.facts.length +
    deduplicated.contacts.length +
    deduplicated.profile.length;

  console.log(`   去除重复: ${deduplicated.duplicatesRemoved} 条`);
  console.log(`   保留: ${totalAfterDedup} 条\n`);

  if (totalAfterDedup === 0) {
    console.log('✅ 所有提取的信息都已存在于长期记忆中');
    return;
  }

  // 4. 预览或更新
  if (options.dryRun) {
    console.log('📝 [预览模式] 将添加以下内容:\n');

    if (deduplicated.decisions.length > 0) {
      console.log('## 决策');
      deduplicated.decisions.forEach(d => console.log(`  - ${d.content}`));
      console.log();
    }

    if (deduplicated.preferences.length > 0) {
      console.log('## 偏好');
      deduplicated.preferences.forEach(p => console.log(`  - ${p.content}`));
      console.log();
    }

    if (deduplicated.facts.length > 0) {
      console.log('## 事实');
      deduplicated.facts.forEach(f => console.log(`  - ${f.content}`));
      console.log();
    }

    if (deduplicated.contacts.length > 0) {
      console.log('## 联系人');
      deduplicated.contacts.forEach(c => console.log(`  - ${c.content}`));
      console.log();
    }

    if (deduplicated.profile.length > 0) {
      console.log('## 用户画像');
      deduplicated.profile.forEach(p => console.log(`  - ${p.content}`));
      console.log();
    }

    console.log('ℹ️  移除 --dry-run 参数以执行实际更新');
    return;
  }

  // 5. 更新长期记忆
  console.log('💾 更新长期记忆（Level 1）...');

  const processedIds = scanResult.conversations.map(c => c.id);
  await updateLongTermMemory(storagePath, deduplicated, processedIds);

  console.log('\n✅ Level 1 整理完成！');
  console.log(`   添加了 ${totalAfterDedup} 条新记录到长期记忆`);
  console.log(`   文件位置: ${join(storagePath, 'long_term', 'MEMORY.md')}`);

  // 6. 执行二次整合（如果指定）
  if (options.consolidateSummary) {
    await runSummaryConsolidation(storagePath, options);
  }
}

/**
 * 执行二次整合
 */
async function runSummaryConsolidation(
  storagePath: string,
  options: Options
): Promise<void> {
  console.log('\n📊 执行二次整合（Level 1 → Level 2）...');

  try {
    const result = await consolidateSummaries(storagePath, {
      verbose: options.verbose,
      model: options.model,
      dryRun: options.dryRun,
    });

    console.log('\n✅ 二次整合完成！');
    console.log(`   生成: profile-summary.md, knowledge-summary.md`);
    console.log(`   文件位置: ${join(storagePath, 'long_term')}`);
  } catch (error) {
    console.error(`\n⚠️ 二次整合失败: ${(error as Error).message}`);
    console.error('   Level 1 数据已保存，可稍后使用 --consolidate-summary-only 重试');
  }
}

main().catch((error) => {
  console.error('\n❌ 错误:', error.message);
  if (process.env.DEBUG) {
    console.error(error.stack);
  }
  process.exit(1);
});
