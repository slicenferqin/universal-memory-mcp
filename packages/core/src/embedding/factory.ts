/**
 * Embedding Provider Factory
 *
 * Creates embedding provider instances based on configuration
 */

import type { EmbeddingProvider } from '../types.js'
import { GeminiEmbeddingProvider } from './gemini.js'
import { OpenAIEmbeddingProvider } from './openai.js'
import { ZhipuAIEmbeddingProvider } from './zhipuai.js'

export interface CreateEmbeddingProviderOptions {
  type: 'gemini' | 'openai' | 'zhipuai'
  apiKey?: string
  model?: string
}

/**
 * Create an embedding provider instance
 */
export function createEmbeddingProvider(
  options: CreateEmbeddingProviderOptions
): EmbeddingProvider {
  switch (options.type) {
    case 'zhipuai':
      return new ZhipuAIEmbeddingProvider({
        apiKey: options.apiKey,
        model: options.model as 'embedding-3' | 'embedding-2',
      })

    case 'gemini':
      return new GeminiEmbeddingProvider({
        apiKey: options.apiKey,
      })

    case 'openai':
      return new OpenAIEmbeddingProvider({
        apiKey: options.apiKey,
        model: options.model as any,
      })

    default:
      throw new Error(`Unknown embedding provider type: ${options.type}`)
  }
}

/**
 * Create default embedding provider (prioritizes domestic options)
 */
export function createDefaultEmbeddingProvider(): EmbeddingProvider {
  // Try domestic providers first (ZhipuAI)
  if (process.env.ZHIPUAI_API_KEY || process.env.ZHIPU_API_KEY) {
    return new ZhipuAIEmbeddingProvider()
  }

  // Try Gemini (free)
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    return new GeminiEmbeddingProvider()
  }

  // Fall back to OpenAI
  if (process.env.OPENAI_API_KEY) {
    return new OpenAIEmbeddingProvider()
  }

  throw new Error(
    'No embedding provider API key found. Please set one of:\n' +
      '- ZHIPUAI_API_KEY (智谱AI, 推荐)\n' +
      '- GEMINI_API_KEY (Google)\n' +
      '- OPENAI_API_KEY (OpenAI)'
  )
}
