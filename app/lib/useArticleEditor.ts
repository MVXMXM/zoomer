'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { streamRewrite, wordCount } from '@/app/lib/rewriteClient'
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

  const handleRewrite = useCallback(
    async (
      operation: ZoomOperation,
      hooks?: {
        onStart?: (oldText: string) => void
        onUpdate?: (text: string) => void
        onEnd?: (text: string) => void
      },
    ) => {
      if (!content.trim()) {
        setError(`Please enter some text to ${operation}.`)
        setTimeout(() => setError(null), 3000)
        return
      }

      const beforeCount = wordCount(content)
      const oldText = content
      setIsLoading(true)
      setError(null)
      setActiveButton(operation)
      setHasPerformedFirstZoom(true)
      textareaRef.current?.blur()
      hooks?.onStart?.(oldText)

      try {
        const result = await streamRewrite(oldText, operation, (full) => {
          setContent(full)
          hooks?.onUpdate?.(full)
        })
        onLoadingStateChange?.(false, operation, { beforeCount, afterCount: wordCount(result) })
        setLastGeneratedContent(result)
        hooks?.onEnd?.(result)
      } catch (err) {
        console.error(`Error ${operation}ing text:`, err)
        setError(`Failed to ${operation} text. Please try again.`)
        setTimeout(() => setError(null), 3000)
        setContent(oldText)
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
    handleRewrite,
  }
}
