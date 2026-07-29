import type { Layer, LayerType } from '@/types'

/**
 * Content fields synced across families. These deliberately exclude layout,
 * model, and fill so an independently authored family retains its visuals.
 */
export const CONTENT_SYNC_KEYS = [
  'text', 'marks', 'screenshotPath', 'screenshotDataUrl', 'src',
  'localeContent', 'localizationMode', 'emoji',
] as const

export type ContentSyncStatus =
  | 'updated' | 'unchanged'
  | 'skipped-type-mismatch' | 'skipped-no-source' | 'skipped-no-target'

export interface ContentSyncEntry {
  path: number[]
  layerName: string
  layerType: LayerType
  status: ContentSyncStatus
  changedKeys: string[]
  preview?: string
}

export interface ContentSyncPlan {
  entries: ContentSyncEntry[]
  layers: Layer[]
  updatedCount: number
  skippedCount: number
}

type LayerRecord = Layer & Record<string, unknown>

// Mirrors pickLayerKeys while callers first filter to keys that actually exist
// on the source layer, preserving the distinction between absent and explicit
// undefined properties without importing store code into this pure utility.
function pickExistingLayerKeys(layer: Layer, keys: string[]): Partial<Layer> {
  const source = layer as LayerRecord
  const out: Record<string, unknown> = {}
  for (const key of keys) out[key] = source[key]
  return out as Partial<Layer>
}

function valuesDiffer(source: unknown, target: unknown): boolean {
  if (Object.is(source, target)) return false
  if (typeof source !== 'object' || source === null || typeof target !== 'object' || target === null) return true
  return JSON.stringify(source) !== JSON.stringify(target)
}

function truncate(value: string): string {
  return value.length > 60 ? `${value.slice(0, 57)}…` : value
}

function previewFor(source: LayerRecord, changedKeys: string[]): string | undefined {
  const parts = changedKeys.flatMap((key) => {
    const value = source[key]
    if (key === 'text' && typeof value === 'string') return [truncate(value)]
    if ((key === 'screenshotPath' || key === 'screenshotDataUrl' || key === 'src') && typeof value === 'string') return [truncate(value)]
    if (key === 'localeContent' && value && typeof value === 'object') {
      const localizedText = Object.values(value as Record<string, { text?: unknown }>)
        .find((content) => typeof content?.text === 'string')?.text
      return typeof localizedText === 'string' ? [truncate(localizedText)] : ['Localized content']
    }
    if (key === 'emoji' && typeof value === 'string') return [value]
    if (key === 'marks') return ['Text styling']
    if (key === 'localizationMode' && typeof value === 'string') return [value]
    return []
  })
  return parts.length ? parts.join(' · ') : undefined
}

/**
 * Walk source and target trees by index path, copying content-only allowlisted
 * values while preserving the target tree's complete structure and layout.
 */
export function planContentSync(sourceLayers: Layer[], targetLayers: Layer[]): ContentSyncPlan {
  const entries: ContentSyncEntry[] = []
  let updatedCount = 0
  let skippedCount = 0

  const walk = (source: Layer[] | undefined, target: Layer[] | undefined, parentPath: number[]): Layer[] => {
    const result: Layer[] = []
    const length = Math.max(source?.length ?? 0, target?.length ?? 0)
    for (let index = 0; index < length; index++) {
      const path = [...parentPath, index]
      const sourceLayer = source?.[index]
      const targetLayer = target?.[index]
      if (!sourceLayer) {
        if (targetLayer) {
          entries.push({ path, layerName: targetLayer.name, layerType: targetLayer.type, status: 'skipped-no-source', changedKeys: [] })
          skippedCount++
          result.push(targetLayer)
        }
        continue
      }
      if (!targetLayer) {
        entries.push({ path, layerName: sourceLayer.name, layerType: sourceLayer.type, status: 'skipped-no-target', changedKeys: [] })
        skippedCount++
        continue
      }
      if (sourceLayer.type !== targetLayer.type) {
        entries.push({ path, layerName: targetLayer.name, layerType: targetLayer.type, status: 'skipped-type-mismatch', changedKeys: [] })
        skippedCount++
        result.push(targetLayer)
        continue
      }

      const sourceRecord = sourceLayer as LayerRecord
      const targetRecord = targetLayer as LayerRecord
      const changedKeys = CONTENT_SYNC_KEYS.filter((key) => (
        key in sourceRecord && valuesDiffer(sourceRecord[key], targetRecord[key])
      ))
      const patch = pickExistingLayerKeys(sourceLayer, changedKeys as string[])
      let next = changedKeys.length ? { ...targetLayer, ...patch } as Layer : targetLayer

      if (sourceLayer.type === 'group' && targetLayer.type === 'group') {
        const children = walk(sourceLayer.children, targetLayer.children, path)
        if (children.some((child, childIndex) => child !== targetLayer.children[childIndex]) || children.length !== targetLayer.children.length) {
          next = { ...next, children } as Layer
        }
      }

      if (changedKeys.length) {
        updatedCount++
        entries.push({
          path,
          layerName: targetLayer.name,
          layerType: targetLayer.type,
          status: 'updated',
          changedKeys: [...changedKeys],
          preview: previewFor(sourceRecord, changedKeys),
        })
      } else {
        entries.push({ path, layerName: targetLayer.name, layerType: targetLayer.type, status: 'unchanged', changedKeys: [] })
      }
      result.push(next)
    }
    return result
  }

  const layers = walk(sourceLayers, targetLayers, [])
  return { entries, layers, updatedCount, skippedCount }
}
