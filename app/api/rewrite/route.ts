import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: Request) {
  try {
    console.log('Rewrite API Route called')
    
    const body = await req.json()
    console.log('Request body:', body)
    
    const { prompt, operation, excerpt, context } = body
    
    if (!prompt) {
      console.log('No prompt provided')
      return new Response('Missing prompt', { status: 400 })
    }

    if (!operation || !['expand', 'contract'].includes(operation)) {
      console.log('Invalid or missing operation')
      return new Response('Missing or invalid operation. Must be "expand" or "contract"', { status: 400 })
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

    const systemPrompt = excerpt
      ? operation === 'expand'
        ? `The user highlighted a passage inside a larger piece of writing. Expand only that highlighted passage with more detail and clarity, about 25% longer. Reply with only the expanded passage — no quotes, no explanation, and do not rewrite or repeat the surrounding text. Keep it as a single paragraph unless the original used line breaks.${context ? `\n\nFull text (context only):\n${context}\n\nHighlighted passage:\n${prompt}` : `\n\nPassage:\n${prompt}`}`
        : `The user highlighted a passage inside a larger piece of writing. Distill only that highlighted passage to its core meaning, about 25% shorter. Reply with only the distilled passage — no quotes, no explanation, and do not rewrite or repeat the surrounding text. Keep it as a single paragraph unless the original used line breaks.${context ? `\n\nFull text (context only):\n${context}\n\nHighlighted passage:\n${prompt}` : `\n\nPassage:\n${prompt}`}`
      : operation === 'expand'
      ? `The user has provided you with text to be expanded on, meaning they'd like a version of the same text with more detail and clarity where the central ideas are expanded on in greater detail. Please rewrite their text in a form that is around 25% longer, it must be longer than the original text at all costs. Add multiple paragraphs if the text gets too long to be comfortably read in a single paragraph. Reply with only the expanded text, no introduction, explanation, or quotes. Text: ${prompt}`
      : `The user has provided you with text to be contracted, meaning they'd like a more concise version of the same text that is distilled down to its core concepts (less, but better). Please rewrite their text in a form that is around 25% shorter while maintaining the core meaning, it must be shorter than the original text at all costs. Combine multiple paragraphs into a single paragraph if a block of text gets too short to warrant its own paragraph. Reply with only the contracted text, no introduction, explanation, or quotes. Text: ${prompt}`

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
