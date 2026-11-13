'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useDialKit } from 'dialkit'
import { GLASS_DIALS } from '@/app/lib/glassSettings'
import { ControlBar } from '@/app/components/ControlBar'
import { WordBlurOverlay, type BlurPhase } from '@/app/components/WordBlurOverlay'
import { placeEditMenu, type EditOrigin, type MenuAnchor } from '@/app/lib/menuPlacement'
import { wordHomes } from '@/app/lib/zoomLayout'
import { useArticleEditor } from '@/app/lib/useArticleEditor'
import { useBoxWidth } from '@/app/lib/useBoxWidth'
import type { ZoomFlowFixture } from '@/app/lib/zoomFlowPreview'
import { wordCount, type RewriteRange } from '@/app/lib/rewriteClient'
import type { ZoomArticleProps } from '@/app/types/zoom'

const REST_HEIGHT = 'calc(100dvh - 96px - 32px)'
function getSelectionRects(textarea: HTMLTextAreaElement, range?: RewriteRange, text = textarea.value) {
  const start = range?.start ?? textarea.selectionStart
  const end = range?.end ?? textarea.selectionEnd
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

  mirror.append(document.createTextNode(text.slice(0, start)))
  selection.textContent = text.slice(start, end)
  mirror.append(selection)
  // Keep the last selected line measurable when the selection ends in a newline.
  mirror.append(document.createTextNode('\u200b'))
  document.body.append(mirror)
  const rects = Array.from(selection.getClientRects())
  mirror.remove()
  return rects
}

function readEditOrigin(textarea: HTMLTextAreaElement, range?: RewriteRange, text?: string): EditOrigin | null {
  const first = getSelectionRects(textarea, range, text)[0]
  if (!first) return null
  return { x: first.left + window.scrollX, y: first.top + window.scrollY,
    lineHeight: parseFloat(getComputedStyle(textarea).lineHeight) || 32.5 }
}

type ZoomPhase = 'idle' | BlurPhase

export function ArticleContent(props: ZoomArticleProps & { preview?: ZoomFlowFixture }) {
  const fixture = process.env.NODE_ENV === 'development' ? props.preview : undefined
  const fixtureReview = fixture?.stage === 'review' || fixture?.stage === 'pinned'
  const fixtureOpen = fixtureReview || fixture?.stage === 'working'
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (previewTimer.current) clearTimeout(previewTimer.current) }, [])
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
  } = useArticleEditor({ ...props, initialContent: fixture
    ? fixtureReview || fixture.stage === 'accepted' ? fixture.after : fixture.before
    : props.initialContent })
  const boxRef = useRef<HTMLDivElement>(null)
  const width = useBoxWidth(boxRef)
  const [oldText, setOldText] = useState(fixtureOpen ? fixture!.before : '')
  const [destText, setDestText] = useState(fixtureReview ? fixture!.after : '')
  const [overlayOpen, setOverlayOpen] = useState(Boolean(fixtureOpen))
  const [overlayReady, setOverlayReady] = useState(Boolean(fixtureReview))
  const [streaming, setStreaming] = useState(fixture?.stage === 'working')
  const [focusRange, setFocusRange] = useState<RewriteRange | null>(fixtureOpen ? fixture!.range : null)
  const [morphKey, setMorphKey] = useState(0)
  const [historyMorph, setHistoryMorph] = useState(false)
  const [zoomPhase, setZoomPhase] = useState<ZoomPhase>(fixtureReview ? 'review' : fixture?.stage === 'working' ? 'stream' : 'idle')
  const phaseRef = useRef<ZoomPhase>('idle')
  phaseRef.current = zoomPhase
  const showDock = zoomPhase === 'arrive' || zoomPhase === 'review'
  const overlayPhase: BlurPhase = historyMorph ? 'history' : zoomPhase === 'idle' ? 'stream' : zoomPhase
  const [controlAnchor, setControlAnchor] = useState<MenuAnchor | null>(null)

  const editOriginRef = useRef<EditOrigin | null>(null)
  const [overlayHeight, setOverlayHeight] = useState(0)
  const [textHeight, setTextHeight] = useState(200)
  const operationOpen = overlayOpen && !historyMorph

  const updateControlAnchor = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    if (!operationOpen) {
      const origin = readEditOrigin(textarea)
      if (origin) editOriginRef.current = origin
    }
    const origin = editOriginRef.current
    if (!origin) return
    setControlAnchor(placeEditMenu(origin,
      { width: window.innerWidth, height: window.innerHeight, scrollX: window.scrollX, scrollY: window.scrollY },
      { width: controlWidth, height: controlHeight, gap: selectionGap }))
  }, [textareaRef, operationOpen, controlWidth, controlHeight, selectionGap])

  const backToEdit = useCallback(() => {
    const origin = editOriginRef.current
    if (!origin) return
    window.scrollTo({ top: Math.max(0, origin.y - controlHeight - selectionGap - 24),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [controlHeight, selectionGap])

  useLayoutEffect(() => {
    if (width > 0) setTextHeight(Math.max(200, wordHomes(operationOpen ? oldText : content, width).height + 80))
    if (operationOpen && focusRange && textareaRef.current) {
      editOriginRef.current = readEditOrigin(textareaRef.current, focusRange, oldText)
      updateControlAnchor()
    }
  }, [content, focusRange, oldText, operationOpen, width, textareaRef, updateControlAnchor])

  const handleSelectionChange = useCallback(() => {
    rememberSelection()
    updateControlAnchor()
  }, [rememberSelection, updateControlAnchor])

  useEffect(() => {
    if (!hasSelection && !operationOpen) return
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
  }, [hasSelection, operationOpen, shouldExpand, updateControlAnchor])

  useEffect(() => {
    if (!fixture || !textareaRef.current || width <= 0) return
    props.onLoadingStateChange?.(fixture.stage === 'working', fixture.stage === 'rejected' ? null : 'expand',
      fixtureReview || fixture.stage === 'accepted'
        ? { beforeCount: wordCount(fixture.before), afterCount: wordCount(fixture.after) } : undefined)
    if (fixture.stage === 'accepted' || fixture.stage === 'rejected') return
    const textarea = textareaRef.current
    editOriginRef.current = readEditOrigin(textarea, fixture.range, fixture.before)
    if (fixture.stage === 'selection') {
      textarea.focus({ preventScroll: true })
      textarea.setSelectionRange(fixture.range.start, fixture.range.end)
      rememberSelection()
    }
    updateControlAnchor()
    if (fixture.stage !== 'pinned') return
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => window.scrollTo(0, (editOriginRef.current?.y ?? 0) + 180))
    })
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second) }
    // Fixtures are pinned only on mount/resize, not when the reviewer scrolls back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixture, width])

  useEffect(() => {
    const showingResult =
      historyMorph || zoomPhase === 'review' || zoomPhase === 'accept' || zoomPhase === 'reject'
    onTransitioningChange?.(showingResult ? false : overlayOpen || isLoading)
  }, [overlayOpen, isLoading, historyMorph, zoomPhase, onTransitioningChange])

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
    setOverlayHeight(0)
    requestAnimationFrame(() => {
      const textarea = textareaRef.current
      if (!textarea) return
      textarea.setSelectionRange(textarea.selectionEnd, textarea.selectionEnd)
      textarea.focus({ preventScroll: true })
    })
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
    if (fixture) setContent(fixture.before)
    else if (!undo()) return
    phaseRef.current = 'reject'
    setZoomPhase('reject')
  }, [undo, fixture, setContent])

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
    const hooks = {
      onStart: (source: string, range: RewriteRange | null) => {
        if (textareaRef.current && range) editOriginRef.current = readEditOrigin(textareaRef.current, range, source)
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
      onEnd: (full: string) => {
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
    }
    if (fixture) {
      props.onLoadingStateChange?.(true, operation)
      hooks.onStart(fixture.before, fixture.range)
      previewTimer.current = setTimeout(() => {
        setContent(fixture.after)
        props.onLoadingStateChange?.(false, operation, { beforeCount: wordCount(fixture.before), afterCount: wordCount(fixture.after) })
        hooks.onEnd(fixture.after)
      }, 1100)
    } else void handleRewrite(operation, hooks)
  }, [handleRewrite, onSettled, onTransitioningChange, fixture, setContent, textareaRef, props.onLoadingStateChange])

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
        if (event.key === 'Enter' && event.target instanceof HTMLElement && event.target.closest('button')) return
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
        minHeight: shouldExpand ? REST_HEIGHT : '200px',
        height: Math.max(textHeight, overlayOpen ? overlayHeight + 80 : 0),
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
          onHeightChange={setOverlayHeight}
        />
      )}

      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => {
          setContent(e.target.value)
          handleSelectionChange()
        }}
        className={`w-full min-h-[200px] resize-none text-[20px] leading-relaxed bg-transparent border-none outline-none px-0 pt-0 pb-0 relative ${
          isLoading && !overlayReady && !focusRange ? 'text-shimmer' : 'text-slate-900'
        }`}
        style={{
          caretColor: 'var(--workspace-accent, #06b6d4)',
          height: textHeight,
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
        visible={(hasSelection || operationOpen) && !historyMorph && !!controlAnchor}
        mode={operationOpen ? showDock ? 'review' : zoomPhase === 'stream' ? 'working' : 'settling' : 'choose'}
        pinned={controlAnchor?.pinned}
        onBackToEdit={backToEdit}
        onAccept={acceptReview}
        onReject={rejectReview}
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
