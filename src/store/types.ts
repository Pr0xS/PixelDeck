import type {
  Project, SlideGroup, Layer, Selection,
  LayerType,
  ProjectSettings, LocaleLayerPatch,
  LocaleContentBatchEntry,
  CanvasFormatId,
  CustomCanvasFormat,
  CustomFormatId,
  Template,
  PanoSettings,
} from '@/types'

// ─── EditorStore interface ────────────────────────────────────────────────────

export interface EditorStore {
  // ─ Project state
  project: Project
  activeSlideGroupId: string
  selection: Selection | null

  // ─ UI state
  zoom: number   // display scale (0.05 – 4.0)
  viewportX: number  // stage x offset in screen pixels
  viewportY: number  // stage y offset in screen pixels
  showGrid: boolean
  showSeamGuides: boolean
  /** ID of the group currently being edited (PowerPoint-style group enter) */
  editingGroupId: string | null
  /** Multi-selection for grouping operations */
  selectedLayerIds: string[]
  /** Index into the selected BackgroundLayer's accents[] currently being edited. Only meaningful while a background layer is the sole selection. */
  selectedAccentIndex: number | null

  // ─ Clipboard (not undoable — lives outside zundo partialize)
  clipboard: Layer[] | null
  /** Slide group from which the clipboard was copied — used to suppress offset when pasting cross-slide */
  clipboardSourceGroupId: string | null
  pasteCount: number

  // ─ Style clipboard (not undoable)
  styleClipboard: { layerType: LayerType; style: Record<string, unknown> } | null

  // ─ Style clipboard actions
  copyLayerStyle: (layerId: string) => void
  pasteLayerStyle: (layerId: string) => void

  // ─ In-canvas text editing (transient — not undoable). Set by canvas dblclick;
  //   StageCanvas mounts a WYSIWYG overlay over the layer and TextNode hides
  //   the Konva node while editing.
  editingTextId: string | null
  startTextEdit: (layerId: string) => void
  stopTextEdit: () => void

  // ─ Transient: when a layer is inserted that should open in the Content tab
  //   (shape/emoji), the factory sets this to the new layer id. PropertiesPanel
  //   reads it once, switches to 'content', then clears it. Not undoable.
  pendingContentFocusLayerId: string | null
  setPendingContentFocus: (layerId: string | null) => void

  // ─ Brand color actions
  addBrandColor: (name: string, value: string) => void
  updateBrandColor: (id: string, patch: { name?: string; value?: string }) => void
  removeBrandColor: (id: string) => void

  // ─ Locale state (transient — not in undo history)
  activeLocale: string

  // ─ Canvas format state (transient preview/export context)
  activeCanvasFormat: CanvasFormatId
  /** Ephemeral override for capture/export — null means "use project.settings.pano". */
  panoRenderOverride: { gapPx: number; compensate: boolean } | null
  setPanoRenderOverride: (override: { gapPx: number; compensate: boolean } | null) => void
  /** Convenience: update project.settings.pano (undoable). */
  updatePanoSettings: (patch: Partial<PanoSettings>) => void

  // ─ Locale actions
  setActiveLocale: (locale: string) => void
  addLocale: (locale: string) => void
  removeLocale: (locale: string) => void
  relabelDefaultLocale: (locale: string) => void
  promoteLocaleToDefault: (locale: string) => void
  updateLayerInSlideGroup: (slideGroupId: string, layerId: string, patch: Partial<Layer>) => void
  setLocaleContent: (slideGroupId: string, layerId: string, locale: string, patch: LocaleLayerPatch) => void
  clearLocaleContent: (slideGroupId: string, layerId: string, locale: string) => void
  /** Commit multiple locale content patches in a single undo step. Use for bulk AI translate. */
  setLocaleContentBatch: (entries: LocaleContentBatchEntry[]) => void

  // ─ Canvas format actions
  setActiveCanvasFormat: (format: CanvasFormatId) => void
  makeLayerShared: (layerId: string) => void
  clearLayerFormatOverride: (layerId: string, format?: CanvasFormatId) => void
  syncLayerFormatToShared: (layerId: string, format?: CanvasFormatId) => void
  setLayerFormatVisibility: (layerId: string, format: CanvasFormatId, visible: boolean | undefined) => void
  setLayerOnlyInFormat: (layerId: string, format?: CanvasFormatId) => void
  clearLayerFormatVisibility: (layerId: string) => void
  toggleActiveFormat: (format: CanvasFormatId) => void
  addCustomFormat: (label: string, width: number, height: number) => void
  removeCustomFormat: (id: CustomFormatId) => void
  updateCustomFormat: (id: CustomFormatId, patch: Partial<Pick<CustomCanvasFormat, 'label' | 'width' | 'height'>>) => void
  clearLayerFormatOverrideKey: (layerId: string, key: string, format?: CanvasFormatId) => void
  clearLayerLocaleFormatOverride: (layerId: string, locale?: string, format?: CanvasFormatId) => void
  clearLayerLocaleFormatOverrideKey: (layerId: string, key: string, locale?: string, format?: CanvasFormatId) => void
  applyLayerFormatKeyToShared: (layerId: string, key: string, format?: CanvasFormatId) => void
  resetActiveFormatLayout: (format?: CanvasFormatId) => void
  resetActiveLocaleFormatLayout: (locale?: string, format?: CanvasFormatId) => void
  shareActiveFormatOwnedLayers: (format?: CanvasFormatId) => void
  resetActiveFormatVisibility: (format?: CanvasFormatId) => void
  promoteActiveFormatLayoutToShared: (format?: CanvasFormatId) => void

  // ─ Project actions
  setProjectName: (name: string) => void
  updateSettings: (patch: Partial<ProjectSettings>) => void
  updateProject: (patch: Partial<Project>) => void

  // ─ SlideGroup actions
  addSlideGroup: () => void
  removeSlideGroup: (id: string) => void
  setActiveSlideGroup: (id: string) => void
  updateSlideGroup: (id: string, patch: Partial<SlideGroup>) => void
  duplicateSlideGroup: (id: string) => void
  reorderSlideGroups: (ids: string[]) => void

  // ─ Layer actions
  addLayer: (layer: Layer) => void
  removeLayer: (layerId: string) => void
  updateLayer: (layerId: string, patch: Partial<Layer>) => void
  duplicateLayer: (layerId: string) => void
  moveLayerUp: (layerId: string) => void
  moveLayerDown: (layerId: string) => void
  reorderLayers: (layerIds: string[]) => void
  setLayerVisibility: (layerId: string, visible: boolean) => void
  setLayerLocked: (layerId: string, locked: boolean) => void

  // ─ Selection
  select: (layerId: string | null) => void
  selectAccent: (index: number | null) => void
  deselect: () => void
  toggleLayerSelection: (layerId: string) => void
  clearMultiSelection: () => void
  setMultiSelection: (ids: string[]) => void

  // ─ Canvas helpers
  setZoom: (zoom: number) => void
  setViewportPosition: (x: number, y: number) => void
  toggleGrid: () => void
  toggleSeamGuides: () => void

  // ─ Group actions
  createGroup: (layerIds: string[]) => void
  dissolveGroup: (groupId: string) => void
  addToGroup: (groupId: string, layer: Layer) => void
  removeFromGroup: (groupId: string, layerId: string) => void
  updateChildLayer: (groupId: string, childId: string, patch: Partial<Layer>) => void
  addChipGroup: () => void
  /** Reorder children within a group */
  reorderGroupChildren: (groupId: string, childIds: string[]) => void
  /** Move a top-level layer into a group; insertBeforeChildId=null appends */
  moveLayerIntoGroup: (layerId: string, groupId: string, insertBeforeChildId: string | null) => void
  /** Eject a child from a group to the top-level; insertBeforeLayerId=null appends at top */
  moveChildToTopLevel: (groupId: string, childId: string, insertBeforeLayerId: string | null) => void
  /** Move a child from one group to another */
  moveChildBetweenGroups: (fromGroupId: string, childId: string, toGroupId: string, insertBeforeChildId: string | null) => void

  // ─ Group editing mode (PowerPoint-style)
  enterGroupEdit: (groupId: string) => void
  exitGroupEdit: () => void
  selectChild: (groupId: string, childId: string) => void

  // ─ Clipboard actions
  copyLayers: (layerIds?: string[]) => void
  cutLayers: (layerIds?: string[]) => void
  pasteLayers: () => void

  // ─ Layer factory methods
  addPhone: () => void
  addText: () => void
  addImage: (src: string, width: number, height: number) => void
  addImageAt: (src: string, width: number, height: number, x: number, y: number) => void
  addShape: () => void
  addEmoji: () => void
  addBrand: () => void

  // ─ Project persistence
  exportProject: () => string
  importProject: (json: string) => void
  resetProject: () => void

  // ─ Template actions
  exportActiveAsTemplate: (opts: { name: string; description?: string; category?: string; slideGroupIds?: string[] }) => Template
  importTemplateAsNewProject: (tpl: Template) => void
  addTemplateSlideGroups: (tpl: Template) => void
}

// ─── Zustand set/get type aliases ────────────────────────────────────────────

export type EditorSet = (partial: Partial<EditorStore> | ((s: EditorStore) => Partial<EditorStore>)) => void
export type EditorGet = () => EditorStore
