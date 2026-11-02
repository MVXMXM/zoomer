import type { DialConfig, ResolvedValues } from 'dialkit'

// This module replaces DialKit at build time in production. Tuple defaults
// become plain values; no editor, store, persistence, or listeners are shipped.
function resolveDefaults(config: DialConfig): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(config)
      .filter(([key]) => key !== '_collapsed')
      .map(([key, value]) => [key,
        Array.isArray(value) ? value[0]
          : value !== null && typeof value === 'object' ? resolveDefaults(value as DialConfig)
          : value,
      ]),
  )
}

export function useDialKit<T extends DialConfig>(_name: string, config: T): ResolvedValues<T> {
  return resolveDefaults(config) as ResolvedValues<T>
}

export function DialRoot() {
  return null
}
