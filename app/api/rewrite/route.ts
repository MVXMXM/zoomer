import OpenAI from 'openai'
import { wordCount } from '@/app/lib/rewriteClient'
import { zoomTargets } from '@/app/lib/zoomTargets'

const guidance = {
  expand: [
    'Make a light expansion. Add a brief clarification while keeping the original scope and structure.',
    'Develop the main ideas with additional explanation and relevant detail.',
    'Substantially develop the main ideas. Add concrete explanations, examples, or implications supported by the passage. Avoid repetition and invented facts.',
  ],
  contract: [
    'Make a light edit. Trim redundant words while retaining nearly all details and nuances.',
    'Tighten the prose and combine overlapping points. Keep the main claims and important supporting details.',
    'Produce a compact distillation. Keep the central message and essential qualifications. Drop secondary examples, repetition, and supporting detail.',
  ],
}

export async function POST(req: Request) {
  try {
    console.log('Rewrite API Route called')
    
    const body = await req.json()
    console.log('Request body:', body)
    
    const { prompt, operation, degree = 2, excerpt, context, boundaries } = body
    const hasBoundaries = typeof boundaries?.before === 'string' && typeof boundaries?.after === 'string'
    
    if (typeof prompt !== 'string' || !prompt.trim()) {
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

    if (!process.env.OPENAI_API_KEY) {
      console.error('Missing OPENAI_API_KEY')
      return new Response('API key not configured', { status: 500 })
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    console.log('Using prompt:', prompt.substring(0, 100) + '...')
    console.log('Operation:', operation)

    const sourceWords = wordCount(prompt)
    const stop = zoomTargets(sourceWords).find((stop) => stop.operation === operation && stop.degree === degree)
    if (!stop) return new Response('Zoom stop unavailable for this passage', { status: 400 })
    const { target: targetWords, min: minWords, max: maxWords } = stop

    const instructions = [
      `Rewrite only the passage. It contains ${sourceWords} words. Aim for exactly ${targetWords} words, within ${minWords}–${maxWords} words. Count words separated by whitespace and revise your draft to fit the budget before replying.`,
      guidance[operation === 'expand' ? 'expand' : 'contract'][degree - 1],
      'Preserve the core meaning and voice. Reply with only the rewritten passage, without a preamble, quotation marks around it, or a word-count report.',
      hasBoundaries
        ? 'The before and after fields are exact, unchanged text on either side of the selection. Read before + replacement + after as one continuous passage before answering. Make the replacement fit the existing sentence structure, capitalization, and punctuation at both joins. Continue a mid-sentence fragment as a fragment. Do not repeat neighboring words or punctuation or add a sentence ending if the sentence continues outside the selection. The editor preserves whitespace at the edges of the selected passage.'
        : excerpt ? 'Use surrounding text only for context.' : '',
      excerpt || hasBoundaries ? 'Keep the rewrite on one line if the selected passage, excluding edge whitespace, is on one line.' : '',
    ].filter(Boolean).join('\n')

    const input = hasBoundaries
      ? { before: boundaries.before, passage: prompt, after: boundaries.after }
      : { passage: prompt, ...(excerpt && context ? { surroundingText: context } : {}) }
    let previousAttempt: { draft: string; wordCount: number } | undefined
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await openai.responses.create({
        model: 'gpt-6-luna',
        reasoning: { effort: 'low' },
        max_output_tokens: 4096,
        instructions: previousAttempt === undefined
          ? instructions
          : `${instructions}\nThe previous draft had ${previousAttempt.wordCount} words and did not pass validation. Use it as a starting point if it fits the surrounding text. Adjust it toward ${targetWords} words and check the final count before submitting.`,
        input: JSON.stringify({ ...input, previousAttempt }),
      }, { signal: req.signal })
      const candidate = response.output_text.trim()
      const count = wordCount(candidate)
      if (response.status === 'completed' && count >= minWords && count <= maxWords) {
        return new Response(candidate, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' } })
      }
      previousAttempt = { draft: candidate, wordCount: count }
    }
    return new Response('The rewrite missed its target word count. Please try again.', { status: 422 })
  } catch (error) {
    console.error('API Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(`Internal Server Error: ${message}`, { status: 500 })
  }
}
