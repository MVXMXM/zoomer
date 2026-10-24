import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: Request) {
  try {
    console.log('Rewrite API Route called')
    
    const body = await req.json()
    console.log('Request body:', body)
    
    const { prompt, operation, degree = 2, excerpt, context } = body
    
    if (!prompt) {
      console.log('No prompt provided')
      return new Response('Missing prompt', { status: 400 })
    }

    if (!operation || !['expand', 'contract'].includes(operation)) {
      console.log('Invalid or missing operation')
      return new Response('Missing or invalid operation. Must be "expand" or "contract"', { status: 400 })
    }

    if (![1, 2, 3].includes(degree)) {
      return new Response('Invalid degree. Must be 1, 2, or 3', { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('Missing ANTHROPIC_API_KEY')
      return new Response('API key not configured', { status: 500 })
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    console.log('Using prompt:', prompt.substring(0, 100) + '...')
    console.log('Operation:', operation)

    const targetPercent = degree === 1 ? 10 : degree === 2 ? 25 : 50

    const systemPrompt = excerpt
      ? operation === 'expand'
        ? `The user highlighted a passage inside a larger piece of writing. Expand only that highlighted passage with more detail and clarity, about ${targetPercent}% longer. Reply with only the expanded passage — no quotes, no explanation, and do not rewrite or repeat the surrounding text. Keep it as a single paragraph unless the original used line breaks.${context ? `\n\nFull text (context only):\n${context}\n\nHighlighted passage:\n${prompt}` : `\n\nPassage:\n${prompt}`}`
        : `The user highlighted a passage inside a larger piece of writing. Distill only that highlighted passage to its core meaning, about ${targetPercent}% shorter. Reply with only the distilled passage — no quotes, no explanation, and do not rewrite or repeat the surrounding text. Keep it as a single paragraph unless the original used line breaks.${context ? `\n\nFull text (context only):\n${context}\n\nHighlighted passage:\n${prompt}` : `\n\nPassage:\n${prompt}`}`
      : operation === 'expand'
      ? `The user has provided text to expand. Rewrite it with more detail and clarity, targeting around ${targetPercent}% more words while preserving its meaning and voice. It must be longer than the original. Add paragraphs if needed for readability. Reply with only the expanded text, with no introduction, explanation, or quotes. Text: ${prompt}`
      : `The user has provided text to distill. Rewrite it around ${targetPercent}% shorter while preserving its core meaning and voice. It must be shorter than the original. Combine short paragraphs where appropriate. Reply with only the distilled text, with no introduction, explanation, or quotes. Text: ${prompt}`

    console.log('Calling Anthropic API...')

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 4096,
      messages: [{ role: 'user', content: systemPrompt }],
      stream: true,
    })

    console.log('API call successful, streaming response')
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              controller.enqueue(new TextEncoder().encode(chunk.delta.text))
            }
          }
          controller.close()
        } catch (error) {
          console.error('Streaming error:', error)
          controller.error(error)
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('API Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(`Internal Server Error: ${message}`, { status: 500 })
  }
}
