'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { pairWords, wordHomes, type WordHome } from '@/app/lib/zoomLayout'

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
  kind: 'stay' | 'exit' | 'enter'
}

const EXIT_BLUR = 8
const FADE_RATE = 0.06
const MOVE_RATE = 0.14
const SETTLE_HOLD_MS = 900

type WordBlurOverlayProps = {
  oldText: string
  newText: string
  width: number
  streaming: boolean
  onReady: () => void
  onSettled: () => void
}

function stayParticle(home: WordHome, prev?: WordParticle): WordParticle {
  return {
    id: `s-${home.index}`,
    word: home.word,
    x: prev?.x ?? home.x,
    y: prev?.y ?? home.y,
    tx: home.x,
    ty: home.y,
    opacity: prev?.opacity ?? 1,
    targetOpacity: 1,
    blur: 0,
    targetBlur: 0,
    kind: 'stay',
  }
}

function layoutStay(text: string, width: number): WordParticle[] {
  return wordHomes(text, width).words.map((home) => stayParticle(home))
}

export function WordBlurOverlay({
  oldText,
  newText,
  width,
  streaming,
  onReady,
  onSettled,
}: WordBlurOverlayProps) {
  const particlesRef = useRef<WordParticle[]>(width > 0 ? layoutStay(oldText, width) : [])
  const settledRef = useRef(false)
  const destReadyRef = useRef(false)
  const streamEndedAtRef = useRef<number | null>(null)
  const [, setTick] = useState(0)

  useLayoutEffect(() => {
    if (streaming) streamEndedAtRef.current = null
    else if (streamEndedAtRef.current === null) streamEndedAtRef.current = performance.now()
  }, [streaming])

  useLayoutEffect(() => {
    if (width <= 0) return
    const oldLayout = wordHomes(oldText, width)
    const existing = new Map(particlesRef.current.map((p) => [p.id, p]))

    if (streaming || newText.length === 0) {
      destReadyRef.current = false
      particlesRef.current = oldLayout.words.map((home) => stayParticle(home, existing.get(`s-${home.index}`)))
      settledRef.current = false
      setTick((n) => n + 1)
      onReady()
      return
    }

    const newLayout = wordHomes(newText, width)
    destReadyRef.current = true
    const pairing = pairWords(oldLayout.words, newLayout.words)
    const next: WordParticle[] = []

    for (const { old, neu } of pairing.survivors) {
      const prev = existing.get(`s-${old.index}`)
      next.push({
        id: `s-${old.index}`,
        word: neu.word,
        x: prev?.x ?? old.x,
        y: prev?.y ?? old.y,
        tx: neu.x,
        ty: neu.y,
        opacity: prev?.opacity ?? 1,
        targetOpacity: 1,
        blur: 0,
        targetBlur: 0,
        kind: 'stay',
      })
    }

    for (const old of pairing.deletions) {
      const prev = existing.get(`s-${old.index}`) ?? existing.get(`d-${old.index}`)
      next.push({
        id: `d-${old.index}`,
        word: old.word,
        x: prev?.x ?? old.x,
        y: prev?.y ?? old.y,
        tx: old.x,
        ty: old.y,
        opacity: prev?.opacity ?? 1,
        targetOpacity: 0,
        blur: prev?.blur ?? 0,
        targetBlur: EXIT_BLUR,
        kind: 'exit',
      })
    }

    for (const neu of pairing.insertions) {
      const prev = existing.get(`i-${neu.index}`)
      next.push({
        id: `i-${neu.index}`,
        word: neu.word,
        x: prev?.x ?? neu.x,
        y: prev?.y ?? neu.y,
        tx: neu.x,
        ty: neu.y,
        opacity: prev?.opacity ?? 0,
        targetOpacity: 1,
        blur: prev?.blur ?? EXIT_BLUR,
        targetBlur: 0,
        kind: 'enter',
      })
    }

    particlesRef.current = next
    settledRef.current = false
    setTick((n) => n + 1)
    onReady()
  }, [oldText, newText, width, streaming, onReady])

  useEffect(() => {
    let raf = 0
    const loop = () => {
      let moving = false
      for (const p of particlesRef.current) {
        const fade = p.kind === 'stay' ? MOVE_RATE : FADE_RATE
        p.x += (p.tx - p.x) * MOVE_RATE
        p.y += (p.ty - p.y) * MOVE_RATE
        p.opacity += (p.targetOpacity - p.opacity) * fade
        p.blur += (p.targetBlur - p.blur) * fade
        if (
          Math.abs(p.tx - p.x) > 0.4 ||
          Math.abs(p.ty - p.y) > 0.4 ||
          Math.abs(p.targetOpacity - p.opacity) > 0.02 ||
          Math.abs(p.targetBlur - p.blur) > 0.08
        ) {
          moving = true
        }
      }
      setTick((n) => n + 1)
      const endedAt = streamEndedAtRef.current
      const held = endedAt !== null && performance.now() - endedAt > SETTLE_HOLD_MS
      if (!streaming && destReadyRef.current && held && !moving && !settledRef.current) {
        settledRef.current = true
        onSettled()
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [streaming, onSettled])

  return (
    <div className="absolute left-0 top-0 right-0 pointer-events-none" style={{ zIndex: 3, margin: 0, padding: 0 }}>
      {particlesRef.current.map((p) => (
        <div
          key={p.id}
          className="absolute left-0 top-0 text-slate-900 text-[20px] whitespace-pre-wrap"
          style={{
            letterSpacing: '-0.01em',
            lineHeight: 1.625,
            fontWeight: 400,
            overflowWrap: 'normal',
            wordBreak: 'normal',
            transform: `translate(${p.x}px, ${p.y}px)`,
            opacity: p.opacity,
            filter: p.kind === 'stay' ? undefined : `blur(${p.blur}px)`,
            transformOrigin: 'left top',
            willChange: 'transform, opacity, filter',
          }}
        >
          {p.word}
        </div>
      ))}
    </div>
  )
}
