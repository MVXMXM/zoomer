import { alignWords } from '@/app/lib/inlineDiff'
import { tokenizeForLayout, type LayoutToken } from '@/app/lib/zoomLayout'
import type { RewriteRange } from '@/app/lib/rewriteClient'

export type ReviewWord = {
  id: string
  text: string
  trailing: string
  role: 'same' | 'add' | 'del'
  inScope: boolean
  oldIndex: number | null
  newIndex: number | null
}

export type ReviewLayout = {
  words: ReviewWord[]
  beforeTokens: LayoutToken[]
  afterTokens: LayoutToken[]
  beforeLead: string
  afterLead: string
  diffLead: string
}

function tokenEnd(token: LayoutToken) {
  return token.start + token.text.length
}

export function reviewLayout(before: string, after: string, range: RewriteRange | null): ReviewLayout {
  const bounds = range ?? { start: 0, end: before.length }
  const beforeLayout = tokenizeForLayout(before)
  const afterLayout = tokenizeForLayout(after)
  const beforeTokens = beforeLayout.tokens
  const afterTokens = afterLayout.tokens
  const suffixChars = before.length - bounds.end
  const afterSuffixStart = after.length - suffixChars

  const beforePrefix = beforeTokens.filter((token) => tokenEnd(token) <= bounds.start)
  const oldExcerpt = beforeTokens.filter((token) => tokenEnd(token) > bounds.start && token.start < bounds.end)
  const beforeSuffix = beforeTokens.filter((token) => token.start >= bounds.end)
  const afterPrefix = afterTokens.filter((token) => tokenEnd(token) <= bounds.start)
  const afterExcerpt = afterTokens.filter(
    (token) => tokenEnd(token) > bounds.start && token.start < afterSuffixStart,
  )

  const slots = alignWords(oldExcerpt, afterExcerpt)
  const words: ReviewWord[] = []

  beforePrefix.forEach((token, index) => {
    words.push({
      id: `b-${index}`,
      text: token.text,
      trailing: token.trailing,
      role: 'same',
      inScope: false,
      oldIndex: index,
      newIndex: index < afterPrefix.length ? index : null,
    })
  })

  for (const slot of slots) {
    const oldIndex = slot.oldOffset === null ? null : beforePrefix.length + slot.oldOffset
    const newIndex = slot.newOffset === null ? null : afterPrefix.length + slot.newOffset
    words.push({
      id: oldIndex !== null ? `b-${oldIndex}` : `n-${newIndex}`,
      text: slot.text,
      trailing: slot.trailing,
      role: slot.role,
      inScope: true,
      oldIndex,
      newIndex,
    })
  }

  const oldSuffixAt = beforePrefix.length + oldExcerpt.length
  const newSuffixAt = afterPrefix.length + afterExcerpt.length
  beforeSuffix.forEach((token, index) => {
    const newIndex = newSuffixAt + index
    words.push({
      id: `b-${oldSuffixAt + index}`,
      text: token.text,
      trailing: token.trailing,
      role: 'same',
      inScope: false,
      oldIndex: oldSuffixAt + index,
      newIndex: newIndex < afterTokens.length ? newIndex : null,
    })
  })

  return {
    words,
    beforeTokens,
    afterTokens,
    beforeLead: beforeLayout.lead,
    afterLead: afterLayout.lead,
    diffLead: beforeLayout.lead,
  }
}
