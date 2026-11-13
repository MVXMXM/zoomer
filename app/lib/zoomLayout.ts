import { LINE_HEIGHT } from '@/app/lib/zoomMetrics'

export type WordHome = {
  word: string
  norm: string
  x: number
  y: number
  index: number
}

export type WordPairing = {
  survivors: { old: WordHome; neu: WordHome }[]
  deletions: WordHome[]
  insertions: WordHome[]
}

export function wordHomes(text: string, width: number): { words: WordHome[]; height: number } {
  if (!text || width <= 0 || typeof document === 'undefined') {
    return { words: [], height: LINE_HEIGHT }
  }

  const root = getMeasureRoot()
  root.style.width = `${width}px`
  root.replaceChildren()

  const spans: HTMLSpanElement[] = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const tokens = wrapTokens(line)
    if (tokens.length === 0 && i < lines.length - 1) {
      root.appendChild(document.createTextNode('\n'))
      continue
    }
    for (const token of tokens) {
      if (/^\s+$/.test(token)) {
        root.appendChild(document.createTextNode(token))
        continue
      }
      const span = document.createElement('span')
      span.textContent = token
      root.appendChild(span)
      spans.push(span)
    }
    if (i < lines.length - 1) root.appendChild(document.createTextNode('\n'))
  }

  void root.offsetWidth

  const origin = root.getBoundingClientRect()
  const words: WordHome[] = spans.map((span, index) => {
    const rect = span.getBoundingClientRect()
    return {
      word: span.textContent ?? '',
      norm: (span.textContent ?? '').trim().toLowerCase(),
      x: rect.left - origin.left,
      y: rect.top - origin.top,
      index,
    }
  })
  const originY = words.reduce((min, word) => Math.min(min, word.y), words[0]?.y ?? 0)
  if (originY !== 0) {
    for (const word of words) word.y -= originY
  }

  return { words, height: Math.max(root.offsetHeight, LINE_HEIGHT) }
}

function wrapTokens(line: string): string[] {
  const chunks = line.match(/\S+\s*|\s+/g) ?? []
  const tokens: string[] = []
  for (const chunk of chunks) {
    if (/^\s+$/.test(chunk)) {
      tokens.push(chunk)
      continue
    }
    const space = chunk.match(/\s+$/)?.[0] ?? ''
    const core = space ? chunk.slice(0, -space.length) : chunk
    const pieces = core.split(/(?<=[\-\u00AD])/).filter(Boolean)
    if (pieces.length === 0) continue
    pieces[pieces.length - 1] += space
    tokens.push(...pieces)
  }
  return tokens
}

let measureRoot: HTMLDivElement | null = null

function getMeasureRoot(): HTMLDivElement {
  if (measureRoot && measureRoot.isConnected) return measureRoot
  const el = document.createElement('div')
  el.setAttribute('aria-hidden', 'true')
  Object.assign(el.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    margin: '0',
    padding: '0',
    border: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
    boxSizing: 'border-box',
    fontFamily: 'Archivo, sans-serif',
    fontSize: '20px',
    fontWeight: '400',
    lineHeight: '1.625',
    letterSpacing: '-0.01em',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'normal',
    wordBreak: 'normal',
  })
  document.body.appendChild(el)
  measureRoot = el
  return el
}

export type LayoutToken = {
  text: string
  trailing: string
  start: number
}

export function tokenizeForLayout(text: string): { tokens: LayoutToken[]; lead: string } {
  const tokens: LayoutToken[] = []
  let lead = ''
  let offset = 0
  const lines = text.split('\n')
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]
    let cursor = 0
    for (const token of wrapTokens(line)) {
      const start = offset + cursor
      cursor += token.length
      if (/^\s+$/.test(token)) {
        if (tokens.length > 0) tokens[tokens.length - 1].trailing += token
        else lead += token
        continue
      }
      const space = token.match(/\s+$/)?.[0] ?? ''
      const core = token.slice(0, token.length - space.length)
      if (!core) continue
      tokens.push({ text: core, trailing: space, start })
    }
    offset += line.length
    if (lineIndex < lines.length - 1) {
      if (tokens.length > 0) tokens[tokens.length - 1].trailing += '\n'
      else lead += '\n'
      offset += 1
    }
  }
  return { tokens, lead }
}

export function placeWords(
  pieces: { text: string; trailing: string }[],
  width: number,
  lead = '',
): { x: number; y: number; width: number }[] {
  if (!pieces.length || width <= 0 || typeof document === 'undefined') {
    return pieces.map(() => ({ x: 0, y: 0, width: 0 }))
  }
  const root = getMeasureRoot()
  root.style.width = `${width}px`
  root.replaceChildren()
  if (lead) root.appendChild(document.createTextNode(lead))
  const spans: HTMLSpanElement[] = []
  for (const piece of pieces) {
    const span = document.createElement('span')
    const newlineAt = piece.trailing.indexOf('\n')
    if (newlineAt === -1) {
      span.textContent = piece.text + piece.trailing
      root.appendChild(span)
    } else {
      span.textContent = piece.text + piece.trailing.slice(0, newlineAt)
      root.appendChild(span)
      root.appendChild(document.createTextNode(piece.trailing.slice(newlineAt)))
    }
    spans.push(span)
  }
  void root.offsetWidth
  const origin = root.getBoundingClientRect()
  const placed = spans.map((span) => {
    const rect = span.getBoundingClientRect()
    return { x: rect.left - origin.left, y: rect.top - origin.top, width: rect.width }
  })
  const originY = placed.reduce((min, word) => Math.min(min, word.y), placed[0]?.y ?? 0)
  if (originY !== 0) {
    for (const word of placed) word.y -= originY
  }
  return placed
}

export function pairWords(oldHomes: WordHome[], newHomes: WordHome[]): WordPairing {
  const oldUsed = new Set<number>()
  const newUsed = new Set<number>()
  const survivors: { old: WordHome; neu: WordHome }[] = []

  const oldCounts = countNorms(oldHomes)
  const newCounts = countNorms(newHomes)
  const newByNorm = new Map<string, WordHome>()
  for (const home of newHomes) {
    if (!newByNorm.has(home.norm)) newByNorm.set(home.norm, home)
  }

  for (const old of oldHomes) {
    if (oldCounts.get(old.norm) !== 1 || newCounts.get(old.norm) !== 1) continue
    const neu = newByNorm.get(old.norm)
    if (!neu) continue
    survivors.push({ old, neu })
    oldUsed.add(old.index)
    newUsed.add(neu.index)
  }

  const oldRest = oldHomes.filter((home) => !oldUsed.has(home.index))
  const newRest = newHomes.filter((home) => !newUsed.has(home.index))
  for (const { ai, bi } of lcs(oldRest, newRest)) {
    survivors.push({ old: oldRest[ai], neu: newRest[bi] })
    oldUsed.add(oldRest[ai].index)
    newUsed.add(newRest[bi].index)
  }

  return {
    survivors,
    deletions: oldHomes.filter((home) => !oldUsed.has(home.index)),
    insertions: newHomes.filter((home) => !newUsed.has(home.index)),
  }
}

function countNorms(homes: WordHome[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const home of homes) {
    counts.set(home.norm, (counts.get(home.norm) ?? 0) + 1)
  }
  return counts
}

function lcs(oldRest: WordHome[], newRest: WordHome[]): { ai: number; bi: number }[] {
  const n = oldRest.length
  const m = newRest.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] =
        oldRest[i - 1].norm === newRest[j - 1].norm
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }
  const pairs: { ai: number; bi: number }[] = []
  let i = n
  let j = m
  while (i > 0 && j > 0) {
    if (oldRest[i - 1].norm === newRest[j - 1].norm) {
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
