/**
 * Embedding Provider Factory
 *
 * Creates embedding provider instances based on configuration
 */

import type { EmbeddingProvider } from '../types.js'
import { GeminiEmbeddingProvider } from './gemini.js'
import { OpenAIEmbeddingProvider } from './openai.js'

export interface CreateEmbeddingProviderOptions {
  type: 'gemini' | 'openai'
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
 * Create default embedding provider (prioritizes free options)
 */
export function createDefaultEmbeddingProvider(): EmbeddingProvider {
  // Try Gemini first (free)
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    return new GeminiEmbeddingProvider()
  }

  // Fall back to OpenAI
  if (process.env.OPENAI_API_KEY) {
    return new OpenAIEmbeddingProvider()
  }

  throw new Error(
    'No embedding provider API key found. Please set either:\n' +
      '- GEMINI_API_KEY (recommended, free tier available)\n' +
      '- OPENAI_API_KEY (paid)'
  )
}
