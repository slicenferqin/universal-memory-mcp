/**
 * File system storage implementation
 */

import { mkdir, readFile, writeFile, appendFile, readdir, unlink, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { glob } from 'node:fs/promises';
import type { StorageBackend } from './types.js';

/**
 * 本地文件系统存储后端
 */
export class LocalFileStorage implements StorageBackend {
  /**
   * 确保目录存在
   */
  private async ensureDir(filePath: string): Promise<void> {
    const dir = dirname(filePath);
    await mkdir(dir, { recursive: true });
  }

  /**
   * 读取文件
   */
  async read(path: string): Promise<string> {
    try {
      return await readFile(path, 'utf-8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return '';
      }
      throw error;
    }
  }

  /**
   * 写入文件
   */
  async write(path: string, content: string): Promise<void> {
    await this.ensureDir(path);
    await writeFile(path, content, 'utf-8');
  }

  /**
   * 追加内容
   */
  async append(path: string, content: string): Promise<void> {
    await this.ensureDir(path);
    await appendFile(path, content, 'utf-8');
  }

  /**
   * 列出文件
   */
  async list(pattern: string): Promise<string[]> {
    try {
      // Node.js 20+ 支持 glob
      const files: string[] = [];
      for await (const file of glob(pattern)) {
        files.push(file);
      }
      return files.sort();
    } catch {
      // Fallback: 简单目录遍历
      return [];
    }
  }

  /**
   * 删除文件
   */
  async delete(path: string): Promise<void> {
    try {
      await unlink(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * 检查文件是否存在
   */
  async exists(path: string): Promise<boolean> {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * 初始化存储目录结构
 */
export async function initializeStorage(storagePath: string): Promise<void> {
  const storage = new LocalFileStorage();

  // 创建目录结构
  const dirs = [
    join(storagePath, 'daily'),
    join(storagePath, 'long_term'),
    join(storagePath, 'projects'),
  ];

  for (const dir of dirs) {
    await mkdir(dir, { recursive: true });
  }

  // 创建初始长期记忆文件
  const memoryPath = join(storagePath, 'long_term', 'MEMORY.md');
  if (!(await storage.exists(memoryPath))) {
    await storage.write(
      memoryPath,
      `# Long-term Memory

This file contains important information extracted from conversations.

## User Preferences

_No preferences recorded yet._

## Important Decisions

_No decisions recorded yet._

## Key Facts

_No facts recorded yet._
`
    );
  }

  // 创建配置文件
  const configPath = join(storagePath, 'config.json');
  if (!(await storage.exists(configPath))) {
    await storage.write(
      configPath,
      JSON.stringify(
        {
          version: '1.0.0',
          createdAt: new Date().toISOString(),
        },
        null,
        2
      )
    );
  }
}
