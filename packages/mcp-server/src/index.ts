#!/usr/bin/env node

/**
 * Universal Memory MCP Server
 *
 * 提供以下 MCP 工具：
 * - search_memory: 搜索历史对话记忆
 * - get_session_context: 获取会话上下文
 * - update_long_term_memory: 更新长期记忆
 * - record_conversation: 记录对话（通常自动调用）
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { createMemoryManager, type MemoryConfig } from '@universal-memory/core';

// 创建记忆管理器
const memoryManager = createMemoryManager();

// 创建 MCP Server
const server = new Server(
  {
    name: 'universal-memory-mcp',
    version: '0.0.1',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 定义工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_memory',
        description:
          '搜索历史对话记忆。用于回忆之前讨论过的内容、做过的决策、用户的偏好等。',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: '搜索关键词或问题',
            },
            time_range: {
              type: 'array',
              items: { type: 'string' },
              description: '时间范围 [开始日期, 结束日期]，格式：YYYY-MM-DD',
            },
            project: {
              type: 'string',
              description: '项目名称过滤',
            },
            limit: {
              type: 'number',
              description: '返回结果数量限制，默认 10',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_session_context',
        description:
          '获取会话上下文，包括最近的对话、长期记忆和项目状态。建议在每个会话开始时调用。',
        inputSchema: {
          type: 'object',
          properties: {
            include_recent_days: {
              type: 'number',
              description: '包含最近几天的对话，默认 2',
            },
            include_long_term: {
              type: 'boolean',
              description: '是否包含长期记忆，默认 true',
            },
            project: {
              type: 'string',
              description: '项目名称',
            },
          },
        },
      },
      {
        name: 'update_long_term_memory',
        description:
          '更新长期记忆。当发现重要的用户偏好、做出关键决策、或需要记住重要信息时调用。',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              enum: ['decisions', 'preferences', 'contacts', 'facts'],
              description: '记忆分类',
            },
            content: {
              type: 'string',
              description: '要记录的内容',
            },
          },
          required: ['category', 'content'],
        },
      },
      {
        name: 'record_conversation',
        description:
          '记录一段对话。通常由系统自动调用，但也可以手动调用来补充记录。',
        inputSchema: {
          type: 'object',
          properties: {
            user_message: {
              type: 'string',
              description: '用户消息',
            },
            ai_response: {
              type: 'string',
              description: 'AI 响应',
            },
            project: {
              type: 'string',
              description: '项目名称',
            },
            session_id: {
              type: 'string',
              description: '会话 ID',
            },
          },
          required: ['user_message', 'ai_response'],
        },
      },
    ],
  };
});

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'search_memory': {
        const { query, time_range, project, limit } = args as {
          query: string;
          time_range?: string[];
          project?: string;
          limit?: number;
        };

        const results = await memoryManager.search(query, {
          timeRange: time_range
            ? [new Date(time_range[0]), new Date(time_range[1])]
            : undefined,
          project,
          limit,
        });

        if (results.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `没有找到与 "${query}" 相关的记忆。`,
              },
            ],
          };
        }

        const formatted = results
          .map((r, i) => {
            const date = r.timestamp.toISOString().split('T')[0];
            const projectInfo = r.project ? ` [${r.project}]` : '';
            return `### 结果 ${i + 1}${projectInfo} (${date}, 相关度: ${(r.score * 100).toFixed(0)}%)\n\n${r.content}`;
          })
          .join('\n\n---\n\n');

        return {
          content: [
            {
              type: 'text',
              text: `找到 ${results.length} 条相关记忆：\n\n${formatted}`,
            },
          ],
        };
      }

      case 'get_session_context': {
        const { include_recent_days, include_long_term, project } = args as {
          include_recent_days?: number;
          include_long_term?: boolean;
          project?: string;
        };

        const context = await memoryManager.getSessionContext({
          includeRecentDays: include_recent_days,
          includeLongTerm: include_long_term,
          project,
        });

        let response = '# 会话上下文\n\n';

        if (context.longTermMemory) {
          response += '## 长期记忆\n\n' + context.longTermMemory + '\n\n';
        }

        if (context.projectState) {
          response += '## 项目状态\n\n' + context.projectState + '\n\n';
        }

        if (context.recentConversations.length > 0) {
          response += `## 最近对话 (${context.recentConversations.length} 条)\n\n`;
          for (const conv of context.recentConversations.slice(-5)) {
            const date = conv.context.timestamp.toISOString().split('T')[0];
            response += `### ${date}\n\n`;
            response += `**User:** ${conv.userMessage.slice(0, 200)}...\n\n`;
            response += `**AI:** ${conv.aiResponse.slice(0, 200)}...\n\n`;
          }
        } else {
          response += '## 最近对话\n\n_暂无最近对话记录_\n\n';
        }

        return {
          content: [
            {
              type: 'text',
              text: response,
            },
          ],
        };
      }

      case 'update_long_term_memory': {
        const { category, content } = args as {
          category: 'decisions' | 'preferences' | 'contacts' | 'facts';
          content: string;
        };

        await memoryManager.updateLongTermMemory(category, content);

        return {
          content: [
            {
              type: 'text',
              text: `已将以下内容添加到长期记忆 [${category}]:\n\n${content}`,
            },
          ],
        };
      }

      case 'record_conversation': {
        const { user_message, ai_response, project, session_id } = args as {
          user_message: string;
          ai_response: string;
          project?: string;
          session_id?: string;
        };

        const conversation = await memoryManager.recordConversation(
          user_message,
          ai_response,
          {
            project,
            sessionId: session_id,
          }
        );

        return {
          content: [
            {
              type: 'text',
              text: `对话已记录 (ID: ${conversation.id})`,
            },
          ],
        };
      }

      default:
        throw new Error(`未知工具: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `错误: ${message}`,
        },
      ],
      isError: true,
    };
  }
});

// 启动服务器
async function main() {
  // 初始化记忆系统
  await memoryManager.initialize();

  console.error('Universal Memory MCP Server starting...');
  console.error(`Storage path: ${memoryManager.getStoragePath()}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Universal Memory MCP Server running');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
