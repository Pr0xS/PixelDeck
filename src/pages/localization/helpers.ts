import type { GroupLayer, Layer, SlideGroup, TextLayer, PhoneLayer, ImageLayer } from '@/types'
import { effectiveLocalizationMode } from '@/utils/locale'
import { CANVAS_FORMAT_PRESETS } from '@/utils/canvasFormats'
import type { CanvasFormatId } from '@/types'
import type { LocalizableRow } from './types'

export function findLayerById(
  layers: Layer[],
  layerId: string,
  containerGroupId: string | null = null,
): { layer: Layer; containerGroupId: string | null } | null {
  for (const layer of layers) {
    if (layer.id === layerId) return { layer, containerGroupId }
    if (layer.type === 'group') {
      const found = findLayerById((layer as GroupLayer).children, layerId, layer.id)
      if (found) return found
    }
  }
  return null
}

export function collectLocalizableRows(
  slideGroup: SlideGroup,
  layers: Layer[],
  depth = 0,
  containerGroupId: string | null = null,
): LocalizableRow[] {
  const rows: LocalizableRow[] = []
  for (const layer of layers) {
    if (layer.type === 'group') {
      rows.push(...collectLocalizableRows(slideGroup, (layer as GroupLayer).children, depth + 1, layer.id))
      continue
    }
    if (layer.type !== 'text' && layer.type !== 'phone' && layer.type !== 'image') continue
    rows.push({
      slideGroupId: slideGroup.id,
      slideGroupName: slideGroup.name,
      layerId: layer.id,
      layerName: layer.name,
      layerType: layer.type,
      depth,
      containerGroupId,
      defaultText: layer.type === 'text' ? (layer as TextLayer).text : undefined,
      defaultImageRef:
        layer.type === 'phone'
          ? (layer as PhoneLayer).screenshotPath ?? (layer as PhoneLayer).screenshotDataUrl
          : layer.type === 'image'
            ? (layer as ImageLayer).src
            : undefined,
      layer: layer as TextLayer | PhoneLayer | ImageLayer,
    })
  }
  // Sort: texts first, then images/phone
  return rows.sort((a, b) => {
    if (a.layerType === 'text' && b.layerType !== 'text') return -1
    if (a.layerType !== 'text' && b.layerType === 'text') return 1
    return 0
  })
}

export function isOverrideComplete(row: LocalizableRow, locale: string, defaultLocale: string): boolean {
  if (locale === defaultLocale) return true
  if (effectiveLocalizationMode(row.layer) === 'skip') return true // skipped = not counted
  const override = row.layer.localeOverrides?.[locale]
  if (!override) return false
  if (row.layerType === 'text') return typeof override.text === 'string' && override.text.trim().length > 0
  if (row.layerType === 'phone') return Boolean((override.screenshotPath?.trim()) || override.screenshotDataUrl)
  return Boolean(override.src?.trim())
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Failed to read file'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Build a locale-namespaced asset key.
 * Format: `locale::{locale}::{slideGroupId}::{layerId}::{fileName}`
 * Uses `::` as separator so it never collides with nanoid chars or file names.
 */
export function buildLocaleAssetKey(locale: string, slideGroupId: string, layerId: string, fileName: string): string {
  return `locale::${locale}::${slideGroupId}::${layerId}::${fileName}`
}

export function truncate(value: string, length = 120): string {
  if (value.length <= length) return value
  return `${value.slice(0, length - 1)}…`
}

export function getFileLabel(value?: string): string {
  if (!value) return 'No image'
  if (value.startsWith('data:')) return 'Embedded image'
  // Locale-namespaced asset keys: `locale::{locale}::{slideGroupId}::{layerId}::{fileName}`
  if (value.startsWith('locale::')) {
    const parts = value.split('::')
    // parts[0]='locale', [1]=locale, [2]=slideGroupId, [3]=layerId, [4]=fileName
    return parts[4] || value
  }
  // Legacy locale keys used dashes: `locale-{locale}-{slideGroupId}-{layerId}-{fileName}`
  // These can't be parsed unambiguously (nanoid uses dashes too), so show the raw key.
  // Plain path: take the last segment after '/'
  const slashParts = value.split('/')
  return slashParts[slashParts.length - 1] || value
}

export function getPlatformBadge(ownerFormat?: CanvasFormatId): { label: string; color: string } | null {
  if (!ownerFormat) return null
  const preset = CANVAS_FORMAT_PRESETS.find((f) => f.id === ownerFormat)
  if (!preset) return null
  const isIos = ownerFormat === 'iphone-69' || ownerFormat === 'ipad-13'
  return {
    label: preset.label,
    color: isIos ? '#5ac8fa' : '#a4c639',
  }
}
