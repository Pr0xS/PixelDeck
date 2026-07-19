import type { CSSProperties } from 'react'
import type { BackgroundLayer, BrandColor, GroupLayer, Layer, SlideGroup, TextLayer, PhoneLayer, ImageLayer } from '@/types'
import { effectiveLocalizationMode, isLocaleContentComplete } from '@/utils/locale'
import { CANVAS_FORMAT_PRESETS } from '@/utils/canvasFormats'
import type { CanvasFormatId } from '@/types'
import { resolveFill } from '@/utils/brandColors'
import { fillToCss } from '@/utils/gradients'
import type { LocalizableRow } from './types'

export interface SlideBackgroundPreview {
  /** Base surface: background-color and/or background-image (gradient or slide image) + sizing. */
  style: CSSProperties
  /** Tint overlay color drawn above the background image (BackgroundLayer.imageOverlayColor), if any. */
  overlayColor?: string
  overlayOpacity?: number
}

/**
 * Approximates a SlideGroup's real background as CSS, for contrast-checking text
 * previews in the Localization view. Reads BackgroundLayer directly (fill + optional
 * image) — no Konva capture involved. Accents/noise/imageBlur are intentionally skipped
 * (this is a contrast smell-test, not a pixel-perfect preview).
 */
export function getSlideBackgroundPreview(
  slideGroup: SlideGroup,
  brandColors: BrandColor[],
): SlideBackgroundPreview {
  const bgLayer = slideGroup.layers.find((l): l is BackgroundLayer => l.type === 'background')
  if (!bgLayer) return { style: { backgroundColor: '#1a1a2e' } }

  const resolvedFill = resolveFill(bgLayer.fill, brandColors)
  const fillCss = fillToCss(resolvedFill)
  const isSolidFill = typeof resolvedFill === 'string'

  if (bgLayer.imageDataUrl) {
    const fit = bgLayer.imageFit ?? 'cover'
    return {
      style: {
        backgroundColor: isSolidFill ? fillCss : undefined,
        backgroundImage: `url(${bgLayer.imageDataUrl})`,
        backgroundSize: fit === 'fill' ? '100% 100%' : fit,
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      },
      overlayColor: (bgLayer.imageOverlayOpacity ?? 0) > 0 ? (bgLayer.imageOverlayColor ?? '#000000') : undefined,
      overlayOpacity: bgLayer.imageOverlayOpacity,
    }
  }

  return {
    style: isSolidFill
      ? { backgroundColor: fillCss }
      : { backgroundImage: fillCss },
  }
}

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
  return isLocaleContentComplete(row.layer, row.layer.localeContent?.[locale])
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
