import type { EditorStore, EditorSet, EditorGet } from '../types'

export const createSelectionSlice = (
  set: EditorSet,
  get: EditorGet,
): Pick<
  EditorStore,
  | 'select'
  | 'deselect'
  | 'toggleLayerSelection'
  | 'clearMultiSelection'
  | 'setMultiSelection'
  | 'setZoom'
  | 'setViewportPosition'
  | 'toggleGrid'
  | 'toggleSeamGuides'
  | 'startTextEdit'
  | 'stopTextEdit'
  | 'enterGroupEdit'
  | 'exitGroupEdit'
  | 'selectChild'
> => ({
  startTextEdit: (layerId) => set({ editingTextId: layerId }),
  stopTextEdit: () => set({ editingTextId: null }),

  // ─ Selection
  select: (layerId) => {
    const { activeSlideGroupId } = get()
    set({
      selection: layerId ? { slideGroupId: activeSlideGroupId, layerId } : null,
      selectedLayerIds: [],
      editingGroupId: null,
    })
  },

  deselect: () => set({ selection: null, editingGroupId: null, selectedLayerIds: [] }),

  toggleLayerSelection: (layerId) => {
    set((s) => {
      const exists = s.selectedLayerIds.includes(layerId)
      const selectedLayerIds = exists
        ? s.selectedLayerIds.filter((id) => id !== layerId)
        : [...s.selectedLayerIds, layerId]
      return { selectedLayerIds }
    })
  },

  clearMultiSelection: () => set({ selectedLayerIds: [] }),

  setMultiSelection: (ids) =>
    set({ selectedLayerIds: ids, selection: null, editingGroupId: null }),

  // ─ Canvas helpers
  setZoom: (zoom) => set({ zoom: Math.max(0.05, Math.min(4, zoom)) }),
  setViewportPosition: (x, y) => set({ viewportX: x, viewportY: y }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleSeamGuides: () => set((s) => ({ showSeamGuides: !s.showSeamGuides })),

  // ─ Group editing mode
  enterGroupEdit: (groupId) => {
    const { activeSlideGroupId } = get()
    set({
      editingGroupId: groupId,
      // layerId = null means: group entered, no child selected yet
      selection: { slideGroupId: activeSlideGroupId, layerId: null },
      selectedLayerIds: [],
    })
  },

  exitGroupEdit: () => {
    const { editingGroupId, activeSlideGroupId } = get()
    set({
      editingGroupId: null,
      // Re-select the group itself as a top-level layer
      selection: editingGroupId
        ? { slideGroupId: activeSlideGroupId, layerId: editingGroupId }
        : null,
    })
  },

  selectChild: (_groupId, childId) => {
    const { activeSlideGroupId } = get()
    // In the new model: editingGroupId tracks the group; selection.layerId IS the child
    set({
      selection: { slideGroupId: activeSlideGroupId, layerId: childId },
    })
  },
})
