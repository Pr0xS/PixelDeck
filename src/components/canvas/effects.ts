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
      node.cache()
      node.filters([Konva.Filters.Blur])
      ;(node as Konva.Node & { blurRadius: (radius: number) => void }).blurRadius(blurRadius)
    } else {
      node.filters([])
    }

    node.getLayer()?.batchDraw()
  }, [nodeRef, blur, cacheKey])
}
