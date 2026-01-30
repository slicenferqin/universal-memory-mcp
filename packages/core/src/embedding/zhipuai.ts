/**
 * ZhipuAI (智谱AI) Embedding Provider
 *
 * Chinese AI company - ChatGLM embedding models
 *
 * API Docs: https://open.bigmodel.cn/dev/api
 */

export interface ZhipuAIConfig {
  apiKey?: string
  model?: 'embedding-3' | 'embedding-2'
}

interface ZhipuAIEmbeddingRequest {
  model: string
  input: string | string[]
  dimensions?: number
}

interface ZhipuAIEmbeddingResponse {
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

export class ZhipuAIEmbeddingProvider {
  readonly name: string
  readonly dimensions: number
  private apiKey: string
  private baseURL: string
  private model: string

  constructor(config: ZhipuAIConfig = {}) {
    this.apiKey = config.apiKey || this.getApiKey()
    this.baseURL = 'https://open.bigmodel.cn/api/paas/v4/embeddings'
    this.model = config.model || 'embedding-3'

    // Set dimensions based on model
    if (this.model === 'embedding-3') {
      this.dimensions = 1024
      this.name = 'zhipuai-embedding-3'
    } else {
      this.dimensions = 1024
      this.name = 'zhipuai-embedding-2'
    }
  }

  /**
   * Get API key from environment
   */
  private getApiKey(): string {
    const key = process.env.ZHIPUAI_API_KEY || process.env.ZHIPU_API_KEY
    if (!key) {
      throw new Error('ZHIPUAI_API_KEY or ZHIPU_API_KEY environment variable required')
    }
    return key
  }

  /**
   * Generate embedding for a single text
   */
  async generate(text: string): Promise<number[]> {
    const url = this.baseURL

    const requestBody: ZhipuAIEmbeddingRequest = {
      model: this.model,
      input: text,
      dimensions: this.dimensions,
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
        throw new Error(`ZhipuAI API error: ${response.status} - ${error}`)
      }

      const data = (await response.json()) as ZhipuAIEmbeddingResponse
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
    const url = this.baseURL

    const requestBody: ZhipuAIEmbeddingRequest = {
      model: this.model,
      input: texts,
      dimensions: this.dimensions,
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
        throw new Error(`ZhipuAI API error: ${response.status} - ${error}`)
      }

      const data = (await response.json()) as ZhipuAIEmbeddingResponse

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
