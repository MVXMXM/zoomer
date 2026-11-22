'use client'

import { useCallback, useEffect, useState } from 'react'
import { MorphingText } from '@/registry/magicui/morphing-text'
import { ArticleContent } from '@/app/components/ArticleContent'
import { LINE_HEIGHT } from '@/app/lib/zoomMetrics'
import type { ZoomOperation } from '@/app/types/zoom'
import zoomerVersion from '@/zoomer-version.json'

export function ZoomWorkspace() {
  const appearance = {
    layout: {
      contentWidth: 650,
      horizontalPadding: 16,
      verticalPadding: 48,
    },
    colors: {
      background: '#f8fafc',
      accent: '#06b6d4',
    },
    heading: {
      fontSize: 20,
      weight: 700,
      motionDuration: 0.4,
      motionBlur: 4,
      motionDistance: 10,
    },
  }
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
        Welcome to Zoomer <span className="font-normal">(v{zoomerVersion.version})</span>
      </>
    )
  }

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center [overflow-anchor:none]"
      style={{ backgroundColor: appearance.colors.background, '--workspace-accent': appearance.colors.accent } as React.CSSProperties}
    >
      <div
        id="top"
        className="w-full mx-auto [overflow-anchor:none]"
        style={{
          maxWidth: appearance.layout.contentWidth,
          paddingInline: appearance.layout.horizontalPadding,
          paddingBlock: appearance.layout.verticalPadding,
        }}
      >
        <h1
          className="relative m-0 mb-0 shrink-0 overflow-hidden text-[20px] font-bold text-left text-[#06b6d4]"
          style={{ height: LINE_HEIGHT, lineHeight: `${LINE_HEIGHT}px`, letterSpacing: '-0.01em', fontSize: appearance.heading.fontSize, fontWeight: appearance.heading.weight, color: appearance.colors.accent }}
        >
          <MorphingText
            className="absolute inset-0 whitespace-nowrap"
            duration={appearance.heading.motionDuration}
            blur={appearance.heading.motionBlur}
            distance={appearance.heading.motionDistance}
          >
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
