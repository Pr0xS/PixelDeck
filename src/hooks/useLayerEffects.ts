import type Konva from 'konva'
import type { RefObject } from 'react'
import type { BaseLayer } from '@/types'
import { getShadowProps, useKonvaBlur } from '@/components/canvas/effects'

/** Apply a layer's blur and expose its matching Konva shadow props. */
export function useLayerEffects(
  nodeRef: RefObject<Konva.Node | null>,
  layer: Pick<BaseLayer, 'blur' | 'shadow'>,
  cacheKey?: string | number | boolean | null,
  blur = layer.blur,
) {
  useKonvaBlur(nodeRef, blur, cacheKey)
  return getShadowProps(layer.shadow)
}
