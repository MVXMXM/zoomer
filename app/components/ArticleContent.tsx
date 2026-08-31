'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ControlBar } from '@/app/components/ControlBar'
import { WordBlurOverlay } from '@/app/components/WordBlurOverlay'
import { useArticleEditor } from '@/app/lib/useArticleEditor'
import { useBoxWidth } from '@/app/lib/useBoxWidth'
import type { ZoomArticleProps } from '@/app/types/zoom'

const REST_HEIGHT = 'calc(100dvh - 96px - 32px)'

export function ArticleContent(props: ZoomArticleProps) {
  const { onTransitioningChange } = props
  const {
    content,
    setContent,
    isLoading,
    error,
    activeButton,
    shouldExpand,
    hasPerformedFirstZoom,
    textareaRef,
    handleRewrite,
  } = useArticleEditor(props)
  const boxRef = useRef<HTMLDivElement>(null)
  const width = useBoxWidth(boxRef)
  const [oldText, setOldText] = useState('')
  const [destText, setDestText] = useState('')
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [overlayReady, setOverlayReady] = useState(false)
  const [streaming, setStreaming] = useState(false)

  useEffect(() => {
    onTransitioningChange?.(overlayOpen || isLoading)
  }, [overlayOpen, isLoading, onTransitioningChange])

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
    setOverlayOpen(false)
    setOverlayReady(false)
    setStreaming(false)
    setOldText('')
    setDestText('')
  }, [])

  const start = (operation: 'expand' | 'contract') => {
    void handleRewrite(operation, {
      onStart: (source) => {
        setOldText(source)
        setDestText('')
        setOverlayReady(false)
        setOverlayOpen(true)
        setStreaming(true)
      },
      onEnd: (full) => {
        setDestText(full)
        setStreaming(false)
      },
    })
  }

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
          oldText={oldText}
          newText={destText}
          width={width}
          streaming={streaming}
          onReady={onReady}
          onSettled={onSettled}
        />
      )}

      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full min-h-[200px] resize-none text-[20px] leading-relaxed bg-transparent border-none outline-none px-0 pt-0 pb-[132px] relative text-slate-900"
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
        autoFocus={!hasPerformedFirstZoom}
        disabled={isLoading || overlayOpen}
      />

      <ControlBar
        visible={shouldExpand}
        disabled={isLoading || overlayOpen || !!activeButton}
        onContract={() => start('contract')}
        onExpand={() => start('expand')}
      />

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-red-50 text-red-700 px-4 py-2 rounded-lg shadow-lg border border-red-200 z-40"
        >
          {error}
        </motion.div>
      )}
    </div>
  )
}
