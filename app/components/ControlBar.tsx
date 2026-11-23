'use client'

import { SegmentedController, SliderScale } from '@mvxmxm/maxos'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent } from 'react'
import { Microscope, Telescope } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import type { SelectionMenuSettings } from '@/app/lib/selectionMenuSettings'
import type { ZoomDegree, ZoomOperation } from '@/app/types/zoom'
import { MAX_EXACT_ZOOM_WORDS, zoomTargets } from '@/app/lib/zoomTargets'
import { AnimatedWordCount } from './AnimatedWordCount'

type ControlBarProps = {
  sourceWords: number
  previousWords?: number
  reviewTop?: number
  menuRef?: React.Ref<HTMLDivElement>
  inline?: boolean
  scaleLoadingOperation?: ZoomOperation | null
  scaleReviewOperation?: ZoomOperation | null
  settings: SelectionMenuSettings
  visible: boolean
  anchor?: {
    x: number
    y: number
    placement: 'above' | 'below'
  } | null
  disabled: boolean
  onZoom: (operation: ZoomOperation, degree?: ZoomDegree, targetWords?: number) => void
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

function WordCountComparison({ sourceWords, wordCount }: { sourceWords: number; wordCount: number }) {
  const originalCount = `${sourceWords} ${sourceWords === 1 ? 'word' : 'words'}`
  const previewing = wordCount !== sourceWords
  const [lastOriginalCount, setLastOriginalCount] = useState(originalCount)
  if (previewing && lastOriginalCount !== originalCount) setLastOriginalCount(originalCount)
  return (
    <span className="zoom-count-comparison" data-previewing={previewing || undefined}>
      <span className="zoom-slider-original" aria-hidden={!previewing} style={{ width: previewing ? `${originalCount.length + 1}ch` : undefined }}>
        <del>{lastOriginalCount}</del>
      </span>
      <span>
        <AnimatedWordCount count={wordCount} />
        {' '}{wordCount === 1 ? 'word' : 'words'}
      </span>
    </span>
  )
}

function ZoomScale({ stops, neutralIndex: presetNeutralIndex, sourceWords, previousWords, disabled, loadingOperation, reviewOperation, onZoom }: {
  stops: ReturnType<typeof zoomTargets>
  neutralIndex: number
  sourceWords: number
  previousWords?: number
  disabled: boolean
  loadingOperation?: ZoomOperation | null
  reviewOperation?: ZoomOperation | null
  onZoom: ControlBarProps['onZoom']
}) {
  const tickWidth = 16 // SliderScale's fixed tick width.
  const exact = sourceWords > 0 && sourceWords <= MAX_EXACT_ZOOM_WORDS
  const neutralIndex = exact ? sourceWords - 1 : presetNeutralIndex
  const lastIndex = exact ? MAX_EXACT_ZOOM_WORDS - 1 : stops.length
  const ticksPerStop = exact ? 1 : 2
  const lastTick = lastIndex * ticksPerStop
  const initialTick = neutralIndex * ticksPerStop
  const [tick, setTick] = useState(initialTick)
  const loading = Boolean(loadingOperation)
  const [previous, setPrevious] = useState({ sourceWords, loading })
  if (previous.sourceWords !== sourceWords || previous.loading !== loading) {
    setPrevious({ sourceWords, loading })
    if (previous.sourceWords !== sourceWords || !loading) setTick(initialTick)
  }
  const scaleRef = useRef<HTMLDivElement>(null)
  const loadingLabelRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ ruler: HTMLElement; pointerId: number; x: number; scrollLeft: number } | null>(null)
  const index = Math.round(tick / ticksPerStop)
  const previewTick = index * ticksPerStop

  useLayoutEffect(() => {
    const scale = scaleRef.current
    const label = loadingLabelRef.current
    if (!loadingOperation || !scale || !label) return
    const align = () => {
      scale.style.setProperty('--zoom-scale-loading-width', `${label.getBoundingClientRect().width}px`)
    }
    align()
    const observer = new ResizeObserver(align)
    observer.observe(label)
    return () => observer.disconnect()
  }, [loadingOperation])

  useLayoutEffect(() => {
    const first = Math.min(initialTick, previewTick)
    const last = Math.max(initialTick, previewTick)
    scaleRef.current?.querySelectorAll('.maxos-slider-scale-tick').forEach((tick, position) => {
      tick.toggleAttribute('data-zoom-traversed', position >= first && position <= last && position !== initialTick)
    })
  }, [initialTick, previewTick])

  const stopAt = (position: number) => position === neutralIndex
    ? undefined
    : stops[position < neutralIndex ? position : position - 1]
  const countAt = (position: number) => exact ? position + 1 : stopAt(position)?.target ?? sourceWords
  const wordCount = countAt(index)
  const direction = loadingOperation ?? reviewOperation ?? (index < neutralIndex ? 'contract' : index > neutralIndex ? 'expand' : null)
  const reduceMotion = useReducedMotion()
  const fadeTransition = { duration: reduceMotion ? 0 : 0.22, ease: 'easeOut' } as const
  const apply = (position: number) => {
    if (disabled || position === neutralIndex) return
    if (exact) {
      onZoom(position < neutralIndex ? 'contract' : 'expand', undefined, countAt(position))
      return
    }
    const target = stopAt(position)
    if (target) onZoom(target.operation, target.degree)
  }
  const clearDrag = (pointerId: number) => {
    const gesture = drag.current
    if (gesture?.pointerId !== pointerId) return
    drag.current = null
    delete gesture.ruler.dataset.dragging
  }

  return (
    <div
      ref={scaleRef}
      className="zoom-scale"
      data-loading={loadingOperation || undefined}
      data-reviewing={reviewOperation || undefined}
      data-preset-stops={!exact || undefined}
      onPointerDownCapture={(event) => {
        if (!event.isPrimary || event.button !== 0 || !(event.target instanceof Element)) return
        const ruler = event.target.closest<HTMLElement>('[role="slider"]')
        if (!ruler) return
        event.stopPropagation()
        ruler.setPointerCapture(event.pointerId)
        drag.current = { ruler, pointerId: event.pointerId, x: event.clientX, scrollLeft: ruler.scrollLeft }
      }}
      onPointerMoveCapture={(event) => {
        const gesture = drag.current
        if (gesture?.pointerId !== event.pointerId) return
        event.stopPropagation()
        const delta = gesture.x - event.clientX
        const distance = Math.abs(delta)
        if (distance < 1 && !('dragging' in gesture.ruler.dataset)) return
        const { ruler, scrollLeft, x } = gesture
        const bounds = ruler.getBoundingClientRect()
        const travel = delta < 0 ? bounds.right - x : x - bounds.left
        const progress = Math.min(1, distance / Math.max(1, travel))
        const endScroll = delta < 0 ? 0 : lastTick * tickWidth
        ruler.dataset.dragging = ''
        ruler.scrollLeft = scrollLeft + (endScroll - scrollLeft) * progress
      }}
      onPointerUpCapture={(event) => {
        const gesture = drag.current
        if (gesture?.pointerId !== event.pointerId) return
        event.stopPropagation()
        const { ruler } = gesture
        const dragged = 'dragging' in ruler.dataset
        const bounds = ruler.getBoundingClientRect()
        const offset = dragged ? 0 : event.clientX - (bounds.left + bounds.width / 2)
        const target = Math.max(0, Math.min(lastIndex, Math.round((ruler.scrollLeft + offset) / (tickWidth * ticksPerStop))))
        clearDrag(event.pointerId)
        if (dragged) apply(target)
        else setTick(target * ticksPerStop)
      }}
      onPointerCancel={(event) => { clearDrag(event.pointerId) }}
      onLostPointerCapture={(event) => { clearDrag(event.pointerId) }}
      onKeyDownCapture={(event) => {
        if (!(event.target instanceof HTMLElement) || event.target.role !== 'slider') return
        if (event.key === 'Enter') {
          event.preventDefault()
          apply(index)
          return
        }
        const direction = event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1
          : event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : 0
        if (!direction) return
        event.preventDefault()
        event.stopPropagation()
        setTick(Math.max(0, Math.min(lastTick, (index + direction) * ticksPerStop)))
      }}
    >
      <motion.div
        className="zoom-scale-ruler-content"
        inert={disabled}
        initial={false}
        animate={{ opacity: loadingOperation || reviewOperation ? 0 : 1 }}
        transition={fadeTransition}
      >
        <SliderScale
          key={sourceWords}
          label="Semantic zoom target in words"
          count={lastTick + 1}
          value={tick}
          onChange={setTick}
          tickLabel={(position) => {
            if (exact) {
              const count = countAt(position)
              return count === 1 || count % 5 === 0 ? String(count) : undefined
            }
            if (position % ticksPerStop !== 0) return undefined
            return String(countAt(position / ticksPerStop))
          }}
          formatValue={(position) => {
            const count = countAt(Math.round(position / ticksPerStop))
            return `${count} ${count === 1 ? 'word' : 'words'}`
          }}
        />
      </motion.div>
      <motion.div
        className="zoom-scale-headline"
        inert={disabled}
        initial={false}
        animate={{ opacity: loadingOperation ? 0 : 1 }}
        transition={fadeTransition}
      >
        <button type="button" className="zoom-slider-readout" onClick={() => apply(index)} disabled={index === neutralIndex}>
          <WordCountComparison sourceWords={index === neutralIndex ? previousWords ?? sourceWords : sourceWords} wordCount={wordCount} />
        </button>
      </motion.div>
      <span
        className="zoom-scale-icon zoom-scale-icon--start"
        data-active={direction === 'contract' || undefined}
        data-inactive={!!reviewOperation || direction === 'expand' || undefined}
        aria-hidden="true"
      >
        <Microscope size={24} />
      </span>
      {(exact || neutralIndex < lastIndex) && (
        <span
          className="zoom-scale-icon zoom-scale-icon--end"
          data-active={direction === 'expand' || undefined}
          data-inactive={!!reviewOperation || direction === 'contract' || undefined}
          aria-hidden="true"
        >
          <Telescope size={24} />
        </span>
      )}
      {loadingOperation && (
        <div ref={loadingLabelRef} role="status" className="zoom-scale-loading zoom-slider-readout">
          <span><span>{loadingOperation === 'contract' ? 'Zooming in' : 'Zooming out'}</span></span>
        </div>
      )}
      {reviewOperation && previousWords !== undefined && (
        <span role="status" className="sr-only">
          Document word count changed from {previousWords} to {wordCount}.
        </span>
      )}
    </div>
  )
}

function updateGeneralNotch(slider: HTMLDivElement | null) {
  const notch = slider?.querySelector('.zoom-slider-notch')
  const fill = notch?.parentElement
  const content = slider?.querySelector('.zoom-slider-content')
  if (!notch || !fill || !content) return

  const bounds = notch.getBoundingClientRect()
  const hasClearance = fill.clientWidth >= notch.clientWidth + 16
  const overlapsContent = Array.from(content.children).some((element) => {
    const item = element.getBoundingClientRect()
    return item.width > 0 && bounds.right + 4 > item.left && bounds.left - 4 < item.right
  })
  notch.toggleAttribute('data-overlapping', !hasClearance || overlapsContent)
}

export function ControlBar({ sourceWords, previousWords, reviewTop, menuRef, inline, scaleLoadingOperation, scaleReviewOperation, settings, visible, anchor, disabled, onZoom, review }: ControlBarProps) {
  const stops = zoomTargets(sourceWords)
  const availableStops = zoomStops.filter((stop) =>
    !stop || stops.some(({ operation, degree }) => operation === stop[0] && degree === stop[1]),
  )
  const neutralIndex = availableStops.indexOf(null)
  const exact = sourceWords > 0 && sourceWords <= MAX_EXACT_ZOOM_WORDS
  const generalStopCount = exact ? MAX_EXACT_ZOOM_WORDS : availableStops.length
  const generalNeutralIndex = exact ? sourceWords - 1 : neutralIndex
  const [keyboardTarget, setKeyboardTarget] = useState<number | null>(null)
  const [dragPosition, setDragPosition] = useState<number | null>(null)
  const dragIndex = dragPosition === null ? null : Math.floor(dragPosition)
  const exactIndex = Math.min(generalStopCount - 1, keyboardTarget ?? generalNeutralIndex)
  const activeIndex = dragIndex ?? (exact ? exactIndex : generalNeutralIndex)
  const bandPosition = dragPosition ?? activeIndex + 0.5
  const bandPadding = exact ? 2 : 0.5
  const startsAtOne = exact && sourceWords === 1
  const coversStartIcon = activeIndex === 0 && activeIndex < generalNeutralIndex
  const coversEndIcon = activeIndex === generalStopCount - 1 && activeIndex > generalNeutralIndex
  const bandStart = coversStartIcon ? 0 : Math.max(0, Math.min(generalNeutralIndex + 0.5, bandPosition) - bandPadding)
  const bandEnd = coversEndIcon
    ? generalStopCount
    : startsAtOne && activeIndex > 0
      ? (bandPosition - 0.5) / (generalStopCount - 1) * generalStopCount
      : Math.min(generalStopCount, Math.max(generalNeutralIndex + 0.5, bandPosition) + bandPadding)
  const notchPosition = activeIndex < generalNeutralIndex ? 'left-2' : 'right-2'
  const pointerId = useRef<number | null>(null)
  const [hoveredTarget, setHoveredTarget] = useState<(typeof stops)[number] | null>(null)
  const [focusedTarget, setFocusedTarget] = useState<(typeof stops)[number] | null>(null)
  const activeStop = dragIndex === null ? null : availableStops[dragIndex]
  const activeTarget = activeStop && stops.find(({ operation, degree }) => operation === activeStop[0] && degree === activeStop[1])
  const previewTarget = dragIndex === null ? hoveredTarget ?? focusedTarget : activeTarget
  const wordCount = exact ? activeIndex + 1 : previewTarget?.target ?? sourceWords
  const generalSliderRef = useRef<HTMLDivElement>(null)
  const generalContent = (
    <>
      {(exact || stops.some(({ operation }) => operation === 'contract')) && (
        <Microscope
          size={16}
          className="zoom-slider-icon zoom-slider-icon--start"
          data-inactive={activeIndex > generalNeutralIndex || undefined}
        />
      )}
      {(exact || stops.some(({ operation }) => operation === 'expand')) && (
        <Telescope
          size={16}
          className="zoom-slider-icon zoom-slider-icon--end"
          data-inactive={activeIndex < generalNeutralIndex || undefined}
        />
      )}
      <span className="zoom-slider-readout zoom-slider-value">
        <WordCountComparison sourceWords={wordCount === sourceWords ? previousWords ?? sourceWords : sourceWords} wordCount={wordCount} />
      </span>
    </>
  )

  const applyGeneralTarget = (index: number) => {
    if (disabled || index === generalNeutralIndex) return
    if (exact) {
      onZoom(index < generalNeutralIndex ? 'contract' : 'expand', undefined, index + 1)
      return
    }
    const stop = availableStops[index]
    if (stop) onZoom(stop[0], stop[1])
  }

  const positionAtPointer = (event: PointerEvent<HTMLDivElement>) => {
    const { left, width } = event.currentTarget.getBoundingClientRect()
    return Math.max(0.5, Math.min(generalStopCount - 0.5, (event.clientX - left) / width * generalStopCount))
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
    updateGeneralNotch(generalSliderRef.current)
  })
  useLayoutEffect(() => {
    const slider = generalSliderRef.current
    const fill = slider?.querySelector('.zoom-slider-fill')
    const value = slider?.querySelector('.zoom-slider-content .zoom-slider-value')
    if (!slider || !fill || !value) return
    const update = () => updateGeneralNotch(slider)
    const observer = new ResizeObserver(update)
    observer.observe(fill)
    observer.observe(value)
    slider.addEventListener('transitionend', update)
    return () => {
      observer.disconnect()
      slider.removeEventListener('transitionend', update)
    }
  }, [inline, reviewing])
  useLayoutEffect(() => {
    if (inline) return
    const content = fieldsetRef.current
    if (!content) return
    const measure = () => setContentWidth(content.offsetWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(content)
    return () => observer.disconnect()
  }, [inline])
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
      className={inline ? 'w-full' : reviewTop === undefined ? 'fixed z-50' : 'absolute z-50'}
      style={inline ? undefined : {
        zIndex: 9999,
        left: reviewTop === undefined ? anchor?.x ?? '50%' : '50%',
        top: reviewTop ?? anchor?.y ?? '100%',
        pointerEvents: visible ? 'auto' : 'none',
        transform: 'translate3d(-50%, 0, 0)',
      }}
    >
      <motion.div
        ref={menuRef}
        initial={inline ? false : { opacity: 0, scale: reduceMotion ? 1 : 0.94, y: reduceMotion ? 0 : hiddenOffset }}
        animate={{
          opacity: visible ? 1 : 0,
          scale: reduceMotion || visible ? 1 : 0.94,
          y: reduceMotion || visible ? 0 : hiddenOffset,
          width: inline ? '100%' : contentWidth ?? 'max-content',
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
        className={`${inline ? 'document-zoom-control w-full' : 'selection-segments w-max'} ${reviewing ? 'review-segments' : ''}`}
        style={{
          transformOrigin: anchor?.placement === 'above' ? '50% 100%' : '50% 0%',
          height: reviewing ? settings.shape.height : undefined,
        }}
        onMouseDown={(e) => {
          if (!inline) e.preventDefault()
        }}
      >
        <fieldset
          ref={fieldsetRef}
          disabled={disabled && !reviewing}
          className={`relative m-0 h-full min-w-0 border-0 p-0 ${inline ? 'w-full' : 'left-1/2 w-max -translate-x-1/2'}`}
        >
          {reviewing ? (
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
            <div className={inline ? 'w-full' : 'w-[min(18rem,calc(100vw-2rem))]'}>
              {inline ? (
                <ZoomScale
                  stops={stops}
                  neutralIndex={neutralIndex}
                  sourceWords={sourceWords}
                  previousWords={previousWords}
                  disabled={disabled}
                  loadingOperation={scaleLoadingOperation}
                  reviewOperation={scaleReviewOperation}
                  onZoom={onZoom}
                />
              ) : (
                <div
                  className="zoom-slider-layout flex flex-col justify-center"
                  style={{ '--zoom-slider-menu-height': `${settings.shape.height}px` } as CSSProperties}
                  role="group"
                  aria-label="Semantic zoom strength"
                >
                  <div className="flex h-7 items-center text-(--slate-950)">
                    <div
                      ref={generalSliderRef}
                      className="zoom-slider relative grid h-full min-w-0 flex-1 touch-none select-none"
                      data-dragging={dragIndex !== null || undefined}
                      data-covers-start-icon={coversStartIcon || undefined}
                      data-starts-at-one={startsAtOne || undefined}
                      data-neutral-microscope={startsAtOne && activeIndex === 0 || undefined}
                      data-end-stop={activeIndex === 0 || activeIndex === generalStopCount - 1 || undefined}
                      data-covers-end-icon={coversEndIcon || undefined}
                      style={{
                        '--zoom-slider-fill-start': bandStart / generalStopCount,
                        '--zoom-slider-fill-end': 1 - bandEnd / generalStopCount,
                        gridTemplateColumns: exact ? undefined : `repeat(${availableStops.length}, minmax(0, 1fr))`,
                      } as CSSProperties}
                      role={exact ? 'slider' : undefined}
                      tabIndex={exact && !disabled ? 0 : undefined}
                      aria-label={exact ? 'Semantic zoom target in words' : undefined}
                      aria-valuemin={exact ? 1 : undefined}
                      aria-valuemax={exact ? MAX_EXACT_ZOOM_WORDS : undefined}
                      aria-valuenow={exact ? wordCount : undefined}
                      aria-disabled={exact && disabled || undefined}
                      onBlur={exact ? () => setKeyboardTarget(null) : undefined}
                      onKeyDown={exact ? (event) => {
                        if (disabled || event.altKey || event.ctrlKey || event.metaKey) return
                        let next: number
                        switch (event.key) {
                          case 'ArrowLeft':
                          case 'ArrowDown': next = exactIndex - 1; break
                          case 'ArrowRight':
                          case 'ArrowUp': next = exactIndex + 1; break
                          case 'Home': next = 0; break
                          case 'End': next = generalStopCount - 1; break
                          case 'Enter':
                          case ' ':
                            event.preventDefault()
                            setKeyboardTarget(null)
                            applyGeneralTarget(exactIndex)
                            return
                          default: return
                        }
                        event.preventDefault()
                        setKeyboardTarget(Math.max(0, Math.min(generalStopCount - 1, next)))
                      } : undefined}
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
                        const index = Math.floor(positionAtPointer(event))
                        clearDrag()
                        setHoveredTarget(null)
                        setKeyboardTarget(null)
                        applyGeneralTarget(index)
                      }}
                      onLostPointerCapture={(event) => {
                        if (event.target === event.currentTarget && pointerId.current === event.pointerId) clearDrag()
                      }}
                    >
                      <span aria-hidden="true" className="zoom-slider-track">
                        <span className="zoom-slider-fill">
                          <span className={`zoom-slider-notch ${notchPosition}`} />
                        </span>
                      </span>
                      <span className="zoom-slider-content" aria-hidden="true">{generalContent}</span>
                      <span aria-hidden="true" className="zoom-slider-track zoom-slider-track--content">
                        <span className="zoom-slider-fill zoom-slider-fill--content">
                          <span className="zoom-slider-content--filled">{generalContent}</span>
                        </span>
                      </span>
                      {!exact && availableStops.map((stop) => {
                        if (!stop) {
                          return (
                            <span key="neutral" role="img" aria-label="Neutral" />
                          )
                        }
                        const [operation, degree, label] = stop
                        const target = stops.find((stop) => stop.operation === operation && stop.degree === degree)
                        if (!target) return null
                        const action = operation === 'contract' ? 'Distill' : 'Extrapolate'
                        const preview = `${action} to ${target.target} ${target.target === 1 ? 'word' : 'words'}`
                        return (
                          <div
                            key={label}
                            className="relative min-w-0"
                            onMouseEnter={() => setHoveredTarget(target)}
                            onMouseLeave={() => setHoveredTarget(null)}
                          >
                            <button
                              type="button"
                              aria-label={`${label}, ${preview}`}
                              onFocus={() => setFocusedTarget(target)}
                              onBlur={() => setFocusedTarget(null)}
                              onClick={(event) => {
                                if (event.detail !== 0) return
                                setHoveredTarget(null)
                                setFocusedTarget(null)
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
            </div>
          )}
        </fieldset>
      </motion.div>
    </div>
  )
}
