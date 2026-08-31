import type { ZoomOperation } from '@/app/types/zoom'

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter((word) => word.length > 0).length
}

function mockRewrite(text: string, operation: ZoomOperation): string {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return text
  if (operation === 'contract') {
    const keep = Math.max(1, Math.round(words.length * 0.75))
    return words.filter((_, i) => i === 0 || i % 4 !== 3).slice(0, keep).join(' ')
  }
  const extras = ['in clearer terms', 'with the surrounding context filled in']
  return `${text.trim()} ${extras[text.length % extras.length]}.`
}

async function streamString(text: string, onUpdate: (full: string) => void): Promise<string> {
  const parts = text.split(/(\s+)/)
  let result = ''
  for (const part of parts) {
    result += part
    onUpdate(result)
    await new Promise((resolve) => setTimeout(resolve, 16))
  }
  return result
}

export async function streamRewrite(
  text: string,
  operation: ZoomOperation,
  onUpdate: (full: string) => void,
): Promise<string> {
  const response = await fetch('/api/rewrite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: `"${text}"`, operation }),
  })

  if (!response.ok || !response.body) {
    return streamString(mockRewrite(text, operation), onUpdate)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let result = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    result += decoder.decode(value, { stream: true })
    onUpdate(result)
  }

  return result
}
