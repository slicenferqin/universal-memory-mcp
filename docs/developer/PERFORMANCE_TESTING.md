# Performance Testing Guide

## Running Benchmarks

### Prerequisites

1. Install dependencies:

```bash
pnpm install
```

2. Build the project:

```bash
cd packages/core && pnpm build
```

3. Set up API key:

```bash
export GEMINI_API_KEY="your-api-key"
# or
export OPENAI_API_KEY="your-api-key"
```

4. Index your conversations:

```bash
node test-indexing.mjs
```

### Test Suite

Run all tests:

```bash
# 1. Basic functionality
node test-vectorstore.mjs

# 2. Indexing test
node test-indexing.mjs

# 3. Enhanced search
node test-enhanced-search.mjs

# 4. Performance benchmarks
node test-benchmark.mjs

# 5. Recall quality
node test-recall.mjs

# 6. Vector quality
node test-quality.mjs

# 7. Full integration
node test-integration.mjs
```

## Performance Benchmarks

### Expected Results (Gemini 768-dim)

```
📊 Test 1: Embedding Generation
   ❌ No cache: ~500-800ms for 10 embeddings (~50-80ms each)
   ✅ With cache (cold): ~500-800ms (same as no cache)
   🚀 With cache (warm): ~5-10ms for 10 embeddings (~0.5-1ms each)

📊 Test 2: Batch Embedding
   Batch (no cache): ~400-600ms for 10 embeddings (~40-60ms each)
   Batch (cached): ~5-10ms for 10 embeddings (~0.5-1ms each)

📊 Test 3: Vector Search Performance
   Average: ~20-50ms per search
   Throughput: ~20-50 searches/second

📊 Test 4: Keyword Search Performance
   Average: ~5-15ms per search
   Throughput: ~70-200 searches/second
```

### Factors Affecting Performance

1. **Network Latency**: First-time embedding generation depends on API speed
2. **Vector Count**: More indexed chunks = slower search
3. **Result Limit**: Higher limits = slower search
4. **Cache Hit Rate**: Warm cache = 100x faster embeddings

## Quality Metrics

### Expected Results

```
📊 Aggregate Quality Metrics:
   Average Precision: 70-90%
   Average Recall: 60-80%
   Average MRR: 0.5-0.8
   Average Score: 0.6-0.8
```

### Interpreting Results

- **Precision**: % of results that are relevant (higher is better)
- **Recall**: % of relevant results found (higher is better)
- **MRR (Mean Reciprocal Rank)**: 1/rank of first relevant result (closer to 1.0 is better)
- **Quality Assessment**:
  - 0.8+ precision & 0.7+ MRR = ✅ Excellent
  - 0.6+ precision & 0.5+ MRR = ✅ Good
  - 0.4+ precision & 0.3+ MRR = ⚠️ Moderate
  - Below 0.4 = ❌ Needs improvement

## Optimization Tips

### Improving Search Performance

1. **Use Smaller Embedding Dimension**:
   - Gemini (768) is faster than OpenAI-large (3072)
   - Trade-off: Slightly lower accuracy

2. **Limit Result Size**:

   ```typescript
   semanticSearch(query, { limit: 5 }) // Faster than limit: 50
   ```

3. **Add Filters**:

   ```typescript
   semanticSearch(query, {
     project: 'my-app', // Reduces search space
     client: 'claude-code',
   })
   ```

4. **Use Keyword Search for Exact Matches**:
   ```typescript
   // Fast path for known keywords
   if (isExactMatch) {
     return vectorStore.keywordSearch(query)
   }
   ```

### Improving Search Quality

1. **Tune Time Decay**:

   ```typescript
   // Recent conversations more important
   timeDecayHalfLife: 14 // Boost last 2 weeks
   ```

2. **Enable Project Relevance**:

   ```typescript
   projectRelevance: true,
   currentProject: getCurrentProject(), // 1.5x boost
   ```

3. **Adjust Hybrid Weights**:

   ```typescript
   // For technical queries, prefer semantic
   semanticWeight: 0.8,
   keywordWeight: 0.2,

   // For exact term matches, prefer keyword
   semanticWeight: 0.5,
   keywordWeight: 0.5,
   ```

4. **Improve Chunking**:
   ```typescript
   // Smaller chunks = more precise
   chunkConversation(conv, {
     maxChunkSize: 1000, // vs 2000 default
   })
   ```

### Reducing API Costs

1. **Enable Caching**:

   ```typescript
   const cachedProvider = new CachedEmbeddingProvider(provider, 1000)
   ```

2. **Batch Indexing**:

   ```typescript
   pipeline.indexRecent(7, {
     batchSize: 20, // Fewer API calls
   })
   ```

3. **Use Free Provider**:
   ```typescript
   // Gemini: 1500 requests/day free
   new GeminiEmbeddingProvider()
   ```

## Troubleshooting

### Low Search Quality

**Symptoms**: Precision < 0.5, MRR < 0.3

**Solutions**:

1. Check if data is indexed correctly
2. Verify embedding provider is working
3. Try different embedding provider (OpenAI vs Gemini)
4. Adjust time decay and relevance weights
5. Improve chunking strategy

### Slow Search Performance

**Symptoms**: > 100ms per search

**Solutions**:

1. Reduce indexed chunks (delete old data)
2. Lower result limit
3. Add project/client filters
4. Use smaller embedding dimension
5. Enable search result caching

### High API Costs

**Symptoms**: Large API bills

**Solutions**:

1. Enable embedding cache
2. Use Gemini instead of OpenAI
3. Batch more conversations per API call
4. Reduce re-indexing frequency
5. Use local embedding model (future feature)

## Continuous Monitoring

### Track These Metrics

```typescript
// Cache performance
const cacheStats = provider.getCacheStats()
console.log(`Hit rate: ${cacheStats.hitRate.toFixed(1)}%`)

// Search performance
const start = Date.now()
const results = await semanticSearch(query, options)
const duration = Date.now() - start
console.log(`Search took ${duration}ms`)

// Database size
const dbStats = vectorStore.getStats()
console.log(`Indexed: ${dbStats.totalChunks} chunks`)
```

### Set Up Alerts

Monitor for:

- Cache hit rate < 50%
- Search latency > 100ms
- Precision < 60%
- API errors > 5%

## Benchmark Comparison

### Vector Store Performance

| Operation                   | Time     | Throughput          |
| --------------------------- | -------- | ------------------- |
| Insert 1 doc                | 1-2ms    | 500-1000 docs/sec   |
| Insert 100 docs (batch)     | 50-100ms | 1000-2000 docs/sec  |
| Semantic search (10 chunks) | 20-50ms  | 20-50 searches/sec  |
| Keyword search (10 chunks)  | 5-15ms   | 70-200 searches/sec |

### Provider Comparison

| Provider     | Dimension | Speed  | Cost     | Quality   |
| ------------ | --------- | ------ | -------- | --------- |
| Gemini       | 768       | Fast   | Free     | Good      |
| OpenAI-small | 1536      | Fast   | $0.02/1M | Very Good |
| OpenAI-large | 3072      | Medium | $0.13/1M | Excellent |

## Next Steps

1. Run benchmarks on your dataset
2. Compare against expected results
3. Tune parameters based on your use case
4. Set up continuous monitoring
5. Iterate on optimization
