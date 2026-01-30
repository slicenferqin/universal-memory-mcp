/**
 * Vector Search Quality Tests
 *
 * Tests precision, recall, and MRR (Mean Reciprocal Rank)
 */

import { VectorStore } from '../packages/core/dist/index.js'
import { createDefaultEmbeddingProvider } from '../packages/core/dist/index.js'
import { join } from 'node:path'
import { homedir } from 'node:os'

async function testVectorQuality() {
  console.log('🧪 Vector Search Quality Tests\n')

  const provider = createDefaultEmbeddingProvider()
  const storagePath = join(homedir(), '.ai_memory')

  const vectorStore = new VectorStore({
    storagePath,
    dimensions: provider.dimensions,
  })

  const stats = vectorStore.getStats()
  console.log(`📊 Total chunks: ${stats.totalChunks}\n`)

  if (stats.totalChunks < 10) {
    console.log('⚠️  Not enough data for quality tests. Need at least 10 chunks.\n')
    vectorStore.close()
    return
  }

  // Test queries with expected results
  const qualityTests = [
    {
      query: 'authentication',
      minExpectedScore: 0.7,
      description: 'Should find high-relevance authentication content',
    },
    {
      query: 'error handling',
      minExpectedScore: 0.6,
      description: 'Should find error handling patterns',
    },
    {
      query: 'implementation',
      minExpectedScore: 0.5,
      description: 'Generic query, lower score threshold',
    },
  ]

  const results = []

  for (const test of qualityTests) {
    console.log(`🔍 Test: "${test.query}"`)
    console.log(`   ${test.description}\n`)

    const queryEmbedding = await provider.generate(test.query)
    const searchResults = vectorStore.semanticSearch(queryEmbedding, 10)

    // Calculate metrics
    const topResults = searchResults.slice(0, 5)
    const relevantResults = topResults.filter((r) => r.score >= test.minExpectedScore)

    const precision = relevantResults.length / topResults.length
    const recall = relevantResults.length / Math.max(searchResults.length, 1)

    // MRR: 1/rank of first relevant result
    let mrr = 0
    for (let i = 0; i < searchResults.length; i++) {
      if (searchResults[i].score >= test.minExpectedScore) {
        mrr = 1 / (i + 1)
        break
      }
    }

    const avgScore = topResults.reduce((sum, r) => sum + r.score, 0) / topResults.length

    const metrics = {
      precision,
      recall,
      mrr,
      avgScore,
    }

    results.push(metrics)

    console.log(`   Results: ${searchResults.length} total, ${topResults.length} evaluated`)
    console.log(`   Precision: ${(precision * 100).toFixed(1)}%`)
    console.log(`   Recall: ${(recall * 100).toFixed(1)}%`)
    console.log(`   MRR: ${mrr.toFixed(3)}`)
    console.log(`   Avg Score: ${avgScore.toFixed(3)}\n`)

    // Show top 3 results
    console.log(`   Top 3 Results:`)
    for (let i = 0; i < Math.min(3, topResults.length); i++) {
      const result = topResults[i]
      const isRelevant = result.score >= test.minExpectedScore
      console.log(`   [${i + 1}] ${isRelevant ? '✅' : '❌'} Score: ${result.score.toFixed(4)}`)
      console.log(`       "${result.content.substring(0, 60)}..."`)
    }
    console.log('   ' + '─'.repeat(60) + '\n')
  }

  // Aggregate metrics
  const avgPrecision = results.reduce((sum, m) => sum + m.precision, 0) / results.length
  const avgRecall = results.reduce((sum, m) => sum + m.recall, 0) / results.length
  const avgMRR = results.reduce((sum, m) => sum + m.mrr, 0) / results.length
  const avgScore = results.reduce((sum, m) => sum + m.avgScore, 0) / results.length

  console.log('📊 Aggregate Quality Metrics:\n')
  console.log(`   Average Precision: ${(avgPrecision * 100).toFixed(1)}%`)
  console.log(`   Average Recall: ${(avgRecall * 100).toFixed(1)}%`)
  console.log(`   Average MRR: ${avgMRR.toFixed(3)}`)
  console.log(`   Average Score: ${avgScore.toFixed(3)}\n`)

  // Quality assessment
  console.log('🎯 Quality Assessment:\n')

  if (avgPrecision >= 0.8 && avgMRR >= 0.7) {
    console.log('   ✅ Excellent! High quality search results.\n')
  } else if (avgPrecision >= 0.6 && avgMRR >= 0.5) {
    console.log('   ✅ Good quality. Search is working well.\n')
  } else if (avgPrecision >= 0.4 && avgMRR >= 0.3) {
    console.log('   ⚠️  Moderate quality. Consider tuning relevance thresholds.\n')
  } else {
    console.log('   ❌ Low quality. May need to improve embeddings or indexing.\n')
  }

  console.log('✅ Quality tests complete!')
  vectorStore.close()
}

testVectorQuality().catch(console.error)
