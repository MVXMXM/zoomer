'use client'

import { useState } from 'react'

// Names, defaults, ordering, and ranges mirror Aave's published glass playground.
export type GlassSettings = {
  width: number
  height: number
  borderRadius: number
  scale: number
  depth: number
  curvature: number
  splay: number
  chroma: number
  blur: number
  glow: number
  edgeHighlight: number
  specularAngle: number
}

export const DEFAULT_GLASS_SETTINGS: GlassSettings = {
  width: 20,
  height: 20,
  borderRadius: 64,
  scale: 0.2,
  depth: 41,
  curvature: 80,
  splay: 1,
  chroma: 0,
  blur: 0.4,
  glow: 1,
  edgeHighlight: 0,
  specularAngle: 0,
}

type Dial = {
  key: keyof GlassSettings
  label: string
  min: number
  max: number
  step: number
  format: (value: number) => string
}

const integer = (value: number) => `${Math.round(value)}`

const dials: Dial[] = [
  { key: 'width', label: 'Width', min: 20, max: 120, step: 1, format: integer },
  { key: 'height', label: 'Height', min: 20, max: 80, step: 1, format: integer },
  { key: 'borderRadius', label: 'BorderRadius', min: 0, max: 64, step: 1, format: integer },
  { key: 'scale', label: 'Scale', min: 0, max: 0.2, step: 0.001, format: (value) => value.toFixed(3) },
  { key: 'depth', label: 'Depth', min: 5, max: 60, step: 1, format: integer },
  { key: 'curvature', label: 'Curvature', min: 0, max: 80, step: 1, format: integer },
  { key: 'splay', label: 'Splay', min: 0, max: 1, step: 0.01, format: (value) => value.toFixed(2) },
  { key: 'chroma', label: 'Chroma', min: 0, max: 1, step: 0.01, format: (value) => value.toFixed(2) },
  { key: 'blur', label: 'Blur', min: 0, max: 2, step: 0.1, format: (value) => value.toFixed(1) },
  { key: 'glow', label: 'Glow', min: 0, max: 1, step: 0.01, format: (value) => value.toFixed(2) },
  {
    key: 'edgeHighlight',
    label: 'Edge Highlight',
    min: 0,
    max: 1,
    step: 0.01,
    format: (value) => value.toFixed(2),
  },
  { key: 'specularAngle', label: 'Specular Angle', min: 0, max: 180, step: 1, format: integer },
]

type GlassTunerProps = {
  value: GlassSettings
  onChange: (value: GlassSettings) => void
}

export function GlassTuner({ value, onChange }: GlassTunerProps) {
  const [copied, setCopied] = useState(false)

  const copyValues = async () => {
    await navigator.clipboard.writeText(JSON.stringify(value, null, 2))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <details
      open
      className="fixed right-4 top-4 z-[10001] max-h-[calc(100dvh-2rem)] w-[260px] overflow-y-auto rounded-2xl border border-white/15 bg-slate-950/90 text-white shadow-2xl backdrop-blur-xl"
    >
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-bold tracking-tight">
        Aave glass controls <span className="ml-1 font-normal text-slate-400">dev only</span>
      </summary>
      <div className="border-t border-white/10 px-4 pb-4 pt-3">
        <p className="mb-3 text-[11px] leading-4 text-slate-400">
          Parameters, defaults, and ranges match the published reference.
        </p>
        <div className="space-y-3">
          {dials.map((dial) => (
            <label key={dial.key} className="block">
              <span className="mb-1 flex items-center justify-between text-xs">
                <span className="text-slate-300">{dial.label}</span>
                <span className="font-mono text-cyan-300">{dial.format(value[dial.key])}</span>
              </span>
              <input
                className="block w-full accent-cyan-400"
                type="range"
                min={dial.min}
                max={dial.max}
                step={dial.step}
                value={value[dial.key]}
                onChange={(event) => onChange({ ...value, [dial.key]: Number(event.target.value) })}
              />
            </label>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-lg border border-white/15 px-3 py-2 text-xs hover:bg-white/10"
            onClick={() => onChange(DEFAULT_GLASS_SETTINGS)}
          >
            Reset
          </button>
          <button
            type="button"
            className="flex-1 rounded-lg bg-cyan-400 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-300"
            onClick={() => void copyValues()}
          >
            {copied ? 'Copied' : 'Copy values'}
          </button>
        </div>
      </div>
    </details>
  )
}
