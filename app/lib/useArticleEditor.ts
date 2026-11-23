'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  selectionRange,
  stitchRewrite,
  streamRewrite,
  wordCount,
  type RewriteRange,
} from '@/app/lib/rewriteClient'
import type { ZoomDegree, ZoomOperation } from '@/app/types/zoom'

const HISTORY_CAP = 20

function isAbortError(err: unknown) {
  return err instanceof Error && err.name === 'AbortError'
}

export function useArticleEditor(initialContent: string) {
  const [content, setContent] = useState(initialContent)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeButton, setActiveButton] = useState<ZoomOperation | null>(null)
  const [hasSelection, setHasSelection] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const selectionRef = useRef<RewriteRange>({ start: 0, end: 0 })
  const [selectionWordCount, setSelectionWordCount] = useState(0)
  const contentRef = useRef(content)
  const pastRef = useRef<string[]>([])
  const futureRef = useRef<string[]>([])
  const abortRef = useRef<AbortController | null>(null)
  contentRef.current = content

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const end = textarea.value.length
    textarea.setSelectionRange(end, end)
    textarea.focus({ preventScroll: true })
  }, [])

  const rememberSelection = useCallback(() => {
    const el = textareaRef.current
    if (!el || document.activeElement !== el) return
    const range = selectionRange(contentRef.current, el.selectionStart, el.selectionEnd)
    selectionRef.current = range ?? { start: el.selectionStart, end: el.selectionStart }
    setHasSelection(Boolean(range))
    setSelectionWordCount(range ? wordCount(el.value.slice(range.start, range.end)) : 0)
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

  const undo = useCallback((): { from: string; to: string } | null => {
    const prev = pastRef.current[pastRef.current.length - 1]
    if (prev === undefined) return null
    const from = contentRef.current
    futureRef.current = [...futureRef.current, from]
    pastRef.current = pastRef.current.slice(0, -1)
    restoreContent(prev)
    return { from, to: prev }
  }, [restoreContent])

  const redo = useCallback((): { from: string; to: string } | null => {
    const next = futureRef.current[futureRef.current.length - 1]
    if (next === undefined) return null
    const from = contentRef.current
    pastRef.current = [...pastRef.current, from].slice(-HISTORY_CAP)
    futureRef.current = futureRef.current.slice(0, -1)
    restoreContent(next)
    return { from, to: next }
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

      const el = textareaRef.current
      const live = el && document.activeElement === el
        ? selectionRange(content, el.selectionStart, el.selectionEnd)
        : null
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
      textareaRef.current?.blur()
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
        pastRef.current = [...pastRef.current, oldText].slice(-HISTORY_CAP)
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
  }
}
