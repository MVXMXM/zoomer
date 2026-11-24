import type { ZoomDegree, ZoomOperation } from '@/app/types/zoom'

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
  return { start: from, end: to }
}

export function stitchRewrite(
  source: string,
  range: RewriteRange | null,
  replacement: string,
): string {
  if (!range) return replacement
  const selected = source.slice(range.start, range.end)
  const leadingSpace = selected.match(/^\s*/)?.[0] ?? ''
  const trailingSpace = selected.match(/\s*$/)?.[0] ?? ''
  let body = replacement.trim()
  if (!selected.trim().includes('\n')) {
    body = replacement.replace(/\s*\n+\s*/g, ' ').trim()
  }
  return source.slice(0, range.start) + leadingSpace + body + trailingSpace + source.slice(range.end)
}

export async function streamRewrite(
  text: string,
  operation: ZoomOperation,
  degree: ZoomDegree,
  onUpdate: (full: string) => void,
  options?: { boundaries?: { before: string; after: string }; signal?: AbortSignal; targetWords?: number; approximateTarget?: boolean },
): Promise<string> {
  const response = await fetch('/api/rewrite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: text,
      operation,
      degree,
      targetWords: options?.targetWords,
      approximateTarget: options?.approximateTarget,
      excerpt: Boolean(options?.boundaries),
      boundaries: options?.boundaries,
    }),
    signal: options?.signal,
  })

  if (response.status === 422) throw new RangeError(await response.text())
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
