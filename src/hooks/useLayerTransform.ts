import type Konva from 'konva'
import type { RefObject } from 'react'

interface NormalizedScale {
  scaleX: number
  scaleY: number
}

interface LayerTransformOptions<TNode extends Konva.Node, TPatch> {
  nodeRef: RefObject<TNode | null>
  onChange: (patch: TPatch) => void
  buildPatch: (node: TNode, scale: NormalizedScale) => TPatch
  beforeChange?: () => void
}

/**
 * Shared transform-end normalization for nodes whose persisted model does not
 * retain Konva scale. Geometry-specific patch calculation stays at the call site.
 */
export function useLayerTransform<TNode extends Konva.Node, TPatch>({
  nodeRef,
  onChange,
  buildPatch,
  beforeChange,
}: LayerTransformOptions<TNode, TPatch>) {
  return () => {
    const node = nodeRef.current
    if (!node) return
    const scale = { scaleX: node.scaleX(), scaleY: node.scaleY() }
    node.scaleX(1)
    node.scaleY(1)
    const patch = buildPatch(node, scale)
    beforeChange?.()
    onChange(patch)
  }
}
