/**
 * OpenAI Embedding Provider
 *
 * Models:
 * - text-embedding-3-small: 1536 dimensions, $0.02/1M tokens
 * - text-embedding-3-large: 3072 dimensions, $0.13/1M tokens
 */

export interface OpenAIConfig {
  apiKey?: string
  baseURL?: string
  model?: 'text-embedding-3-small' | 'text-embedding-3-large' | 'text-embedding-ada-002'
}

interface OpenAIEmbeddingRequest {
  input: string | string[]
  model: string
  dimensions?: number
}

interface OpenAIEmbeddingResponse {
  object: string
  data: Array<{
    object: string
    embedding: number[]
    index: number
  }>
  model: string
  usage: {
    prompt_tokens: number
    total_tokens: number
  }
}

export class OpenAIEmbeddingProvider {
  readonly name: string
  readonly dimensions: number
  private apiKey: string
  private baseURL: string
  private model: string

  constructor(config: OpenAIConfig = {}) {
    this.apiKey = config.apiKey || this.getApiKey()
    this.baseURL = config.baseURL || 'https://api.openai.com/v1'
    this.model = config.model || 'text-embedding-3-small'

    // Set dimensions based on model
    if (this.model === 'text-embedding-3-small') {
      this.dimensions = 1536
      this.name = 'openai-small'
    } else if (this.model === 'text-embedding-3-large') {
      this.dimensions = 3072
      this.name = 'openai-large'
    } else {
      this.dimensions = 1536
      this.name = 'openai-ada'
    }
  }

  /**
   * Get API key from environment
   */
  private getApiKey(): string {
    const key = process.env.OPENAI_API_KEY
    if (!key) {
      throw new Error('OPENAI_API_KEY environment variable required')
    }
    return key
  }

  /**
   * Generate embedding for a single text
   */
  async generate(text: string): Promise<number[]> {
    const url = `${this.baseURL}/embeddings`

    const requestBody: OpenAIEmbeddingRequest = {
      input: text,
      model: this.model,
    }

    // Add dimensions parameter for v3 models
    if (this.model.startsWith('text-embedding-3-')) {
      requestBody.dimensions = this.dimensions
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`OpenAI API error: ${response.status} - ${error}`)
      }

      const data = (await response.json()) as OpenAIEmbeddingResponse
      return data.data[0].embedding
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to generate embedding: ${error.message}`)
      }
      throw error
    }
  }

  /**
   * Generate embeddings for multiple texts
   */
  async generateBatch(texts: string[]): Promise<number[][]> {
    const url = `${this.baseURL}/embeddings`

    const requestBody: OpenAIEmbeddingRequest = {
      input: texts,
      model: this.model,
    }

    if (this.model.startsWith('text-embedding-3-')) {
      requestBody.dimensions = this.dimensions
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`OpenAI API error: ${response.status} - ${error}`)
      }

      const data = (await response.json()) as OpenAIEmbeddingResponse

      // Sort by index and return embeddings
      return data.data.sort((a, b) => a.index - b.index).map((item) => item.embedding)
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to generate batch embeddings: ${error.message}`)
      }
      throw error
    }
  }
}
