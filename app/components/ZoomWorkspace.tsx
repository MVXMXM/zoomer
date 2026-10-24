'use client'

import { useCallback, useEffect, useState } from 'react'
import { MorphingText } from '@/registry/magicui/morphing-text'
import { ArticleContent } from '@/app/components/ArticleContent'
import { LINE_HEIGHT } from '@/app/lib/zoomMetrics'
import type { ZoomOperation } from '@/app/types/zoom'

export function ZoomWorkspace() {
  const [isLoading, setIsLoading] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [activeButton, setActiveButton] = useState<ZoomOperation | null>(null)
  const [hasText, setHasText] = useState(false)
  const [hasSelection, setHasSelection] = useState(false)
  const [lastOperation, setLastOperation] = useState<{
    type: ZoomOperation
    beforeCount: number
    afterCount: number
  } | null>(null)
  const chromeBusy = isLoading || isTransitioning

  useEffect(() => {
    if (!hasText) {
      setLastOperation(null)
    }
  }, [hasText])

  const handleLoadingStateChange = useCallback(
    (
      loading: boolean,
      button: ZoomOperation | null,
      operationSummary?: { beforeCount: number; afterCount: number },
    ) => {
      setIsLoading(loading)
      setActiveButton(button)
      if (!loading && button && operationSummary) {
        setLastOperation({
          type: button,
          beforeCount: operationSummary.beforeCount,
          afterCount: operationSummary.afterCount,
        })
      }
    },
    [],
  )

  const getTitleContent = () => {
    if (chromeBusy) {
      const op = activeButton ?? lastOperation?.type
      if (op === 'contract') return 'Zooming in...'
      if (op === 'expand') return 'Zooming out...'
    }
    if (hasSelection) {
      return 'Choose a zoom direction'
    }
    if (lastOperation) {
      return (
        <>
          <span className="line-through font-normal">{lastOperation.beforeCount} words</span> {lastOperation.afterCount}{' '}
          words
        </>
      )
    }
    if (hasText) return 'Select text to zoom'
    return (
      <>
        Welcome to Zoomer <span className="font-normal">(v0.1.1)</span>
      </>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center [overflow-anchor:none]">
      <div id="top" className="w-full max-w-[650px] mx-auto px-4 py-12 [overflow-anchor:none]">
        <h1
          className="relative m-0 mb-0 shrink-0 overflow-hidden text-[20px] font-bold text-left text-[#06b6d4]"
          style={{ height: LINE_HEIGHT, lineHeight: `${LINE_HEIGHT}px`, letterSpacing: '-0.01em' }}
        >
          <MorphingText className="absolute inset-0 whitespace-nowrap">
            {getTitleContent()}
          </MorphingText>
        </h1>
        <ArticleContent
          initialContent=""
          onLoadingStateChange={handleLoadingStateChange}
          onHasTextChange={setHasText}
          onContentManuallyEdited={() => setLastOperation(null)}
          onSelectionChange={setHasSelection}
          onTransitioningChange={setIsTransitioning}
        />
      </div>
    </main>
  )
}
