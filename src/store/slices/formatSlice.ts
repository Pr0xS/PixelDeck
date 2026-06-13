import type { Layer, CanvasFormatId } from '@/types'
import {
  BASE_CANVAS_FORMAT,
  CANVAS_FORMAT_PRESETS,
  FORMAT_LAYOUT_KEYS,
  getProjectActiveFormats,
  getProjectBaseFormat,
  makeOwnedFormatLayersSharedInLayerTree,
  mapLayerToAuthoringSpace,
  promoteFormatOverridesToSharedInLayerTree,
  resetFormatOverridesInLayerTree,
  resetFormatVisibilityInLayerTree,
} from '@/utils/canvasFormats'
import type { EditorStore, EditorSet, EditorGet } from '../types'
import {
  mapLayerById,
  mutateActiveGroup,
  withoutFormatOverride,
  pickLayerKeys,
} from '../helpers'

export const createFormatSlice = (
  set: EditorSet,
  get: EditorGet,
): Pick<
  EditorStore,
  | 'setActiveCanvasFormat'
  | 'makeLayerShared'
  | 'clearLayerFormatOverride'
  | 'syncLayerFormatToShared'
  | 'setLayerFormatVisibility'
  | 'setLayerOnlyInFormat'
  | 'clearLayerFormatVisibility'
  | 'toggleActiveFormat'
  | 'clearLayerFormatOverrideKey'
  | 'applyLayerFormatKeyToShared'
  | 'resetActiveFormatLayout'
  | 'shareActiveFormatOwnedLayers'
  | 'resetActiveFormatVisibility'
  | 'promoteActiveFormatLayoutToShared'
> => ({
  // ─ Canvas format actions
  setActiveCanvasFormat: (format) => set({ activeCanvasFormat: format, selection: null, editingGroupId: null, selectedLayerIds: [] }),

  clearLayerFormatOverride: (layerId, format) => {
    const targetFormat = format ?? get().activeCanvasFormat
    mutateActiveGroup(set, (g) => ({ ...g, layers: mapLayerById(g.layers, layerId, (l) => withoutFormatOverride(l, targetFormat)) }))
  },

  syncLayerFormatToShared: (layerId, format) => {
    const targetFormat = format ?? get().activeCanvasFormat
    const baseFormat = getProjectBaseFormat(get().project)
    if (targetFormat === baseFormat) return
    mutateActiveGroup(set, (g) => ({
      ...g,
      layers: mapLayerById(g.layers, layerId, (layer) => {
        const patch = layer.formatOverrides?.[targetFormat]
        if (!patch) return layer
        // Override values live in the target format's coordinate space.
        // Map them back to the group's authoring space before merging into
        // the shared base, otherwise the layer jumps in every other format.
        const inTargetSpace = { ...layer, ...patch, id: layer.id, type: layer.type } as Layer
        const mapped = mapLayerToAuthoringSpace(
          inTargetSpace, targetFormat, baseFormat, g.slideWidth, g.slideHeight,
        )
        const sharedPatch = pickLayerKeys(mapped, Object.keys(patch))
        return withoutFormatOverride({ ...layer, ...sharedPatch } as Layer, targetFormat)
      }),
    }))
  },

  setLayerFormatVisibility: (layerId, format, visible) => {
    mutateActiveGroup(set, (g) => ({
      ...g,
      layers: mapLayerById(g.layers, layerId, (layer) => {
        const next = { ...(layer.formatVisibility ?? {}) }
        if (visible === undefined) delete next[format]
        else next[format] = visible
        return { ...layer, formatVisibility: Object.keys(next).length ? next : undefined } as Layer
      }),
    }))
  },

  setLayerOnlyInFormat: (layerId, format) => {
    const targetFormat = format ?? get().activeCanvasFormat
    mutateActiveGroup(set, (g) => ({
      ...g,
      layers: mapLayerById(g.layers, layerId, (layer) => ({
        ...layer,
        formatVisibility: Object.fromEntries(
          CANVAS_FORMAT_PRESETS.map((preset) => [preset.id, preset.id === targetFormat]),
        ),
      } as Layer)),
    }))
  },

  clearLayerFormatVisibility: (layerId) => {
    mutateActiveGroup(set, (g) => ({
      ...g,
      layers: mapLayerById(g.layers, layerId, (layer) => ({ ...layer, formatVisibility: undefined } as Layer)),
    }))
  },

  makeLayerShared: (layerId) => {
    mutateActiveGroup(set, (g) => ({
      ...g,
      layers: mapLayerById(g.layers, layerId, (layer) => {
        if (!layer.ownerFormat) return layer
        const format = layer.ownerFormat
        return makeOwnedFormatLayersSharedInLayerTree(
          [layer],
          format,
          getProjectBaseFormat(get().project),
          g.slideWidth,
          g.slideHeight,
        )[0]
      }),
    }))
  },

  toggleActiveFormat: (format) => {
    const { project, activeCanvasFormat } = get()
    const baseFormat = getProjectBaseFormat(project)
    if (format === 'base' || format === baseFormat) return // can't remove base
    const currentFormats = getProjectActiveFormats(project)
    let newList: CanvasFormatId[]
    if (currentFormats.includes(format)) {
      newList = currentFormats.filter((f) => f !== format)
      if (activeCanvasFormat === format) set({ activeCanvasFormat: baseFormat })
    } else {
      newList = [...currentFormats, format]
    }
    get().updateSettings({ baseCanvasFormat: BASE_CANVAS_FORMAT, activeFormats: newList })
  },

  clearLayerFormatOverrideKey: (layerId, key, format) => {
    const targetFormat = format ?? get().activeCanvasFormat
    mutateActiveGroup(set, (g) => ({
      ...g,
      layers: mapLayerById(g.layers, layerId, (layer) => {
        const existing = layer.formatOverrides?.[targetFormat] as Record<string, unknown> | undefined
        if (!existing || !(key in existing)) return layer
        const { [key]: _removed, ...restPatch } = existing
        void _removed
        const newPatch = Object.keys(restPatch).length > 0 ? restPatch : undefined
        const { [targetFormat]: _old, ...otherOverrides } = layer.formatOverrides ?? {}
        void _old
        const newFormatOverrides = newPatch
          ? { ...otherOverrides, [targetFormat]: newPatch }
          : (Object.keys(otherOverrides).length > 0 ? otherOverrides : undefined)
        return { ...layer, formatOverrides: newFormatOverrides } as Layer
      }),
    }))
  },

  applyLayerFormatKeyToShared: (layerId, key, format) => {
    const targetFormat = format ?? get().activeCanvasFormat
    const { project } = get()
    const baseFormat = getProjectBaseFormat(project)
    if (targetFormat === baseFormat) return
    mutateActiveGroup(set, (g) => ({
      ...g,
      layers: mapLayerById(g.layers, layerId, (layer) => {
        const existing = layer.formatOverrides?.[targetFormat] as Record<string, unknown> | undefined
        if (!existing || !(key in existing)) return layer
        const overrideValue = existing[key]
        // If it's a spatial key, scale from target format coords to authoring coords
        let sharedPatch: Partial<Layer> = { [key]: overrideValue } as Partial<Layer>
        if ((FORMAT_LAYOUT_KEYS as readonly string[]).includes(key)) {
          const dummy = { ...layer, [key]: overrideValue } as Layer
          const mapped = mapLayerToAuthoringSpace(
            dummy, targetFormat, baseFormat, g.slideWidth, g.slideHeight,
          )
          sharedPatch = pickLayerKeys(mapped, [key])
        }
        // Apply value to base layer
        const updated = { ...layer, ...sharedPatch } as Layer
        // Remove key from format override
        const { [key]: _removed, ...restPatch } = existing
        void _removed
        const newPatch = Object.keys(restPatch).length > 0 ? restPatch : undefined
        const { [targetFormat]: _old, ...otherOverrides } = layer.formatOverrides ?? {}
        void _old
        const newFormatOverrides = newPatch
          ? { ...otherOverrides, [targetFormat]: newPatch }
          : (Object.keys(otherOverrides).length > 0 ? otherOverrides : undefined)
        return { ...updated, formatOverrides: newFormatOverrides } as Layer
      }),
    }))
  },

  resetActiveFormatLayout: (format) => {
    const targetFormat = format ?? get().activeCanvasFormat
    const baseFormat = getProjectBaseFormat(get().project)
    if (targetFormat === baseFormat) return
    mutateActiveGroup(set, (g) => ({
      ...g,
      layers: resetFormatOverridesInLayerTree(g.layers, targetFormat),
    }))
  },

  shareActiveFormatOwnedLayers: (format) => {
    const targetFormat = format ?? get().activeCanvasFormat
    const baseFormat = getProjectBaseFormat(get().project)
    if (targetFormat === baseFormat) return
    mutateActiveGroup(set, (g) => ({
      ...g,
      layers: makeOwnedFormatLayersSharedInLayerTree(
        g.layers,
        targetFormat,
        baseFormat,
        g.slideWidth,
        g.slideHeight,
      ),
    }))
  },

  resetActiveFormatVisibility: (format) => {
    const targetFormat = format ?? get().activeCanvasFormat
    const baseFormat = getProjectBaseFormat(get().project)
    if (targetFormat === baseFormat) return
    mutateActiveGroup(set, (g) => ({
      ...g,
      layers: resetFormatVisibilityInLayerTree(g.layers, targetFormat),
    }))
  },

  promoteActiveFormatLayoutToShared: (format) => {
    const targetFormat = format ?? get().activeCanvasFormat
    const baseFormat = getProjectBaseFormat(get().project)
    if (targetFormat === baseFormat) return
    mutateActiveGroup(set, (g) => ({
      ...g,
      layers: promoteFormatOverridesToSharedInLayerTree(
        g.layers,
        targetFormat,
        baseFormat,
        g.slideWidth,
        g.slideHeight,
      ),
    }))
  },
})
