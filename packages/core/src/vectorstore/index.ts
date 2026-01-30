/**
 * Vector Store exports
 */

export { VectorStore } from './store.js'
export { IndexingPipeline } from './pipeline.js'

export type { VectorStoreConfig, VectorDocument } from './store.js'

// Rename to avoid conflict with types.ts
export type { SearchResult as VectorSearchResult } from './store.js'

export type { IndexingOptions, IndexingStats } from './pipeline.js'
