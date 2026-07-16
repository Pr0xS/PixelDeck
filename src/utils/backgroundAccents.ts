import type { BackgroundAccent } from '@/types'
import { parseColorAlpha, withAlpha } from './gradients'

function clampOpacity(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export function updateBackgroundAccentAt(
  accents: readonly BackgroundAccent[],
  index: number,
  patch: Partial<BackgroundAccent>,
): BackgroundAccent[] {
  return accents.map((accent, currentIndex) => (
    currentIndex === index ? { ...accent, ...patch } : accent
  ))
}

/** Read the independent opacity, falling back to legacy rgba() alpha. */
export function getBackgroundAccentOpacity(accent: BackgroundAccent): number {
  return accent.opacity === undefined
    ? parseColorAlpha(accent.color)
    : clampOpacity(accent.opacity)
}

/** Remove legacy color alpha when opacity is stored independently. */
export function getBackgroundAccentRenderColor(
  accent: BackgroundAccent,
  resolvedColor: string,
): string {
  return accent.opacity === undefined ? resolvedColor : withAlpha(resolvedColor, 1)
}

export function getNextBackgroundAccentIndex(
  accents: readonly BackgroundAccent[],
  point: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number,
  clickedIndex: number,
  selectedIndex: number | null,
): number {
  if (clickedIndex !== selectedIndex) return clickedIndex

  const hits = accents.flatMap((accent, index) => {
    if (accent.rx <= 0 || accent.ry <= 0) return []
    const centerX = (accent.cx / 100) * canvasWidth
    const centerY = (accent.cy / 100) * canvasHeight
    const normalizedX = (point.x - centerX) / accent.rx
    const normalizedY = (point.y - centerY) / accent.ry
    return normalizedX ** 2 + normalizedY ** 2 <= 1 ? [index] : []
  })

  if (hits.length < 2) return clickedIndex
  const currentPosition = hits.indexOf(clickedIndex)
  if (currentPosition < 0) return clickedIndex
  return hits[(currentPosition - 1 + hits.length) % hits.length]
}
