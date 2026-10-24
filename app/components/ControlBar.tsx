'use client'

import { useEffect, useState } from 'react'
import { Microscope, Telescope } from 'lucide-react'
import type { ZoomDegree, ZoomOperation } from '@/app/types/zoom'

type ZoomStop = -3 | -2 | -1 | 0 | 1 | 2 | 3

type ControlBarProps = {
  visible: boolean
  disabled: boolean
  onZoom: (operation: ZoomOperation, degree: ZoomDegree) => void
}

const STOPS: ZoomStop[] = [-3, -2, -1, 0, 1, 2, 3]
const PERCENT_BY_DEGREE: Record<ZoomDegree, number> = { 1: 10, 2: 25, 3: 50 }

function stopDetails(stop: ZoomStop) {
  if (stop === 0) return { label: 'Original', shortLabel: 'Original' }
  const degree = Math.abs(stop) as ZoomDegree
  const direction = stop < 0 ? 'Distill' : 'Extrapolate'
  return {
    label: `${direction} ${PERCENT_BY_DEGREE[degree]}%`,
    shortLabel: `${stop > 0 ? '+' : '−'}${PERCENT_BY_DEGREE[degree]}%`,
  }
}

export function ControlBar({ visible, disabled, onZoom }: ControlBarProps) {
  const [selectedStop, setSelectedStop] = useState<ZoomStop>(0)

  useEffect(() => {
    if (!visible) setSelectedStop(0)
  }, [visible])

  const selectStop = (stop: ZoomStop) => {
    if (disabled) return
    setSelectedStop(stop)
    if (stop === 0) return
    onZoom(stop < 0 ? 'contract' : 'expand', Math.abs(stop) as ZoomDegree)
  }

  return (
    <div
      className="fixed left-1/2 z-50 -translate-x-1/2 transition-all duration-500 ease-in-out"
      style={{ zIndex: 9999, bottom: visible ? '24px' : '-120px' }}
    >
      <div
        className="relative h-24 w-[min(390px,calc(100vw-32px))] rounded-full border border-white/80 px-5 backdrop-blur-[30px]"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,.72) 0%, rgba(218,226,235,.72) 100%)',
          boxShadow: '0 8px 32px rgba(31,38,135,.18), inset 0 1px 0 rgba(255,255,255,.8)',
        }}
        onMouseDown={(event) => event.preventDefault()}
      >
        <div className="flex h-full items-center gap-3">
          <Microscope className="h-5 w-5 shrink-0 text-slate-700" strokeWidth={2} aria-hidden="true" />

          <div className="relative flex h-16 min-w-0 flex-1 items-center" role="group" aria-label="Semantic zoom strength">
            <div className="absolute left-[7.14%] right-[7.14%] top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-300/80" />
            <div
              className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-cyan-500/70 transition-all duration-300"
              style={{
                left: selectedStop < 0 ? `${(selectedStop + 3) * (100 / 7) + 100 / 14}%` : '50%',
                right: selectedStop > 0 ? `${(3 - selectedStop) * (100 / 7) + 100 / 14}%` : '50%',
              }}
            />

            {STOPS.map((stop) => {
              const details = stopDetails(stop)
              const selected = selectedStop === stop
              const isCenter = stop === 0
              return (
                <button
                  key={stop}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectStop(stop)}
                  aria-label={details.label}
                  aria-pressed={selected}
                  className="group relative z-10 flex h-16 min-w-0 flex-1 items-center justify-center disabled:cursor-not-allowed"
                >
                  <span
                    className={`flex items-center justify-center rounded-full border transition-all duration-200 ${
                      selected
                        ? 'h-7 w-7 border-cyan-300 bg-cyan-500 shadow-[0_0_0_4px_rgba(6,182,212,.12)]'
                        : isCenter
                          ? 'h-4 w-4 border-slate-400 bg-white'
                          : 'h-3 w-3 border-white bg-slate-400 group-hover:h-5 group-hover:w-5 group-hover:bg-cyan-400'
                    }`}
                  >
                    {selected && !isCenter && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </span>
                  {!isCenter && (
                    <span
                      className={`pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-700 px-2 py-1 text-[11px] font-semibold text-white transition-all ${
                        selected ? 'opacity-100' : 'translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100'
                      }`}
                    >
                      {details.label}
                    </span>
                  )}
                  <span
                    className={`pointer-events-none absolute bottom-0 whitespace-nowrap text-[9px] font-semibold tabular-nums ${
                      selected ? 'text-cyan-700' : 'text-slate-500'
                    }`}
                  >
                    {isCenter ? '0' : details.shortLabel}
                  </span>
                </button>
              )
            })}
          </div>

          <Telescope className="h-5 w-5 shrink-0 text-slate-700" strokeWidth={2} aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}
