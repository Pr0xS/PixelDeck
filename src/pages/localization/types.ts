import type { ImageLayer, PhoneLayer, TextLayer } from '@/types'

export type LocalizableDisplayLayer = TextLayer | PhoneLayer | ImageLayer

export interface LocalizableRow {
  slideGroupId: string
  slideGroupName: string
  layerId: string
  layerName: string
  layerType: 'text' | 'phone' | 'image'
  depth: number
  containerGroupId: string | null
  defaultText?: string
  defaultImageRef?: string
  layer: LocalizableDisplayLayer
}

export interface UploadTarget {
  slideGroupId: string
  layerId: string
  locale: string
  layerType: 'phone' | 'image'
}

export type CellStatus = 'idle' | 'queued' | 'translating' | 'done' | 'error'
export type CellKey = string // `${layerId}:${locale}`

export function cellKey(layerId: string, locale: string): CellKey {
  return `${layerId}:${locale}`
}
