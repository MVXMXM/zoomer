import type { DialConfig, ResolvedValues } from 'dialkit'

export const GLASS_DIALS = {
  shape: {
    width: [276, 260, 400, 1],
    height: [48, 44, 80, 1],
    borderRadius: [24, 8, 40, 1],
    iconSize: [18, 16, 24, 1],
    labelSize: [13, 12, 16, 1],
    selectionGap: [12, 4, 40, 1],
  },
  refraction: {
    scale: [0.075, 0, 0.2, 0.001],
    depth: [18, 5, 60, 1],
    curvature: [48, 0, 80, 1],
    splay: [1, 0, 1, 0.01],
    chroma: [0.08, 0, 1, 0.01],
    blur: [0.35, 0, 2, 0.1],
  },
  lighting: {
    backdropBlur: [14, 0, 28, 1],
    tint: [0.2, 0, 0.5, 0.01],
    glow: [0.25, 0, 1, 0.01],
    edgeHighlight: [0.65, 0, 1, 0.01],
    specularAngle: [135, 0, 180, 1],
  },
} satisfies DialConfig

export type GlassSettings = ResolvedValues<typeof GLASS_DIALS>
