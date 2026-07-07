import type { GroupLayer, Layer } from '@/types'
import { getPhoneSpec } from '@/assets/mockups/specs'
import { DEFAULT_TEXT_WIDTH } from '@/utils/textRendering'

export function estimateLayerBox(layer: Layer): { x: number; y: number; w: number; h: number } {
  if (layer.type === 'phone') {
    const spec = getPhoneSpec(layer.model)
    return { x: layer.x, y: layer.y, w: spec.frameWidth * layer.scale, h: spec.frameHeight * layer.scale }
  }
  if (layer.type === 'image' || layer.type === 'shape') return { x: layer.x, y: layer.y, w: layer.width, h: layer.height }
  if (layer.type === 'text') return { x: layer.x, y: layer.y, w: layer.width ?? DEFAULT_TEXT_WIDTH, h: layer.height ?? layer.fontSize * layer.lineHeight * Math.max(1, layer.text.split('\n').length) }
  if (layer.type === 'emoji') return { x: layer.x, y: layer.y, w: layer.fontSize, h: layer.fontSize }
  if (layer.type === 'brand') return { x: layer.x, y: layer.y, w: 360, h: Math.max(layer.logoSize, layer.nameFontSize) }
  if (layer.type === 'group') {
    const s = layer.scale ?? 1
    const b = estimateGroupBox({ ...layer, x: 0, y: 0 })
    return { x: layer.x + b.x * s, y: layer.y + b.y * s, w: b.w * s, h: b.h * s }
  }
  return { x: layer.x, y: layer.y, w: 1, h: 1 }
}

export function estimateGroupBox(layer: GroupLayer): { x: number; y: number; w: number; h: number } {
  if (layer.children.length === 0) return { x: layer.x, y: layer.y, w: 1, h: 1 }
  const boxes = layer.children.map(estimateLayerBox)
  const minX = Math.min(...boxes.map((box) => box.x))
  const minY = Math.min(...boxes.map((box) => box.y))
  const maxX = Math.max(...boxes.map((box) => box.x + box.w))
  const maxY = Math.max(...boxes.map((box) => box.y + box.h))
  return { x: layer.x + minX, y: layer.y + minY, w: maxX - minX, h: maxY - minY }
}
