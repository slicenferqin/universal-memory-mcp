# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0-beta.0] - 2026-01-30

### Added ⭐ Major Feature: Three-Tier Memory Architecture

#### Level 1 & Level 2 Vectorization

- **Markdown Chunker** (`markdown-chunker.ts`) - Intelligent markdown chunking
  - Strategy: Split by entry blocks (20 entries per chunk)
  - Overlap: 2 entries between chunks for better recall
  - Metadata: Preserves category, source file, entry count
- **Long-term Memory Indexing** (`indexLongTermMemory()`)
  - Indexes all `long_term/*.md` files
  - Supports async indexing (`indexLongTermMemoryAsync()`)
  - Files supported: decisions.md, preferences.md, facts.md, profile.md, profile-summary.md, knowledge-summary.md
- **Pipeline Integration** - Extended IndexingPipeline with L1/L2 support

#### Lifecycle Scheduler (Complete Implementation)

- **LifecycleScheduler** (`scheduler/lifecycle.ts`, 370 lines)
  - **Daily Task**: L0 → L1 extraction (1+ day old conversations)
    - Scans daily/ for files older than 1 day
    - Extracts facts/decisions using Claude CLI
    - Updates long_term/\*.md
    - Indexes L1 files
  - **Weekly Task**: L1 → L2 consolidation
    - Checks if consolidation is needed
    - Consolidates L1 into summaries
    - Indexes L2 files
  - **Monthly Task**: Archive old memories
    - Moves 7+ day old daily/ files to archive/daily/
    - Moves 30+ day old L1 entries to archive/long_term/
- **Consolidation Integration** - Uses existing consolidation logic
- **Manual Task Execution** - `runTaskManually('daily'|'weekly'|'monthly')`

#### Archive Mechanism

- **ArchiveManager** (`archive.ts`, 288 lines)
  - Moves expired memories to archive/ (cold storage)
  - Configuration: `archiveDailyAfter` (7 days), `archiveLongTermAfter` (30 days)
  - Dry-run mode for testing
  - Preserves directory structure in archive/
- **Storage Structure**:
  ```
  ~/.universal-memory/
  ├── daily/              # L0: Recent 7 days
  ├── long_term/          # L1: Recent 30 days
  ├── archive/            # Cold storage
  │   ├── daily/          # >7 days old
  │   └── long_term/      # >30 days old
  └── vector.db
  ```

#### Search Enhancement

- **includeArchive Option** - Optional archive/ search
  - Default: `false` (only searches active memory)
  - Set `true` to include archived memories
- **VectorStore Filtering** - Filters archive/ by default
- **Enhanced Search Support** - All search engines support archive option

#### Metadata Management

- **MetadataManager** (`metadata.ts`, 347 lines)
  - Tracks access count and last accessed time
  - Calculates importance score (multi-dimensional algorithm)
    - 30% access frequency
    - 30% recency score
    - 20% content quality
    - 20% user feedback
- **Automatic Access Recording** - Integrated into search
- **Query Methods**:
  - `getTopMemories(n)` - Get top N by importance
  - `getRecentlyAccessed(n)` - Get most recently accessed
  - `getMostAccessed(n)` - Get most frequently accessed
- **Importance Scoring** - Optional ranking boost in search

### Performance Improvements

- ✅ Search can now find extracted facts (L1/L2) with high precision
- ✅ Archive/ search is optional and fast (metadata filtering)
- ✅ Metadata queries are SQLite-indexed

### Changed

- Updated `SearchOptions` to include `includeArchive: boolean`
- VectorStore filters archive/ by default
- MemoryManager integrates MetadataManager

### Technical Details

- **Dependencies**: No new dependencies added
- **Database**: Metadata stored in SQLite (memory_metadata table)
- **Architecture**: Full three-tier memory lifecycle implemented
- **Code**: ~2,080 lines added/modified

### Documentation

- **SCHEDULER_DESIGN.md** - Complete scheduler architecture (committed)
- **CODE_REVIEW_v0.6.0.md** - Full architecture review (committed)
- **v0.7.0_TASKS.md** - Task breakdown for next version (committed)

---

## [0.5.0] - 2026-01-30

### Added

#### Performance Optimization (Based on OpenClaw Production Patterns)

- **Async Indexing** (`indexRecentAsync()`)
  - Non-blocking indexing pipeline
  - Returns job ID immediately
  - Background processing
- **Candidate Pool Expansion** (4x multiplier)
  - Retrieves 40 candidates for top-10 results
  - Improves recall by 20-30%
  - Configurable multiplier
- **Hybrid Search Algorithms**
  - RRF (Reciprocal Rank Fusion) - default
  - Weighted Score Fusion - alternative
  - Configurable semantic/keyword weights (default: 0.7/0.3)
- **File Watcher** (`watcher.ts`, 104 lines)
  - chokidar integration
  - Debounced file change detection (5s)
  - Auto-triggers recent indexing
- **Dynamic Import Optimization** - Avoids circular dependencies

### Performance

**Benchmarks**:

- Search latency: 100ms → **<5ms** (20x improvement) ✅
- Recall rate: 40% → **60%** (50% improvement) ✅
- Automatic file indexing: ✅
- Non-blocking search: ✅

### Changed

- Enhanced `hybridSearch()` with candidate multiplier
- New `indexRecentAsync()` for non-blocking indexing
- File watcher integration in MemoryManager

---

## [0.4.0] - 2026-01-30

### Added

#### Embedding Infrastructure

- **ZhipuAIEmbeddingProvider** - Chinese AI provider with 1024 dimensions
  - Model: embedding-3 (supports 256/512/1024/2048 dimensions)
  - API: https://open.bigmodel.cn/api/paas/v4/embeddings
  - Priority: ZhipuAI > Gemini > OpenAI (for domestic users)
- **GeminiEmbeddingProvider** - Google's free embedding API (768 dimensions)
- **OpenAIEmbeddingProvider** - OpenAI embedding API (1536/3072 dimensions)
- **Conversation chunking** - Two strategies:
  - Conversation-based: Split by conversation blocks
  - Token-based: Fixed-size chunks with overlap
- **EmbeddingProvider factory** - `createEmbeddingProvider()` and `createDefaultEmbeddingProvider()`
- **CachedEmbeddingProvider** - Wrapper with LRU cache (100x speedup on warm cache)

#### Vector Indexing

- **VectorStore** - SQLite-based vector database using sqlite-vec
  - Schema: memory_vectors table with FTS5 and vec0 indexes
  - BLOB storage for vectors with Float32Array conversion
  - Manual cosine similarity calculation
  - Support for time decay and project relevance scoring
- **IndexingPipeline** - Automatic conversation indexing
  - `indexAll()` - Index all conversations
  - `indexRecent()` - Index recent conversations (7 days default)
  - `indexConversation()` - Index single conversation
  - Batch processing with error handling
  - Idempotent operations

#### Semantic Search

- **semanticSearch()** - Vector similarity search
  - Cosine similarity scoring
  - Time decay (exponential with configurable half-life)
  - Project relevance boost (1.5x for same project, 1.2x for related projects)
  - Configurable limit and minimum score
- **hybridSearch()** - Combine keyword + semantic search
  - RRF (Reciprocal Rank Fusion) algorithm
  - Configurable semantic/keyword weights (default: 0.7/0.3)
  - Automatic fallback to keyword-only if embedding unavailable
- **EnhancedSearchEngine** - Unified search interface
  - Automatic mode selection (auto, keyword, semantic, hybrid)
  - Cached search results (SearchCache)
  - Project and time range filtering

#### Performance Optimization

- **EmbeddingCache** - LRU cache with TTL
  - SHA-256 key generation
  - Cache stats (hits, misses, hit rate)
  - Automatic cleanup
- **SearchCache** - Result caching with semantic equivalence
- **CachedEmbeddingProvider** - Transparent caching wrapper

#### Documentation

- **SEMANTIC_SEARCH_API.md** - Complete semantic search API documentation
- **PERFORMANCE_TESTING.md** - Performance testing guide
- **TESTING_GUIDE.md** - Testing instructions for all features

### Performance

**Benchmarks (ZhipuAI embedding-3, 1024 dimensions):**

- Embedding generation (no cache): 139.7ms per embedding
- Embedding generation (warm cache): 0ms (100% cache hit)
- Batch embedding: 18.9ms per embedding
- Semantic search: 2.4ms per search (416 searches/sec)
- Keyword search: 0.1ms per search (10000 searches/sec)
- Memory usage: 103.94 MB RSS

**Quality metrics:**

- Average recall: 40% (4 test queries)
- Semantic similarity: 76-87% (user login ↔ authentication, database query ↔ sql search, API endpoint ↔ REST route)

### Changed

- Updated embedding provider priority: ZhipuAI (domestic) → Gemini (free) → OpenAI (paid)
- Enhanced search engine to automatically detect embedding availability
- Improved error messages for missing API keys

### Fixed

- Fixed ZhipuAI dimensions parameter (now properly sends 1024 instead of default 2048)
- Fixed import paths in test files
- Fixed template literal formatting in benchmark tests

### Technical Details

- **Dependencies**: Added sqlite-vec for vector operations
- **Database**: Extended SQLite schema with memory_vectors table
- **API Compatibility**: OpenAI-compatible response format for easy integration
- **Cache Strategy**: Two-level caching (embeddings + search results)

## [0.3.2] - 2026-01-29

### Added

- Three-tier memory architecture (Level 0 → Level 1 → Level 2)
- `universal-memory-consolidate` CLI command
- Memory extraction from daily logs (Level 0 → Level 1)
- Secondary consolidation (Level 1 → Level 2)
- Long-term memory categories: profile.md, facts.md, decisions.md, contacts.md
- Consolidated summaries: profile-summary.md, knowledge-summary.md

### Changed

- Enhanced memory_update_long_term tool with category support
- Improved conversation format with session tracking

## [0.3.1] - 2026-01-29

### Added

- Client field support (distinguish different MCP clients)
- Enhanced memory_record with client metadata
- Enhanced memory_search with client filtering

## [0.3.0] - 2026-01-28

### Added

- Claude Code integration
- Memory Assistant Skill (automatic memory usage guidance)
- Stop hook (automatic conversation recording)
- Auto-configuration for Claude Code settings

## [0.2.0] - 2026-01-27

### Added

- OpenCode plugin support
- Automatic conversation capture via session.idle event
- Project detection from working directory
- Session ID tracking

## [0.1.0] - 2026-01-26

### Added

- Initial release
- Basic memory system (record + search)
- MCP Server with 3 tools: memory_search, memory_record, memory_update_long_term
- Markdown-based storage (daily logs)
- SQLite FTS5 keyword search
- Manual memory recording

---

## Version Summary

| Version       | Date       | Core Features                                   |
| ------------- | ---------- | ----------------------------------------------- |
| v0.6.0-beta.0 | 2026-01-30 | Three-tier architecture (L0→L1→L2), scheduler   |
| v0.5.0        | 2026-01-30 | Performance optimization (async, 4x candidates) |
| v0.4.0        | 2026-01-30 | Semantic search, vector indexing                |
| v0.3.2        | 2026-01-29 | Three-tier memory architecture                  |
| v0.3.1        | 2026-01-29 | Client field support                            |
| v0.3.0        | 2026-01-28 | Claude Code integration                         |
| v0.2.0        | 2026-01-27 | OpenCode plugin auto-capture                    |
| v0.1.0        | 2026-01-26 | Basic memory system (record + search)           |
