import { getPanoGapPx, getPanoTotalWidth } from '@/utils/panoGeometry'
import type { SlideGroup } from '@/types'

export function useStageGeometry(
  group: SlideGroup | undefined,
  panoCompensate: boolean,
  panoCompensationPx: number,
  zoom: number,
) {
  // The gap is real canvas geometry only while compensation is active.
  const effectiveCompensationPx = group && panoCompensate ? panoCompensationPx : 0
  const visualGapPx = group ? getPanoGapPx(group, effectiveCompensationPx) : 0
  const totalWidth = group ? getPanoTotalWidth(group, effectiveCompensationPx) : 0
  const totalHeight = group ? group.slideHeight : 0

  return {
    effectiveCompensationPx,
    visualGapPx,
    totalWidth,
    totalHeight,
    displayWidth: totalWidth * zoom,
    displayHeight: totalHeight * zoom,
  }
}
