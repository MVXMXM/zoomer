'use client'

import { useRef, useState } from 'react'
import { Microscope, Telescope } from 'lucide-react'

type ControlBarProps = {
  visible: boolean
  disabled: boolean
  onContract: () => void
  onExpand: () => void
}

export function ControlBar({ visible, disabled, onContract, onExpand }: ControlBarProps) {
  const [position, setPosition] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)
  const dragPosition = useRef(0)

  const fire = (direction: number) => {
    if (disabled) return
    if (direction < 0) onContract()
    else onExpand()
    setPosition(0)
  }

  const moveTo = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return
    const next = Math.max(-1, Math.min(1, ((clientX - rect.left - 18) / (rect.width - 36)) * 2 - 1))
    dragPosition.current = next
    setPosition(next)
  }

  return (
    <div
      className="radio-control-position fixed left-1/2 -translate-x-1/2 transition-all duration-500 ease-in-out"
      style={{ zIndex: 9999, bottom: visible ? '24px' : '-180px' }}
      inert={!visible}
    >
      <div
        className="radio-control"
        onMouseDown={(event) => event.preventDefault()}
        data-disabled={disabled}
      >
        <div className="radio-heading" aria-hidden="true">
          <span>ZOOM</span>
          <span className="radio-heading-detail"><i /> TEXT TUNER</span>
        </div>
        <div className="radio-dial" aria-hidden="true">
          <div className="radio-numbers"><span>−</span><span>2</span><span>1</span><span>0</span><span>1</span><span>2</span><span>+</span></div>
          <div className="radio-ticks">
            {Array.from({ length: 41 }, (_, index) => <i key={index} className={index % 5 === 0 ? 'major' : ''} />)}
          </div>
          <span className="radio-needle" style={{ left: `calc(50% + ${disabled ? 0 : position * 44}%)` }} />
        </div>
        <div
          ref={trackRef}
          className="radio-slider"
          role="slider"
          aria-label="Zoom direction"
          aria-valuemin={-100}
          aria-valuemax={100}
          aria-valuenow={Math.round((disabled ? 0 : position) * 100)}
          aria-valuetext={position < -0.25 ? 'Distill' : position > 0.25 ? 'Extrapolate' : 'Neutral'}
          aria-disabled={disabled}
          tabIndex={disabled ? -1 : 0}
          data-dragging={isDragging}
          onPointerDown={(event) => {
            if (disabled || event.button !== 0) return
            event.preventDefault()
            event.currentTarget.setPointerCapture(event.pointerId)
            setIsDragging(true)
            moveTo(event.clientX)
          }}
          onPointerMove={(event) => {
            if (isDragging && !disabled) moveTo(event.clientX)
          }}
          onPointerUp={(event) => {
            if (!isDragging) return
            event.currentTarget.releasePointerCapture(event.pointerId)
            setIsDragging(false)
            if (Math.abs(dragPosition.current) > 0.45) fire(dragPosition.current)
            setPosition(0)
          }}
          onPointerCancel={() => { setIsDragging(false); setPosition(0) }}
          onLostPointerCapture={() => { setIsDragging(false); setPosition(0) }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault()
              fire(event.key === 'ArrowLeft' ? -1 : 1)
            }
          }}
        >
          <span className="radio-slot" />
          <span className="radio-thumb" style={{ left: `calc(50% + ${disabled ? 0 : position * 44}%)` }}><i /><i /><i /><i /><i /></span>
        </div>
        <div className="radio-labels">
          <button type="button" disabled={disabled} onClick={() => fire(-1)}><Microscope size={12} strokeWidth={1.8} /> Distill</button>
          <span aria-hidden="true">TUNING</span>
          <button type="button" disabled={disabled} onClick={() => fire(1)}>Extrapolate <Telescope size={12} strokeWidth={1.8} /></button>
        </div>
      </div>
    </div>
  )
}
