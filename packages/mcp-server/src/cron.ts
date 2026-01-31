#!/usr/bin/env node

/**
 * universal-memory-cron - 定时任务管理 CLI
 */

import { execSync, spawnSync } from 'node:child_process';
import { platform } from 'node:os';

function printHelp(): void {
  console.log(`
universal-memory-cron - 管理长期记忆整理定时任务

使用方法:
  universal-memory-cron <command>

命令:
  install     安装定时任务（每天凌晨 2:00 运行）
  uninstall   卸载定时任务
  status      查看定时任务状态

示例:
  universal-memory-cron install
  universal-memory-cron uninstall
  universal-memory-cron status

说明:
  此命令用于管理 universal-memory-consolidate 的定时任务。
  安装后，系统会每天凌晨 2:00 自动运行记忆整理。

  支持的系统：macOS, Linux
  Windows 用户请使用 Task Scheduler 手动配置。
`);
}

function getCronJobLine(): string {
  // 每天凌晨 2:00 运行，整理前一天的对话
  return `0 2 * * * $(which universal-memory-consolidate) --days 1 >> ~/.ai_memory/consolidate.log 2>&1`;
}

function getCronMarker(): string {
  return '# universal-memory-consolidate';
}

function installCron(): void {
  const os = platform();

  if (os === 'win32') {
    console.log('❌ Windows 不支持自动安装 cron 任务');
    console.log('\n请使用 Task Scheduler 手动配置：');
    console.log('  1. 打开 Task Scheduler');
    console.log('  2. 创建基本任务');
    console.log('  3. 触发器：每天 2:00');
    console.log('  4. 操作：运行 universal-memory-consolidate --days 1');
    return;
  }

  // 检查是否已安装
  try {
    const currentCrontab = execSync('crontab -l 2>/dev/null', { encoding: 'utf-8' });
    if (currentCrontab.includes(getCronMarker())) {
      console.log('ℹ️  定时任务已存在');
      console.log('\n当前配置：');
      const lines = currentCrontab.split('\n').filter(l => l.includes('universal-memory'));
      lines.forEach(l => console.log(`  ${l}`));
      return;
    }
  } catch {
    // crontab 为空或不存在
  }

  // 安装新的 cron 任务
  const marker = getCronMarker();
  const cronJob = getCronJobLine();
  const newEntry = `${marker}\n${cronJob}`;

  try {
    // 获取现有 crontab
    let currentCrontab = '';
    try {
      currentCrontab = execSync('crontab -l 2>/dev/null', { encoding: 'utf-8' });
    } catch {
      // crontab 为空
    }

    // 添加新任务
    const newCrontab = currentCrontab.trim() + '\n' + newEntry + '\n';

    // 写入 crontab
    const result = spawnSync('crontab', ['-'], {
      input: newCrontab,
      encoding: 'utf-8',
    });

    if (result.status !== 0) {
      throw new Error(result.stderr || 'Unknown error');
    }

    console.log('✅ 定时任务已安装');
    console.log('\n配置详情：');
    console.log('  时间：每天凌晨 2:00');
    console.log('  命令：universal-memory-consolidate --days 1');
    console.log('  日志：~/.ai_memory/consolidate.log');
    console.log('\n查看：crontab -l | grep universal-memory');
  } catch (error) {
    console.error('❌ 安装失败:', (error as Error).message);
    console.log('\n请尝试手动安装：');
    console.log('  crontab -e');
    console.log(`  # 添加以下行：`);
    console.log(`  ${cronJob}`);
  }
}

function uninstallCron(): void {
  const os = platform();

  if (os === 'win32') {
    console.log('❌ Windows 请使用 Task Scheduler 手动删除任务');
    return;
  }

  try {
    const currentCrontab = execSync('crontab -l 2>/dev/null', { encoding: 'utf-8' });

    if (!currentCrontab.includes('universal-memory')) {
      console.log('ℹ️  没有找到相关的定时任务');
      return;
    }

    // 移除相关行
    const newCrontab = currentCrontab
      .split('\n')
      .filter(line => !line.includes('universal-memory'))
      .join('\n');

    // 写入 crontab
    const result = spawnSync('crontab', ['-'], {
      input: newCrontab,
      encoding: 'utf-8',
    });

    if (result.status !== 0) {
      throw new Error(result.stderr || 'Unknown error');
    }

    console.log('✅ 定时任务已卸载');
  } catch (error) {
    if ((error as Error).message.includes('no crontab')) {
      console.log('ℹ️  没有找到相关的定时任务');
    } else {
      console.error('❌ 卸载失败:', (error as Error).message);
    }
  }
}

function showStatus(): void {
  const os = platform();

  if (os === 'win32') {
    console.log('ℹ️  Windows 请使用 Task Scheduler 查看任务状态');
    return;
  }

  try {
    const currentCrontab = execSync('crontab -l 2>/dev/null', { encoding: 'utf-8' });
    const lines = currentCrontab.split('\n').filter(l =>
      l.includes('universal-memory') && !l.startsWith('#')
    );

    if (lines.length === 0) {
      console.log('ℹ️  未安装定时任务');
      console.log('\n运行以下命令安装：');
      console.log('  universal-memory-cron install');
    } else {
      console.log('✅ 定时任务已安装\n');
      console.log('当前配置：');
      lines.forEach(l => console.log(`  ${l}`));

      // 检查日志文件
      try {
        const logTail = execSync('tail -5 ~/.ai_memory/consolidate.log 2>/dev/null', { encoding: 'utf-8' });
        if (logTail.trim()) {
          console.log('\n最近日志：');
          console.log(logTail);
        }
      } catch {
        console.log('\n暂无运行日志');
      }
    }
  } catch {
    console.log('ℹ️  未安装定时任务');
    console.log('\n运行以下命令安装：');
    console.log('  universal-memory-cron install');
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'install':
      installCron();
      break;
    case 'uninstall':
      uninstallCron();
      break;
    case 'status':
      showStatus();
      break;
    case '--help':
    case '-h':
    case undefined:
      printHelp();
      break;
    default:
      console.error(`未知命令: ${command}`);
      console.log('运行 universal-memory-cron --help 查看帮助');
      process.exit(1);
  }
}

main();
