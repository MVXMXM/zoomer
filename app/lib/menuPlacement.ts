export type EditOrigin = { x: number; y: number; lineHeight: number }
export type MenuAnchor = { x: number; y: number; placement: 'above' | 'below'; pinned: boolean }

export function placeEditMenu(
  origin: EditOrigin,
  viewport: { width: number; height: number; scrollX: number; scrollY: number },
  menu: { width: number; height: number; gap: number },
): MenuAnchor {
  const margin = 12
  const top = origin.y - viewport.scrollY
  const pinned = top + origin.lineHeight < margin || top > viewport.height - margin
  const below = !pinned && top - menu.height - menu.gap < margin
  const desiredY = pinned
    ? top < 0 ? margin : viewport.height - menu.height - margin - 40
    : below ? top + origin.lineHeight + menu.gap : top - menu.height - menu.gap
  return {
    x: Math.max(menu.width / 2 + margin, Math.min(viewport.width - menu.width / 2 - margin,
      origin.x - viewport.scrollX + menu.width / 2)),
    y: Math.max(margin, Math.min(viewport.height - menu.height - margin, desiredY)),
    placement: below ? 'below' : 'above',
    pinned,
  }
}
