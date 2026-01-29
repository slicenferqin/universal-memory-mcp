/**
 * Extractor - 调用 Claude Code CLI 提取关键信息
 */

import { spawn } from 'node:child_process';
import type { Conversation } from './scanner.js';

export interface ExtractedInfo {
  category: 'decisions' | 'preferences' | 'facts' | 'contacts' | 'profile';
  content: string;
  confidence: number;
  sourceConversationId: string;
  timestamp: Date;
}

export interface ExtractionResult {
  decisions: ExtractedInfo[];
  preferences: ExtractedInfo[];
  facts: ExtractedInfo[];
  contacts: ExtractedInfo[];
  profile: ExtractedInfo[];  // 新增：用户画像
  raw?: string;
}

/**
 * 构建提取 prompt
 */
function buildExtractionPrompt(conversations: Conversation[]): string {
  const conversationText = conversations
    .map((c, i) => `
### 对话 ${i + 1} [ID: ${c.id}]
**时间**: ${c.timestamp.toISOString()}
**项目**: ${c.project || '未知'}

**用户**: ${c.userMessage.substring(0, 1500)}

**AI**: ${c.aiResponse.substring(0, 2000)}
`)
    .join('\n---\n');

  return `你是一个记忆整理助手。分析以下对话记录，提取重要信息。

## 对话记录

${conversationText}

## 提取规则

### 1. Decisions（重要决策）
- 技术选型、架构决策、版本发布、方案选择、Bug修复决策

### 2. Preferences（用户偏好）
- 编程偏好、工具偏好、工作风格偏好

### 3. Facts（关键事实）
- 项目信息、技术细节、版本信息

### 4. Contacts（联系人）
- 提到的人、团队或组织

### 5. Profile（用户画像）⭐ 重要
- **职业/角色**：如"全栈开发者"、"技术负责人"
- **技术栈**：如"TypeScript + React + Node.js"
- **专业领域**：如"AI/ML"、"前端开发"
- **沟通风格**：如"偏好简洁直接"、"中英文混用"
- **工作习惯**：如"喜欢先规划再实施"

## 输出格式

只输出 JSON，不要其他文字：

{
  "decisions": [{"content": "...", "confidence": 0.9, "sourceConversationId": "...", "timestamp": "..."}],
  "preferences": [],
  "facts": [],
  "contacts": [],
  "profile": []
}

## 注意
1. 只提取明确的信息，不要推测
2. 简洁表达，每条 1-2 句话
3. Profile 类别特别重要，用于建立用户画像

直接输出 JSON：`;
}

export interface ExtractOptions {
  verbose?: boolean;
  model?: 'haiku' | 'sonnet' | 'opus';
  batchSize?: number;
}

/**
 * 调用 Claude Code CLI 提取信息
 */
export async function extractWithClaudeCLI(
  conversations: Conversation[],
  options: ExtractOptions = {}
): Promise<ExtractionResult> {
  if (conversations.length === 0) {
    return { decisions: [], preferences: [], facts: [], contacts: [], profile: [] };
  }

  // 分批处理，默认每批 5 条对话（减小批次提高速度）
  const batchSize = options.batchSize || 5;
  const batches: Conversation[][] = [];

  for (let i = 0; i < conversations.length; i += batchSize) {
    batches.push(conversations.slice(i, i + batchSize));
  }

  const allResults: ExtractionResult = {
    decisions: [],
    preferences: [],
    facts: [],
    contacts: [],
    profile: [],
  };

  console.log(`   总共 ${conversations.length} 条对话，分 ${batches.length} 批处理`);
  console.log(`   使用模型: ${options.model || 'default'}`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const startTime = Date.now();

    console.log(`   [${i + 1}/${batches.length}] 开始处理 ${batch.length} 条对话...`);

    try {
      const result = await extractBatch(batch, options);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log(`   [${i + 1}/${batches.length}] 完成 (${elapsed}s) - 提取: ${result.decisions.length}决策, ${result.preferences.length}偏好, ${result.facts.length}事实, ${result.profile.length}画像`);

      allResults.decisions.push(...result.decisions);
      allResults.preferences.push(...result.preferences);
      allResults.facts.push(...result.facts);
      allResults.contacts.push(...result.contacts);
      allResults.profile.push(...result.profile);
    } catch (error) {
      console.error(`   [${i + 1}/${batches.length}] 失败: ${(error as Error).message}`);
      // 继续处理下一批
    }
  }

  return allResults;
}

/**
 * 提取单个批次
 */
async function extractBatch(
  conversations: Conversation[],
  options: ExtractOptions = {}
): Promise<ExtractionResult> {
  const prompt = buildExtractionPrompt(conversations);

  if (options.verbose) {
    console.log(`     [DEBUG] Prompt 长度: ${prompt.length} 字符`);
  }

  return new Promise((resolve, reject) => {
    const args = [
      '-p', prompt,
      '--output-format', 'json',  // 使用 json 而不是 stream-json（stream-json 在管道中有问题）
    ];

    // 添加模型参数
    if (options.model) {
      args.push('--model', options.model);
      if (options.verbose) {
        console.log(`     [DEBUG] 使用模型: ${options.model}`);
      }
    }

    if (options.verbose) {
      console.log(`     [DEBUG] 启动 Claude CLI...`);
    }

    // 复制环境变量但移除 Claude 相关的（避免嵌套 Claude 实例冲突）
    const cleanEnv = { ...process.env };
    delete cleanEnv.CLAUDECODE;
    delete cleanEnv.CLAUDE_CODE_ENTRYPOINT;

    const startTime = Date.now();
    const childProcess = spawn('claude', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: cleanEnv,
    });

    // 立即关闭 stdin
    childProcess.stdin.end();

    let stdout = '';
    let stderr = '';
    let lastDataTime = Date.now();

    // 定期检查进度
    const progressInterval = setInterval(() => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const sinceLastData = ((Date.now() - lastDataTime) / 1000).toFixed(0);
      if (options.verbose) {
        console.log(`     [DEBUG] 运行中... ${elapsed}s (最后数据: ${sinceLastData}s前, stdout: ${stdout.length}字节)`);
      }
    }, 10000); // 每10秒报告一次

    childProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      lastDataTime = Date.now();
    });

    childProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      lastDataTime = Date.now();
    });

    childProcess.on('close', (code) => {
      clearInterval(progressInterval);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (options.verbose) {
        console.log(`     [DEBUG] Claude CLI 退出 (code=${code}, ${elapsed}s, stdout=${stdout.length}字节)`);
      }

      if (code !== 0) {
        if (stderr.includes('command not found') || stderr.includes('ENOENT')) {
          reject(new Error('Claude Code CLI 未安装或未登录。请先安装并登录 Claude Code。'));
          return;
        }
        reject(new Error(`Claude CLI 退出码 ${code}: ${stderr}`));
        return;
      }

      try {
        const result = parseExtractionResult(stdout, conversations);
        resolve(result);
      } catch (error) {
        if (options.verbose) {
          console.log('     [DEBUG] Raw output:', stdout.substring(0, 500));
        }
        reject(new Error(`解析提取结果失败: ${error}`));
      }
    });

    childProcess.on('error', (error) => {
      clearInterval(progressInterval);
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error('Claude Code CLI 未安装。请先运行: curl -fsSL https://claude.ai/install.sh | bash'));
      } else {
        reject(new Error(`启动 Claude CLI 失败: ${error.message}`));
      }
    });
  });
}

/**
 * 解析提取结果
 */
function parseExtractionResult(
  output: string,
  conversations: Conversation[]
): ExtractionResult {
  const lines = output.trim().split('\n');

  // 尝试从 stream-json 格式解析
  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const data = JSON.parse(line);

      // 如果是 result 类型
      if (data.type === 'result' && data.result) {
        const jsonMatch = data.result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return parseJsonResult(jsonMatch[0], conversations);
        }
      }

      // 如果是 assistant 消息
      if (data.type === 'assistant' && data.message?.content) {
        const content = data.message.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text' && block.text) {
              // 尝试提取 JSON
              const jsonMatch = block.text.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                try {
                  return parseJsonResult(jsonMatch[0], conversations);
                } catch {
                  continue;
                }
              }
            }
          }
        }
      }
    } catch {
      continue;
    }
  }

  // 尝试从整个输出中提取 JSON
  const jsonMatch = output.match(/\{[\s\S]*"decisions"[\s\S]*\}/);
  if (jsonMatch) {
    return parseJsonResult(jsonMatch[0], conversations);
  }

  // 返回空结果
  return { decisions: [], preferences: [], facts: [], contacts: [], profile: [] };
}

/**
 * 解析 JSON 结果
 */
function parseJsonResult(
  jsonStr: string,
  conversations: Conversation[]
): ExtractionResult {
  // 清理可能的 markdown 代码块
  let cleaned = jsonStr
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();

  const data = JSON.parse(cleaned);

  const processItems = (items: any[], category: string): ExtractedInfo[] => {
    if (!Array.isArray(items)) return [];

    return items
      .filter(item => item && item.content)
      .map((item) => {
        // 查找对应的对话来获取时间戳
        const conv = conversations.find(c => c.id === item.sourceConversationId);

        return {
          category: category as ExtractedInfo['category'],
          content: String(item.content || '').trim(),
          confidence: Number(item.confidence) || 0.8,
          sourceConversationId: String(item.sourceConversationId || ''),
          timestamp: conv?.timestamp || new Date(item.timestamp || Date.now()),
        };
      });
  };

  return {
    decisions: processItems(data.decisions || [], 'decisions'),
    preferences: processItems(data.preferences || [], 'preferences'),
    facts: processItems(data.facts || [], 'facts'),
    contacts: processItems(data.contacts || [], 'contacts'),
    profile: processItems(data.profile || [], 'profile'),
    raw: jsonStr,
  };
}

/**
 * 检查 Claude Code CLI 是否可用
 */
export async function checkClaudeCLI(): Promise<{ available: boolean; error?: string }> {
  return new Promise((resolve) => {
    const process = spawn('claude', ['--version'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve({ available: true });
      } else {
        resolve({ available: false, error: 'Claude Code CLI 未正确安装或未登录' });
      }
    });

    process.on('error', () => {
      resolve({ available: false, error: 'Claude Code CLI 未安装' });
    });
  });
}
