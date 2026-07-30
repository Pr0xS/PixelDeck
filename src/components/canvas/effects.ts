import { useEffect, type RefObject } from 'react'
import Konva from 'konva'
import type { ShadowConfig } from '@/types'

export function getShadowProps(shadow?: ShadowConfig) {
  return shadow
    ? {
        shadowColor: shadow.color,
        shadowBlur: shadow.blur,
        shadowOffsetX: shadow.offsetX,
        shadowOffsetY: shadow.offsetY,
        shadowOpacity: shadow.opacity,
      }
    : {}
}

export function useKonvaBlur(
  nodeRef: RefObject<Konva.Node | null>,
  blur?: number,
  cacheKey?: string | number | boolean | null,
) {
  useEffect(() => {
    const node = nodeRef.current
    if (!node) return

    const blurRadius = blur ?? 0
    node.clearCache()

    if (blurRadius > 0) {
      // CSS blur(Npx) has a Gaussian tail that extends well beyond N px
      // (sigma = N/2, visible spread ≈ 3×sigma ≈ 1.5×N). Pad generously so the
      // cache canvas doesn't hard-clip the tail at its own boundary.
      node.cache({ offset: Math.ceil(blurRadius * 3) })
      // Native CSS blur avoids Konva.Filters.Blur's known white-halo artifact on
      // anti-aliased transparent edges (konvajs/konva#428, #1799).
      node.filters([`blur(${blurRadius}px)`])
    } else {
      node.filters([])
    }

    node.getLayer()?.batchDraw()
  }, [nodeRef, blur, cacheKey])
}
