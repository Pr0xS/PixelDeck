/**
 * Layer alignment utilities.
 *
 * All alignment is done by computing deltas from the layer's current bounding
 * box to the target position, then applying those deltas to layer.x / layer.y.
 * Using deltas (not absolute coords) is critical because:
 *  - Layers with rotation have offsetX/offsetY applied in Konva; their stored
 *    x/y is the visual top-left of the un-rotated box, not the Konva node origin.
 *  - Pano layers live at x > slideWidth; we must not reset their slide offset.
 *
 * Bounding boxes are obtained from Konva via node.getClientRect() which accounts
 * for rotation, scale, and all transforms. This is the same method used by the
 * rubber-band selection in StageCanvas.
 */

import { getStage } from '@/utils/stageRegistry'
import type { Layer } from '@/types'

export type AlignAxis =
  | 'left'
  | 'center-h'
  | 'right'
  | 'top'
  | 'center-v'
  | 'bottom'

export interface BBox {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Get the visual bounding box of a layer from the Konva stage.
 * Returns null if the stage is not mounted or the node is not found.
 * The returned rect is in stage (canvas) coordinates.
 */
export function getLayerBBox(layerId: string): BBox | null {
  const stage = getStage()
  if (!stage) return null
  const node = stage.findOne(`#layer-${layerId}`)
  if (!node) return null
  // skipShadow: true so shadow doesn't inflate the bbox
  const rect = node.getClientRect({ skipShadow: true, relativeTo: stage })
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
}

/**
 * Compute the union bounding box of multiple layers.
 * Returns null if none of the layers have a resolvable bbox.
 */
export function getUnionBBox(layerIds: string[]): BBox | null {
  const boxes = layerIds.map(getLayerBBox).filter((b): b is BBox => b !== null)
  if (boxes.length === 0) return null
  const x1 = Math.min(...boxes.map((b) => b.x))
  const y1 = Math.min(...boxes.map((b) => b.y))
  const x2 = Math.max(...boxes.map((b) => b.x + b.width))
  const y2 = Math.max(...boxes.map((b) => b.y + b.height))
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
}

/**
 * Compute the x/y patch needed to align a single layer to a target bbox
 * along the given axis.
 *
 * @param layer       The layer to align (provides current x/y)
 * @param layerBBox   The layer's current visual bbox (from getLayerBBox)
 * @param targetBBox  The reference bbox to align against (slide or selection)
 * @param axis        Which alignment to apply
 */
export function computeAlignPatch(
  layer: Layer,
  layerBBox: BBox,
  targetBBox: BBox,
  axis: AlignAxis,
): Partial<Layer> {
  const patch: Partial<Layer> = {}

  switch (axis) {
    case 'left':
      patch.x = layer.x + (targetBBox.x - layerBBox.x)
      break
    case 'center-h':
      patch.x = layer.x + (targetBBox.x + targetBBox.width / 2 - (layerBBox.x + layerBBox.width / 2))
      break
    case 'right':
      patch.x = layer.x + (targetBBox.x + targetBBox.width - (layerBBox.x + layerBBox.width))
      break
    case 'top':
      patch.y = layer.y + (targetBBox.y - layerBBox.y)
      break
    case 'center-v':
      patch.y = layer.y + (targetBBox.y + targetBBox.height / 2 - (layerBBox.y + layerBBox.height / 2))
      break
    case 'bottom':
      patch.y = layer.y + (targetBBox.y + targetBBox.height - (layerBBox.y + layerBBox.height))
      break
  }

  // Round to integers to avoid sub-pixel drift
  if (patch.x !== undefined) patch.x = Math.round(patch.x)
  if (patch.y !== undefined) patch.y = Math.round(patch.y)

  return patch
}
