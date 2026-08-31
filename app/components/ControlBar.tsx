'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Microscope, MoveHorizontal, Telescope } from 'lucide-react'
import type { ZoomOperation } from '@/app/types/zoom'

type ControlBarProps = {
  visible: boolean
  disabled: boolean
  onContract: () => void
  onExpand: () => void
}

export function ControlBar({ visible, disabled, onContract, onExpand }: ControlBarProps) {
  const [sliderPosition, setSliderPosition] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [showDragTooltip, setShowDragTooltip] = useState<ZoomOperation | null>(null)
  const [mousePosition, setMousePosition] = useState({ x: 132, y: 48 })
  const sliderRef = useRef<HTMLDivElement>(null)

  const handleControlBarMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMousePosition({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }, [])

  const handleControlBarMouseLeave = useCallback(() => {
    setMousePosition({ x: 132, y: 48 })
  }, [])

  useEffect(() => {
    const pointLight = document.getElementById('point-light')
    if (pointLight) {
      pointLight.setAttribute('x', mousePosition.x.toString())
      pointLight.setAttribute('y', mousePosition.y.toString())
    }
  }, [mousePosition])

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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (disabled || isDragging) return
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        onContract()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        onExpand()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [disabled, isDragging, onContract, onExpand])

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
          <filter id="lighting" x="-50%" y="-50%" width="200%" height="200%">
            <feSpecularLighting
              id="slider-light"
              specularConstant="8"
              specularExponent="120"
              surfaceScale="2"
              lightingColor="#00d4ff"
            >
              <fePointLight id="point-light" x="128" y="48" z="100" />
            </feSpecularLighting>
            <feComposite in="SourceGraphic" in2="specOut" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
          </filter>
        </defs>
      </svg>

      <div
        className="fixed left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ease-in-out"
        style={{ zIndex: 9999, bottom: visible ? '24px' : '-100px' }}
      >
        <div
          ref={sliderRef}
          className="control-container relative w-[264px] h-24 rounded-full flex items-center justify-between px-4 backdrop-blur-[30px] border border-slate-200"
          style={{
            '--border': '1',
            position: 'relative',
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.4) 0%, rgba(196, 196, 196, 0.5) 100%)',
            boxShadow: '0 0 40px 0 rgba(179, 179, 179, 0.15), 0 8px 32px 0 rgba(31, 38, 135, 0.2)',
          } as React.CSSProperties}
          onMouseMove={handleControlBarMouseMove}
          onMouseLeave={handleControlBarMouseLeave}
        >
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              inset: '-1px',
              border: `calc(var(--border) * 1px) solid transparent`,
              background: 'transparent',
              mask: 'linear-gradient(transparent 0 100%) padding-box, linear-gradient(#fff 0 100%) border-box',
              maskComposite: 'intersect',
              filter: 'url(#lighting)',
            }}
          />

          <button
            className="w-[64px] h-[64px] flex items-center justify-center rounded-full hover:cursor-pointer transition-all duration-200 ease-in-out disabled:cursor-not-allowed disabled:opacity-50 relative group"
            onClick={() => fire('contract')}
            disabled={disabled}
            type="button"
            style={{
              background:
                'linear-gradient(180deg, rgba(180, 195, 216, 0.75) 0%, rgba(180, 195, 216, 0.5) 50%, rgba(223, 233, 242, 0.25) 100%)',
              boxShadow: '0 0 15px rgba(255, 255, 255, 0.4)',
              transition: 'box-shadow 0.2s ease-in-out',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 0 25px rgba(255, 255, 255, 0.8)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 0 15px rgba(255, 255, 255, 0.4)'
            }}
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

          <div className="w-[64px] h-[64px] flex items-center justify-center">
            <MoveHorizontal className="w-[24px] h-[24px] text-slate-800" strokeWidth={2} />
          </div>

          <button
            className="w-[64px] h-[64px] flex items-center justify-center rounded-full hover:cursor-pointer transition-all duration-200 ease-in-out disabled:cursor-not-allowed disabled:opacity-50 relative group"
            onClick={() => fire('expand')}
            disabled={disabled}
            type="button"
            style={{
              background:
                'linear-gradient(180deg, rgba(180, 195, 216, 0.75) 0%, rgba(180, 195, 216, 0.5) 50%, rgba(223, 233, 242, 0.25) 100%)',
              boxShadow: '0 0 15px rgba(255, 255, 255, 0.4)',
              transition: 'box-shadow 0.2s ease-in-out',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 0 25px rgba(255, 255, 255, 0.8)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 0 15px rgba(255, 255, 255, 0.4)'
            }}
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
