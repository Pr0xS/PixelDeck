import type { Layer } from '@/types'

export type LayerTypeKey = Layer['type']

export const LAYER_ICON: Record<LayerTypeKey, string> = {
  background: '🎨',
  phone: '📱',
  text: 'T',
  image: '🖼',
  shape: '▭',
  emoji: '😀',
  brand: '🏷',
  group: '▥',
}

export interface ContextMenu { layerId: string; x: number; y: number }

/** Data attached to every useSortable item so handleDragEnd knows the source/dest container */
export type ItemData =
  | { container: 'root'; isGroup?: boolean }
  | { container: 'group'; groupId: string }
