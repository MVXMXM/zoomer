export type DiffToken = {
  type: 'same' | 'add' | 'del'
  text: string
}

type Word = {
  text: string
  trailing: string
}

const MAX_CELLS = 250_000

function leadingWhitespace(text: string): string {
  return /^\s*/.exec(text)?.[0] ?? ''
}

function splitWords(text: string): Word[] {
  const body = text.slice(leadingWhitespace(text).length)
  const words: Word[] = []
  const re = /(\S+)(\s*)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(body))) {
    words.push({ text: match[1], trailing: match[2] })
  }
  return words
}

function norm(text: string): string {
  const folded = text.toLowerCase().replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, '')
  return folded || text.toLowerCase()
}

function lcs(oldWords: Word[], newWords: Word[]): { ai: number; bi: number }[] {
  const n = oldWords.length
  const m = newWords.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] =
        norm(oldWords[i - 1].text) === norm(newWords[j - 1].text)
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }

  const pairs: { ai: number; bi: number }[] = []
  let i = n
  let j = m
  while (i > 0 && j > 0) {
    if (norm(oldWords[i - 1].text) === norm(newWords[j - 1].text)) {
      pairs.push({ ai: i - 1, bi: j - 1 })
      i -= 1
      j -= 1
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i -= 1
    } else {
      j -= 1
    }
  }
  pairs.reverse()
  return pairs
}

function pushWord(tokens: DiffToken[], type: DiffToken['type'], word: Word) {
  tokens.push({ type, text: word.text })
  if (word.trailing) tokens.push({ type: 'same', text: word.trailing })
}

function isWhitespace(text: string): boolean {
  return /^\s+$/.test(text)
}

// A word that still appears in the new text is the same word, even if it moved.
// Drop the struck copy and keep the new one as plain text.
function settleSharedWords(tokens: DiffToken[]): DiffToken[] {
  const addedByNorm = new Map<string, number[]>()
  tokens.forEach((token, index) => {
    if (token.type !== 'add') return
    const key = norm(token.text)
    const queue = addedByNorm.get(key)
    if (queue) queue.push(index)
    else addedByNorm.set(key, [index])
  })

  const drop = new Set<number>()
  tokens.forEach((token, index) => {
    if (token.type !== 'del') return
    const queue = addedByNorm.get(norm(token.text))
    const addedAt = queue?.shift()
    if (addedAt === undefined) return
    drop.add(index)
    const follower = tokens[index + 1]
    if (follower?.type === 'same' && isWhitespace(follower.text)) drop.add(index + 1)
    tokens[addedAt] = { type: 'same', text: tokens[addedAt].text }
  })

  return tokens.filter((_, index) => !drop.has(index))
}

function mergeSame(tokens: DiffToken[]): DiffToken[] {
  const merged: DiffToken[] = []
  for (const token of tokens) {
    if (!token.text) continue
    const prev = merged[merged.length - 1]
    if (prev && prev.type === 'same' && token.type === 'same') prev.text += token.text
    else merged.push({ ...token })
  }
  return merged
}

function fallback(before: string, after: string): DiffToken[] {
  const tokens: DiffToken[] = []
  const oldLead = leadingWhitespace(before)
  const newLead = leadingWhitespace(after)
  const lead = oldLead === newLead ? oldLead : newLead
  if (lead) tokens.push({ type: 'same', text: lead })
  for (const word of splitWords(before)) pushWord(tokens, 'del', word)
  for (const word of splitWords(after)) {
    if (tokens[tokens.length - 1]?.type === 'del') tokens.push({ type: 'same', text: ' ' })
    pushWord(tokens, 'add', word)
  }
  return mergeSame(settleSharedWords(tokens))
}

export type AlignedWord = {
  role: 'same' | 'add' | 'del'
  text: string
  trailing: string
  oldOffset: number | null
  newOffset: number | null
}

export function alignWords(before: Word[], after: Word[]): AlignedWord[] {
  if (before.length * after.length > MAX_CELLS) {
    return [
      ...before.map((word, index) => ({
        role: 'del' as const,
        text: word.text,
        trailing: word.trailing,
        oldOffset: index,
        newOffset: null,
      })),
      ...after.map((word, index) => ({
        role: 'add' as const,
        text: word.text,
        trailing: word.trailing,
        oldOffset: null,
        newOffset: index,
      })),
    ]
  }

  const slots: AlignedWord[] = []
  let i = 0
  let j = 0
  const stops = [...lcs(before, after), { ai: before.length, bi: after.length }]
  for (const stop of stops) {
    while (i < stop.ai) {
      slots.push({
        role: 'del',
        text: before[i].text,
        trailing: before[i].trailing,
        oldOffset: i,
        newOffset: null,
      })
      i += 1
    }
    while (j < stop.bi) {
      const prev = slots[slots.length - 1]
      if (prev?.role === 'del' && !prev.trailing) prev.trailing = ' '
      slots.push({
        role: 'add',
        text: after[j].text,
        trailing: after[j].trailing,
        oldOffset: null,
        newOffset: j,
      })
      j += 1
    }
    if (i === stop.ai && j === stop.bi && i < before.length && j < after.length) {
      slots.push({
        role: 'same',
        text: after[j].text,
        trailing: after[j].trailing,
        oldOffset: i,
        newOffset: j,
      })
      i += 1
      j += 1
    }
  }

  const addedByNorm = new Map<string, number[]>()
  slots.forEach((slot, index) => {
    if (slot.role !== 'add') return
    const key = norm(slot.text)
    const queue = addedByNorm.get(key)
    if (queue) queue.push(index)
    else addedByNorm.set(key, [index])
  })
  const drop = new Set<number>()
  slots.forEach((slot, index) => {
    if (slot.role !== 'del') return
    const addedAt = addedByNorm.get(norm(slot.text))?.shift()
    if (addedAt === undefined) return
    drop.add(index)
    const added = slots[addedAt]
    slots[addedAt] = {
      role: 'same',
      text: added.text,
      trailing: added.trailing,
      oldOffset: slot.oldOffset,
      newOffset: added.newOffset,
    }
  })
  return slots.filter((_, index) => !drop.has(index))
}

export function diffWords(before: string, after: string): DiffToken[] {
  const oldWords = splitWords(before)
  const newWords = splitWords(after)
  if (oldWords.length * newWords.length > MAX_CELLS) return fallback(before, after)

  const tokens: DiffToken[] = []
  const oldLead = leadingWhitespace(before)
  const newLead = leadingWhitespace(after)
  const lead = oldLead === newLead ? oldLead : newLead
  if (lead) tokens.push({ type: 'same', text: lead })

  let i = 0
  let j = 0
  const stops = [...lcs(oldWords, newWords), { ai: oldWords.length, bi: newWords.length }]
  for (const stop of stops) {
    while (i < stop.ai) {
      pushWord(tokens, 'del', oldWords[i])
      i += 1
    }
    while (j < stop.bi) {
      if (tokens[tokens.length - 1]?.type === 'del') tokens.push({ type: 'same', text: ' ' })
      pushWord(tokens, 'add', newWords[j])
      j += 1
    }
    if (i === stop.ai && j === stop.bi && i < oldWords.length && j < newWords.length) {
      tokens.push({ type: 'same', text: newWords[j].text })
      if (newWords[j].trailing) tokens.push({ type: 'same', text: newWords[j].trailing })
      i += 1
      j += 1
    }
  }

  return mergeSame(settleSharedWords(tokens))
}
