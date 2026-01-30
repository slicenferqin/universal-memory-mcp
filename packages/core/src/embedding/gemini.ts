/**
 * Gemini Embedding Provider
 *
 * Free tier: 1500 requests/day
 * Model: text-embedding-004 (768 dimensions)
 */

export interface GeminiConfig {
  apiKey?: string
  model?: 'text-embedding-004'
}

interface GeminiEmbeddingRequest {
  model: string
  content: {
    parts: {
      text: string
    }[]
  }[]
}

interface GeminiEmbeddingResponse {
  embedding: {
    values: number[]
  }
}

export class GeminiEmbeddingProvider {
  readonly name = 'gemini'
  readonly dimensions = 768
  private apiKey: string
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models'
  private model: string

  constructor(config: GeminiConfig = {}) {
    this.apiKey = config.apiKey || this.getApiKey()
    this.model = config.model || 'text-embedding-004'

    if (!this.apiKey) {
      throw new Error(
        'Gemini API key not found. Set GEMINI_API_KEY environment variable ' +
          'or pass it in config.'
      )
    }
  }

  /**
   * Get API key from environment
   */
  private getApiKey(): string {
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
    if (!key) {
      throw new Error('GEMINI_API_KEY or GOOGLE_API_KEY environment variable required')
    }
    return key
  }

  /**
   * Generate embedding for a single text
   */
  async generate(text: string): Promise<number[]> {
    const url = `${this.baseUrl}/${this.model}:embedContent?key=${this.apiKey}`

    const requestBody: GeminiEmbeddingRequest = {
      model: this.model,
      content: [
        {
          parts: [{ text }],
        },
      ],
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Gemini API error: ${response.status} - ${error}`)
      }

      const data = (await response.json()) as GeminiEmbeddingResponse
      return data.embedding.values
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to generate embedding: ${error.message}`)
      }
      throw error
    }
  }

  /**
   * Generate embeddings for multiple texts (batch processing)
   */
  async generateBatch(texts: string[]): Promise<number[][]> {
    // Gemini doesn't have a native batch endpoint, so we parallelize
    const promises = texts.map((text) => this.generate(text))
    return Promise.all(promises)
  }
}
