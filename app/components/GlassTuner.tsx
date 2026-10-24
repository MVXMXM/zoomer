'use client'

import { useState } from 'react'

export type GlassSettings = {
  fill: number
  blur: number
  saturation: number
  contrast: number
  topShade: number
  bottomLight: number
  rim: number
  highlight: number
  shadow: number
  iconSize: number
  refraction: number
  curvature: number
  splay: number
  chroma: number
  refractionVisibility: number
}

export const DEFAULT_GLASS_SETTINGS: GlassSettings = {
  fill: 0.22,
  blur: 16,
  saturation: 108,
  contrast: 94,
  topShade: 0.5,
  bottomLight: 0.98,
  rim: 0.9,
  highlight: 0.42,
  shadow: 0.28,
  iconSize: 29,
  refraction: 14,
  curvature: 1.8,
  splay: 1,
  chroma: 0.8,
  refractionVisibility: 0.3,
}

type Dial = {
  key: keyof GlassSettings
  label: string
  min: number
  max: number
  step: number
  format?: (value: number) => string
}

const dials: Dial[] = [
  { key: 'fill', label: 'Fill', min: 0, max: 0.9, step: 0.01, format: (value) => value.toFixed(2) },
  { key: 'blur', label: 'Blur', min: 0, max: 32, step: 1, format: (value) => `${value}px` },
  { key: 'saturation', label: 'Saturation', min: 80, max: 160, step: 1, format: (value) => `${value}%` },
  { key: 'contrast', label: 'Contrast', min: 75, max: 115, step: 1, format: (value) => `${value}%` },
  { key: 'topShade', label: 'Top shade', min: 0, max: 0.8, step: 0.01, format: (value) => value.toFixed(2) },
  { key: 'bottomLight', label: 'Bottom light', min: 0, max: 1, step: 0.01, format: (value) => value.toFixed(2) },
  { key: 'rim', label: 'Rim', min: 0, max: 1, step: 0.01, format: (value) => value.toFixed(2) },
  { key: 'highlight', label: 'Highlight', min: 0, max: 0.8, step: 0.01, format: (value) => value.toFixed(2) },
  { key: 'shadow', label: 'Shadow', min: 0, max: 0.6, step: 0.01, format: (value) => value.toFixed(2) },
  { key: 'iconSize', label: 'Icon size', min: 20, max: 38, step: 1, format: (value) => `${value}px` },
  { key: 'refraction', label: 'Refraction', min: 0, max: 40, step: 1, format: (value) => `${value}px` },
  { key: 'curvature', label: 'Curvature', min: 0.5, max: 4, step: 0.1, format: (value) => value.toFixed(1) },
  { key: 'splay', label: 'Edge splay', min: 0.35, max: 2, step: 0.05, format: (value) => value.toFixed(2) },
  { key: 'chroma', label: 'Chroma', min: 0, max: 4, step: 0.1, format: (value) => `${value.toFixed(1)}px` },
  {
    key: 'refractionVisibility',
    label: 'Refracted text',
    min: 0,
    max: 0.8,
    step: 0.01,
    format: (value) => value.toFixed(2),
  },
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
        Glass dials <span className="ml-1 font-normal text-slate-400">dev only</span>
      </summary>
      <div className="border-t border-white/10 px-4 pb-4 pt-3">
        <div className="space-y-3">
          {dials.map((dial) => (
            <label key={dial.key} className="block">
              <span className="mb-1 flex items-center justify-between text-xs">
                <span className="text-slate-300">{dial.label}</span>
                <span className="font-mono text-cyan-300">{dial.format?.(value[dial.key]) ?? value[dial.key]}</span>
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
