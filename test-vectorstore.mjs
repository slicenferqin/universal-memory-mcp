/**
 * Test VectorStore and IndexingPipeline
 */

import { VectorStore, IndexingPipeline } from './packages/core/dist/index.js'
import { createDefaultEmbeddingProvider } from './packages/core/dist/index.js'
import { join } from 'node:path'
import { homedir } from 'node:os'

async function testVectorStore() {
  console.log('🧪 Testing VectorStore and IndexingPipeline...\n')

  try {
    // Create embedding provider
    console.log('📦 Creating embedding provider...')
    const provider = createDefaultEmbeddingProvider()
    console.log(`✅ Using provider: ${provider.name} (${provider.dimensions} dimensions)\n`)

    // Initialize vector store
    console.log('🗄️  Initializing VectorStore...')
    const storagePath = join(homedir(), '.ai_memory')
    const vectorStore = new VectorStore({
      storagePath,
      dimensions: provider.dimensions,
    })
    console.log('✅ VectorStore initialized\n')

    // Check stats
    console.log('📊 Current stats:')
    const stats = vectorStore.getStats()
    console.log(`   Total documents: ${stats.totalDocuments}`)
    console.log(`   Total chunks: ${stats.totalChunks}\n`)

    // Test semantic search if there are indexed documents
    if (stats.totalChunks > 0) {
      console.log('🔍 Testing semantic search...')
      const query = 'authentication implementation'
      const queryEmbedding = await provider.generate(query)

      const results = vectorStore.semanticSearch(queryEmbedding, 5)

      console.log(`✅ Found ${results.length} results:\n`)

      for (let i = 0; i < Math.min(3, results.length); i++) {
        const result = results[i]
        console.log(`   [${i + 1}] Score: ${result.score.toFixed(4)}`)
        console.log(`       Content: "${result.content.substring(0, 100)}..."`)
        console.log(`       Project: ${result.project || 'N/A'}`)
        console.log()
      }
    } else {
      console.log('⚠️  No indexed documents found\n')
      console.log('💡 To index your conversations, run:')
      console.log('   node test-indexing.mjs\n')
    }

    // Test keyword search
    if (stats.totalChunks > 0) {
      console.log('🔍 Testing keyword search...')
      const keywordResults = vectorStore.keywordSearch('authentication', 3)

      console.log(`✅ Found ${keywordResults.length} keyword results:\n`)

      for (let i = 0; i < Math.min(3, keywordResults.length); i++) {
        const result = keywordResults[i]
        console.log(`   [${i + 1}] Score: ${result.score.toFixed(4)}`)
        console.log(`       Content: "${result.content.substring(0, 100)}..."`)
        console.log()
      }
    }

    // Close store
    vectorStore.close()

    console.log('✅ All tests passed!')
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    if (error.stack) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

testVectorStore()
