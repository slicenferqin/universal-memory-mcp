#!/usr/bin/env node

/**
 * Universal Memory MCP Server
 *
 * Provides MCP tools for persistent memory across AI sessions:
 * - memory_search: Search conversation history and long-term memories
 * - memory_record: Record conversations
 * - memory_update_long_term: Update long-term memory
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { createMemoryManager, type MemoryConfig } from 'universal-memory-core';

// Create memory manager
const memoryManager = createMemoryManager();

// Create MCP Server
const server = new Server(
  {
    name: 'universal-memory-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'memory_search',
        description: `Search through conversation history and long-term memories.

WHEN TO USE:
- When user asks about past discussions, decisions, or preferences
- When user references something "we talked about before"
- When you need context from previous sessions
- When user asks "what did we decide about X" or "remember when we..."
- When you need to know user preferences (search "preferences" or specific topic)

This searches across all recorded conversations and long-term memories.
Use specific keywords for better results (e.g., "TypeScript preferences", "database decision").`,
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search keywords or question',
            },
            time_range: {
              type: 'array',
              items: { type: 'string' },
              description: 'Time range [start_date, end_date], format: YYYY-MM-DD',
            },
            project: {
              type: 'string',
              description: 'Filter by project name',
            },
            limit: {
              type: 'number',
              description: 'Max results to return, default 10',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'memory_record',
        description: `Record the current conversation exchange for future reference.

WHEN TO USE:
- After EVERY meaningful conversation exchange
- When the conversation contains information worth remembering
- To ensure continuity across sessions

What to record:
- user_message: The user's question or request
- ai_response: Summary of your response (key points, not full text)

This builds memory over time, allowing recall of past discussions in future sessions.`,
        inputSchema: {
          type: 'object',
          properties: {
            user_message: {
              type: 'string',
              description: 'The user message/question',
            },
            ai_response: {
              type: 'string',
              description: 'Summary of your response (key points)',
            },
            project: {
              type: 'string',
              description: 'Project name if in a project context',
            },
            session_id: {
              type: 'string',
              description: 'Session ID for grouping related conversations',
            },
          },
          required: ['user_message', 'ai_response'],
        },
      },
      {
        name: 'memory_update_long_term',
        description: `Store important information in long-term memory for easy retrieval.

WHEN TO USE - Call this when you identify:
- User preferences (coding style, tools, communication preferences)
- Important decisions (architecture choices, technology selections)
- Key facts about user or their projects
- Contact information or team details

Categories:
- preferences: User's personal preferences and working style
- decisions: Important technical or project decisions
- facts: Key information about user, projects, or context
- contacts: People, teams, or organizations mentioned

Long-term memories are searchable via memory_search.`,
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              enum: ['decisions', 'preferences', 'contacts', 'facts'],
              description: 'Memory category',
            },
            content: {
              type: 'string',
              description: 'Content to remember',
            },
          },
          required: ['category', 'content'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'memory_search': {
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
                text: `No memories found matching "${query}".`,
              },
            ],
          };
        }

        const formatted = results
          .map((r, i) => {
            const date = r.timestamp.toISOString().split('T')[0];
            const projectInfo = r.project ? ` [${r.project}]` : '';
            return `### Result ${i + 1}${projectInfo} (${date}, relevance: ${(r.score * 100).toFixed(0)}%)\n\n${r.content}`;
          })
          .join('\n\n---\n\n');

        return {
          content: [
            {
              type: 'text',
              text: `Found ${results.length} relevant memories:\n\n${formatted}`,
            },
          ],
        };
      }

      case 'memory_record': {
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
              text: `Conversation recorded (ID: ${conversation.id})`,
            },
          ],
        };
      }

      case 'memory_update_long_term': {
        const { category, content } = args as {
          category: 'decisions' | 'preferences' | 'contacts' | 'facts';
          content: string;
        };

        await memoryManager.updateLongTermMemory(category, content);

        return {
          content: [
            {
              type: 'text',
              text: `Stored in long-term memory [${category}]:\n\n${content}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  // Initialize memory system
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
