'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  selectionRange,
  stitchRewrite,
  streamRewrite,
  wordCount,
  type RewriteRange,
} from '@/app/lib/rewriteClient'
import type { ZoomArticleProps, ZoomOperation } from '@/app/types/zoom'

const HISTORY_CAP = 20

type Headline = {
  type: ZoomOperation
  beforeCount: number
  afterCount: number
} | null

type HistoryEntry = {
  content: string
  headline: Headline
}

function isAbortError(err: unknown) {
  return err instanceof Error && err.name === 'AbortError'
}

export function useArticleEditor({
  initialContent,
  onLoadingStateChange,
  onWordCountChange,
  onHasTextChange,
  onContentManuallyEdited,
  onEngagementChange,
}: ZoomArticleProps) {
  const [content, setContent] = useState(initialContent)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeButton, setActiveButton] = useState<ZoomOperation | null>(null)
  const [hasText, setHasText] = useState(initialContent.trim().length > 0)
  const [shouldExpand, setShouldExpand] = useState(initialContent.trim().length > 0)
  const [hasPerformedFirstZoom, setHasPerformedFirstZoom] = useState(false)
  const [lastGeneratedContent, setLastGeneratedContent] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const selectionRef = useRef<RewriteRange>({ start: 0, end: 0 })
  const contentRef = useRef(content)
  const pastRef = useRef<HistoryEntry[]>([])
  const futureRef = useRef<HistoryEntry[]>([])
  const headlineRef = useRef<Headline>(null)
  const abortRef = useRef<AbortController | null>(null)
  contentRef.current = content

  useEffect(() => {
    onLoadingStateChange?.(isLoading, activeButton)
  }, [isLoading, activeButton, onLoadingStateChange])

  useEffect(() => {
    onWordCountChange?.(wordCount(content))
  }, [content, onWordCountChange])

  useEffect(() => {
    if (isLoading) return
    const hasContent = content.trim().length > 0
    if (hasContent !== hasText) {
      setHasText(hasContent)
      onHasTextChange?.(hasContent)
    }
  }, [content, hasText, onHasTextChange, isLoading])

  useEffect(() => {
    if (isLoading) return
    if (!hasText) {
      setShouldExpand(false)
      return
    }
    const timeoutId = setTimeout(() => setShouldExpand(true), 500)
    return () => clearTimeout(timeoutId)
  }, [content, hasText, isLoading])

  useEffect(() => {
    onEngagementChange?.(shouldExpand)
  }, [shouldExpand, onEngagementChange])

  useEffect(() => {
    if (!isLoading && lastGeneratedContent && content !== lastGeneratedContent && content.trim().length > 0) {
      onContentManuallyEdited?.()
      setLastGeneratedContent('')
    }
  }, [content, lastGeneratedContent, isLoading, onContentManuallyEdited])

  const autoResize = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
      textareaRef.current.style.overflow = 'hidden'
    }
  }, [])

  useEffect(() => {
    if (isLoading || shouldExpand) return
    autoResize()
  }, [content, autoResize, isLoading, shouldExpand])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const rememberSelection = useCallback(() => {
    const el = textareaRef.current
    if (!el || document.activeElement !== el) return
    selectionRef.current = { start: el.selectionStart, end: el.selectionEnd }
  }, [])

  const snapshot = useCallback(
    (): HistoryEntry => ({
      content: contentRef.current,
      headline: headlineRef.current,
    }),
    [],
  )

  const applyEntry = useCallback(
    (entry: HistoryEntry) => {
      setContent(entry.content)
      setLastGeneratedContent(entry.headline ? entry.content : '')
      headlineRef.current = entry.headline
      if (entry.headline) {
        onLoadingStateChange?.(false, entry.headline.type, {
          beforeCount: entry.headline.beforeCount,
          afterCount: entry.headline.afterCount,
        })
      } else {
        onContentManuallyEdited?.()
      }
    },
    [onLoadingStateChange, onContentManuallyEdited],
  )

  const abortRewrite = useCallback(() => {
    if (!abortRef.current) return false
    abortRef.current.abort()
    return true
  }, [])

  const undo = useCallback((): { from: string; to: string } | null => {
    const prev = pastRef.current[pastRef.current.length - 1]
    if (!prev) return null
    const from = contentRef.current
    futureRef.current = [...futureRef.current, snapshot()]
    pastRef.current = pastRef.current.slice(0, -1)
    applyEntry(prev)
    return { from, to: prev.content }
  }, [applyEntry, snapshot])

  const redo = useCallback((): { from: string; to: string } | null => {
    const next = futureRef.current[futureRef.current.length - 1]
    if (!next) return null
    const from = contentRef.current
    pastRef.current = [...pastRef.current, snapshot()].slice(-HISTORY_CAP)
    futureRef.current = futureRef.current.slice(0, -1)
    applyEntry(next)
    return { from, to: next.content }
  }, [applyEntry, snapshot])

  const handleRewrite = useCallback(
    async (
      operation: ZoomOperation,
      hooks?: {
        onStart?: (oldText: string, range: RewriteRange | null) => void
        onUpdate?: (text: string) => void
        onEnd?: (text: string) => void
        onError?: () => void
      },
    ) => {
      if (!content.trim()) {
        setError(`Please enter some text to ${operation}.`)
        setTimeout(() => setError(null), 3000)
        return
      }

      if (abortRef.current) return

      const el = textareaRef.current
      const live = el
        ? selectionRange(content, el.selectionStart, el.selectionEnd)
        : null
      const remembered = selectionRange(
        content,
        selectionRef.current.start,
        selectionRef.current.end,
      )
      const range = live ?? remembered
      const excerpt = range ? content.slice(range.start, range.end) : null

      const beforeCount = wordCount(content)
      const oldText = content
      const priorHeadline = headlineRef.current
      const controller = new AbortController()
      abortRef.current = controller
      setIsLoading(true)
      setError(null)
      setActiveButton(operation)
      setHasPerformedFirstZoom(true)
      textareaRef.current?.blur()
      hooks?.onStart?.(oldText, range)

      try {
        const result = await streamRewrite(
          excerpt ?? oldText,
          operation,
          (chunk) => {
            if (controller.signal.aborted) return
            const next = excerpt ? stitchRewrite(oldText, range, chunk) : chunk
            setContent(next)
            hooks?.onUpdate?.(next)
          },
          excerpt
            ? { excerpt: true, context: oldText, signal: controller.signal }
            : { signal: controller.signal },
        )
        if (abortRef.current === controller) abortRef.current = null
        if (controller.signal.aborted) {
          setContent(oldText)
          hooks?.onError?.()
          return
        }
        if (!result.trim()) throw new Error('Empty rewrite')
        const next = excerpt ? stitchRewrite(oldText, range, result) : result
        pastRef.current = [...pastRef.current, { content: oldText, headline: priorHeadline }].slice(
          -HISTORY_CAP,
        )
        futureRef.current = []
        const afterCount = wordCount(next)
        headlineRef.current = { type: operation, beforeCount, afterCount }
        onLoadingStateChange?.(false, operation, { beforeCount, afterCount })
        setLastGeneratedContent(next)
        setContent(next)
        hooks?.onEnd?.(next)
      } catch (err) {
        setContent(oldText)
        hooks?.onError?.()
        if (isAbortError(err) || controller.signal.aborted) return
        console.error(`Error ${operation}ing text:`, err)
        setError(`Failed to ${operation} text. Please try again.`)
        setTimeout(() => setError(null), 3000)
      } finally {
        if (abortRef.current === controller) abortRef.current = null
        setIsLoading(false)
        setActiveButton(null)
      }
    },
    [content, onLoadingStateChange],
  )

  return {
    content,
    setContent,
    isLoading,
    error,
    activeButton,
    shouldExpand,
    hasPerformedFirstZoom,
    textareaRef,
    rememberSelection,
    handleRewrite,
    abortRewrite,
    undo,
    redo,
  }
}
