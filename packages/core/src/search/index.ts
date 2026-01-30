/**
 * Search exports
 */

// Original search
export { SearchEngine, searchLongTermMemory } from '../search.js'

// Enhanced search
export { EnhancedSearchEngine } from './enhanced.js'
export {
  semanticSearch,
  hybridSearch,
  calculateTimeDecay,
  calculateProjectRelevance,
} from './semantic.js'

export type { SemanticSearchOptions } from './semantic.js'
