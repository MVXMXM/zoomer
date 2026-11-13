'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ControlBar } from '@/app/components/ControlBar'
import { WordBlurOverlay, type BlurPhase } from '@/app/components/WordBlurOverlay'
import { ZoomDiffReview } from '@/app/components/ZoomDiffReview'
import { useArticleEditor } from '@/app/lib/useArticleEditor'
import { useBoxWidth } from '@/app/lib/useBoxWidth'
import type { RewriteRange } from '@/app/lib/rewriteClient'
import type { ZoomArticleProps, ZoomDegree, ZoomOperation } from '@/app/types/zoom'

const REST_HEIGHT = 'calc(100dvh - 96px - 32px)'

type ZoomPhase = 'idle' | BlurPhase

export function ArticleContent(props: ZoomArticleProps) {
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

  const start = useCallback((operation: ZoomOperation, degree: ZoomDegree = 2) => {
    void handleRewrite(operation, degree, {
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
          rememberSelection()
        }}
        className={`w-full min-h-[200px] resize-none text-[20px] leading-relaxed bg-transparent border-none outline-none px-0 pt-0 pb-[132px] relative ${
          isLoading && !overlayReady && !focusRange ? 'text-shimmer' : 'text-slate-900'
        }`}
        style={{
          caretColor: '#06b6d4',
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
        onSelect={rememberSelection}
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
      />

      {hasSelection && !overlayOpen && (
        <ControlBar
          visible
          disabled={isLoading || !!activeButton}
          onZoom={start}
        />
      )}

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
