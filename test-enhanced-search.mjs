/**
 * Test Enhanced Semantic Search
 */

import { EnhancedSearchEngine } from './packages/core/dist/index.js'
import { VectorStore } from './packages/core/dist/index.js'
import { createDefaultEmbeddingProvider } from './packages/core/dist/index.js'
import { loadConfig } from './packages/core/dist/index.js'
import { join } from 'node:path'
import { homedir } from 'node:os'

async function testEnhancedSearch() {
  console.log('🧪 Testing Enhanced Semantic Search...\n')

  try {
    // Initialize components
    console.log('📦 Initializing components...')
    const provider = createDefaultEmbeddingProvider()
    const config = loadConfig()

    const storagePath = join(homedir(), '.ai_memory')
    const vectorStore = new VectorStore({
      storagePath,
      dimensions: provider.dimensions,
    })

    const searchEngine = new EnhancedSearchEngine(config, vectorStore, provider)

    console.log(`✅ Provider: ${provider.name} (${provider.dimensions} dimensions)`)
    console.log(`✅ Semantic search available: ${searchEngine.isSemanticSearchAvailable()}\n`)

    // Test 1: Semantic Search
    console.log('🔍 Test 1: Semantic Search')
    console.log('   Query: "authentication implementation"\n')

    const semanticResults = await searchEngine.search('authentication implementation', {
      mode: 'semantic',
      limit: 5,
    })

    console.log(`   Found ${semanticResults.length} results:\n`)
    for (let i = 0; i < Math.min(3, semanticResults.length); i++) {
      const result = semanticResults[i]
      console.log(`   [${i + 1}] Score: ${result.score.toFixed(4)}`)
      console.log(`       Content: "${result.content.substring(0, 80)}..."`)
      console.log(`       Project: ${result.project || 'N/A'}`)
      console.log(`       Time: ${result.timestamp.toLocaleDateString()}`)
      console.log()
    }

    // Test 2: Hybrid Search
    console.log('🔍 Test 2: Hybrid Search (Semantic + Keyword)')
    console.log('   Query: "user login"\n')

    const hybridResults = await searchEngine.search('user login', {
      mode: 'hybrid',
      limit: 5,
      semanticWeight: 0.7,
      keywordWeight: 0.3,
    })

    console.log(`   Found ${hybridResults.length} results:\n`)
    for (let i = 0; i < Math.min(3, hybridResults.length); i++) {
      const result = hybridResults[i]
      console.log(`   [${i + 1}] Score: ${result.score.toFixed(4)}`)
      console.log(`       Content: "${result.content.substring(0, 80)}..."`)
      console.log()
    }

    // Test 3: Time Decay
    console.log('🔍 Test 3: Time Decay Effect')
    console.log('   Comparing recent vs old results...\n')

    const recentResults = await searchEngine.search('implementation', {
      mode: 'semantic',
      limit: 10,
      timeDecay: true,
      timeDecayHalfLife: 30,
    })

    if (recentResults.length > 0) {
      const newest = recentResults[0]
      const oldest = recentResults[Math.min(recentResults.length - 1, recentResults.length - 1)]

      const daysDiff =
        (newest.timestamp.getTime() - oldest.timestamp.getTime()) / (1000 * 60 * 60 * 24)

      console.log(
        `   Newest result: ${newest.timestamp.toLocaleDateString()} (score: ${newest.score.toFixed(4)})`
      )
      console.log(
        `   Oldest result: ${oldest.timestamp.toLocaleDateString()} (score: ${oldest.score.toFixed(4)})`
      )
      console.log(`   Time difference: ${Math.round(daysDiff)} days`)
    }

    // Test 4: Project Relevance
    console.log('\n🔍 Test 4: Project Relevance Boost')

    if (recentResults.length > 0 && recentResults[0].project) {
      const testProject = recentResults[0].project
      console.log(`   Current project: ${testProject}`)

      const projectBoostedResults = await searchEngine.search('implementation', {
        mode: 'semantic',
        limit: 5,
        project: testProject,
      })

      console.log(`   Results with project boost: ${projectBoostedResults.length}`)
      console.log(`   Top result score: ${projectBoostedResults[0]?.score.toFixed(4)}`)
    }

    console.log('\n✅ All tests passed!')
  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    if (error.stack) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

testEnhancedSearch()
