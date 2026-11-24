'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { SELECTION_MENU_SETTINGS } from '@/app/lib/selectionMenuSettings'
import { ControlBar } from '@/app/components/ControlBar'
import { zoomTargets } from '@/app/lib/zoomTargets'
import { WordBlurOverlay, type BlurPhase } from '@/app/components/WordBlurOverlay'
import { useArticleEditor } from '@/app/lib/useArticleEditor'
import { useBoxWidth } from '@/app/lib/useBoxWidth'
import { editorLineBreak, editorSelection, expandEditorRange, renderEditorDocument, setEditorSelection } from '@/app/lib/editorDocument'
import { editorShortcut } from '@/app/lib/editorShortcuts'
import { wordCount, type RewriteRange } from '@/app/lib/rewriteClient'
import type { ZoomDegree, ZoomOperation } from '@/app/types/zoom'

const VIEWPORT_MARGIN = 12

type ControlAnchor = {
  x: number
  y: number
  placement: 'above' | 'below'
}

function getControlAnchor(editor: HTMLDivElement, width: number, height: number, gap: number): ControlAnchor | null {
  const selected = editorSelection(editor)
  const viewport = editor.getBoundingClientRect()
  const rects = selected && selected.start !== selected.end
    ? Array.from(selected.range.getClientRects()).filter((rect) => rect.width && rect.bottom > viewport.top && rect.top < viewport.bottom)
    : []
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
    editContent,
    isLoading,
    error,
    activeButton,
    hasSelection,
    selectionWordCount,
    editorRef,
    rememberSelection,
    handleRewrite,
    abortRewrite,
    undo,
    redo,
  } = useArticleEditor(initialContent)
  const pendingMarkup = useRef<{ source: string; offset: number; marker: string } | null>(null)
  const placeholderRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const width = useBoxWidth(editorRef)
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
  useLayoutEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const selected = editorSelection(editor)
    if (renderEditorDocument(editor, content) && selected) {
      setEditorSelection(editor, Math.min(content.length, selected.start), Math.min(content.length, selected.end))
    }
  }, [content, editorRef])

  useLayoutEffect(() => {
    if (placeholderRef.current) renderEditorDocument(placeholderRef.current, initialContent)
  }, [initialContent])

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
  const [selectionPreviewWords, setSelectionPreviewWords] = useState<number | null>(null)
  const phaseRef = useRef<ZoomPhase>('idle')
  phaseRef.current = zoomPhase
  const showDock = zoomPhase === 'arrive' || zoomPhase === 'review'
  const keepReviewActions = showDock || zoomPhase === 'accept' || zoomPhase === 'reject'
  const documentControlWords = wordCount(zoomPhase === 'stream' ? oldText : keepReviewActions ? destText : content)
  const documentPreviewWords = selectionPreviewWords !== null && hasSelection && !overlayOpen && !isLoading
    ? documentControlWords + selectionPreviewWords - selectionWordCount
    : undefined
  const previousDocumentWords = keepReviewActions ? wordCount(oldText) : undefined
  const overlayPhase: BlurPhase = historyMorph ? 'history' : zoomPhase === 'idle' ? 'stream' : zoomPhase
  const [controlAnchor, setControlAnchor] = useState<ControlAnchor | null>(null)
  const [reviewBottom, setReviewBottom] = useState<number | null>(null)
  const reviewTop = keepReviewActions && reviewBottom !== null
    ? Math.min(reviewBottom + selectionGap, Math.max(0, editorHeight - controlHeight))
    : undefined

  useLayoutEffect(() => {
    if (overlayOpen && reviewScrollRef.current && editorRef.current) {
      reviewScrollRef.current.scrollTop = editorRef.current.scrollTop
      reviewScrollRef.current.scrollLeft = editorRef.current.scrollLeft
    }
  }, [overlayOpen, editorRef])

  const updateControlAnchor = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    const menu = controlMenuRef.current
    if (!menu) return
    const nextAnchor = getControlAnchor(editor, menu.offsetWidth, menu.offsetHeight, selectionGap)
    setControlAnchor(nextAnchor)
  }, [editorRef, selectionGap])

  const handleSelectionChange = useCallback(() => {
    rememberSelection()
    updateControlAnchor()
  }, [rememberSelection, updateControlAnchor])

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [handleSelectionChange])

  const replaceText = useCallback((editor: HTMLDivElement, start: number, end: number, text: string, anchor: number, head: number) => {
    const source = editor.textContent ?? ''
    const next = source.slice(0, start) + text + source.slice(end)
    renderEditorDocument(editor, next)
    setEditorSelection(editor, anchor, head)
    editContent(next)
    handleSelectionChange()
  }, [editContent, handleSelectionChange])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const handleBeforeInput = (event: InputEvent) => {
      if (!event.cancelable || event.isComposing) return
      const selected = editorSelection(editor)
      if (!selected) return
      const source = editor.textContent ?? ''
      if (event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak') {
        event.preventDefault()
        const bullet = editorShortcut(
          { key: 'Enter', metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, isComposing: false },
          source,
          selected.start,
          selected.end,
        )
        if (bullet) {
          replaceText(editor, bullet.start, bullet.end, bullet.text, bullet.selectionStart, bullet.selectionEnd)
        } else {
          const lineBreak = editorLineBreak(source, selected.start, selected.end)
          replaceText(editor, lineBreak.start, lineBreak.end, lineBreak.text, lineBreak.caret, lineBreak.caret)
        }
        return
      }
      if (selected.start === selected.end) return
      const { start, end } = expandEditorRange(source, selected.start, selected.end)
      if (start === selected.start && end === selected.end) return
      const text = event.inputType.startsWith('delete') ? '' : event.data
      if (text === null) return
      event.preventDefault()
      const caret = start + text.length
      replaceText(editor, start, end, text, caret, caret)
    }
    editor.addEventListener('beforeinput', handleBeforeInput)
    return () => editor.removeEventListener('beforeinput', handleBeforeInput)
  }, [editorRef, replaceText])

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
      const editor = editorRef.current
      if (!editor) return
      editor.focus({ preventScroll: true })
      if (scrollTop !== undefined) editor.scrollTop = scrollTop
      if (scrollLeft !== undefined) editor.scrollLeft = scrollLeft
    })
  }, [editorRef])

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

  const start = useCallback((operation: ZoomOperation, degree: ZoomDegree = 2, targetWords?: number, wholeDocument = false, approximateTarget = false) => {
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
    }, targetWords, wholeDocument, approximateTarget)
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
        if (step.rewrite) playMorph(step.from, step.to)
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
        if (step.rewrite) playMorph(step.from, step.to)
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
          previewWords={documentPreviewWords}
          settings={SELECTION_MENU_SETTINGS}
          visible
          scaleLoadingOperation={zoomPhase === 'stream' ? rewriteOperation : null}
          scaleReviewOperation={keepReviewActions ? rewriteOperation : null}
          disabled={!content.trim() || isLoading || overlayOpen || !!activeButton}
          onZoom={(operation, degree, targetWords, approximateTarget) => start(operation, degree, targetWords, true, approximateTarget)}
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


          <div
            ref={placeholderRef}
            aria-hidden="true"
            hidden={Boolean(content) || overlayOpen}
            className="document-editor-scroll document-text pointer-events-none absolute inset-0 text-[20px] leading-relaxed text-(--slate-500)"
          />

          <div
            ref={editorRef}
            contentEditable={isLoading || overlayOpen ? false : 'plaintext-only'}
            role="textbox"
            aria-label="Document text"
            aria-multiline="true"
            aria-readonly={isLoading || overlayOpen}
            className={`document-editor-scroll document-text block h-full w-full text-[20px] leading-relaxed bg-transparent outline-none relative ${
              isLoading && !overlayReady && !focusRange ? 'text-shimmer' : 'text-foreground'
            }`}
            style={{
              caretColor: 'var(--accent)',
              overflowWrap: 'normal',
              opacity: overlayReady ? 0 : 1,
              pointerEvents: overlayOpen ? 'none' : 'auto',
              zIndex: 2,
            }}
            onInput={(event) => {
              const editor = event.currentTarget
              const { inputType, data, isComposing } = event.nativeEvent as InputEvent
              const pending = pendingMarkup.current
              pendingMarkup.current = null
              if (pending && data && inputType === 'insertText' && !isComposing) {
                const { source, offset, marker } = pending
                const unformatted = source.slice(0, offset) + data + source.slice(offset)
                if (editor.textContent === unformatted) {
                  const next = source.slice(0, offset) + marker + data + marker + source.slice(offset)
                  const caret = offset + marker.length + data.length
                  renderEditorDocument(editor, next)
                  setEditorSelection(editor, caret, caret)
                  editContent(next)
                  handleSelectionChange()
                  return
                }
              }
              const group = inputType === 'insertText' || inputType === 'deleteContentBackward' ? inputType : undefined
              editContent(editor.textContent ?? '', group)
              handleSelectionChange()
            }}
            onKeyDown={(event) => {
              const editor = event.currentTarget
              const selected = editorSelection(editor)
              if (!selected || event.nativeEvent.isComposing) return
              const { start, end } = selected
              const source = editor.textContent ?? ''
              const edit = editorShortcut(event.nativeEvent, source, start, end)
              if (edit) {
                event.preventDefault()
                if ((event.metaKey || event.ctrlKey) && edit.start === edit.end) {
                  const marker = edit.text.slice(0, edit.selectionStart - edit.start)
                  const pending = pendingMarkup.current
                  pendingMarkup.current = pending?.offset === start && pending.marker === marker
                    ? null
                    : { source, offset: start, marker }
                  return
                }
                pendingMarkup.current = null
                replaceText(editor, edit.start, edit.end, edit.text, edit.selectionStart, edit.selectionEnd)
              } else if (event.key === 'Enter' && !overlayOpen) {
                pendingMarkup.current = null
                event.preventDefault()
                const lineBreak = editorLineBreak(source, start, end)
                replaceText(editor, lineBreak.start, lineBreak.end, lineBreak.text, lineBreak.caret, lineBreak.caret)
              } else if (event.key.startsWith('Arrow') || event.key === 'Escape') {
                pendingMarkup.current = null
              }
            }}
            onBlur={() => { pendingMarkup.current = null }}
            onPointerDown={() => { pendingMarkup.current = null }}
            onPaste={(event) => {
              const editor = event.currentTarget
              const selected = editorSelection(editor)
              if (!selected) return
              event.preventDefault()
              const text = event.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n')
              const range = expandEditorRange(editor.textContent ?? '', selected.start, selected.end)
              const caret = range.start + text.length
              pendingMarkup.current = null
              replaceText(editor, range.start, range.end, text, caret, caret)
            }}
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
            onPreviewWordsChange={setSelectionPreviewWords}
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
