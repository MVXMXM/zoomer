import type { ZoomDegree, ZoomOperation } from '@/app/types/zoom'

export const MAX_EXACT_ZOOM_WORDS = 100

const degrees = [1, 2, 3] as const
// Each step quadruples the requested change before rounding and length limits.
const strengthMultiplier = { 1: 1, 2: 4, 3: 16 }

export function zoomTargets(sourceWords: number) {
  if (sourceWords < 1) return []

  const shorter = degrees.slice(Math.max(0, 4 - sourceWords))
  const build = (operation: ZoomOperation, available: readonly ZoomDegree[]) => {
    let previousChange = 0
    return available.map((degree, index) => {
      const baseChange = operation === 'expand' ? Math.max(1, sourceWords * 0.1) : sourceWords * 0.05
      const desired = Math.round(baseChange * strengthMultiplier[degree])
      const limit = operation === 'contract' ? sourceWords - available.length + index : Infinity
      const change = Math.min(limit, Math.max(previousChange + 1, desired))
      previousChange = change
      return { operation, degree, target: sourceWords + (operation === 'expand' ? change : -change) }
    })
  }

  const targets = [...build('contract', shorter).reverse(), ...build('expand', degrees)]
  return targets.map((stop, index) => {
    const lower = stop.operation === 'expand' ? Math.max(sourceWords, targets[index - 1]?.target ?? 0) : targets[index - 1]?.target ?? 0
    const upper = stop.operation === 'contract' ? Math.min(sourceWords, targets[index + 1]?.target ?? sourceWords) : targets[index + 1]?.target ?? Infinity
    const tolerance = Math.min(
      Math.max(1, Math.round(stop.target * 0.05)),
      Math.floor((stop.target - lower - 1) / 2),
      Math.floor((upper - stop.target - 1) / 2),
    )
    return { ...stop, min: stop.target - tolerance, max: stop.target + tolerance }
  })
}
