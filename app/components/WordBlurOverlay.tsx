'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RewriteRange } from '@/app/lib/rewriteClient'
import { LINE_HEIGHT } from '@/app/lib/zoomMetrics'
import { reviewLayout, type ReviewWord } from '@/app/lib/reviewLayout'
import { pairWords, placeWords, tokenizeForLayout, wordHomes, type WordHome } from '@/app/lib/zoomLayout'

export type BlurPhase = 'stream' | 'arrive' | 'review' | 'accept' | 'reject' | 'history'

type Role = 'same' | 'add' | 'del'

type WordParticle = {
  id: string
  word: string
  x: number
  y: number
  tx: number
  ty: number
  opacity: number
  targetOpacity: number
  blur: number
  targetBlur: number
  mark: number
  targetMark: number
  role: Role
}

type Point = { x: number; y: number }

const EXIT_BLUR = 8
const FADE_RATE = 0.06
const MOVE_RATE = 0.14
const HOLD_MS: Record<BlurPhase, number> = {
  stream: 0,
  arrive: 220,
  review: 0,
  accept: 160,
  reject: 160,
  history: 900,
}

type WordBlurOverlayProps = {
  oldText: string
  newText: string
  width: number
  streaming: boolean
  focusRange?: RewriteRange | null
  phase: BlurPhase
  onReady: () => void
  onHeld: () => void
  onSettled: () => void
  onHeightChange?: (height: number) => void
}

const TEXT_STYLE = {
  letterSpacing: '-0.01em',
  lineHeight: 1.625,
  fontWeight: 400,
  overflowWrap: 'normal',
  wordBreak: 'normal',
} as const

function StreamingSource({ text, range }: { text: string; range?: RewriteRange | null }) {
  if (!range) {
    return (
      <div className="text-shimmer text-[20px] whitespace-pre-wrap" style={TEXT_STYLE}>
        {text}
      </div>
    )
  }

  return (
    <div className="text-slate-900 text-[20px] whitespace-pre-wrap" style={TEXT_STYLE}>
      {text.slice(0, range.start)}
      <span className="text-shimmer">{text.slice(range.start, range.end)}</span>
      {text.slice(range.end)}
    </div>
  )
}

function mix(from: number, to: number, amount: number) {
  return Math.round(from + (to - from) * amount)
}

function markedColor(role: Role, mark: number) {
  const amount = Math.min(1, Math.max(0, mark))
  if (role === 'add' && amount > 0.01) {
    return {
      color: `rgb(${mix(15, 2, amount)}, ${mix(23, 44, amount)}, ${mix(42, 34, amount)})`,
      backgroundColor: `rgba(209, 250, 229, ${amount})`,
      textDecorationLine: undefined,
      textDecorationColor: undefined,
    }
  }
  if (role === 'del' && amount > 0.01) {
    return {
      color: `rgb(${mix(15, 69, amount)}, ${mix(23, 10, amount)}, ${mix(42, 10, amount)})`,
      backgroundColor: `rgba(254, 226, 226, ${amount})`,
      textDecorationLine: amount > 0.08 ? ('line-through' as const) : undefined,
      textDecorationColor: `rgba(153, 27, 27, ${amount})`,
    }
  }
  return {
    color: '#0f172a',
    backgroundColor: 'transparent',
    textDecorationLine: undefined,
    textDecorationColor: undefined,
  }
}

function particle(
  id: string,
  word: string,
  role: Role,
  prev: WordParticle | undefined,
  start: Point,
  goal: { tx: number; ty: number; opacity: number; blur: number; mark: number },
  fresh?: { opacity: number; blur: number; mark: number },
): WordParticle {
  return {
    id,
    word,
    role,
    x: prev?.x ?? start.x,
    y: prev?.y ?? start.y,
    tx: goal.tx,
    ty: goal.ty,
    opacity: prev?.opacity ?? fresh?.opacity ?? 1,
    targetOpacity: goal.opacity,
    blur: prev?.blur ?? fresh?.blur ?? 0,
    targetBlur: goal.blur,
    mark: prev?.mark ?? fresh?.mark ?? 0,
    targetMark: goal.mark,
  }
}

function pointAt(points: Point[], index: number | null, fallback: Point): Point {
  if (index === null) return fallback
  return points[index] ?? fallback
}

function reviewGoal(phase: BlurPhase, word: ReviewWord, diff: Point, old: Point, next: Point) {
  if (phase === 'accept') {
    if (word.role === 'del') return { tx: diff.x, ty: diff.y, opacity: 0, blur: EXIT_BLUR, mark: 0 }
    return { tx: next.x, ty: next.y, opacity: 1, blur: 0, mark: 0 }
  }
  if (phase === 'reject') {
    if (word.role === 'add') return { tx: diff.x, ty: diff.y, opacity: 0, blur: EXIT_BLUR, mark: 0 }
    return { tx: old.x, ty: old.y, opacity: 1, blur: 0, mark: 0 }
  }
  if (word.role === 'same') return { tx: diff.x, ty: diff.y, opacity: 1, blur: 0, mark: 0 }
  return { tx: diff.x, ty: diff.y, opacity: 1, blur: 0, mark: 1 }
}

function snap(particles: WordParticle[]) {
  for (const item of particles) {
    item.x = item.tx
    item.y = item.ty
    item.opacity = item.targetOpacity
    item.blur = item.targetBlur
    item.mark = item.targetMark
  }
}

export function WordBlurOverlay({
  oldText,
  newText,
  width,
  streaming,
  focusRange,
  phase,
  onReady,
  onHeld,
  onSettled,
  onHeightChange,
}: WordBlurOverlayProps) {
  const [scopeRows, setScopeRows] = useState<{ x: number; y: number; width: number }[]>([])
  const particlesRef = useRef<WordParticle[]>([])
  const settledRef = useRef(false)
  const phaseAtRef = useRef(0)
  const [, setTick] = useState(0)

  useLayoutEffect(() => {
    if (width <= 0) return
    setScopeRows([])
    onHeightChange?.(Math.max(wordHomes(oldText, width).height, wordHomes(newText, width).height))
    phaseAtRef.current = performance.now()
    settledRef.current = false
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const existing = new Map(particlesRef.current.map((item) => [item.id, item]))

    if (phase === 'history') {
      const oldLayout = wordHomes(oldText, width)
      const newLayout = wordHomes(newText, width)
      const pairing = pairWords(oldLayout.words, newLayout.words)
      const next: WordParticle[] = []
      const homeOf = (home: WordHome) => ({ x: home.x, y: home.y })
      for (const { old, neu } of pairing.survivors) {
        const prev = existing.get(`s-${old.index}`)
        next.push(particle(`s-${old.index}`, neu.word, 'same', prev, homeOf(old), {
          tx: neu.x,
          ty: neu.y,
          opacity: 1,
          blur: 0,
          mark: 0,
        }))
      }
      for (const old of pairing.deletions) {
        const prev = existing.get(`s-${old.index}`) ?? existing.get(`d-${old.index}`)
        next.push(particle(`d-${old.index}`, old.word, 'del', prev, homeOf(old), {
          tx: old.x,
          ty: old.y,
          opacity: 0,
          blur: EXIT_BLUR,
          mark: 0,
        }))
      }
      for (const neu of pairing.insertions) {
        const prev = existing.get(`i-${neu.index}`)
        next.push(particle(
          `i-${neu.index}`,
          neu.word,
          'add',
          prev,
          homeOf(neu),
          { tx: neu.x, ty: neu.y, opacity: 1, blur: 0, mark: 0 },
          { opacity: 0, blur: EXIT_BLUR, mark: 0 },
        ))
      }
      if (reduced) snap(next)
      particlesRef.current = next
      setTick((count) => count + 1)
      onReady()
      return
    }

    if (phase === 'stream' || newText.length === 0) {
      const { tokens, lead } = tokenizeForLayout(oldText)
      const placed = placeWords(tokens, width, lead)
      particlesRef.current = tokens.map((token, index) => {
        const home = placed[index] ?? { x: 0, y: 0 }
        return particle(`b-${index}`, token.text, 'same', existing.get(`b-${index}`), home, {
          tx: home.x,
          ty: home.y,
          opacity: 1,
          blur: 0,
          mark: 0,
        })
      })
      setTick((count) => count + 1)
      onReady()
      return
    }

    const layout = reviewLayout(oldText, newText, focusRange ?? null)
    const beforePos = placeWords(layout.beforeTokens, width, layout.beforeLead)
    const afterPos = placeWords(layout.afterTokens, width, layout.afterLead)
    const diffPos = placeWords(layout.words, width, layout.diffLead)
    const rows = new Map<number, { x: number; y: number; width: number }>()
    layout.words.forEach((word, index) => {
      if (!word.inScope) return
      const pos = diffPos[index]
      if (!pos) return
      const key = Math.round(pos.y)
      const row = rows.get(key)
      if (row) {
        const right = Math.max(row.x + row.width, pos.x + pos.width)
        row.x = Math.min(row.x, pos.x)
        row.width = right - row.x
      } else rows.set(key, { ...pos })
    })
    setScopeRows(Array.from(rows.values()))
    onHeightChange?.(Math.max(...diffPos.map(point => point.y + LINE_HEIGHT), LINE_HEIGHT))
    particlesRef.current = layout.words.map((word, index) => {
      const diff = diffPos[index] ?? { x: 0, y: 0 }
      const old = pointAt(beforePos, word.oldIndex, diff)
      const next = pointAt(afterPos, word.newIndex, diff)
      const prev = existing.get(word.id)
      const arrived = phase === 'arrive' && word.role === 'add'
      return particle(
        word.id,
        word.text,
        word.role,
        prev,
        arrived ? diff : old,
        reviewGoal(phase, word, diff, old, next),
        arrived ? { opacity: 0, blur: EXIT_BLUR, mark: 0 } : undefined,
      )
    })
    if (reduced) snap(particlesRef.current)
    setTick((count) => count + 1)
    onReady()
  }, [focusRange, newText, oldText, onReady, onHeightChange, phase, width])

  useEffect(() => {
    let raf = 0
    const loop = () => {
      let moving = false
      for (const item of particlesRef.current) {
        const fade = item.role === 'same' ? MOVE_RATE : FADE_RATE
        item.x += (item.tx - item.x) * MOVE_RATE
        item.y += (item.ty - item.y) * MOVE_RATE
        item.opacity += (item.targetOpacity - item.opacity) * fade
        item.blur += (item.targetBlur - item.blur) * fade
        item.mark += (item.targetMark - item.mark) * FADE_RATE
        if (
          Math.abs(item.tx - item.x) > 0.4 ||
          Math.abs(item.ty - item.y) > 0.4 ||
          Math.abs(item.targetOpacity - item.opacity) > 0.02 ||
          Math.abs(item.targetBlur - item.blur) > 0.08 ||
          Math.abs(item.targetMark - item.mark) > 0.02
        ) {
          moving = true
        }
      }
      setTick((count) => count + 1)
      if (phase === 'stream' || phase === 'review') {
        if (moving) raf = requestAnimationFrame(loop)
        return
      }
      const held = performance.now() - phaseAtRef.current > HOLD_MS[phase]
      if (!moving && held) {
        if (!settledRef.current) {
          settledRef.current = true
          if (phase === 'arrive') onHeld()
          else onSettled()
        }
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [onHeld, onSettled, phase])

  const showSource = streaming || phase === 'stream' || (phase !== 'history' && newText.length === 0)

  return (
    <div
      className="absolute left-0 top-0 right-0 pointer-events-none"
      style={{ zIndex: 4, margin: 0, padding: 0 }}
      role={phase === 'review' ? 'region' : undefined}
      aria-label={phase === 'review' ? 'Review zoom changes' : undefined}
    >
      {!showSource && (phase === 'arrive' || phase === 'review') && scopeRows.map((row, index) => (
        <div key={`scope-${index}`} className="zoom-replacement-scope" aria-hidden="true"
          style={{ left: row.x - 2, top: row.y, width: row.width + 4, height: LINE_HEIGHT }} />
      ))}
      {showSource ? (
        <StreamingSource text={oldText} range={focusRange} />
      ) : (
        particlesRef.current.map((item) => {
          const tone = markedColor(item.role, item.mark)
          return (
            <div
              key={item.id}
              className="absolute left-0 top-0 text-[20px] whitespace-pre"
              style={{
                letterSpacing: '-0.01em',
                lineHeight: 1.625,
                fontWeight: 400,
                transform: `translate(${item.x}px, ${item.y}px)`,
                opacity: item.opacity,
                filter: item.blur > 0.05 ? `blur(${item.blur}px)` : undefined,
                transformOrigin: 'left top',
                willChange: 'transform, opacity, filter',
                color: tone.color,
                backgroundColor: tone.backgroundColor,
                textDecorationLine: tone.textDecorationLine,
                textDecorationColor: tone.textDecorationColor,
                borderRadius: 3,
              }}
            >
              {item.word}
            </div>
          )
        })
      )}
    </div>
  )
}
