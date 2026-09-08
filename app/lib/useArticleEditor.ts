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
    if (!el) return
    selectionRef.current = { start: el.selectionStart, end: el.selectionEnd }
  }, [])

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
            const next = excerpt ? stitchRewrite(oldText, range, chunk) : chunk
            setContent(next)
            hooks?.onUpdate?.(next)
          },
          excerpt ? { excerpt: true, context: oldText } : undefined,
        )
        if (!result.trim()) throw new Error('Empty rewrite')
        const next = excerpt ? stitchRewrite(oldText, range, result) : result
        onLoadingStateChange?.(false, operation, { beforeCount, afterCount: wordCount(next) })
        setLastGeneratedContent(next)
        setContent(next)
        hooks?.onEnd?.(next)
      } catch (err) {
        console.error(`Error ${operation}ing text:`, err)
        setError(`Failed to ${operation} text. Please try again.`)
        setTimeout(() => setError(null), 3000)
        setContent(oldText)
        hooks?.onError?.()
      } finally {
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
  }
}
