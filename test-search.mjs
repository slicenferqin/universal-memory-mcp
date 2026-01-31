import { createMemoryManager } from './packages/core/dist/index.js';

const manager = createMemoryManager();
await manager.initialize();

console.log('Storage path:', manager.getStoragePath());

const results = await manager.search('universal-memory-mcp');
console.log('Search results:', results.length);
console.log(JSON.stringify(results, null, 2));
