import type { Layer } from '@/types'
import { getPanoSlideX, getPanoTotalWidth } from '@/utils/panoGeometry'

/** 2× SlideNavigator's THUMB_H (44) for DPR sharpness — do not collapse into THUMB_H. */
export const NAV_THUMB_CAPTURE_HEIGHT_PX = 88

export interface ThumbnailRequest {
  groupId: string
  format: string
  locale: string
  pano: { gapPx: number; compensate: boolean }
  key: string
}

export function stripExpensiveEffects(layers: Layer[]): Layer[] {
  return layers.map((layer) => {
    if (layer.type !== 'background') return layer
    const hasImageBlur = Boolean(layer.imageBlur)
    const hasAccentBlur = layer.accents.some((accent) => Boolean(accent.blur))
    if (!hasImageBlur && !hasAccentBlur) return layer
    return {
      ...layer,
      imageBlur: 0,
      accents: layer.accents.map((accent) => accent.blur ? { ...accent, blur: 0 } : accent),
    }
  })
}

export function getThumbnailStageGeometry(
  group: { slideWidth: number; slideHeight: number; numSlides: number },
  compensationPx: number,
) {
  const totalWidth = getPanoTotalWidth(group, compensationPx)
  const totalHeight = group.slideHeight
  const scale = NAV_THUMB_CAPTURE_HEIGHT_PX / group.slideHeight
  const sliceWidth = Math.round(group.slideWidth * scale)
  return {
    totalWidth,
    totalHeight,
    scale,
    stageWidth: Math.ceil(totalWidth * scale),
    stageHeight: Math.ceil(totalHeight * scale),
    sliceWidth,
    sliceHeight: Math.round(group.slideHeight * scale),
    sliceXs: Array.from({ length: group.numSlides }, (_, index) =>
      Math.round(getPanoSlideX(group, index, compensationPx) * scale)),
  }
}

export function enqueueRequests(queue: ThumbnailRequest[], incoming: ThumbnailRequest[]): ThumbnailRequest[] {
  const next = [...queue]
  for (const request of incoming) {
    const index = next.findIndex((queued) => queued.groupId === request.groupId)
    if (index === -1) {
      next.push(request)
    } else if (next[index]!.key !== request.key) {
      next[index] = request
    }
  }
  return next
}
