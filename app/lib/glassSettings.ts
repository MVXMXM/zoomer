import type { DialConfig, ResolvedValues } from 'dialkit'

export const GLASS_DIALS = {
  shape: {
    width: [286, 260, 400, 1],
    height: [58, 44, 80, 1],
    borderRadius: [40, 8, 40, 1],
    iconSize: [24, 16, 24, 1],
    labelSize: [16, 12, 16, 1],
    selectionGap: [11, 4, 40, 1],
  },
  motion: {
    enterDuration: [0.32, 0.15, 0.7, 0.01],
    exitDuration: [0.14, 0.08, 0.3, 0.01],
    bounce: [0.12, 0, 0.35, 0.01],
    distance: [6, 0, 16, 1],
  },
  refraction: {
    scale: [0.2, 0, 0.2, 0.001],
    depth: [24, 5, 60, 1],
    curvature: [48, 0, 80, 1],
    splay: [1, 0, 1, 0.01],
    chroma: [1, 0, 1, 0.01],
    blur: [0.3, 0, 2, 0.1],
  },
  lighting: {
    backdropBlur: [10, 0, 28, 1],
    tint: [0.42, 0, 0.5, 0.01],
    glow: [0.41, 0, 1, 0.01],
    edgeHighlight: [1, 0, 1, 0.01],
    specularAngle: [173, 0, 180, 1],
  },
} satisfies DialConfig

export type GlassSettings = ResolvedValues<typeof GLASS_DIALS>
