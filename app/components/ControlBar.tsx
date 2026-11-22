'use client'

import { SegmentedController } from '@mvxmxm/maxos'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import type { SelectionMenuSettings } from '@/app/lib/selectionMenuSettings'

type ControlBarProps = {
  menuRef: React.Ref<HTMLDivElement>
  settings: SelectionMenuSettings
  visible: boolean
  anchor: {
    x: number
    y: number
    placement: 'above' | 'below'
  } | null
  disabled: boolean
  loading: boolean
  onContract: () => void
  onExpand: () => void
  review?: { onAccept: () => void; onReject: () => void }
}

type ZoomSegment = 'contract' | 'expand' | 'idle' | 'accept' | 'reject'

const zoomSegments = [
  { id: 'contract', label: 'Distill' },
  { id: 'expand', label: 'Extrapolate' },
] as const

const reviewSegments = [
  { id: 'reject', label: 'Reject' },
  { id: 'accept', label: 'Accept' },
] as const

export function ControlBar({ menuRef, settings, visible, anchor, disabled, loading, onContract, onExpand, review }: ControlBarProps) {
  const reduceMotion = useReducedMotion()
  const fieldsetRef = useRef<HTMLFieldSetElement>(null)
  const [contentWidth, setContentWidth] = useState<number>()
  const reviewing = !!review
  useLayoutEffect(() => {
    const content = fieldsetRef.current
    if (!content) return
    const measure = () => setContentWidth(content.offsetWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(content)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!reviewing || !visible) return
    const [reject, accept] = fieldsetRef.current?.querySelectorAll('button') ?? []
    reject?.setAttribute('aria-keyshortcuts', 'Escape')
    accept?.setAttribute('aria-keyshortcuts', 'Enter')
    return () => {
      reject?.removeAttribute('aria-keyshortcuts')
      accept?.removeAttribute('aria-keyshortcuts')
    }
  }, [reviewing, visible])
  const menuMotion = settings.motion
  const hiddenOffset = (anchor?.placement === 'above' ? 1 : -1) * menuMotion.distance

  return (
    <div
      aria-hidden={!visible}
      inert={!visible}
      className="fixed z-50"
      style={{
        zIndex: 9999,
        left: anchor?.x ?? '50%',
        top: anchor?.y ?? '100%',
        pointerEvents: visible ? 'auto' : 'none',
        transform: 'translate3d(-50%, 0, 0)',
      }}
    >
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.94, y: reduceMotion ? 0 : hiddenOffset }}
        animate={{
          opacity: visible ? 1 : 0,
          scale: reduceMotion || visible ? 1 : 0.94,
          y: reduceMotion || visible ? 0 : hiddenOffset,
          width: contentWidth ?? 'max-content',
        }}
        transition={reduceMotion
          ? { duration: 0.1, width: { duration: 0 } }
          : {
              opacity: { duration: visible ? Math.min(0.16, menuMotion.enterDuration) : menuMotion.exitDuration },
              width: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
              scale: visible
                ? { type: 'spring', visualDuration: menuMotion.enterDuration, bounce: menuMotion.bounce }
                : { duration: menuMotion.exitDuration, ease: 'easeIn' },
              y: visible
                ? { type: 'spring', visualDuration: menuMotion.enterDuration, bounce: menuMotion.bounce }
                : { duration: menuMotion.exitDuration, ease: 'easeIn' },
            }
        }
        className={reviewing ? 'selection-segments review-segments w-max' : 'selection-segments w-max'}
        style={{
          transformOrigin: anchor?.placement === 'above' ? '50% 100%' : '50% 0%',
          height: settings.shape.height,
        }}
        onMouseDown={(e) => {
          // Keep the textarea highlight when Distill / Extrapolate is clicked.
          e.preventDefault()
        }}
      >
        <fieldset ref={fieldsetRef} disabled={loading || (disabled && !reviewing)} className="relative left-1/2 m-0 h-full w-max min-w-0 -translate-x-1/2 border-0 p-0">
          {loading ? (
            <div role="status" className="flex h-full items-center gap-2 px-6 text-sm font-medium text-slate-950">
              <LoaderCircle className="size-[18px] motion-safe:animate-spin" aria-hidden="true" />
              Zooming…
            </div>
          ) : (
            <SegmentedController<ZoomSegment>
              bordered={false}
              label={reviewing ? 'Zoom result' : 'Text selection actions'}
              items={reviewing ? reviewSegments : zoomSegments}
              value="idle"
              onChange={(value) => {
                if (value === 'contract') onContract()
                if (value === 'expand') onExpand()
                if (value === 'accept') review?.onAccept()
                if (value === 'reject') review?.onReject()
              }}
            />
          )}
        </fieldset>
      </motion.div>
    </div>
  )
}
