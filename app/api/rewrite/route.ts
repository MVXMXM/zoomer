import { GoogleGenAI, ThinkingLevel } from '@google/genai'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    
    const { prompt, operation, excerpt, context } = body
    
    if (!prompt) {
      console.log('No prompt provided')
      return new Response('Missing prompt', { status: 400 })
    }

    if (!operation || !['expand', 'contract'].includes(operation)) {
      console.log('Invalid or missing operation')
      return new Response('Missing or invalid operation. Must be "expand" or "contract"', { status: 400 })
    }

    if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
      return new Response('Gemini API key not configured. Set GEMINI_API_KEY in .env.local.', { status: 500 })
    }

    const gemini = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    })

    const systemPrompt = excerpt
      ? operation === 'expand'
        ? `The user highlighted a passage inside a larger piece of writing. Expand only that highlighted passage with more detail and clarity, about 25% longer. Reply with only the expanded passage — no quotes, no explanation, and do not rewrite or repeat the surrounding text. Keep it as a single paragraph unless the original used line breaks.${context ? `\n\nFull text (context only):\n${context}\n\nHighlighted passage:\n${prompt}` : `\n\nPassage:\n${prompt}`}`
        : `The user highlighted a passage inside a larger piece of writing. Distill only that highlighted passage to its core meaning, about 25% shorter. Reply with only the distilled passage — no quotes, no explanation, and do not rewrite or repeat the surrounding text. Keep it as a single paragraph unless the original used line breaks.${context ? `\n\nFull text (context only):\n${context}\n\nHighlighted passage:\n${prompt}` : `\n\nPassage:\n${prompt}`}`
      : operation === 'expand'
      ? `The user has provided you with text to be expanded on, meaning they'd like a version of the same text with more detail and clarity where the central ideas are expanded on in greater detail. Please rewrite their text in a form that is around 25% longer, it must be longer than the original text at all costs. Add multiple paragraphs if the text gets too long to be comfortably read in a single paragraph. Reply with only the expanded text, no introduction, explanation, or quotes. Text: ${prompt}`
      : `The user has provided you with text to be contracted, meaning they'd like a more concise version of the same text that is distilled down to its core concepts (less, but better). Please rewrite their text in a form that is around 25% shorter while maintaining the core meaning, it must be shorter than the original text at all costs. Combine multiple paragraphs into a single paragraph if a block of text gets too short to warrant its own paragraph. Reply with only the contracted text, no introduction, explanation, or quotes. Text: ${prompt}`

    const abortController = new AbortController()
    const abort = () => abortController.abort()
    req.signal.addEventListener('abort', abort, { once: true })
    if (req.signal.aborted) abort()

    let cancelled = false
    const stream = new ReadableStream({
      async start(controller) {
        let receivedText = false
        try {
          const response = await gemini.models.generateContentStream({
            model: 'gemini-3.5-flash-lite',
            contents: systemPrompt,
            config: {
              maxOutputTokens: 4096,
              thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
              abortSignal: abortController.signal,
            },
          })
          const encoder = new TextEncoder()
          for await (const chunk of response) {
            if (cancelled) break
            if (chunk.text) {
              receivedText = true
              controller.enqueue(encoder.encode(chunk.text))
            }
          }
          if (!cancelled) {
            if (!receivedText) throw new Error('Gemini returned no rewrite')
            controller.close()
          }
        } catch (error) {
          if (!cancelled) {
            console.error('Rewrite streaming error:', error)
            controller.error(error)
          }
        } finally {
          req.signal.removeEventListener('abort', abort)
        }
      },
      cancel() {
        cancelled = true
        abort()
        req.signal.removeEventListener('abort', abort)
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
