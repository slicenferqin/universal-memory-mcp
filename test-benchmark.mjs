/**
 * Performance Tests for Universal Memory
 */

import { VectorStore } from '../packages/core/dist/index.js';
import { createDefaultEmbeddingProvider, CachedEmbeddingProvider } from '../packages/core/dist/index.js';
import { IndexingPipeline } from '../packages/core/dist/index.js';
import { join } from 'node:path';
import { homedir } from 'node:os';

async function benchmark() {
  console.log('🧪 Performance Benchmarks\n');

  const provider = createDefaultEmbeddingProvider();
  const cachedProvider = new CachedEmbeddingProvider(provider, 1000);
  const storagePath = join(homedir(), '.ai_memory');
  
  const vectorStore = new VectorStore({
    storagePath,
    dimensions: provider.dimensions,
  });

  // Test 1: Embedding Generation Performance
  console.log('📊 Test 1: Embedding Generation');
  console.log('   Testing 10 embeddings...\n');
  
  const testTexts = [
    'This is a test of the embedding generation performance',
    'Authentication implementation in Node.js requires JWT tokens',
    'Vector search uses cosine similarity to find relevant documents',
    'Hybrid search combines semantic and keyword search results',
    'Time decay weighting boosts recent memories in search results',
    'Project relevance gives higher scores to current project matches',
    'Indexing pipeline automatically processes conversation logs',
    'SQLite with sqlite-vec provides efficient vector storage',
    'Chunking breaks long conversations into smaller pieces',
    'RRF algorithm merges multiple search result lists',
  ];

  let start, duration;

  // Without cache
  start = Date.now();
  for (const text of testTexts) {
    await provider.generate(text);
  }
  duration = Date.now() - start;
  console.log(`   ❌ No cache: ${duration}ms (${(duration / 10).toFixed(1)}ms per embedding)\n`);

  // With cache (first run - cache miss)
  start = Date.now();
  for (const text of testTexts) {
    await cachedProvider.generate(text);
  }
  duration = Date.now() - start;
  console.log(`   ✅ With cache (cold): ${duration}ms (${(duration / 10).toFixed(1)}ms per embedding)\n`);

  // With cache (second run - cache hit)
  start = Date.now();
  for (const text of testTexts) {
    await cachedProvider.generate(text);
  }
  duration = Date.now() - start;
  console.log(`   🚀 With cache (warm): ${duration}ms (${(duration / 10).toFixed(1)}ms per embedding)\n`);

  const cacheStats = cachedProvider.getCacheStats();
  console.log(`   Cache stats: ${cacheStats.hitRate.toFixed(1)}% hit rate (${cacheStats.hits}/${cacheStats.hits + cacheStats.misses})\n`);

  // Test 2: Batch Embedding Performance
  console.log('📊 Test 2: Batch Embedding');
  console.log('   Testing batch of 10 embeddings...\n');

  start = Date.now();
  await provider.generateBatch(testTexts);
  duration = Date.now() - start;
  console.log(`   Batch (no cache): ${duration}ms (${(duration / 10).toFixed(1)}ms per embedding)\n`);

  start = Date.now();
  await cachedProvider.generateBatch(testTexts);
  duration = Date.now() - start;
  console.log(`   Batch (cached): ${duration}ms (${(duration / 10).toFixed(1)}ms per embedding)\n`);

  // Test 3: Vector Search Performance
  console.log('📊 Test 3: Vector Search Performance\n');

  const stats = vectorStore.getStats();
  console.log(`   Indexed documents: ${stats.totalDocuments}`);
  console.log(`   Indexed chunks: ${stats.totalChunks}\n`);

  if (stats.totalChunks > 0) {
    const queryEmbedding = await provider.generate('authentication implementation');

    // Warm-up
    for (let i = 0; i < 3; i++) {
      vectorStore.semanticSearch(queryEmbedding, 10);
    }

    // Benchmark
    const iterations = 10;
    start = Date.now();
    for (let i = 0; i < iterations; i++) {
      vectorStore.semanticSearch(queryEmbedding, 10);
    }
    duration = Date.now() - start;
    
    console.log(`   Semantic search (${iterations} iterations):`);
    console.log(`   Total: ${duration}ms`);
    console.log(`   Average: ${(duration / iterations).toFixed(1)}ms per search`);
    console.log(`   Throughput: ${(iterations / (duration / 1000)).toFixed(1)} searches/second\n`);

    // Test with different result sizes
    const limits = [5, 10, 20, 50];
    console.log('   Search performance by result limit:');
    for (const limit of limits) {
      start = Date.now();
      vectorStore.semanticSearch(queryEmbedding, limit);
      duration = Date.now() - start;
      console.log(`   Limit ${limit:2d}: ${duration}ms`);
    }
    console.log('');
  }

  // Test 4: Keyword Search Performance
  console.log('📊 Test 4: Keyword Search Performance\n');

  if (stats.totalChunks > 0) {
    const iterations = 10;
    
    // Warm-up
    for (let i = 0; i < 3; i++) {
      vectorStore.keywordSearch('authentication', 10);
    }

    // Benchmark
    start = Date.now();
    for (let i = 0; i < iterations; i++) {
      vectorStore.keywordSearch('authentication', 10);
    }
    duration = Date.now() - start;

    console.log(`   Keyword search (${iterations} iterations):`);
    console.log(`   Total: ${duration}ms`);
    console.log(`   Average: ${(duration / iterations).toFixed(1)}ms per search`);
    console.log(`   Throughput: ${(iterations / (duration / 1000)).toFixed(1)} searches/second\n`);
  }

  // Test 5: Memory Usage
  console.log('📊 Test 5: Memory Usage\n');
  
  const memUsage = process.memoryUsage();
  console.log(`   Heap Used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Heap Total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB\n`);

  console.log('✅ Benchmarks complete!');
  vectorStore.close();
}

benchmark().catch(console.error);
