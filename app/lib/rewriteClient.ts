import type { ZoomOperation } from '@/app/types/zoom'

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter((word) => word.length > 0).length
}

export type RewriteRange = {
  start: number
  end: number
}

export function selectionRange(source: string, start: number, end: number): RewriteRange | null {
  const from = Math.min(start, end)
  const to = Math.max(start, end)
  if (to <= from) return null
  if (!source.slice(from, to).trim()) return null
  if (from === 0 && to === source.length) return null
  return { start: from, end: to }
}

export function stitchRewrite(
  source: string,
  range: RewriteRange | null,
  replacement: string,
): string {
  if (!range) return replacement
  const selected = source.slice(range.start, range.end)
  let body = replacement
  // Triple-click includes a trailing newline; still keep a one-line rewrite.
  if (!selected.replace(/\n+$/, '').includes('\n')) {
    body = replacement.replace(/\s*\n+\s*/g, ' ').trim()
  }
  // Keep the following line separate when the highlight ate the break.
  if (selected.endsWith('\n') && !body.endsWith('\n')) body += '\n'
  return source.slice(0, range.start) + body + source.slice(range.end)
}

export async function streamRewrite(
  text: string,
  operation: ZoomOperation,
  onUpdate: (full: string) => void,
  options?: { excerpt?: boolean; context?: string },
): Promise<string> {
  const response = await fetch('/api/rewrite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: `"${text}"`,
      operation,
      excerpt: Boolean(options?.excerpt),
      context: options?.context,
    }),
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
