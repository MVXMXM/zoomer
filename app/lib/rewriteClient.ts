import type { ZoomOperation } from '@/app/types/zoom'

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter((word) => word.length > 0).length
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
    throw new Error(`Rewrite failed (${response.status})`)
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
