'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { SELECTION_MENU_SETTINGS } from '@/app/lib/selectionMenuSettings'
import { ControlBar } from '@/app/components/ControlBar'
import { zoomTargets } from '@/app/lib/zoomTargets'
import { WordBlurOverlay, type BlurPhase } from '@/app/components/WordBlurOverlay'
import { useArticleEditor } from '@/app/lib/useArticleEditor'
import { useBoxWidth } from '@/app/lib/useBoxWidth'
import { wordCount, type RewriteRange } from '@/app/lib/rewriteClient'
import type { ZoomDegree, ZoomOperation } from '@/app/types/zoom'

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
    width: `${textarea.clientWidth}px`,
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
  return rects.filter((line) => line.bottom > rect.top && line.top < rect.bottom)
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

export function ArticleContent({ initialContent }: { initialContent: string }) {
  const { height: controlHeight, selectionGap } = SELECTION_MENU_SETTINGS.shape
  const controlMenuRef = useRef<HTMLDivElement>(null)
  const {
    content,
    setContent,
    isLoading,
    error,
    activeButton,
    hasSelection,
    selectionWordCount,
    textareaRef,
    rememberSelection,
    handleRewrite,
    abortRewrite,
    undo,
    redo,
  } = useArticleEditor(initialContent)
  const boxRef = useRef<HTMLDivElement>(null)
  const width = useBoxWidth(textareaRef)
  const reviewScrollRef = useRef<HTMLDivElement>(null)
  const [editorHeight, setEditorHeight] = useState(0)
  useLayoutEffect(() => {
    const editor = boxRef.current
    if (!editor) return
    const measure = () => setEditorHeight(editor.clientHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(editor)
    return () => observer.disconnect()
  }, [])
  const [oldText, setOldText] = useState('')
  const [destText, setDestText] = useState('')
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [overlayReady, setOverlayReady] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [focusRange, setFocusRange] = useState<RewriteRange | null>(null)
  const [morphKey, setMorphKey] = useState(0)
  const [historyMorph, setHistoryMorph] = useState(false)
  const [zoomPhase, setZoomPhase] = useState<ZoomPhase>('idle')
  const [rewriteOperation, setRewriteOperation] = useState<ZoomOperation | null>(null)
  const phaseRef = useRef<ZoomPhase>('idle')
  phaseRef.current = zoomPhase
  const showDock = zoomPhase === 'arrive' || zoomPhase === 'review'
  const keepReviewActions = showDock || zoomPhase === 'accept' || zoomPhase === 'reject'
  const documentControlWords = wordCount(zoomPhase === 'stream' ? oldText : keepReviewActions ? destText : content)
  const previousDocumentWords = keepReviewActions ? wordCount(oldText) : undefined
  const overlayPhase: BlurPhase = historyMorph ? 'history' : zoomPhase === 'idle' ? 'stream' : zoomPhase
  const [controlAnchor, setControlAnchor] = useState<ControlAnchor | null>(null)
  const [reviewBottom, setReviewBottom] = useState<number | null>(null)
  const reviewTop = keepReviewActions && reviewBottom !== null
    ? Math.min(reviewBottom + selectionGap, Math.max(0, editorHeight - controlHeight))
    : undefined

  useLayoutEffect(() => {
    if (overlayOpen && reviewScrollRef.current && textareaRef.current) {
      reviewScrollRef.current.scrollTop = textareaRef.current.scrollTop
      reviewScrollRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }, [overlayOpen, textareaRef])

  const updateControlAnchor = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea || textarea.selectionStart === textarea.selectionEnd) return
    const menu = controlMenuRef.current
    if (!menu) return
    const nextAnchor = getControlAnchor(textarea, menu.offsetWidth, menu.offsetHeight, selectionGap)
    setControlAnchor(nextAnchor)
  }, [textareaRef, selectionGap])

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
    const observer = new ResizeObserver(update)
    if (controlMenuRef.current) observer.observe(controlMenuRef.current)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [hasSelection, overlayOpen, updateControlAnchor])

  const onReady = useCallback(() => {
    setOverlayReady(true)
  }, [])

  const onSettled = useCallback(() => {
    const scrollTop = reviewScrollRef.current?.scrollTop
    const scrollLeft = reviewScrollRef.current?.scrollLeft
    phaseRef.current = 'idle'
    setZoomPhase('idle')
    setRewriteOperation(null)
    setOverlayOpen(false)
    setOverlayReady(false)
    setStreaming(false)
    setHistoryMorph(false)
    setOldText('')
    setDestText('')
    setFocusRange(null)
    setReviewBottom(null)
    requestAnimationFrame(() => {
      const textarea = textareaRef.current
      if (!textarea) return
      textarea.focus({ preventScroll: true })
      if (scrollTop !== undefined) textarea.scrollTop = scrollTop
      if (scrollLeft !== undefined) textarea.scrollLeft = scrollLeft
    })
  }, [textareaRef])

  const holdReview = useCallback(() => {
    if (phaseRef.current !== 'arrive') return
    phaseRef.current = 'review'
    setZoomPhase('review')
  }, [])

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
  }, [])

  const start = useCallback((operation: ZoomOperation, degree: ZoomDegree = 2, targetWords?: number, wholeDocument = false) => {
    void handleRewrite(operation, degree, {
      onStart: (source, range) => {
        phaseRef.current = 'stream'
        setRewriteOperation(operation)
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
        } else {
          phaseRef.current = 'arrive'
          setZoomPhase('arrive')
        }
      },
      onError: onSettled,
    }, targetWords, wholeDocument)
  }, [handleRewrite, onSettled])

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
      const operation = add ? 'expand' : 'contract'
      const stops = zoomTargets(selectionWordCount).filter((stop) => stop.operation === operation)
      const stop = stops.find((stop) => stop.degree === 2) ?? stops[0]
      if (stop) start(operation, stop.degree)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isLoading, overlayOpen, activeButton, showDock, zoomPhase, start, abortRewrite, undo, redo, playMorph, acceptReview, rejectReview, selectionWordCount])

  return (
    <>
      <div
        className="document-zoom-slot flex justify-center"
        role="group"
        aria-label="Whole-document zoom"
      >
        <ControlBar
          inline
          sourceWords={documentControlWords}
          previousWords={previousDocumentWords}
          settings={SELECTION_MENU_SETTINGS}
          visible
          scaleLoadingOperation={zoomPhase === 'stream' ? rewriteOperation : null}
          scaleReviewOperation={keepReviewActions ? rewriteOperation : null}
          disabled={!content.trim() || isLoading || overlayOpen || !!activeButton}
          onZoom={(operation, degree, targetWords) => start(operation, degree, targetWords, true)}
        />
      </div>
      <div className="document-page">
        <div
          ref={boxRef}
          className="document-editor relative [overflow-anchor:none]"
        >
          {overlayOpen && width > 0 && (
            <div
              ref={reviewScrollRef}
              className="document-editor-scroll absolute inset-0 z-10"
              tabIndex={showDock ? 0 : -1}
              aria-label="Document preview"
            >
              <div
                className="relative min-h-full"
                style={{ minHeight: reviewBottom === null ? undefined : reviewBottom + (reviewTop === undefined ? 0 : controlHeight + selectionGap) }}
              >
                <WordBlurOverlay
                  key={morphKey}
                  oldText={oldText}
                  newText={destText}
                  width={width}
                  streaming={streaming}
                  focusRange={focusRange}
                  phase={overlayPhase}
                  onReady={onReady}
                  onReviewBottom={setReviewBottom}
                  onHeld={holdReview}
                  onSettled={onSettled}
                />
              </div>
            </div>
          )}


          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value)
              handleSelectionChange()
            }}
            className={`document-editor-scroll block h-full w-full resize-none text-[20px] leading-relaxed bg-transparent border-none outline-none p-0 relative ${
              isLoading && !overlayReady && !focusRange ? 'text-shimmer' : 'text-foreground'
            }`}
            style={{
              caretColor: 'var(--accent)',
              letterSpacing: '-0.01em',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'normal',
              wordBreak: 'normal',
              opacity: overlayReady ? 0 : 1,
              pointerEvents: overlayOpen ? 'none' : 'auto',
              zIndex: 2,
            }}
            placeholder="Type or paste text to apply semantic zoom"
            disabled={isLoading || overlayOpen}
            onSelect={handleSelectionChange}
            onKeyUp={handleSelectionChange}
            onMouseUp={handleSelectionChange}
          />

          <ControlBar
            reviewTop={reviewTop}
            sourceWords={selectionWordCount}
            menuRef={controlMenuRef}
            settings={SELECTION_MENU_SETTINGS}
            visible={(showDock && reviewTop !== undefined) || (hasSelection && !overlayOpen && !!controlAnchor)}
            anchor={controlAnchor}
            review={keepReviewActions ? { onAccept: acceptReview, onReject: rejectReview } : undefined}
            disabled={isLoading || !!activeButton}
            onZoom={start}
          />

          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              role="alert"
              className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-(--surface) text-foreground px-4 py-2 rounded-lg border border-(--slate-300) z-[10000]"
            >
              {error}
            </motion.div>
          )}
        </div>
      </div>
    </>
  )
}
