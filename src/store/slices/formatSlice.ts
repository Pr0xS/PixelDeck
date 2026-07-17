import { nanoid } from 'nanoid'
import type { Layer, CanvasFormatId } from '@/types'
import {
  BASE_CANVAS_FORMAT,
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
  mapLayerTree,
  mutateActiveGroup,
  touchProject,
  updateLayerInTree,
  withoutFormatOverride,
  pickLayerKeys,
} from '../helpers'

function clearOwnerFormatInLayerTree(layers: Layer[], format: CanvasFormatId): Layer[] {
  return mapLayerTree(layers, (layer) => layer.ownerFormat === format
    ? { ...layer, ownerFormat: undefined } as Layer
    : layer)
}

function withoutFormatOverrideKey(layer: Layer, format: CanvasFormatId, key: string): Layer {
  const existing = layer.formatOverrides?.[format] as Record<string, unknown> | undefined
  if (!existing || !(key in existing)) return layer
  const { [key]: _removed, ...restPatch } = existing
  void _removed
  const { [format]: _old, ...otherOverrides } = layer.formatOverrides ?? {}
  void _old
  const formatOverrides = Object.keys(restPatch).length
    ? { ...otherOverrides, [format]: restPatch }
    : (Object.keys(otherOverrides).length ? otherOverrides : undefined)
  return { ...layer, formatOverrides } as Layer
}

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
  | 'addCustomFormat'
  | 'removeCustomFormat'
  | 'updateCustomFormat'
  | 'clearLayerFormatOverrideKey'
  | 'applyLayerFormatKeyToShared'
  | 'resetActiveFormatLayout'
  | 'shareActiveFormatOwnedLayers'
  | 'resetActiveFormatVisibility'
  | 'promoteActiveFormatLayoutToShared'
> => ({
  // ─ Canvas format actions
  setActiveCanvasFormat: (format) => set({ activeCanvasFormat: format, selection: null, editingGroupId: null, selectedLayerIds: [], selectedAccentIndex: null }),

  clearLayerFormatOverride: (layerId, format) => {
    const targetFormat = format ?? get().activeCanvasFormat
    mutateActiveGroup(set, (g) => ({ ...g, layers: updateLayerInTree(g.layers, layerId, (l) => withoutFormatOverride(l, targetFormat)) }))
  },

  syncLayerFormatToShared: (layerId, format) => {
    const targetFormat = format ?? get().activeCanvasFormat
    const baseFormat = getProjectBaseFormat(get().project)
    if (targetFormat === baseFormat) return
    mutateActiveGroup(set, (g) => ({
      ...g,
      layers: updateLayerInTree(g.layers, layerId, (layer) => {
        const patch = layer.formatOverrides?.[targetFormat]
        if (!patch) return layer
        // Override values live in the target format's coordinate space.
        // Map them back to the group's authoring space before merging into
        // the shared base, otherwise the layer jumps in every other format.
        const inTargetSpace = { ...layer, ...patch, id: layer.id, type: layer.type } as Layer
        const mapped = mapLayerToAuthoringSpace(
          inTargetSpace, targetFormat, baseFormat, g.slideWidth * (g.numSlides ?? 1), g.slideHeight,
          get().project.settings.customFormats,
        )
        const sharedPatch = pickLayerKeys(mapped, Object.keys(patch))
        return withoutFormatOverride({ ...layer, ...sharedPatch } as Layer, targetFormat)
      }),
    }))
  },

  setLayerFormatVisibility: (layerId, format, visible) => {
    mutateActiveGroup(set, (g) => ({
      ...g,
      layers: updateLayerInTree(g.layers, layerId, (layer) => {
        const next = { ...(layer.formatVisibility ?? {}) }
        if (visible === undefined) delete next[format]
        else next[format] = visible
        return { ...layer, formatVisibility: Object.keys(next).length ? next : undefined } as Layer
      }),
    }))
  },

  setLayerOnlyInFormat: (layerId, format) => {
    const targetFormat = format ?? get().activeCanvasFormat
    const activeFormats = getProjectActiveFormats(get().project)
    mutateActiveGroup(set, (g) => ({
      ...g,
      layers: updateLayerInTree(g.layers, layerId, (layer) => ({
        ...layer,
        formatVisibility: Object.fromEntries(
          activeFormats.map((activeFormat) => [activeFormat, activeFormat === targetFormat]),
        ),
      } as Layer)),
    }))
  },

  clearLayerFormatVisibility: (layerId) => {
    mutateActiveGroup(set, (g) => ({
      ...g,
      layers: updateLayerInTree(g.layers, layerId, (layer) => ({ ...layer, formatVisibility: undefined } as Layer)),
    }))
  },

  makeLayerShared: (layerId) => {
    mutateActiveGroup(set, (g) => ({
      ...g,
      layers: updateLayerInTree(g.layers, layerId, (layer) => {
        if (!layer.ownerFormat) return layer
        const format = layer.ownerFormat
        return makeOwnedFormatLayersSharedInLayerTree(
          [layer],
          format,
          getProjectBaseFormat(get().project),
          g.slideWidth * (g.numSlides ?? 1),
          g.slideHeight,
          get().project.settings.customFormats,
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

  addCustomFormat: (label, width, height) => {
    const id = `custom:${nanoid()}` as const
    const { project } = get()
    const activeFormats = getProjectActiveFormats(project)
    get().updateSettings({
      customFormats: [...(project.settings.customFormats ?? []), { id, label, width, height }],
      activeFormats: [...activeFormats, id],
    })
    set({ activeCanvasFormat: id })
  },

  removeCustomFormat: (id) => {
    const { project, activeCanvasFormat } = get()
    const customFormats = project.settings.customFormats ?? []
    if (!customFormats.some((format) => format.id === id)) return
    const baseFormat = getProjectBaseFormat(project)
    const slideGroups = project.slideGroups.map((group) => {
      const shared = makeOwnedFormatLayersSharedInLayerTree(
        group.layers,
        id,
        baseFormat,
        group.slideWidth * (group.numSlides ?? 1),
        group.slideHeight,
        customFormats,
      )
      return {
        ...group,
        layers: clearOwnerFormatInLayerTree(resetFormatVisibilityInLayerTree(
          resetFormatOverridesInLayerTree(shared, id),
          id,
        ), id),
      }
    })
    set({
      project: touchProject(project, {
        settings: {
          ...project.settings,
          customFormats: customFormats.filter((format) => format.id !== id),
          activeFormats: getProjectActiveFormats(project).filter((format) => format !== id),
        },
        slideGroups,
      }),
      ...(activeCanvasFormat === id ? { activeCanvasFormat: baseFormat } : {}),
    })
  },

  updateCustomFormat: (id, patch) => {
    const { project } = get()
    get().updateSettings({
      customFormats: (project.settings.customFormats ?? []).map((format) =>
        format.id === id ? { ...format, ...patch } : format,
      ),
    })
  },

  clearLayerFormatOverrideKey: (layerId, key, format) => {
    const targetFormat = format ?? get().activeCanvasFormat
    mutateActiveGroup(set, (g) => ({
      ...g,
      layers: updateLayerInTree(g.layers, layerId, (layer) => withoutFormatOverrideKey(layer, targetFormat, key)),
    }))
  },

  applyLayerFormatKeyToShared: (layerId, key, format) => {
    const targetFormat = format ?? get().activeCanvasFormat
    const { project } = get()
    const baseFormat = getProjectBaseFormat(project)
    if (targetFormat === baseFormat) return
    mutateActiveGroup(set, (g) => ({
      ...g,
      layers: updateLayerInTree(g.layers, layerId, (layer) => {
        const existing = layer.formatOverrides?.[targetFormat] as Record<string, unknown> | undefined
        if (!existing || !(key in existing)) return layer
        const overrideValue = existing[key]
        // If it's a spatial key, scale from target format coords to authoring coords
        let sharedPatch: Partial<Layer> = { [key]: overrideValue } as Partial<Layer>
        if ((FORMAT_LAYOUT_KEYS as readonly string[]).includes(key)) {
          const dummy = { ...layer, [key]: overrideValue } as Layer
          const mapped = mapLayerToAuthoringSpace(
            dummy, targetFormat, baseFormat, g.slideWidth * (g.numSlides ?? 1), g.slideHeight,
            project.settings.customFormats,
          )
          sharedPatch = pickLayerKeys(mapped, [key])
        }
        // Apply value to base layer
        return withoutFormatOverrideKey({ ...layer, ...sharedPatch } as Layer, targetFormat, key)
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
        g.slideWidth * (g.numSlides ?? 1),
        g.slideHeight,
        get().project.settings.customFormats,
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
        g.slideWidth * (g.numSlides ?? 1),
        g.slideHeight,
        get().project.settings.customFormats,
      ),
    }))
  },
})
