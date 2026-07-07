import type { Layer, GroupLayer } from '@/types'
import type { EditorStore, EditorSet, EditorGet } from '../types'
import {
  cloneWithNewIds,
  mutateActiveGroup,
  getActiveGroup,
  STYLE_KEYS,
} from '../helpers'

export const createClipboardSlice = (
  set: EditorSet,
  get: EditorGet,
): Pick<
  EditorStore,
  | 'copyLayers'
  | 'cutLayers'
  | 'pasteLayers'
  | 'copyLayerStyle'
  | 'pasteLayerStyle'
> => ({
  // ─ Clipboard actions
  copyLayers: (layerIds) => {
    const { selection, selectedLayerIds, activeSlideGroupId } = get()
    const group = getActiveGroup(get)
    if (!group) return
    const ids = layerIds ?? (selectedLayerIds.length > 0 ? selectedLayerIds : (selection?.layerId ? [selection.layerId] : []))
    if (ids.length === 0) return
    const toCopy = group.layers.filter((l) => ids.includes(l.id) && l.type !== 'background')
    if (toCopy.length === 0) return
    set({ clipboard: toCopy.map((l) => JSON.parse(JSON.stringify(l)) as Layer), clipboardSourceGroupId: activeSlideGroupId, pasteCount: 0 })
  },

  cutLayers: (layerIds) => {
    const { selection, selectedLayerIds, activeSlideGroupId } = get()
    const group = getActiveGroup(get)
    if (!group) return
    const ids = layerIds ?? (selectedLayerIds.length > 0 ? selectedLayerIds : (selection?.layerId ? [selection.layerId] : []))
    if (ids.length === 0) return
    const toCut = group.layers.filter((l) => ids.includes(l.id) && l.type !== 'background')
    if (toCut.length === 0) return
    set({ clipboard: toCut.map((l) => JSON.parse(JSON.stringify(l)) as Layer), clipboardSourceGroupId: activeSlideGroupId, pasteCount: 0 })
    ids.forEach((id) => get().removeLayer(id))
    get().deselect()
  },

  pasteLayers: () => {
    const { clipboard, pasteCount, activeSlideGroupId, clipboardSourceGroupId } = get()
    if (!clipboard || clipboard.length === 0) return
    // Only apply offset when pasting into the same slide group — cross-slide paste preserves exact position
    const sameSlidePaste = clipboardSourceGroupId === activeSlideGroupId
    const offset = sameSlidePaste ? (pasteCount + 1) * 20 : 0
    const clones = clipboard.map((l) => {
      const clone = cloneWithNewIds(l)
      clone.x = l.x + offset
      clone.y = l.y + offset
      return clone
    })
    // Bypass addLayer to avoid group-edit routing; insert directly into active group
    mutateActiveGroup(set, (g) => ({ ...g, layers: [...g.layers, ...clones] }))
    set({
      editingGroupId: null,
      // After a cross-slide paste, update source group so subsequent pastes in this slide get proper offsets.
      // pasteCount resets to 0 (not 1) because the cross-slide paste itself used offset 0 — it hasn't
      // consumed a cascade step yet, so the next same-slide paste should start the 20/40/60... stepping fresh.
      clipboardSourceGroupId: activeSlideGroupId,
      pasteCount: sameSlidePaste ? pasteCount + 1 : 0,
      ...(clones.length === 1
        ? { selection: { slideGroupId: activeSlideGroupId, layerId: clones[0].id }, selectedLayerIds: [] }
        : { selectedLayerIds: clones.map((c) => c.id), selection: null }),
    })
  },

  // ─ Style clipboard actions
  copyLayerStyle: (layerId) => {
    const { editingGroupId } = get()
    const group = getActiveGroup(get)
    if (!group) return
    let layer: Layer | undefined = group.layers.find((l) => l.id === layerId)
    if (!layer && editingGroupId) {
      const grp = group.layers.find((l) => l.id === editingGroupId && l.type === 'group') as GroupLayer | undefined
      layer = grp?.children.find((c) => c.id === layerId)
    }
    if (!layer) return
    const keys = STYLE_KEYS[layer.type] ?? []
    const style: Record<string, unknown> = {}
    for (const key of keys) {
      const v = (layer as unknown as Record<string, unknown>)[key]
      if (v !== undefined) style[key] = JSON.parse(JSON.stringify(v))
    }
    set({ styleClipboard: { layerType: layer.type, style } })
  },

  pasteLayerStyle: (layerId) => {
    const { styleClipboard, editingGroupId } = get()
    if (!styleClipboard) return
    const group = getActiveGroup(get)
    if (!group) return
    let layer: Layer | undefined = group.layers.find((l) => l.id === layerId)
    if (!layer && editingGroupId) {
      const grp = group.layers.find((l) => l.id === editingGroupId && l.type === 'group') as GroupLayer | undefined
      layer = grp?.children.find((c) => c.id === layerId)
    }
    if (!layer || layer.type !== styleClipboard.layerType) return
    get().updateLayer(layerId, styleClipboard.style as Partial<Layer>)
  },
})
