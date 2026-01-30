/**
 * Recall and Quality Tests
 *
 * Tests the quality of semantic search results
 */

import { VectorStore } from './packages/core/dist/index.js'
import { createDefaultEmbeddingProvider } from './packages/core/dist/index.js'
import { join } from 'node:path'
import { homedir } from 'node:os'

async function testRecall() {
  console.log('🧪 Recall and Quality Tests\n')

  const provider = createDefaultEmbeddingProvider()
  const storagePath = join(homedir(), '.ai_memory')

  const vectorStore = new VectorStore({
    storagePath,
    dimensions: provider.dimensions,
  })

  const stats = vectorStore.getStats()
  console.log(`📊 Indexed documents: ${stats.totalDocuments}`)
  console.log(`   Indexed chunks: ${stats.totalChunks}\n`)

  if (stats.totalChunks === 0) {
    console.log('⚠️  No indexed documents. Please run test-indexing.mjs first.\n')
    vectorStore.close()
    return
  }

  // Test queries
  const testQueries = [
    {
      query: 'authentication',
      expectedKeywords: ['login', 'jwt', 'token', 'auth', 'session'],
      description: 'Authentication-related concepts',
    },
    {
      query: 'database',
      expectedKeywords: ['sql', 'sqlite', 'query', 'schema'],
      description: 'Database-related concepts',
    },
    {
      query: 'API design',
      expectedKeywords: ['rest', 'endpoint', 'http', 'api'],
      description: 'API design concepts',
    },
    {
      query: 'error handling',
      expectedKeywords: ['error', 'exception', 'try', 'catch'],
      description: 'Error handling patterns',
    },
  ]

  let totalRecall = 0
  let totalTests = 0

  for (const test of testQueries) {
    console.log(`🔍 Test: "${test.query}"`)
    console.log(`   Description: ${test.description}\n`)

    // Generate embedding and search
    const queryEmbedding = await provider.generate(test.query)
    const results = vectorStore.semanticSearch(queryEmbedding, 10)

    console.log(`   Found ${results.length} results:\n`)

    // Check each result for expected keywords
    let relevantCount = 0

    for (let i = 0; i < Math.min(5, results.length); i++) {
      const result = results[i]
      const contentLower = result.content.toLowerCase()

      const matchedKeywords = test.expectedKeywords.filter((kw) =>
        contentLower.includes(kw.toLowerCase())
      )

      const isRelevant = matchedKeywords.length > 0
      if (isRelevant) relevantCount++

      console.log(`   [${i + 1}] Score: ${result.score.toFixed(4)} | ${isRelevant ? '✅' : '❌'}`)
      console.log(`       Content: "${result.content.substring(0, 80)}..."`)
      if (matchedKeywords.length > 0) {
        console.log(`       Matched keywords: ${matchedKeywords.join(', ')}`)
      }
      console.log()
    }

    // Calculate recall
    const recall = relevantCount / Math.min(5, results.length)
    totalRecall += recall
    totalTests++

    console.log(
      `   Recall: ${(recall * 100).toFixed(1)}% (${relevantCount}/${Math.min(5, results.length)} relevant)\n`
    )
    console.log('   ' + '─'.repeat(60) + '\n')
  }

  // Overall results
  console.log('📊 Overall Results:\n')
  console.log(`   Average Recall: ${((totalRecall / totalTests) * 100).toFixed(1)}%`)
  console.log(`   Tests Passed: ${totalTests}/${testQueries.length}\n`)

  // Test semantic similarity
  console.log('🔍 Semantic Similarity Tests\n')

  const similarityTests = [
    ['user login', 'authentication'],
    ['database query', 'sql search'],
    ['API endpoint', 'REST route'],
  ]

  for (const [text1, text2] of similarityTests) {
    const emb1 = await provider.generate(text1)
    const emb2 = await provider.generate(text2)

    // Calculate cosine similarity
    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0

    for (let i = 0; i < emb1.length; i++) {
      dotProduct += emb1[i] * emb2[i]
      norm1 += emb1[i] * emb1[i]
      norm2 += emb2[i] * emb2[i]
    }

    const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2))

    console.log(`   "${text1}" ↔ "${text2}"`)
    console.log(`   Similarity: ${(similarity * 100).toFixed(1)}%\n`)
  }

  console.log('✅ Recall tests complete!')
  vectorStore.close()
}

testRecall().catch(console.error)
