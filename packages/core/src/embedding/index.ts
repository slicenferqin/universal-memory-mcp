/**
 * Embedding providers
 */

export { GeminiEmbeddingProvider } from './gemini.js'
export { OpenAIEmbeddingProvider } from './openai.js'
export { createEmbeddingProvider, createDefaultEmbeddingProvider } from './factory.js'

export type { GeminiConfig } from './gemini.js'
export type { OpenAIConfig } from './openai.js'
