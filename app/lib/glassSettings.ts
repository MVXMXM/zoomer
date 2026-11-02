import type { DialConfig, ResolvedValues } from 'dialkit'

export const GLASS_DIALS = {
  shape: {
    width: [184, 184, 344, 1],
    height: [64, 64, 112, 1],
    borderRadius: [32, 0, 64, 1],
    iconSize: [29, 20, 36, 1],
    selectionGap: [12, 4, 40, 1],
  },
  refraction: {
    scale: [0.2, 0, 0.2, 0.001],
    depth: [41, 5, 60, 1],
    curvature: [80, 0, 80, 1],
    splay: [1, 0, 1, 0.01],
    chroma: [0, 0, 1, 0.01],
    blur: [0.4, 0, 2, 0.1],
  },
  lighting: {
    glow: [1, 0, 1, 0.01],
    edgeHighlight: [0, 0, 1, 0.01],
    specularAngle: [0, 0, 180, 1],
  },
} satisfies DialConfig

export type GlassSettings = ResolvedValues<typeof GLASS_DIALS>
