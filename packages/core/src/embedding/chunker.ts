/**
 * Text chunking strategies for embedding generation
 */

export interface Chunk {
  id: string
  content: string
  metadata: {
    conversationId: string
    timestamp: Date
    project?: string
    client?: string
    sessionId: string
    chunkIndex: number
    totalChunks: number
  }
}

export interface ChunkOptions {
  maxChunkSize?: number // Maximum tokens per chunk (default: 2000)
  overlap?: number // Overlap between chunks (default: 0)
  strategy?: 'conversation' | 'token'
}

/**
 * Chunk a conversation into pieces suitable for embedding
 */
export function chunkConversation(
  conversation: {
    userMessage: string
    aiResponse: string
    id: string
    context: {
      timestamp: Date
      project?: string
      client?: string
      sessionId: string
    }
  },
  options: ChunkOptions = {}
): Chunk[] {
  const { maxChunkSize = 2000, overlap = 0, strategy = 'conversation' } = options

  // Combine user and AI messages
  const fullText = `User: ${conversation.userMessage}\n\nAI: ${conversation.aiResponse}`

  // Estimate token count (rough approximation: 1 token ≈ 4 characters)
  const estimatedTokens = Math.ceil(fullText.length / 4)

  // If within limit, return as single chunk
  if (estimatedTokens <= maxChunkSize) {
    return [
      {
        id: `${conversation.id}-chunk-0`,
        content: fullText,
        metadata: {
          conversationId: conversation.id,
          timestamp: conversation.context.timestamp,
          project: conversation.context.project,
          client: conversation.context.client,
          sessionId: conversation.context.sessionId,
          chunkIndex: 0,
          totalChunks: 1,
        },
      },
    ]
  }

  // Split into chunks
  if (strategy === 'conversation') {
    return chunkByConversation(conversation, maxChunkSize)
  } else {
    return chunkByTokens(conversation, maxChunkSize, overlap)
  }
}

/**
 * Chunk by conversation turns (preserves semantic boundaries)
 */
function chunkByConversation(
  conversation: {
    userMessage: string
    aiResponse: string
    id: string
    context: {
      timestamp: Date
      project?: string
      client?: string
      sessionId: string
    }
  },
  maxChunkSize: number
): Chunk[] {
  const chunks: Chunk[] = []

  // Check AI response length
  const aiTokens = Math.ceil(conversation.aiResponse.length / 4)

  if (aiTokens <= maxChunkSize) {
    // Single chunk
    chunks.push({
      id: `${conversation.id}-chunk-0`,
      content: `User: ${conversation.userMessage}\n\nAI: ${conversation.aiResponse}`,
      metadata: {
        conversationId: conversation.id,
        timestamp: conversation.context.timestamp,
        project: conversation.context.project,
        client: conversation.context.client,
        sessionId: conversation.context.sessionId,
        chunkIndex: 0,
        totalChunks: 1,
      },
    })
  } else {
    // Split AI response into paragraphs
    const paragraphs = conversation.aiResponse.split(/\n\n+/)
    const currentChunks: string[] = []
    let currentTokens = 0
    let chunkIndex = 0

    // Add user message to first chunk
    const userHeader = `User: ${conversation.userMessage}\n\nAI: `
    currentTokens += Math.ceil(userHeader.length / 4)
    currentChunks.push(userHeader)

    for (const paragraph of paragraphs) {
      const paraTokens = Math.ceil(paragraph.length / 4)

      if (currentTokens + paraTokens > maxChunkSize && currentChunks.length > 1) {
        // Start new chunk
        chunks.push({
          id: `${conversation.id}-chunk-${chunkIndex}`,
          content: currentChunks.join(''),
          metadata: {
            conversationId: conversation.id,
            timestamp: conversation.context.timestamp,
            project: conversation.context.project,
            client: conversation.context.client,
            sessionId: conversation.context.sessionId,
            chunkIndex,
            totalChunks: 0, // Will update at end
          },
        })

        chunkIndex++
        currentChunks.length = 0
        currentTokens = 0
      }

      currentChunks.push(paragraph + '\n\n')
      currentTokens += paraTokens
    }

    // Add last chunk
    if (currentChunks.length > 0) {
      chunks.push({
        id: `${conversation.id}-chunk-${chunkIndex}`,
        content: currentChunks.join(''),
        metadata: {
          conversationId: conversation.id,
          timestamp: conversation.context.timestamp,
          project: conversation.context.project,
          client: conversation.context.client,
          sessionId: conversation.context.sessionId,
          chunkIndex,
          totalChunks: 0,
        },
      })
    }
  }

  // Update totalChunks
  chunks.forEach((chunk) => {
    chunk.metadata.totalChunks = chunks.length
  })

  return chunks
}

/**
 * Chunk by token count (with optional overlap)
 */
function chunkByTokens(
  conversation: {
    userMessage: string
    aiResponse: string
    id: string
    context: {
      timestamp: Date
      project?: string
      client?: string
      sessionId: string
    }
  },
  maxChunkSize: number,
  overlap: number
): Chunk[] {
  const fullText = `User: ${conversation.userMessage}\n\nAI: ${conversation.aiResponse}`
  const chunks: Chunk[] = []

  // Simple character-based chunking (approximate tokens)
  const maxChars = maxChunkSize * 4
  const overlapChars = overlap * 4

  let startIndex = 0
  let chunkIndex = 0

  while (startIndex < fullText.length) {
    let endIndex = Math.min(startIndex + maxChars, fullText.length)

    // Try to break at word boundary
    if (endIndex < fullText.length) {
      const lastSpace = fullText.lastIndexOf(' ', endIndex)
      if (lastSpace > startIndex) {
        endIndex = lastSpace
      }
    }

    const chunkText = fullText.slice(startIndex, endIndex)

    chunks.push({
      id: `${conversation.id}-chunk-${chunkIndex}`,
      content: chunkText,
      metadata: {
        conversationId: conversation.id,
        timestamp: conversation.context.timestamp,
        project: conversation.context.project,
        client: conversation.context.client,
        sessionId: conversation.context.sessionId,
        chunkIndex,
        totalChunks: 0, // Will update at end
      },
    })

    startIndex = endIndex - overlapChars
    chunkIndex++
  }

  // Update totalChunks
  chunks.forEach((chunk) => {
    chunk.metadata.totalChunks = chunks.length
  })

  return chunks
}
