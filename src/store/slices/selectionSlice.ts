import type { EditorStore, EditorSet, EditorGet } from '../types'

export const createSelectionSlice = (
  set: EditorSet,
  get: EditorGet,
): Pick<
  EditorStore,
  | 'select'
  | 'selectAccent'
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
  | 'setPendingContentFocus'
  | 'enterGroupEdit'
  | 'exitGroupEdit'
  | 'selectChild'
> => ({
  startTextEdit: (layerId) => {
    const { activeLocale, project } = get()
    if (activeLocale !== project.settings.defaultLocale) return
    set({ editingTextId: layerId })
  },
  stopTextEdit: () => set({ editingTextId: null }),
  setPendingContentFocus: (layerId) => set({ pendingContentFocusLayerId: layerId }),

  // ─ Selection
  select: (layerId) => {
    const { activeSlideGroupId } = get()
    set({
      selection: layerId ? { slideGroupId: activeSlideGroupId, layerId } : null,
      selectedLayerIds: [],
      editingGroupId: null,
      selectedAccentIndex: null,
    })
  },

  selectAccent: (index) => set({ selectedAccentIndex: index }),

  deselect: () => set({ selection: null, editingGroupId: null, selectedLayerIds: [], selectedAccentIndex: null }),

  toggleLayerSelection: (layerId) => {
    set((s) => {
      const exists = s.selectedLayerIds.includes(layerId)
      const selectedLayerIds = exists
        ? s.selectedLayerIds.filter((id) => id !== layerId)
        : [...s.selectedLayerIds, layerId]
      return { selectedLayerIds, selectedAccentIndex: null }
    })
  },

  clearMultiSelection: () => set({ selectedLayerIds: [] }),

  setMultiSelection: (ids) =>
    set({ selectedLayerIds: ids, selection: null, editingGroupId: null, selectedAccentIndex: null }),

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
      selectedAccentIndex: null,
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
      selectedAccentIndex: null,
    })
  },

  selectChild: (_groupId, childId) => {
    const { activeSlideGroupId } = get()
    // In the new model: editingGroupId tracks the group; selection.layerId IS the child
    set({
      selection: { slideGroupId: activeSlideGroupId, layerId: childId },
      selectedAccentIndex: null,
    })
  },
})
