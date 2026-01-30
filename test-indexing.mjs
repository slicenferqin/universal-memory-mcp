/**
 * Test Indexing Pipeline - Index all conversations
 */

import { VectorStore, IndexingPipeline } from './packages/core/dist/index.js'
import { createDefaultEmbeddingProvider } from './packages/core/dist/index.js'
import { join } from 'node:path'
import { homedir } from 'node:os'

async function testIndexing() {
  console.log('🧪 Testing IndexingPipeline...\n')

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

    // Check current stats
    console.log('📊 Current stats:')
    const beforeStats = vectorStore.getStats()
    console.log(`   Total documents: ${beforeStats.totalDocuments}`)
    console.log(`   Total chunks: ${beforeStats.totalChunks}\n`)

    // Create indexing pipeline
    console.log('🔄 Creating IndexingPipeline...')
    const pipeline = new IndexingPipeline(vectorStore, provider, storagePath)
    console.log('✅ Pipeline created\n')

    // Index recent conversations (last 7 days)
    console.log('📅 Indexing conversations from last 7 days...\n')
    const result = await pipeline.indexRecent(7, {
      batchSize: 5,
      skipIndexed: true,
      verbose: true,
    })

    // Print results
    console.log('\n📊 Indexing Results:')
    console.log(`   Total files: ${result.totalFiles}`)
    console.log(`   Total conversations: ${result.totalConversations}`)
    console.log(`   Total chunks: ${result.totalChunks}`)
    console.log(`   Indexed: ${result.indexedChunks}`)
    console.log(`   Skipped: ${result.skippedChunks}`)
    console.log(`   Errors: ${result.errors.length}`)

    if (result.errors.length > 0) {
      console.log('\n❌ Errors:')
      for (const error of result.errors.slice(0, 5)) {
        console.log(`   - ${error}`)
      }
      if (result.errors.length > 5) {
        console.log(`   ... and ${result.errors.length - 5} more`)
      }
    }

    // Check updated stats
    console.log('\n📊 Updated stats:')
    const afterStats = vectorStore.getStats()
    console.log(`   Total documents: ${afterStats.totalDocuments}`)
    console.log(`   Total chunks: ${afterStats.totalChunks}`)
    console.log(`   New documents: ${afterStats.totalDocuments - beforeStats.totalDocuments}`)
    console.log(`   New chunks: ${afterStats.totalChunks - beforeStats.totalChunks}`)

    // Close store
    vectorStore.close()

    console.log('\n✅ Indexing complete!')
  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    if (error.stack) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

testIndexing()
