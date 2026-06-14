import type { SlideGroup, PanoSettings } from '@/types'
import type { CanvasFormatId } from '@/types'

function fnv1a(str: string): string {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = (h * 16777619) >>> 0
  }
  return h.toString(36)
}

export function getGroupPreviewKey(
  group: SlideGroup,
  format: CanvasFormatId,
  locale: string,
  pano: PanoSettings | undefined,
): string {
  const effectiveGap = pano?.compensate ? (pano.gapPx ?? 0) : 0
  const payload = JSON.stringify({
    layers: group.layers,
    numSlides: group.numSlides,
    slideWidth: group.slideWidth,
    slideHeight: group.slideHeight,
    format,
    locale,
    panoGapPx: effectiveGap,
  })
  return fnv1a(payload)
}
