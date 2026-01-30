/**
 * Test script for embedding providers
 */

import { createDefaultEmbeddingProvider, chunkConversation } from './packages/core/dist/index.js'

async function testGeminiEmbedding() {
  console.log('🧪 Testing Gemini Embedding Provider...\n')

  try {
    const provider = createDefaultEmbeddingProvider()
    console.log(`✅ Created provider: ${provider.name}`)
    console.log(`   Dimensions: ${provider.dimensions}\n`)

    // Test single embedding
    console.log('📝 Testing single embedding...')
    const text = 'Hello, this is a test of the Gemini embedding API.'
    const embedding = await provider.generate(text)
    console.log(`✅ Generated embedding: ${embedding.length} dimensions`)
    console.log(
      `   Sample values: [${embedding
        .slice(0, 5)
        .map((v) => v.toFixed(4))
        .join(', ')}...]\n`
    )

    // Test batch embedding
    console.log('📝 Testing batch embedding...')
    const texts = ['This is the first text.', 'This is the second text.', 'This is the third text.']
    const embeddings = await provider.generateBatch(texts)
    console.log(`✅ Generated ${embeddings.length} embeddings`)
    console.log(`   Dimensions: ${embeddings.map((e) => e.length).join(', ')}\n`)

    // Test chunking
    console.log('📝 Testing conversation chunking...')
    const conversation = {
      userMessage: 'Can you explain how to implement user authentication in Node.js?',
      aiResponse:
        "Certainly! Here's a detailed explanation of implementing user authentication in Node.js. " +
        'There are several approaches you can take:\n\n' +
        "1. JWT (JSON Web Tokens): This is a stateless approach that's great for scalability. " +
        'The server creates a token and sends it to the client, who stores it and sends it with each request.\n\n' +
        '2. Session-based: Traditional approach using server-side sessions with cookies. ' +
        'Good for simplicity but requires session storage.\n\n' +
        '3. Passport.js: A middleware that provides 500+ strategies for authentication. ' +
        'Very flexible and widely used in the Node.js ecosystem.\n\n' +
        "I recommend JWT for modern applications, especially if you're building a REST API " +
        'or need to support multiple clients (web, mobile, etc.).',
      id: 'test-conv-1',
      context: {
        timestamp: new Date(),
        project: 'test-project',
        sessionId: 'session-123',
      },
    }

    const chunks = chunkConversation(conversation, { maxChunkSize: 500 })
    console.log(`✅ Created ${chunks.length} chunks:`)
    chunks.forEach((chunk, i) => {
      console.log(
        `   Chunk ${i}: ${Math.ceil(chunk.content.length / 4)} tokens, "${chunk.content.substring(0, 50)}..."`
      )
    })

    console.log('\n✅ All tests passed!')
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    process.exit(1)
  }
}

testGeminiEmbedding()
