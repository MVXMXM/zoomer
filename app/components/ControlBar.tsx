'use client'

import { Kbd, SliderScale } from '@mvxmxm/maxos'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent } from 'react'
import { Microscope, Telescope } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import type { SelectionMenuSettings } from '@/app/lib/selectionMenuSettings'
import type { ZoomDegree, ZoomOperation } from '@/app/types/zoom'
import { MAX_EXACT_ZOOM_WORDS, rulerStepLevel, rulerTargets, zoomTargets } from '@/app/lib/zoomTargets'
import { AnimatedWordCount } from './AnimatedWordCount'

type ControlBarProps = {
  sourceWords: number
  previousWords?: number
  reviewTop?: string
  menuRef?: React.Ref<HTMLDivElement>
  inline?: boolean
  scaleLoadingOperation?: ZoomOperation | null
  scaleReviewOperation?: ZoomOperation | null
  previewWords?: number
  onPreviewWordsChange?: (words: number | null) => void
  settings: SelectionMenuSettings
  visible: boolean
  anchor?: {
    x: number
    y: number
    placement: 'above' | 'below'
  } | null
  disabled: boolean
  onZoom: (operation: ZoomOperation, degree?: ZoomDegree, targetWords?: number, approximateTarget?: boolean) => void
  review?: { onAccept: () => void; onReject: () => void }
}

const notchSoundVoices = 8
const notchSoundVolumeRecoveryMs = 120

const zoomStops = [
  ['expand', 3, 'Strong extrapolation'],
  ['expand', 2, 'Medium extrapolation'],
  ['expand', 1, 'Light extrapolation'],
  null,
  ['contract', 1, 'Light distillation'],
  ['contract', 2, 'Medium distillation'],
  ['contract', 3, 'Strong distillation'],
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

function ZoomScale({ sourceWords, previousWords, previewWords, disabled, loadingOperation, reviewOperation, onZoom }: {
  sourceWords: number
  previousWords?: number
  previewWords?: number
  disabled: boolean
  loadingOperation?: ZoomOperation | null
  reviewOperation?: ZoomOperation | null
  onZoom: ControlBarProps['onZoom']
}) {
  const tickWidth = 16 // SliderScale's fixed tick width.
  const [stepLevel, setStepLevel] = useState(() => rulerStepLevel(sourceWords))
  const [dragging, setDragging] = useState(false)
  const targets = rulerTargets(sourceWords, stepLevel).reverse()
  const neutralIndex = targets.indexOf(sourceWords)
  const lastIndex = targets.length - 1
  const [tick, setTick] = useState(neutralIndex)
  const loading = Boolean(loadingOperation)
  const previewing = previewWords !== undefined
  const [previous, setPrevious] = useState({ sourceWords, loading, previewing, stepLevel })
  if (previous.sourceWords !== sourceWords || previous.stepLevel !== stepLevel || previous.loading !== loading || previous.previewing !== previewing) {
    setPrevious({ sourceWords, loading, previewing, stepLevel })
    if (previous.sourceWords !== sourceWords || previous.stepLevel !== stepLevel || !loading || previewing) setTick(neutralIndex)
  }
  useEffect(() => {
    if (dragging || tick !== neutralIndex) return
    const timer = window.setTimeout(() => {
      setStepLevel((level) => rulerStepLevel(sourceWords, level))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [dragging, neutralIndex, sourceWords, tick])
  const scaleRef = useRef<HTMLDivElement>(null)
  const notchSounds = useRef<(HTMLAudioElement | null)[]>([])
  const lastNotchSoundTrigger = useRef(-Infinity)
  const loadingLabelRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ ruler: HTMLElement; pointerId: number; x: number; scrollLeft: number } | null>(null)
  const countAt = (position: number) => targets[position] ?? sourceWords
  const index = previewWords === undefined
    ? tick
    : targets.reduce((closest, target, position) =>
      Math.abs(target - previewWords) < Math.abs(countAt(closest) - previewWords) ? position : closest,
    neutralIndex)
  const playNotchSound = useCallback(() => {
    const now = performance.now()
    const spacing = now - lastNotchSoundTrigger.current
    lastNotchSoundTrigger.current = now
    const sound = notchSounds.current.find((voice) => voice && (voice.paused || voice.ended))
    if (!sound) return
    sound.currentTime = 0
    sound.volume = 0.15 + 0.35 * Math.min(1, spacing / notchSoundVolumeRecoveryMs)
    void sound.play().catch(() => {
      // Audio playback can be blocked by the browser.
    })
  }, [])
  const previousPreview = useRef({ tick: index, active: previewing })
  useLayoutEffect(() => {
    const previous = previousPreview.current
    if (!disabled && (previewing || previous.active) && index !== previous.tick) playNotchSound()
    previousPreview.current = { tick: index, active: previewing }
  }, [disabled, playNotchSound, previewing, index])

  const updateTick = (nextTick: number) => {
    if (previewing) return
    if (!disabled && nextTick !== index) {
      playNotchSound()
    }
    setTick(nextTick)
  }

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
    const first = Math.min(neutralIndex, index)
    const last = Math.max(neutralIndex, index)
    scaleRef.current?.querySelectorAll('.maxos-slider-scale-tick').forEach((tick, position) => {
      tick.toggleAttribute('data-zoom-traversed', position >= first && position <= last && position !== neutralIndex)
    })
  }, [neutralIndex, index, sourceWords, stepLevel])

  const wordCount = previewWords ?? countAt(index)
  const direction = loadingOperation ?? reviewOperation ?? (wordCount < sourceWords ? 'contract' : wordCount > sourceWords ? 'expand' : null)
  const reduceMotion = useReducedMotion()
  const fadeTransition = { duration: reduceMotion ? 0 : 0.22, ease: 'easeOut' } as const
  const apply = (position: number) => {
    const target = countAt(position)
    if (disabled || previewing || sourceWords === 0 || target === sourceWords) return
    onZoom(target < sourceWords ? 'contract' : 'expand', undefined, target, true)
  }
  const clearDrag = (pointerId: number) => {
    const gesture = drag.current
    if (gesture?.pointerId !== pointerId) return
    drag.current = null
    setDragging(false)
    delete gesture.ruler.dataset.dragging
  }

  return (
    <div
      ref={scaleRef}
      className="zoom-scale"
      data-loading={loadingOperation || undefined}
      data-reviewing={reviewOperation || undefined}
      onPointerDownCapture={(event) => {
        if (!event.isPrimary || event.button !== 0 || !(event.target instanceof Element)) return
        const ruler = event.target.closest<HTMLElement>('[role="slider"]')
        if (!ruler) return
        event.stopPropagation()
        setDragging(true)
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
        const endScroll = delta < 0 ? 0 : lastIndex * tickWidth
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
        const target = Math.max(0, Math.min(lastIndex, Math.round((ruler.scrollLeft + offset) / tickWidth)))
        clearDrag(event.pointerId)
        if (dragged) apply(target)
        else updateTick(target)
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
        if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault()
          event.stopPropagation()
          updateTick(event.key === 'Home' ? lastIndex : 0)
          return
        }
        const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1
          : event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : 0
        if (!direction) return
        event.preventDefault()
        event.stopPropagation()
        updateTick(Math.max(0, Math.min(lastIndex, index + direction)))
      }}
    >
      {Array.from({ length: notchSoundVoices }, (_, voice) => (
        <audio
          key={voice}
          ref={(element) => { notchSounds.current[voice] = element }}
          src="/sounds/zoom-notch.wav"
          preload="auto"
        />
      ))}
      <motion.div
        className="zoom-scale-ruler-content"
        inert={disabled || previewing}
        initial={false}
        animate={{ opacity: loadingOperation || reviewOperation ? 0 : 1 }}
        transition={fadeTransition}
      >
        <SliderScale
          key={`${sourceWords}:${stepLevel}`}
          label="Semantic zoom target in words"
          count={lastIndex + 1}
          value={previewing ? index : tick}
          onChange={updateTick}
          tickLabel={(position) => position === neutralIndex || position % 5 === 0 ? String(countAt(position)) : undefined}
          formatValue={(position) => {
            const count = previewWords ?? countAt(position)
            return `${count} ${count === 1 ? 'word' : 'words'}`
          }}
        />
      </motion.div>
      <motion.div
        className="zoom-scale-headline"
        inert={disabled || previewing}
        initial={false}
        animate={{ opacity: loadingOperation ? 0 : 1 }}
        transition={fadeTransition}
      >
        <button
          type="button"
          className="zoom-slider-readout"
          onClick={() => apply(index)}
          disabled={index === neutralIndex}
        >
          <WordCountComparison sourceWords={index === neutralIndex ? previousWords ?? sourceWords : sourceWords} wordCount={wordCount} />
        </button>
      </motion.div>
      {(neutralIndex > 0 || direction === 'expand') && (
        <span
          className="zoom-scale-icon zoom-scale-icon--start"
          data-active={direction === 'expand' || undefined}
          data-inactive={!!reviewOperation || direction === 'contract' || undefined}
          aria-hidden="true"
        >
          <Microscope size={24} strokeWidth={1.5} />
        </span>
      )}
      {(neutralIndex < lastIndex || direction === 'contract') && (
        <span
          className="zoom-scale-icon zoom-scale-icon--end"
          data-active={direction === 'contract' || undefined}
          data-inactive={!!reviewOperation || direction === 'expand' || undefined}
          aria-hidden="true"
        >
          <Telescope size={24} strokeWidth={1.5} />
        </span>
      )}
      {loadingOperation && (
        <div ref={loadingLabelRef} role="status" className="zoom-scale-loading zoom-slider-readout">
          <span><span>{loadingOperation === 'contract' ? 'Zooming out' : 'Zooming in'}</span></span>
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

export function ControlBar({ sourceWords, previousWords, reviewTop, menuRef, inline, scaleLoadingOperation, scaleReviewOperation, previewWords, onPreviewWordsChange, settings, visible, anchor, disabled, onZoom, review }: ControlBarProps) {
  const stops = zoomTargets(sourceWords)
  const availableStops = zoomStops.filter((stop) =>
    !stop || stops.some(({ operation, degree }) => operation === stop[0] && degree === stop[1]),
  )
  const neutralIndex = availableStops.indexOf(null)
  const exact = sourceWords > 0 && sourceWords <= MAX_EXACT_ZOOM_WORDS
  const generalStopCount = exact ? MAX_EXACT_ZOOM_WORDS : availableStops.length
  const generalNeutralIndex = exact ? MAX_EXACT_ZOOM_WORDS - sourceWords : neutralIndex
  const [keyboardTarget, setKeyboardTarget] = useState<number | null>(null)
  const [dragPosition, setDragPosition] = useState<number | null>(null)
  const dragIndex = dragPosition === null ? null : Math.floor(dragPosition)
  const exactIndex = Math.min(generalStopCount - 1, keyboardTarget ?? generalNeutralIndex)
  const activeIndex = dragIndex ?? (exact ? exactIndex : generalNeutralIndex)
  const bandPosition = dragPosition ?? activeIndex + 0.5
  const bandPadding = exact ? 2 : 0.5
  const endsAtOne = exact && sourceWords === 1
  const coversStartIcon = activeIndex === 0 && activeIndex < generalNeutralIndex
  const coversEndIcon = activeIndex === generalStopCount - 1 && activeIndex > generalNeutralIndex
  const bandStart = coversStartIcon
    ? 0
    : endsAtOne && activeIndex < generalNeutralIndex
      ? (bandPosition - 0.5) / (generalStopCount - 1) * generalStopCount
      : Math.max(0, Math.min(generalNeutralIndex + 0.5, bandPosition) - bandPadding)
  const bandEnd = coversEndIcon ? generalStopCount : Math.min(generalStopCount, Math.max(generalNeutralIndex + 0.5, bandPosition) + bandPadding)
  const notchPosition = activeIndex < generalNeutralIndex ? 'left-2' : 'right-2'
  const pointerId = useRef<number | null>(null)
  const [hoveredTarget, setHoveredTarget] = useState<(typeof stops)[number] | null>(null)
  const [focusedTarget, setFocusedTarget] = useState<(typeof stops)[number] | null>(null)
  const activeStop = dragIndex === null ? null : availableStops[dragIndex]
  const activeTarget = activeStop && stops.find(({ operation, degree }) => operation === activeStop[0] && degree === activeStop[1])
  const previewTarget = dragIndex === null ? hoveredTarget ?? focusedTarget : activeTarget
  const wordCount = exact ? MAX_EXACT_ZOOM_WORDS - activeIndex : previewTarget?.target ?? sourceWords
  const wordChange = wordCount - sourceWords
  const displayedCount = wordChange === 0 ? sourceWords : Math.abs(wordChange)
  const selectionPreviewWords = visible && !disabled && !review && wordCount !== sourceWords ? wordCount : null
  useLayoutEffect(() => {
    onPreviewWordsChange?.(selectionPreviewWords)
  }, [onPreviewWordsChange, selectionPreviewWords])
  const generalSliderRef = useRef<HTMLDivElement>(null)
  const generalContent = (
    <>
      {(exact || stops.some(({ operation }) => operation === 'expand')) && (
        <Microscope
          size={16}
          className="zoom-slider-icon zoom-slider-icon--start"
          data-inactive={activeIndex > generalNeutralIndex || undefined}
        />
      )}
      {(exact || stops.some(({ operation }) => operation === 'contract')) && (
        <Telescope
          size={16}
          className="zoom-slider-icon zoom-slider-icon--end"
          data-inactive={activeIndex < generalNeutralIndex || undefined}
        />
      )}
      <span className="zoom-slider-readout zoom-slider-value">
        <span>
          {wordChange < 0 ? '− ' : wordChange > 0 ? '+ ' : ''}
          <AnimatedWordCount count={displayedCount} />
          {' '}{displayedCount === 1 ? 'word' : 'words'}
        </span>
      </span>
    </>
  )

  const applyGeneralTarget = (index: number) => {
    if (disabled || index === generalNeutralIndex) return
    if (exact) {
      onZoom(index < generalNeutralIndex ? 'expand' : 'contract', undefined, MAX_EXACT_ZOOM_WORDS - index)
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
            <div className="segmented-controller" role="group" aria-label="Zoom result">
              <button type="button" className="segmented-controller-button" aria-keyshortcuts="Escape" onClick={review.onReject}>
                Undo <Kbd aria-hidden="true">esc</Kbd>
              </button>
              <button type="button" className="segmented-controller-button" aria-keyshortcuts="Enter" onClick={review.onAccept}>
                Keep <Kbd aria-hidden="true">enter</Kbd>
              </button>
            </div>
          ) : (
            <div className={inline ? 'w-full' : 'w-[min(18rem,calc(100vw-2rem))]'}>
              {inline ? (
                <ZoomScale
                  sourceWords={sourceWords}
                  previousWords={previousWords}
                  previewWords={previewWords}
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
                      data-ends-at-one={endsAtOne || undefined}
                      data-neutral-telescope={endsAtOne && activeIndex === generalNeutralIndex || undefined}
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
                          case 'ArrowUp': next = exactIndex - 1; break
                          case 'ArrowRight':
                          case 'ArrowDown': next = exactIndex + 1; break
                          case 'Home': next = generalStopCount - 1; break
                          case 'End': next = 0; break
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
