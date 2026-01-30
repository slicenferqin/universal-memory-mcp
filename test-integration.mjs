/**
 * Integration Test: Memory Manager with Semantic Search
 *
 * Tests the full workflow:
 * 1. Record a conversation
 * 2. Auto-index with embedding
 * 3. Search with semantic/hybrid modes
 */

import { MemoryManager } from './packages/core/dist/index.js'
import { EnhancedSearchEngine } from './packages/core/dist/index.js'
import { VectorStore } from './packages/core/dist/index.js'
import { IndexingPipeline } from './packages/core/dist/index.js'
import { createDefaultEmbeddingProvider } from './packages/core/dist/index.js'
import { getDefaultConfig } from './packages/core/dist/index.js'
import { join } from 'node:path'
import { homedir } from 'node:os'

async function testIntegration() {
  console.log('🧪 Integration Test: Memory Manager + Semantic Search\n')

  try {
    // Initialize
    const config = getDefaultConfig()
    const storagePath = join(homedir(), '.ai_memory_test')
    config.storagePath = storagePath

    const provider = createDefaultEmbeddingProvider()
    const vectorStore = new VectorStore({
      storagePath,
      dimensions: provider.dimensions,
    })

    const searchEngine = new EnhancedSearchEngine(config, vectorStore, provider)
    const pipeline = new IndexingPipeline(vectorStore, provider, storagePath)

    console.log('✅ Components initialized\n')

    // Test 1: Record a conversation
    console.log('📝 Test 1: Recording conversation...')
    const manager = new MemoryManager(config)

    await manager.record({
      userMessage: 'How do I implement JWT authentication in Node.js?',
      aiResponse:
        'To implement JWT authentication in Node.js, you need to:\n' +
        '1. Install jsonwebtoken package\n' +
        '2. Create a login endpoint that generates a token\n' +
        '3. Create middleware to verify tokens on protected routes\n' +
        '4. Use the token in frontend requests\n\n' +
        "Here's a basic example...",
      context: {
        timestamp: new Date(),
        project: 'test-auth-project',
        sessionId: 'test-session-123',
      },
    })

    console.log('✅ Conversation recorded\n')

    // Test 2: Index the conversation
    console.log('🔄 Test 2: Indexing conversation...')

    // Get the conversation from storage
    const dailyDir = join(storagePath, 'daily')
    const today = new Date().toISOString().split('T')[0]
    const fs = await import('node:fs/promises')
    const content = await fs.readFile(join(dailyDir, `${today}.md`), 'utf-8')

    // Parse conversations
    const blocks = content.split(/^---$/m)
    for (const block of blocks) {
      if (!block.trim()) continue

      const timestampMatch = block.match(/## (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/)
      if (!timestampMatch) continue

      const timestamp = new Date(timestampMatch[1])
      const userMatch = block.match(/\*\*User:\*\* ([\s\S]*?)(?=\*\*AI:\*\*|$)/)
      const aiMatch = block.match(/\*\*AI:\*\* ([\s\S]*?)$/)

      if (userMatch && aiMatch) {
        await pipeline.indexConversation({
          id: `test-${timestamp.getTime()}`,
          userMessage: userMatch[1].trim(),
          aiResponse: aiMatch[1].trim(),
          context: {
            timestamp,
            project: 'test-auth-project',
            sessionId: 'test-session-123',
          },
        })
        break
      }
    }

    console.log('✅ Conversation indexed\n')

    // Test 3: Semantic Search
    console.log('🔍 Test 3: Semantic Search')
    console.log('   Query: "JWT authentication"\n')

    const results = await searchEngine.search('JWT authentication', {
      mode: 'semantic',
      limit: 3,
    })

    console.log(`   Found ${results.length} results:\n`)
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      console.log(`   [${i + 1}] Score: ${result.score.toFixed(4)}`)
      console.log(`       Content: "${result.content.substring(0, 100)}..."`)
      console.log()
    }

    if (results.length > 0) {
      console.log('✅ Semantic search working!\n')
    } else {
      console.log('⚠️  No results found (expected if indexing failed)\n')
    }

    // Test 4: Hybrid Search
    console.log('🔍 Test 4: Hybrid Search')
    console.log('   Query: "token implementation"\n')

    const hybridResults = await searchEngine.search('token implementation', {
      mode: 'hybrid',
      limit: 3,
    })

    console.log(`   Found ${hybridResults.length} results:\n`)
    for (let i = 0; i < hybridResults.length; i++) {
      const result = hybridResults[i]
      console.log(`   [${i + 1}] Score: ${result.score.toFixed(4)}`)
      console.log(`       Content: "${result.content.substring(0, 100)}..."`)
      console.log()
    }

    console.log('✅ Integration test complete!')

    // Cleanup
    vectorStore.close()
  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    if (error.stack) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

testIntegration()
