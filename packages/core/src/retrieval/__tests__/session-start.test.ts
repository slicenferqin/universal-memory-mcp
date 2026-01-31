/**
 * Tests for retrieval/session-start.ts
 *
 * Priority: P0 (High)
 * Coverage: Session start retrieval
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { retrieveOnSessionStart, type SessionStartContext } from '../session-start.js'

describe('Session Start Retrieval', () => {
  const storagePath = process.env.MEMORY_PATH || '/Users/slicenfer/.ai_memory'

  beforeAll(() => {
    console.log(`Using storage path: ${storagePath}`)
  })

  describe('基本召回', () => {
    it('应该召回用户画像', async () => {
      const result = await retrieveOnSessionStart(storagePath, {
        shouldGenerateGreeting: false,
      })

      expect(result.userProfile).toBeTruthy()
      expect(result.userProfile.length).toBeGreaterThan(0)
      console.log('用户画像长度:', result.userProfile.length)
      console.log('用户画像预览:', result.userProfile.substring(0, 200))
    })

    it('应该召回项目最近讨论', async () => {
      const result = await retrieveOnSessionStart(storagePath, {
        currentProject: 'universal-memory-mcp',
        shouldGenerateGreeting: false,
      })

      expect(result.projectRecent).toBeDefined()
      expect(Array.isArray(result.projectRecent)).toBe(true)
      console.log('项目最近讨论数量:', result.projectRecent.length)

      if (result.projectRecent.length > 0) {
        console.log('第一条:', result.projectRecent[0].content.substring(0, 100))
      }
    })

    it('应该召回全局最近讨论', async () => {
      const result = await retrieveOnSessionStart(storagePath, {
        shouldGenerateGreeting: false,
      })

      expect(result.globalRecent).toBeDefined()
      expect(Array.isArray(result.globalRecent)).toBe(true)
      console.log('全局最近讨论数量:', result.globalRecent.length)
    })
  })

  describe('开场白生成', () => {
    it('应该生成开场白（有项目）', async () => {
      const result = await retrieveOnSessionStart(storagePath, {
        currentProject: 'universal-memory-mcp',
        shouldGenerateGreeting: true,
        greetingModel: 'haiku',
      })

      expect(result.greeting).toBeTruthy()
      expect(result.greeting.length).toBeGreaterThan(0)
      console.log('生成的开场白:', result.greeting)
    }, 30000)

    it('应该生成开场白（无项目）', async () => {
      const result = await retrieveOnSessionStart(storagePath, {
        shouldGenerateGreeting: true,
        greetingModel: 'haiku',
      })

      expect(result.greeting).toBeTruthy()
      console.log('生成的开场白（无项目）:', result.greeting)
    }, 30000)

    it('应该处理空记忆情况', async () => {
      // 使用不存在的路径
      const result = await retrieveOnSessionStart('/tmp/nonexistent-memory', {
        shouldGenerateGreeting: true,
        greetingModel: 'haiku',
      })

      expect(result.greeting).toBeTruthy()
      console.log('空记忆开场白:', result.greeting)
    }, 30000)
  })

  describe('项目过滤', () => {
    it('应该按项目过滤讨论', async () => {
      const result1 = await retrieveOnSessionStart(storagePath, {
        currentProject: 'universal-memory-mcp',
        shouldGenerateGreeting: false,
      })

      const result2 = await retrieveOnSessionStart(storagePath, {
        currentProject: 'test-project',
        shouldGenerateGreeting: false,
      })

      console.log('universal-memory-mcp 项目讨论数量:', result1.projectRecent.length)
      console.log('test-project 项目讨论数量:', result2.projectRecent.length)

      // 两个项目的讨论应该不同（除非记忆很少）
      if (result1.projectRecent.length > 0 && result2.projectRecent.length > 0) {
        const content1 = result1.projectRecent[0].content
        const content2 = result2.projectRecent[0].content
        console.log('项目1第一条:', content1.substring(0, 80))
        console.log('项目2第一条:', content2.substring(0, 80))
      }
    })
  })
})
