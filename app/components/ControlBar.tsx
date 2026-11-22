'use client'

import { SegmentedController } from '@mvxmxm/maxos'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { LoaderCircle, Microscope, Telescope } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import type { SelectionMenuSettings } from '@/app/lib/selectionMenuSettings'
import type { ZoomDegree, ZoomOperation } from '@/app/types/zoom'
import { zoomTargets } from '@/app/lib/zoomTargets'

type ControlBarProps = {
  sourceWords: number
  reviewTop?: number
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
  onZoom: (operation: ZoomOperation, degree: ZoomDegree) => void
  review?: { onAccept: () => void; onReject: () => void }
}

const reviewSegments = [
  { id: 'reject', label: 'Reject' },
  { id: 'accept', label: 'Accept' },
] as const

const zoomStops = [
  ['contract', 3, 'Strong distillation'],
  ['contract', 2, 'Medium distillation'],
  ['contract', 1, 'Light distillation'],
  null,
  ['expand', 1, 'Light extrapolation'],
  ['expand', 2, 'Medium extrapolation'],
  ['expand', 3, 'Strong extrapolation'],
] as const

export function ControlBar({ sourceWords, reviewTop, menuRef, settings, visible, anchor, disabled, loading, onZoom, review }: ControlBarProps) {
  const stops = zoomTargets(sourceWords)
  const availableStops = zoomStops.filter((stop) =>
    !stop || stops.some(({ operation, degree }) => operation === stop[0] && degree === stop[1]),
  )
  const neutralIndex = availableStops.indexOf(null)
  const [dragPosition, setDragPosition] = useState<number | null>(null)
  const dragIndex = dragPosition === null ? null : Math.floor(dragPosition)
  const bandPosition = dragPosition ?? neutralIndex + 0.5
  const bandStart = Math.max(0, Math.min(neutralIndex, bandPosition - 0.5))
  const bandEnd = Math.min(availableStops.length, Math.max(neutralIndex + 1, bandPosition + 0.5))
  const notchPosition = dragIndex === null || dragIndex === neutralIndex
    ? 'left-1/2 -translate-x-1/2'
    : dragIndex < neutralIndex ? 'left-1.5' : 'right-1.5'
  const pointerId = useRef<number | null>(null)
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null)
  const [focusedLabel, setFocusedLabel] = useState<string | null>(null)
  const selectedLabel = `${sourceWords} selected ${sourceWords === 1 ? 'word' : 'words'}`
  const activeStop = dragIndex === null ? null : availableStops[dragIndex]
  const activeTarget = activeStop && stops.find(({ operation, degree }) => operation === activeStop[0] && degree === activeStop[1])
  const dragLabel = activeTarget
    ? `${activeTarget.operation === 'contract' ? 'Distill' : 'Extrapolate'} to ${activeTarget.target} ${activeTarget.target === 1 ? 'word' : 'words'}`
    : selectedLabel

  const positionAtPointer = (event: PointerEvent<HTMLDivElement>) => {
    const { left, width } = event.currentTarget.getBoundingClientRect()
    return Math.max(0.5, Math.min(availableStops.length - 0.5, (event.clientX - left) / width * availableStops.length))
  }

  const clearDrag = () => {
    pointerId.current = null
    setDragPosition(null)
  }
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
      className={reviewTop === undefined ? 'fixed z-50' : 'absolute z-50'}
      style={{
        zIndex: 9999,
        left: reviewTop === undefined ? anchor?.x ?? '50%' : '50%',
        top: reviewTop ?? anchor?.y ?? '100%',
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
            <div role="status" className="flex h-full items-center gap-2 px-6 text-sm font-medium text-(--slate-950)">
              <LoaderCircle className="size-[18px] motion-safe:animate-spin" aria-hidden="true" />
              Zooming…
            </div>
          ) : reviewing ? (
            <SegmentedController<string>
              bordered={false}
              label="Zoom result"
              items={reviewSegments}
              value="idle"
              onChange={(value) => {
                if (value === 'accept') review?.onAccept()
                if (value === 'reject') review?.onReject()
              }}
            />
          ) : (
            <div className="flex h-full w-[min(18rem,calc(100vw-2rem))] flex-col justify-center gap-1 px-3" role="group" aria-label="Semantic zoom strength">
              <div className="flex items-center justify-center">
                <span className="text-xs font-semibold tabular-nums text-(--slate-800)">{dragIndex === null ? hoveredLabel ?? focusedLabel ?? selectedLabel : dragLabel}</span>
              </div>
              <div className="flex h-7 items-center rounded-full bg-(--slate-100) text-(--slate-600)">
                <div
                  className={`relative grid h-full min-w-0 flex-1 touch-none select-none ${dragIndex === null ? 'cursor-grab' : 'cursor-grabbing'}`}
                  style={{ gridTemplateColumns: `repeat(${availableStops.length}, minmax(0, 1fr))` }}
                  onPointerDown={(event) => {
                    if (disabled || !event.isPrimary || event.button !== 0 || pointerId.current !== null) return
                    event.preventDefault()
                    event.currentTarget.setPointerCapture(event.pointerId)
                    pointerId.current = event.pointerId
                    setDragPosition(positionAtPointer(event))
                  }}
                  onPointerMove={(event) => {
                    if (pointerId.current === event.pointerId) setDragPosition(positionAtPointer(event))
                  }}
                  onPointerUp={(event) => {
                    if (pointerId.current !== event.pointerId) return
                    const stop = availableStops[Math.floor(positionAtPointer(event))]
                    clearDrag()
                    setHoveredLabel(null)
                    if (!disabled && stop) onZoom(stop[0], stop[1])
                  }}
                  onLostPointerCapture={clearDrag}
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0.5 rounded-full bg-(--accent)"
                    style={{
                      left: `${bandStart / availableStops.length * 100}%`,
                      right: `${(1 - bandEnd / availableStops.length) * 100}%`,
                    }}
                  >
                    <span
                      className={`absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-full bg-(--slate-600) ${notchPosition}`}
                    />
                  </span>
                  {stops.some(({ operation }) => operation === 'contract') && (
                    <Microscope size={16} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2" aria-hidden="true" />
                  )}
                  {stops.some(({ operation }) => operation === 'expand') && (
                    <Telescope size={16} className="pointer-events-none absolute right-3 top-1/2 z-10 -translate-y-1/2" aria-hidden="true" />
                  )}
                  {availableStops.map((stop) => {
                    if (!stop) {
                      return (
                        <span key="neutral" role="img" aria-label="Neutral" />
                      )
                    }
                    const [operation, degree, label] = stop
                    const target = stops.find((stop) => stop.operation === operation && stop.degree === degree)?.target
                    if (target === undefined) return null
                    const action = operation === 'contract' ? 'Distill' : 'Extrapolate'
                    const preview = `${action} to ${target} ${target === 1 ? 'word' : 'words'}`
                    return (
                      <div
                        key={label}
                        className="relative min-w-0"
                        onMouseEnter={() => setHoveredLabel(preview)}
                        onMouseLeave={() => setHoveredLabel(null)}
                      >
                        <button
                          type="button"
                          aria-label={`${label}, ${preview}`}
                          onFocus={() => setFocusedLabel(preview)}
                          onBlur={() => setFocusedLabel(null)}
                          onClick={(event) => {
                            if (event.detail !== 0) return
                            setHoveredLabel(null)
                            setFocusedLabel(null)
                            onZoom(operation, degree)
                          }}
                          className="grid size-full cursor-inherit place-items-center rounded-full focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--slate-950)"
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </fieldset>
      </motion.div>
    </div>
  )
}
