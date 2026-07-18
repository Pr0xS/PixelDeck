import type { Layer } from '@/types'

export type LayerMapper = (layer: Layer) => Layer
export type LayerVisitor = (layer: Layer) => void

/** Read-only pre-order traversal: visits every layer then recurses into group children. */
export function forEachLayerTree(layers: Layer[], fn: LayerVisitor): void {
  for (const layer of layers) {
    fn(layer)
    if (layer.type === 'group') forEachLayerTree(layer.children, fn)
  }
}

/**
 * Map every layer in a tree without mutating the input.
 *
 * Ordering contract: `fn` is applied to a group PARENT FIRST (pre-order), then
 * recursion descends into `mapped.children` — i.e. the children of the value
 * `fn` returned. `fn` must preserve `children` on group layers (rewrite only
 * the layer's own fields); reshaping or removing children inside `fn` will
 * interact with the recursion. If you need post-order semantics (children
 * transformed before the parent sees them), do not use this helper.
 */
export function mapLayerTree(layers: Layer[], fn: LayerMapper): Layer[] {
  return layers.map((layer) => {
    const mapped = fn(layer)
    return mapped.type === 'group'
      ? { ...mapped, children: mapLayerTree(mapped.children, fn) }
      : mapped
  })
}

/** Find a layer at any depth in a layer tree. */
export function findLayerInTree(layers: Layer[], layerId: string): Layer | undefined {
  for (const layer of layers) {
    if (layer.id === layerId) return layer
    if (layer.type === 'group') {
      const found = findLayerInTree(layer.children, layerId)
      if (found) return found
    }
  }
  return undefined
}

/** Update a layer at any depth, preserving the original tree when it is not found. */
export function updateLayerInTree(
  layers: Layer[],
  layerId: string,
  patch: Partial<Layer> | LayerMapper,
): Layer[] {
  let changed = false
  const next = layers.map((layer) => {
    if (layer.id === layerId) {
      const updated = typeof patch === 'function'
        ? patch(layer)
        : ({ ...layer, ...patch } as Layer)
      if (updated !== layer) changed = true
      return updated
    }
    if (layer.type === 'group') {
      const children = updateLayerInTree(layer.children, layerId, patch)
      if (children !== layer.children) {
        changed = true
        return { ...layer, children }
      }
    }
    return layer
  })
  return changed ? next : layers
}
