'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useDialKit } from 'dialkit'
import { GLASS_DIALS } from '@/app/lib/glassSettings'
import { ControlBar } from '@/app/components/ControlBar'
import { WordBlurOverlay, type BlurPhase } from '@/app/components/WordBlurOverlay'
import { ZoomDiffReview } from '@/app/components/ZoomDiffReview'
import { useArticleEditor } from '@/app/lib/useArticleEditor'
import { useBoxWidth } from '@/app/lib/useBoxWidth'
import type { RewriteRange } from '@/app/lib/rewriteClient'
import type { ZoomArticleProps } from '@/app/types/zoom'

const REST_HEIGHT = 'calc(100dvh - 96px - 32px)'
const VIEWPORT_MARGIN = 12

type ControlAnchor = {
  x: number
  y: number
  placement: 'above' | 'below'
}

function getSelectionRects(textarea: HTMLTextAreaElement) {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  if (start === end) return []

  const style = window.getComputedStyle(textarea)
  const mirror = document.createElement('div')
  const selection = document.createElement('span')
  const rect = textarea.getBoundingClientRect()
  const copiedProperties = [
    'boxSizing',
    'fontFamily',
    'fontSize',
    'fontStyle',
    'fontWeight',
    'letterSpacing',
    'lineHeight',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'textAlign',
    'textIndent',
    'textTransform',
    'wordSpacing',
  ] as const

  copiedProperties.forEach((property) => {
    mirror.style[property] = style[property]
  })
  Object.assign(mirror.style, {
    position: 'fixed',
    visibility: 'hidden',
    pointerEvents: 'none',
    overflow: 'hidden',
    whiteSpace: 'pre-wrap',
    overflowWrap: style.overflowWrap,
    wordBreak: style.wordBreak,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    left: `${rect.left - textarea.scrollLeft}px`,
    top: `${rect.top - textarea.scrollTop}px`,
  })

  mirror.append(document.createTextNode(textarea.value.slice(0, start)))
  selection.textContent = textarea.value.slice(start, end)
  mirror.append(selection)
  // Keep the last selected line measurable when the selection ends in a newline.
  mirror.append(document.createTextNode('\u200b'))
  document.body.append(mirror)
  const rects = Array.from(selection.getClientRects())
  mirror.remove()
  return rects
}

function getControlAnchor(textarea: HTMLTextAreaElement, width: number, height: number, gap: number): ControlAnchor | null {
  const rects = getSelectionRects(textarea)
  if (!rects.length) return null

  const first = rects[0]
  const last = rects[rects.length - 1]
  const left = Math.min(...rects.map((rect) => rect.left))
  const right = Math.max(...rects.map((rect) => rect.right))
  const x = Math.min(
    window.innerWidth - VIEWPORT_MARGIN - width / 2,
    Math.max(VIEWPORT_MARGIN + width / 2, (left + right) / 2),
  )
  const belowY = last.bottom + gap
  const aboveY = first.top - gap - height
  const roomBelow = belowY + height <= window.innerHeight - VIEWPORT_MARGIN
  const roomAbove = aboveY >= VIEWPORT_MARGIN

  if (roomBelow || !roomAbove) {
    return {
      x,
      y: Math.min(window.innerHeight - VIEWPORT_MARGIN - height, Math.max(VIEWPORT_MARGIN, belowY)),
      placement: 'below',
    }
  }

  return { x, y: aboveY, placement: 'above' }
}

type ZoomPhase = 'idle' | BlurPhase

export function ArticleContent(props: ZoomArticleProps) {
  const glassSettings = useDialKit('Selection glass', GLASS_DIALS)
  const { width: controlWidth, height: controlHeight, selectionGap } = glassSettings.shape
  const { onTransitioningChange } = props
  const {
    content,
    setContent,
    isLoading,
    error,
    activeButton,
    shouldExpand,
    hasSelection,
    textareaRef,
    rememberSelection,
    handleRewrite,
    abortRewrite,
    undo,
    redo,
  } = useArticleEditor(props)
  const boxRef = useRef<HTMLDivElement>(null)
  const width = useBoxWidth(boxRef)
  const [oldText, setOldText] = useState('')
  const [destText, setDestText] = useState('')
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [overlayReady, setOverlayReady] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [focusRange, setFocusRange] = useState<RewriteRange | null>(null)
  const [morphKey, setMorphKey] = useState(0)
  const [historyMorph, setHistoryMorph] = useState(false)
  const [zoomPhase, setZoomPhase] = useState<ZoomPhase>('idle')
  const phaseRef = useRef<ZoomPhase>('idle')
  phaseRef.current = zoomPhase
  const showDock = zoomPhase === 'arrive' || zoomPhase === 'review'
  const overlayPhase: BlurPhase = historyMorph ? 'history' : zoomPhase === 'idle' ? 'stream' : zoomPhase
  const [controlAnchor, setControlAnchor] = useState<ControlAnchor | null>(null)

  const updateControlAnchor = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea || textarea.selectionStart === textarea.selectionEnd) return
    const nextAnchor = getControlAnchor(textarea, controlWidth, controlHeight, selectionGap)
    if (nextAnchor) setControlAnchor(nextAnchor)
  }, [textareaRef, controlWidth, controlHeight, selectionGap])

  const handleSelectionChange = useCallback(() => {
    rememberSelection()
    updateControlAnchor()
  }, [rememberSelection, updateControlAnchor])

  useEffect(() => {
    if (!hasSelection || overlayOpen) return
    updateControlAnchor()
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(updateControlAnchor)
    }
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [hasSelection, overlayOpen, updateControlAnchor])

  useEffect(() => {
    const showingResult =
      historyMorph || zoomPhase === 'review' || zoomPhase === 'accept' || zoomPhase === 'reject'
    onTransitioningChange?.(showingResult ? false : overlayOpen || isLoading)
  }, [overlayOpen, isLoading, historyMorph, zoomPhase, onTransitioningChange])

  useEffect(() => {
    if (!overlayOpen) return
    const y = window.scrollY
    const lock = () => {
      if (window.scrollY !== y) window.scrollTo(0, y)
    }
    window.addEventListener('scroll', lock, { passive: true })
    return () => window.removeEventListener('scroll', lock)
  }, [overlayOpen])

  const onReady = useCallback(() => {
    setOverlayReady(true)
  }, [])

  const onSettled = useCallback(() => {
    phaseRef.current = 'idle'
    setZoomPhase('idle')
    setOverlayOpen(false)
    setOverlayReady(false)
    setStreaming(false)
    setHistoryMorph(false)
    setOldText('')
    setDestText('')
    setFocusRange(null)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }, [textareaRef])

  const holdReview = useCallback(() => {
    if (phaseRef.current !== 'arrive') return
    phaseRef.current = 'review'
    setZoomPhase('review')
    onTransitioningChange?.(false)
  }, [onTransitioningChange])

  const acceptReview = useCallback(() => {
    const phase = phaseRef.current
    if (phase !== 'arrive' && phase !== 'review') return
    phaseRef.current = 'accept'
    setZoomPhase('accept')
  }, [])

  const rejectReview = useCallback(() => {
    const phase = phaseRef.current
    if (phase !== 'arrive' && phase !== 'review') return
    if (!undo()) return
    phaseRef.current = 'reject'
    setZoomPhase('reject')
  }, [undo])

  const playMorph = useCallback((from: string, to: string) => {
    setOldText(from)
    setDestText(to)
    setFocusRange(null)
    setOverlayReady(false)
    setStreaming(false)
    phaseRef.current = 'idle'
    setZoomPhase('idle')
    setHistoryMorph(true)
    setMorphKey((key) => key + 1)
    setOverlayOpen(true)
    onTransitioningChange?.(false)
  }, [onTransitioningChange])

  const start = useCallback((operation: 'expand' | 'contract') => {
    void handleRewrite(operation, {
      onStart: (source, range) => {
        phaseRef.current = 'stream'
        setZoomPhase('stream')
        setHistoryMorph(false)
        setOldText(source)
        setDestText('')
        setFocusRange(range)
        setOverlayReady(false)
        setOverlayOpen(true)
        setStreaming(true)
      },
      onEnd: (full) => {
        setDestText(full)
        setStreaming(false)
        setOverlayReady(true)
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          phaseRef.current = 'review'
          setZoomPhase('review')
          onTransitioningChange?.(false)
        } else {
          phaseRef.current = 'arrive'
          setZoomPhase('arrive')
        }
      },
      onError: onSettled,
    })
  }, [handleRewrite, onSettled, onTransitioningChange])

  // ⌘+ adds words, ⌘- subtracts them. = is the unshifted plus key.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const withCmd = event.metaKey || event.ctrlKey
      if (zoomPhase === 'accept' || zoomPhase === 'reject') {
        const key = event.key.toLowerCase()
        const chord = key === 'z' || key === 'y' || key === '-' || key === '+' || key === '='
        if (event.key === 'Enter' || event.key === 'Escape' || (withCmd && chord)) event.preventDefault()
        return
      }
      if (showDock) {
        const key = event.key.toLowerCase()
        if (event.key === 'Enter' && !withCmd && !event.altKey) {
          event.preventDefault()
          acceptReview()
          return
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          rejectReview()
          return
        }
        if (withCmd && !event.altKey && key === 'z' && !event.shiftKey) {
          event.preventDefault()
          rejectReview()
          return
        }
        if (withCmd && !event.altKey) {
          const redoKey = (key === 'z' && event.shiftKey) || (key === 'y' && event.ctrlKey && !event.metaKey)
          const subtract = key === '-' || event.code === 'Minus' || event.code === 'NumpadSubtract'
          const add = key === '+' || key === '=' || event.code === 'Equal' || event.code === 'NumpadAdd'
          if (redoKey || subtract || add) event.preventDefault()
        }
        return
      }
      if (!withCmd || event.altKey) return

      const key = event.key.toLowerCase()
      const redoKey = (key === 'z' && event.shiftKey) || (key === 'y' && event.ctrlKey && !event.metaKey)
      if (redoKey) {
        const step = redo()
        if (!step) return
        event.preventDefault()
        playMorph(step.from, step.to)
        return
      }
      if (key === 'z') {
        if (abortRewrite()) {
          event.preventDefault()
          return
        }
        const step = undo()
        if (!step) return
        event.preventDefault()
        playMorph(step.from, step.to)
        return
      }

      const subtract = key === '-' || event.code === 'Minus' || event.code === 'NumpadSubtract'
      const add = key === '+' || key === '=' || event.code === 'Equal' || event.code === 'NumpadAdd'
      if (!subtract && !add) return
      event.preventDefault()
      if (isLoading || overlayOpen || activeButton) return
      start(add ? 'expand' : 'contract')
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isLoading, overlayOpen, activeButton, showDock, zoomPhase, start, abortRewrite, undo, redo, playMorph, acceptReview, rejectReview])

  return (
    <div
      ref={boxRef}
      className="relative [overflow-anchor:none]"
      style={{
        height: shouldExpand ? REST_HEIGHT : '200px',
        transition: overlayOpen || isLoading ? 'none' : 'height 1000ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {overlayOpen && width > 0 && (
        <WordBlurOverlay
          key={morphKey}
          oldText={oldText}
          newText={destText}
          width={width}
          streaming={streaming}
          focusRange={focusRange}
          phase={overlayPhase}
          onReady={onReady}
          onHeld={holdReview}
          onSettled={onSettled}
        />
      )}

      {showDock && <ZoomDiffReview onAccept={acceptReview} onReject={rejectReview} />}

      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => {
          setContent(e.target.value)
          handleSelectionChange()
        }}
        className={`w-full min-h-[200px] resize-none text-[20px] leading-relaxed bg-transparent border-none outline-none p-0 relative ${
          isLoading && !overlayReady && !focusRange ? 'text-shimmer' : 'text-slate-900'
        }`}
        style={{
          caretColor: 'var(--workspace-accent, #06b6d4)',
          height: shouldExpand || overlayOpen ? '100%' : 'auto',
          overflow: 'hidden',
          letterSpacing: '-0.01em',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'normal',
          wordBreak: 'normal',
          opacity: overlayReady ? 0 : 1,
          pointerEvents: overlayOpen ? 'none' : 'auto',
          zIndex: 2,
        }}
        placeholder="Type or paste text to apply semantic zoom"
        autoFocus
        disabled={isLoading || overlayOpen}
        onSelect={handleSelectionChange}
        onKeyUp={handleSelectionChange}
        onMouseUp={handleSelectionChange}
      />

      <ControlBar
        settings={glassSettings}
        visible={hasSelection && !overlayOpen && !!controlAnchor}
        anchor={controlAnchor}
        sourceRef={textareaRef}
        sourceText={content}
        disabled={isLoading || !!activeButton}
        onContract={() => start('contract')}
        onExpand={() => start('expand')}
      />

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-red-50 text-red-700 px-4 py-2 rounded-lg shadow-lg border border-red-200 z-[10000]"
        >
          {error}
        </motion.div>
      )}
    </div>
  )
}
