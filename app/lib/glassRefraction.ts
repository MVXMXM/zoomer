export type LensMapOptions = {
  width: number
  height: number
  radius: number
  curvature: number
  splay: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

// Generates the red/green displacement map described in Aave's glass technique.
// Neutral pixels are 128/128; pixels near the inner edge point radially outward.
export function createLensMap({ width, height, radius, curvature, splay }: LensMapOptions) {
  if (typeof document === 'undefined') return ''

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return ''

  const image = context.createImageData(width, height)
  const halfWidth = width / 2
  const halfHeight = height / 2
  const edgeWidth = Math.max(1, radius * splay)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x + 0.5 - halfWidth
      const dy = y + 0.5 - halfHeight
      const qx = Math.abs(dx) - (halfWidth - radius)
      const qy = Math.abs(dy) - (halfHeight - radius)
      const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0)
      const insideDistance = Math.max(0, -outside)
      const normalizedDepth = clamp(insideDistance / edgeWidth, 0, 1)
      const influence = outside <= 0 ? Math.pow(1 - normalizedDepth, curvature) : 0
      const length = Math.hypot(dx, dy) || 1
      const directionX = dx / length
      const directionY = dy / length
      const index = (y * width + x) * 4

      image.data[index] = Math.round(clamp(128 + directionX * 127 * influence, 0, 255))
      image.data[index + 1] = Math.round(clamp(128 + directionY * 127 * influence, 0, 255))
      image.data[index + 2] = 128
      image.data[index + 3] = 255
    }
  }

  context.putImageData(image, 0, 0)
  return canvas.toDataURL('image/png')
}
