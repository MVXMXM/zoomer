'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Microscope, MoveHorizontal, Telescope } from 'lucide-react'
import type { ZoomOperation } from '@/app/types/zoom'

type ControlBarProps = {
  visible: boolean
  anchor: {
    x: number
    y: number
    placement: 'above' | 'below'
  } | null
  disabled: boolean
  onContract: () => void
  onExpand: () => void
}

export function ControlBar({ visible, anchor, disabled, onContract, onExpand }: ControlBarProps) {
  const [sliderPosition, setSliderPosition] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [showDragTooltip, setShowDragTooltip] = useState<ZoomOperation | null>(null)
  const sliderRef = useRef<HTMLDivElement>(null)

  const handleSliderDrag = useCallback(
    (event: MouseEvent | TouchEvent) => {
      if (!isDragging || !sliderRef.current) return
      const slider = sliderRef.current
      const rect = slider.getBoundingClientRect()
      const sliderWidth = rect.width - 64
      const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
      const x = clientX - rect.left - 32
      const position = Math.max(-sliderWidth / 2, Math.min(sliderWidth / 2, x - sliderWidth / 2))
      setSliderPosition(position)
      const threshold = 20
      if (position < -threshold) setShowDragTooltip('contract')
      else if (position > threshold) setShowDragTooltip('expand')
      else setShowDragTooltip(null)
    },
    [isDragging],
  )

  const handleSliderStart = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      if (disabled) return
      setIsDragging(true)
      event.preventDefault()
    },
    [disabled],
  )

  const handleSliderEnd = useCallback(() => {
    if (!isDragging) return
    const threshold = 50
    if (Math.abs(sliderPosition) > threshold) {
      if (sliderPosition < -threshold) onContract()
      else onExpand()
    } else {
      setSliderPosition(0)
    }
    setIsDragging(false)
    setShowDragTooltip(null)
  }, [isDragging, sliderPosition, onContract, onExpand])

  useEffect(() => {
    if (!isDragging) return
    const handleMove = (e: MouseEvent | TouchEvent) => handleSliderDrag(e)
    const handleEnd = () => handleSliderEnd()
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleEnd)
    document.addEventListener('touchmove', handleMove)
    document.addEventListener('touchend', handleEnd)
    return () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleEnd)
      document.removeEventListener('touchmove', handleMove)
      document.removeEventListener('touchend', handleEnd)
    }
  }, [isDragging, handleSliderDrag, handleSliderEnd])

  useEffect(() => {
    if (disabled) setSliderPosition(0)
  }, [disabled])

  const fire = (operation: ZoomOperation) => {
    if (disabled) return
    setSliderPosition(operation === 'expand' ? 84 : -84)
    if (operation === 'expand') onExpand()
    else onContract()
  }

  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id="liquid-glass-refraction" x="-20%" y="-30%" width="140%" height="160%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.008 0.018"
              numOctaves="2"
              seed="12"
              result="liquid-map"
            />
            <feGaussianBlur in="liquid-map" stdDeviation="0.35" result="soft-map" />
            <feDisplacementMap
              in="SourceGraphic"
              in2="soft-map"
              scale="7"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      <div
        aria-hidden={!visible}
        inert={!visible}
        className="fixed z-50"
        style={{
          zIndex: 9999,
          left: anchor?.x ?? '50%',
          top: anchor?.y ?? '100%',
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? 'auto' : 'none',
          transform: `translate3d(-50%, ${visible ? '0' : anchor?.placement === 'above' ? '6px' : '-6px'}, 0)`,
          transition: 'opacity 180ms ease-out, transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        <div
          ref={sliderRef}
          className="control-container liquid-glass relative w-[264px] h-24 rounded-full flex items-center justify-between px-4"
          style={{
            position: 'relative',
            boxShadow: '0 14px 28px -18px rgba(15, 23, 42, 0.32), 0 2px 8px -4px rgba(15, 23, 42, 0.18)',
          }}
          onMouseDown={(e) => {
            // Keep the textarea highlight when Distill / Extrapolate is clicked.
            e.preventDefault()
          }}
        >
          <div className="liquid-glass-surface" aria-hidden="true" />
          <div className="liquid-glass-rim" aria-hidden="true" />

          <button
            className="liquid-glass-button w-[64px] h-[64px] flex items-center justify-center rounded-full hover:cursor-pointer transition-all duration-200 ease-in-out disabled:cursor-not-allowed disabled:opacity-50 relative z-10 group"
            onClick={() => fire('contract')}
            disabled={disabled}
            type="button"
          >
            <Microscope className="w-[24px] h-[24px] text-slate-800" strokeWidth={2} />
            <div
              className={`absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-[10px] py-2 bg-gray-500 text-white text-xs rounded-[10px] translate-y-1 transition-all duration-200 whitespace-nowrap pointer-events-none z-50 font-bold ${
                showDragTooltip === 'contract'
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0'
              }`}
            >
              Distill
            </div>
          </button>

          <div className="w-[64px] h-[64px] flex items-center justify-center relative z-10">
            <MoveHorizontal className="w-[24px] h-[24px] text-slate-800" strokeWidth={2} />
          </div>

          <button
            className="liquid-glass-button w-[64px] h-[64px] flex items-center justify-center rounded-full hover:cursor-pointer transition-all duration-200 ease-in-out disabled:cursor-not-allowed disabled:opacity-50 relative z-10 group"
            onClick={() => fire('expand')}
            disabled={disabled}
            type="button"
          >
            <Telescope className="w-[24px] h-[24px] text-slate-800" strokeWidth={2} />
            <div
              className={`absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-[10px] py-2 bg-gray-500 text-white text-xs rounded-[10px] translate-y-1 transition-all duration-200 whitespace-nowrap pointer-events-none z-50 font-bold ${
                showDragTooltip === 'expand'
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0'
              }`}
            >
              Extrapolate
            </div>
          </button>
        </div>
      </div>
    </>
  )
}
