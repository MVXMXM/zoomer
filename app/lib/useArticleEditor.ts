'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  selectionRange,
  stitchRewrite,
  streamRewrite,
  wordCount,
  type RewriteRange,
} from '@/app/lib/rewriteClient'
import { editorSelection, setEditorSelection } from '@/app/lib/editorDocument'
import type { ZoomDegree, ZoomOperation } from '@/app/types/zoom'

const HISTORY_CAP = 20

type HistoryEntry = { content: string; rewrite: boolean }

function isAbortError(err: unknown) {
  return err instanceof Error && err.name === 'AbortError'
}

export function useArticleEditor(initialContent: string) {
  const [content, setContent] = useState(initialContent)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeButton, setActiveButton] = useState<ZoomOperation | null>(null)
  const [hasSelection, setHasSelection] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const selectionRef = useRef<RewriteRange>({ start: 0, end: 0 })
  const [selectionWordCount, setSelectionWordCount] = useState(0)
  const contentRef = useRef(content)
  const pastRef = useRef<HistoryEntry[]>([])
  const futureRef = useRef<HistoryEntry[]>([])
  const inputGroup = useRef<{ type: string; time: number } | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  contentRef.current = content

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const end = editor.textContent?.length ?? 0
    editor.focus({ preventScroll: true })
    setEditorSelection(editor, end, end)
  }, [])

  const rememberSelection = useCallback(() => {
    const el = editorRef.current
    if (!el || document.activeElement !== el) return
    const current = editorSelection(el)
    if (!current) return
    const source = el.textContent ?? ''
    const range = selectionRange(source, current.start, current.end)
    selectionRef.current = range ?? { start: current.start, end: current.start }
    setHasSelection(Boolean(range))
    setSelectionWordCount(range ? wordCount(source.slice(range.start, range.end)) : 0)
  }, [])

  const restoreContent = useCallback((text: string) => {
    setContent(text)
    setHasSelection(false)
    selectionRef.current = { start: 0, end: 0 }
  }, [])

  const abortRewrite = useCallback(() => {
    if (!abortRef.current) return false
    abortRef.current.abort()
    return true
  }, [])

  const editContent = useCallback((text: string, inputType?: string) => {
    const previous = contentRef.current
    if (previous === text) return
    const now = Date.now()
    const group = inputGroup.current
    if (!inputType || inputType !== group?.type || now - group.time > 750) {
      pastRef.current = [...pastRef.current, { content: previous, rewrite: false }].slice(-HISTORY_CAP)
    }
    inputGroup.current = inputType ? { type: inputType, time: now } : null
    futureRef.current = []
    contentRef.current = text
    setContent(text)
  }, [])

  const undo = useCallback(() => {
    const prev = pastRef.current.at(-1)
    if (!prev) return null
    const from = contentRef.current
    inputGroup.current = null
    futureRef.current = [...futureRef.current, { content: from, rewrite: prev.rewrite }]
    pastRef.current = pastRef.current.slice(0, -1)
    restoreContent(prev.content)
    return { from, to: prev.content, rewrite: prev.rewrite }
  }, [restoreContent])

  const redo = useCallback(() => {
    const next = futureRef.current.at(-1)
    if (!next) return null
    const from = contentRef.current
    inputGroup.current = null
    pastRef.current = [...pastRef.current, { content: from, rewrite: next.rewrite }].slice(-HISTORY_CAP)
    futureRef.current = futureRef.current.slice(0, -1)
    restoreContent(next.content)
    return { from, to: next.content, rewrite: next.rewrite }
  }, [restoreContent])

  const handleRewrite = useCallback(
    async (
      operation: ZoomOperation,
      degree: ZoomDegree,
      hooks?: {
        onStart?: (oldText: string, range: RewriteRange | null) => void
        onEnd?: (text: string) => void
        onError?: () => void
      },
      targetWords?: number,
      wholeDocument = false,
    ) => {
      if (!content.trim()) {
        setError(`Please enter some text to ${operation}.`)
        setTimeout(() => setError(null), 3000)
        return
      }

      if (abortRef.current) return

      const el = editorRef.current
      const current = el && document.activeElement === el ? editorSelection(el) : null
      const live = current ? selectionRange(content, current.start, current.end) : null
      const remembered = selectionRange(
        content,
        selectionRef.current.start,
        selectionRef.current.end,
      )
      const range = wholeDocument ? { start: 0, end: content.length } : live ?? remembered
      if (!range) {
        setHasSelection(false)
        setError(`Select some text to ${operation}.`)
        setTimeout(() => setError(null), 3000)
        return
      }
      const excerpt = content.slice(range.start, range.end)

      const oldText = content
      const controller = new AbortController()
      abortRef.current = controller
      setIsLoading(true)
      setError(null)
      setActiveButton(operation)
      setHasSelection(false)
      selectionRef.current = { start: 0, end: 0 }
      editorRef.current?.blur()
      hooks?.onStart?.(oldText, range)

      try {
        const result = await streamRewrite(
          excerpt,
          operation,
          degree,
          (chunk) => {
            if (controller.signal.aborted) return
            const next = stitchRewrite(oldText, range, chunk)
            setContent(next)
          },
          {
            boundaries: wholeDocument ? undefined : { before: oldText.slice(0, range.start), after: oldText.slice(range.end) },
            signal: controller.signal,
            targetWords,
          },
        )
        if (abortRef.current === controller) abortRef.current = null
        if (controller.signal.aborted) {
          setContent(oldText)
          hooks?.onError?.()
          return
        }
        if (!result.trim()) throw new Error('Empty rewrite')
        const next = stitchRewrite(oldText, range, result)
        inputGroup.current = null
        pastRef.current = [...pastRef.current, { content: oldText, rewrite: true }].slice(-HISTORY_CAP)
        futureRef.current = []
        setContent(next)
        hooks?.onEnd?.(next)
      } catch (err) {
        setContent(oldText)
        hooks?.onError?.()
        if (isAbortError(err) || controller.signal.aborted) return
        if (!(err instanceof RangeError)) console.error(`Error ${operation}ing text:`, err)
        setError(err instanceof RangeError ? err.message : `Failed to ${operation} text. Please try again.`)
        setTimeout(() => setError(null), 3000)
      } finally {
        if (abortRef.current === controller) abortRef.current = null
        setIsLoading(false)
        setActiveButton(null)
      }
    },
    [content],
  )

  return {
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
  }
}
