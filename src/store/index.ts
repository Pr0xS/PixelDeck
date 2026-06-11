import { create } from 'zustand'
import { useStore } from 'zustand'
import { temporal } from 'zundo'
import type { TemporalState } from 'zundo'
import { nanoid } from 'nanoid'
import type {
  Project, SlideGroup, Layer, Selection,
  LayerType, BrandColor,
  PhoneLayer, TextLayer, ImageLayer, ShapeLayer, ChipsLayer, BrandLayer, GroupLayer,
  BackgroundLayer, BackgroundAccent, CanvasBackground, ProjectSettings, LocaleLayerPatch,
  CanvasFormatId, FormatLayerPatch,
  Template,
} from '@/types'
import { projectToTemplate, applyTemplate } from '@/utils/templates'
import { spansToMarks } from '@/utils/textRendering'
import {
  BASE_CANVAS_FORMAT,
  CANVAS_FORMAT_PRESETS,
  FORMAT_LAYOUT_KEYS,
  FORMAT_FORK_KEYS,
  getProjectActiveFormats,
  getProjectBaseFormat,
  mapLayerToAuthoringSpace,
  normalizeProjectFormats,
} from '@/utils/canvasFormats'

// ─── Slide Size Presets ───────────────────────────────────────────────────────

export const SLIDE_SIZE_PRESETS = CANVAS_FORMAT_PRESETS

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newId() { return nanoid(10) }

let projectStorageWarningShown = false

/**
 * Set or clear a single locale override on a layer (or inside a group child).
 * patch=null removes the locale entry entirely.
 */
function patchLayerLocale(
  layer: Layer,
  layerId: string,
  locale: string,
  patch: LocaleLayerPatch | null,
): Layer {
  if (layer.id === layerId) {
    const existing = layer.localeOverrides ?? {}
    if (patch === null) {
      const updated = { ...existing }
      delete updated[locale]
      return { ...layer, localeOverrides: Object.keys(updated).length > 0 ? updated : undefined }
    }
    return { ...layer, localeOverrides: { ...existing, [locale]: patch } }
  }
  if (layer.type === 'group') {
    const grp = layer as GroupLayer
    return {
      ...grp,
      children: grp.children.map((c) => patchLayerLocale(c, layerId, locale, patch)),
    } as Layer
  }
  return layer
}

/**
 * Bake a group's uniform scale into a child layer's own properties.
 * Used when dissolving / flattening a scaled group so the visual result is unchanged.
 */
function bakeLayerScale(layer: Layer, s: number): Layer {
  if (s === 1) return layer
  const scaled: Layer = { ...layer, x: layer.x * s, y: layer.y * s }
  if (scaled.shadow) {
    scaled.shadow = { ...scaled.shadow, blur: scaled.shadow.blur * s, offsetX: scaled.shadow.offsetX * s, offsetY: scaled.shadow.offsetY * s }
  }
  if (scaled.blur != null) scaled.blur = scaled.blur * s
  switch (scaled.type) {
    case 'phone':
      scaled.scale *= s
      break
    case 'image':
      scaled.width *= s
      scaled.height *= s
      scaled.cornerRadius *= s
      break
    case 'shape':
      scaled.width *= s
      scaled.height *= s
      scaled.cornerRadius *= s
      if (scaled.strokeWidth != null) scaled.strokeWidth *= s
      break
    case 'text':
      scaled.fontSize *= s
      scaled.letterSpacing *= s
      if (scaled.width != null) scaled.width *= s
      if (scaled.height != null) scaled.height *= s
      break
    case 'chips':
      scaled.chipFontSize *= s
      scaled.gap *= s
      break
    case 'brand':
      scaled.logoSize *= s
      scaled.nameFontSize *= s
      scaled.gap *= s
      break
    case 'group':
      scaled.scale = (scaled.scale ?? 1) * s
      break
  }
  return scaled
}

/** Deep-clone a layer and assign fresh ids to it and all group children */
function cloneWithNewIds(layer: Layer): Layer {
  const clone = JSON.parse(JSON.stringify(layer)) as Layer
  clone.id = newId()
  if (clone.type === 'group') {
    (clone as GroupLayer).children = (clone as GroupLayer).children.map(cloneWithNewIds)
  }
  return clone
}

const STYLE_KEYS: Partial<Record<LayerType, string[]>> = {
  background: ['fill', 'accents', 'imageDataUrl', 'imageFit', 'imageBlur', 'imageOverlayColor', 'imageOverlayOpacity', 'noise', 'blur', 'shadow', 'opacity'],
  text: ['fill', 'fontFamily', 'fontSize', 'fontWeight', 'italic', 'underline', 'strikethrough', 'letterSpacing', 'lineHeight', 'align', 'width', 'height', 'verticalAlign', 'blur', 'shadow', 'opacity'],
  shape: ['fill', 'stroke', 'strokeWidth', 'cornerRadius', 'shapeType', 'width', 'height', 'blur', 'shadow', 'opacity'],
  chips: ['primaryGradientFrom', 'primaryGradientTo', 'primaryTextColor', 'defaultBg', 'defaultTextColor', 'chipFontSize', 'gap', 'direction', 'blur', 'shadow', 'opacity'],
  brand: ['nameColor', 'nameFontSize', 'nameFontFamily', 'nameFontWeight', 'logoSize', 'direction', 'gap', 'blur', 'shadow', 'opacity'],
  image: ['cornerRadius', 'blur', 'shadow', 'opacity'],
  phone: ['model', 'scale', 'screenshotFit', 'screenshotOffsetX', 'screenshotOffsetY', 'showStatusBar', 'statusBarTheme', 'statusBarBg', 'statusBarColor', 'border', 'blur', 'shadow', 'opacity'],
  group: ['blur', 'shadow', 'opacity'],
}

export function defaultAccents(): BackgroundAccent[] {
  return [
    { color: 'rgba(255,111,97,0.22)', cx: 18, cy: 106, rx: 900, ry: 700 },
    { color: 'rgba(236,72,153,0.18)', cx: 82, cy: -8, rx: 900, ry: 720 },
  ]
}

function createBackgroundLayer(overrides?: Partial<BackgroundLayer>): BackgroundLayer {
  return {
    id: newId(),
    name: 'Background',
    type: 'background',
    x: 0, y: 0, rotation: 0, opacity: 1, visible: true,
    locked: true,  // always locked — not moveable
    fill: {
      type: 'linear',
      angle: 160,
      stops: [
        { offset: 0, color: '#12101E' },
        { offset: 0.58, color: '#1C1929' },
        { offset: 1, color: '#0F0E1A' },
      ],
    },
    accents: [],
    ...overrides,
  }
}

/** Migrate a legacy CanvasBackground to a BackgroundLayer */
function bgFromLegacy(bg: CanvasBackground): BackgroundLayer {
  return createBackgroundLayer({
    fill: bg.fill,
    accents: (bg.accents ?? []).map((a) => ({ ...a })),
  })
}

/** Recursively migrate legacy TextLayer.spans → marks in a layer tree. */
function migrateLayerSpans(layer: Layer): Layer {
  if (layer.type === 'group') {
    return { ...layer, children: layer.children.map(migrateLayerSpans) }
  }
  if (layer.type === 'text') {
    let result: Layer = layer
    // Migrate base spans
    if ((layer.spans?.length ?? 0) > 0 && !layer.marks?.length) {
      const { text, marks } = spansToMarks(layer.spans!)
      result = { ...result, text, marks: marks.length ? marks : undefined, spans: undefined } as Layer
    }
    // Migrate localeOverrides patches that still carry legacy spans
    if (result.localeOverrides) {
      const migratedOverrides: Record<string, LocaleLayerPatch> = {}
      for (const [locale, patch] of Object.entries(result.localeOverrides)) {
        if (patch.spans?.length && !patch.marks?.length) {
          const { text, marks } = spansToMarks(patch.spans)
          migratedOverrides[locale] = {
            ...patch,
            text: patch.text ?? text,
            marks: marks.length ? marks : undefined,
            spans: undefined,
          }
        } else {
          migratedOverrides[locale] = patch
        }
      }
      result = { ...result, localeOverrides: migratedOverrides }
    }
    return result
  }
  return layer
}

function newSlideGroup(overrides?: Partial<SlideGroup>): SlideGroup {
  const bgLayer = createBackgroundLayer()
  const { layers: overrideLayers, ...otherOverrides } = overrides ?? {}
  // Ensure background is always the first layer
  const layers: Layer[] = overrideLayers
    ? (overrideLayers.some((l) => l.type === 'background')
        ? overrideLayers
        : [bgLayer, ...overrideLayers])
    : [bgLayer]
  return {
    id: newId(),
    name: 'Slide 1',
    numSlides: 1,
    slideWidth: 1290,
    slideHeight: 2796,
    slideNames: ['slide-01'],
    ...otherOverrides,
    layers,
  }
}

function newProject(): Project {
  const now = new Date().toISOString()
  return {
    id: newId(),
    name: 'Untitled Project',
    createdAt: now,
    updatedAt: now,
    settings: {
      defaultSlideWidth: 1290,
      defaultSlideHeight: 2796,
      defaultLocale: 'en',
      brandName: 'My App',
      baseCanvasFormat: BASE_CANVAS_FORMAT,
      activeFormats: ['iphone-69', 'android-phone'],
    },
    slideGroups: [newSlideGroup({ name: 'Slide 1' })],
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

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

  // ─ Clipboard (not undoable — lives outside zundo partialize)
  clipboard: Layer[] | null
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

  // ─ Brand color actions
  addBrandColor: (name: string, value: string) => void
  updateBrandColor: (id: string, patch: { name?: string; value?: string }) => void
  removeBrandColor: (id: string) => void

  // ─ Locale state (transient — not in undo history)
  activeLocale: string

  // ─ Canvas format state (transient preview/export context)
  activeCanvasFormat: CanvasFormatId

  // ─ Locale actions
  setActiveLocale: (locale: string) => void
  addLocale: (locale: string) => void
  removeLocale: (locale: string) => void
  setLocaleOverride: (slideGroupId: string, layerId: string, locale: string, patch: LocaleLayerPatch) => void
  clearLocaleOverride: (slideGroupId: string, layerId: string, locale: string) => void

  // ─ Canvas format actions
  setActiveCanvasFormat: (format: CanvasFormatId) => void
  makeLayerShared: (layerId: string) => void
  clearLayerFormatOverride: (layerId: string, format?: CanvasFormatId) => void
  syncLayerFormatToShared: (layerId: string, format?: CanvasFormatId) => void
  setLayerFormatVisibility: (layerId: string, format: CanvasFormatId, visible: boolean | undefined) => void
  setLayerOnlyInFormat: (layerId: string, format?: CanvasFormatId) => void
  clearLayerFormatVisibility: (layerId: string) => void
  toggleActiveFormat: (format: CanvasFormatId) => void
  clearLayerFormatOverrideKey: (layerId: string, key: string, format?: CanvasFormatId) => void
  applyLayerFormatKeyToShared: (layerId: string, key: string, format?: CanvasFormatId) => void

  // ─ Project actions
  setProjectName: (name: string) => void
  updateSettings: (patch: Partial<ProjectSettings>) => void

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
  addChips: () => void
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

export const useEditorStore = create<EditorStore>()(
  temporal(
    (set, get) => {
  const getActiveGroup = () => {
    const { project, activeSlideGroupId } = get()
    return project.slideGroups.find((g) => g.id === activeSlideGroupId)
  }

  const mutateActiveGroup = (fn: (g: SlideGroup) => SlideGroup) => {
    set((s) => ({
      project: {
        ...s.project,
        updatedAt: new Date().toISOString(),
        slideGroups: s.project.slideGroups.map((g) =>
          g.id === s.activeSlideGroupId ? fn(g) : g,
        ),
      },
    }))
  }

  const mapLayerById = (layers: Layer[], layerId: string, fn: (layer: Layer) => Layer): Layer[] =>
    layers.map((layer) => {
      if (layer.id === layerId) return fn(layer)
      if (layer.type === 'group') {
        return { ...layer, children: mapLayerById((layer as GroupLayer).children, layerId, fn) } as Layer
      }
      return layer
    })

  /**
   * Split a layer patch into layout keys (stored per-format) and content keys
   * (always written to the shared base layer). Content stays shared across
   * formats by design — only positioning/sizing forks.
   */
  const splitFormatPatch = (patch: Partial<Layer>): { layout: FormatLayerPatch; content: Partial<Layer> } => {
    const layout: Record<string, unknown> = {}
    const content: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(patch)) {
      if ((FORMAT_FORK_KEYS as readonly string[]).includes(key)) layout[key] = value
      else content[key] = value
    }
    return { layout: layout as FormatLayerPatch, content: content as Partial<Layer> }
  }

  /** Apply a patch to a layer respecting the active format: content → base, layout → override. */
  const patchLayerForFormat = (
    layer: Layer,
    patch: Partial<Layer>,
    activeFormat: CanvasFormatId,
    baseFormat: CanvasFormatId,
  ): Layer => {
    if (activeFormat === baseFormat) return { ...layer, ...patch } as Layer
    const { layout, content } = splitFormatPatch(patch)
    let next = Object.keys(content).length ? ({ ...layer, ...content } as Layer) : layer
    if (Object.keys(layout).length) next = withFormatOverride(next, activeFormat, layout)
    return next
  }

  const withFormatOverride = (layer: Layer, format: CanvasFormatId, patch: FormatLayerPatch): Layer => ({
    ...layer,
    formatOverrides: {
      ...(layer.formatOverrides ?? {}),
      [format]: {
        ...(layer.formatOverrides?.[format] ?? {}),
        ...patch,
      },
    },
  } as Layer)

  const withoutFormatOverride = (layer: Layer, format: CanvasFormatId): Layer => {
    if (!layer.formatOverrides?.[format]) return layer
    const { [format]: _removed, ...rest } = layer.formatOverrides
    void _removed
    return { ...layer, formatOverrides: Object.keys(rest).length ? rest : undefined } as Layer
  }

  return {
    // ─ Initial state
    project: newProject(),
    activeSlideGroupId: '',
    selection: null,
    zoom: 0.28,
    viewportX: 0,
    viewportY: 0,
    showGrid: false,
    showSeamGuides: true,
    editingGroupId: null,
    selectedLayerIds: [],
    clipboard: null,
    pasteCount: 0,
    styleClipboard: null,
    editingTextId: null,
    activeLocale: 'en',
    activeCanvasFormat: BASE_CANVAS_FORMAT,

    startTextEdit: (layerId) => set({ editingTextId: layerId }),
    stopTextEdit: () => set({ editingTextId: null }),

    // ─ Init activeSlideGroupId after project creation
    // (called once in App.tsx on mount)

    // ─ Locale actions
    setActiveLocale: (locale) => set({ activeLocale: locale }),

    addLocale: (locale) => {
      const { project } = get()
      const existing = project.settings.locales ?? [project.settings.defaultLocale]
      if (existing.includes(locale)) {
        set({ activeLocale: locale })
        return
      }
      set((s) => ({
        project: {
          ...s.project,
          updatedAt: new Date().toISOString(),
          settings: { ...s.project.settings, locales: [...existing, locale] },
        },
        activeLocale: locale,
      }))
    },

    removeLocale: (locale) => {
      const { project, activeLocale } = get()
      const existing = project.settings.locales ?? [project.settings.defaultLocale]
      const locales = existing.filter((l) => l !== locale && l !== project.settings.defaultLocale)
      const finalLocales = [project.settings.defaultLocale, ...locales]

      // Strip overrides for this locale from all layers in all slide groups
      function stripLocale(layer: Layer): Layer {
        if (!layer.localeOverrides?.[locale]) {
          if (layer.type !== 'group') return layer
          const grp = layer as GroupLayer
          return { ...grp, children: grp.children.map(stripLocale) }
        }
        const { [locale]: _removed, ...rest } = layer.localeOverrides
        void _removed
        const updated = { ...layer, localeOverrides: Object.keys(rest).length > 0 ? rest : undefined }
        if (updated.type === 'group') {
          return { ...updated, children: (updated as GroupLayer).children.map(stripLocale) }
        }
        return updated
      }

      set((s) => ({
        project: {
          ...s.project,
          updatedAt: new Date().toISOString(),
          settings: { ...s.project.settings, locales: finalLocales },
          slideGroups: s.project.slideGroups.map((g) => ({
            ...g,
            layers: g.layers.map(stripLocale),
          })),
        },
        activeLocale: activeLocale === locale ? project.settings.defaultLocale : activeLocale,
      }))
    },

    setLocaleOverride: (slideGroupId, layerId, locale, patch) => {
      set((s) => ({
        project: {
          ...s.project,
          updatedAt: new Date().toISOString(),
          slideGroups: s.project.slideGroups.map((g) => {
            if (g.id !== slideGroupId) return g
            return { ...g, layers: g.layers.map((l) => patchLayerLocale(l, layerId, locale, patch)) }
          }),
        },
      }))
    },

    clearLocaleOverride: (slideGroupId, layerId, locale) => {
      set((s) => ({
        project: {
          ...s.project,
          updatedAt: new Date().toISOString(),
          slideGroups: s.project.slideGroups.map((g) => {
            if (g.id !== slideGroupId) return g
            return { ...g, layers: g.layers.map((l) => patchLayerLocale(l, layerId, locale, null)) }
          }),
        },
      }))
    },

    // ─ Canvas format actions
    setActiveCanvasFormat: (format) => set({ activeCanvasFormat: format, selection: null, editingGroupId: null, selectedLayerIds: [] }),

    clearLayerFormatOverride: (layerId, format) => {
      const targetFormat = format ?? get().activeCanvasFormat
      mutateActiveGroup((g) => ({ ...g, layers: mapLayerById(g.layers, layerId, (l) => withoutFormatOverride(l, targetFormat)) }))
    },

    syncLayerFormatToShared: (layerId, format) => {
      const targetFormat = format ?? get().activeCanvasFormat
      const baseFormat = getProjectBaseFormat(get().project)
      if (targetFormat === baseFormat) return
      mutateActiveGroup((g) => ({
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
          ) as unknown as Record<string, unknown>
          const sharedPatch: Record<string, unknown> = {}
          for (const key of Object.keys(patch)) sharedPatch[key] = mapped[key]
          return withoutFormatOverride({ ...layer, ...sharedPatch } as Layer, targetFormat)
        }),
      }))
    },

    setLayerFormatVisibility: (layerId, format, visible) => {
      mutateActiveGroup((g) => ({
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
      mutateActiveGroup((g) => ({
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
      mutateActiveGroup((g) => ({
        ...g,
        layers: mapLayerById(g.layers, layerId, (layer) => ({ ...layer, formatVisibility: undefined } as Layer)),
      }))
    },

    makeLayerShared: (layerId) => {
      mutateActiveGroup((g) => ({
        ...g,
        layers: mapLayerById(g.layers, layerId, (layer) => {
          if (!layer.ownerFormat) return layer
          const format = layer.ownerFormat
          // Clear ownerFormat so the layer becomes shared
          const next = { ...layer, ownerFormat: undefined } as Layer
          // Also clear formatVisibility entry for this format if present
          if (next.formatVisibility?.[format] !== undefined) {
            const { [format]: _removed, ...restVis } = next.formatVisibility!
            void _removed
            ;(next as { formatVisibility?: Partial<Record<string, boolean>> }).formatVisibility =
              Object.keys(restVis).length ? restVis as typeof next.formatVisibility : undefined
          }
          return next
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
      mutateActiveGroup((g) => ({
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
      mutateActiveGroup((g) => ({
        ...g,
        layers: mapLayerById(g.layers, layerId, (layer) => {
          const existing = layer.formatOverrides?.[targetFormat] as Record<string, unknown> | undefined
          if (!existing || !(key in existing)) return layer
          const overrideValue = existing[key]
          // If it's a spatial key, scale from target format coords to authoring coords
          let sharedValue = overrideValue
          if ((FORMAT_LAYOUT_KEYS as readonly string[]).includes(key)) {
            const dummy = { ...layer, [key]: overrideValue } as Layer
            const mapped = mapLayerToAuthoringSpace(
              dummy, targetFormat, baseFormat, g.slideWidth, g.slideHeight,
            ) as unknown as Record<string, unknown>
            sharedValue = mapped[key]
          }
          // Apply value to base layer
          const updated = { ...layer, [key]: sharedValue } as Layer
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

    // ─ Project actions
    setProjectName: (name) =>
      set((s) => ({ project: { ...s.project, name, updatedAt: new Date().toISOString() } })),

    updateSettings: (patch) =>
      set((s) => ({
        project: {
          ...s.project,
          updatedAt: new Date().toISOString(),
          settings: { ...s.project.settings, ...patch },
        },
      })),

    // ─ SlideGroup actions
    addSlideGroup: () => {
      const { project } = get()
      const n = project.slideGroups.length + 1
      const group = newSlideGroup({
        name: `Slide ${n}`,
        slideWidth: project.settings.defaultSlideWidth,
        slideHeight: project.settings.defaultSlideHeight,
        slideNames: [`slide-${String(n).padStart(2, '0')}`],
      })
      set((s) => ({
        project: {
          ...s.project,
          updatedAt: new Date().toISOString(),
          slideGroups: [...s.project.slideGroups, group],
        },
        activeSlideGroupId: group.id,
      }))
    },

    removeSlideGroup: (id) => {
      set((s) => {
        const groups = s.project.slideGroups.filter((g) => g.id !== id)
        const activeId =
          s.activeSlideGroupId === id ? (groups[0]?.id ?? '') : s.activeSlideGroupId
        return {
          project: { ...s.project, updatedAt: new Date().toISOString(), slideGroups: groups },
          activeSlideGroupId: activeId,
        }
      })
    },

    setActiveSlideGroup: (id) => set({ activeSlideGroupId: id, selection: null, editingGroupId: null }),

    updateSlideGroup: (id, patch) => {
      set((s) => ({
        project: {
          ...s.project,
          updatedAt: new Date().toISOString(),
          slideGroups: s.project.slideGroups.map((g) => {
            if (g.id !== id) return g
            const next = { ...g, ...patch }
            // Keep slideNames in sync with numSlides (pad with defaults, trim extras)
            if (next.slideNames.length !== next.numSlides) {
              next.slideNames = Array.from(
                { length: next.numSlides },
                (_, i) => next.slideNames[i] ?? `slide-${String(i + 1).padStart(2, '0')}`,
              )
            }
            return next
          }),
        },
      }))
    },

    duplicateSlideGroup: (id) => {
      const { project } = get()
      const src = project.slideGroups.find((g) => g.id === id)
      if (!src) return
      const clone: SlideGroup = {
        ...JSON.parse(JSON.stringify(src)),
        id: newId(),
        name: `${src.name} (copy)`,
        layers: src.layers.map((l) => ({ ...JSON.parse(JSON.stringify(l)), id: newId() })),
      }
      set((s) => ({
        project: {
          ...s.project,
          updatedAt: new Date().toISOString(),
          slideGroups: [...s.project.slideGroups, clone],
        },
        activeSlideGroupId: clone.id,
      }))
    },

    reorderSlideGroups: (ids) => {
      set((s) => {
        const map = new Map(s.project.slideGroups.map((g) => [g.id, g]))
        return {
          project: {
            ...s.project,
            updatedAt: new Date().toISOString(),
            slideGroups: ids.map((id) => map.get(id)!),
          },
        }
      })
    },

    // ─ Layer actions
    addLayer: (layer) => {
      const { editingGroupId, activeSlideGroupId, project, activeCanvasFormat } = get()
      const baseFormat = getProjectBaseFormat(project)
      const activeGroupForAdd = getActiveGroup()
      let layerToAdd = layer
      if (activeCanvasFormat !== baseFormat && activeGroupForAdd) {
        // Layer is owned by this format — store as-is with ownerFormat tag.
        // No coordinate mapping needed: owned layers only render in their format.
        layerToAdd = { ...layer, ownerFormat: activeCanvasFormat } as Layer
      }
      if (editingGroupId) {
        // Inside group edit mode: add the layer into the group with group-local coords
        const grp = getActiveGroup()?.layers.find(
          (l) => l.id === editingGroupId && l.type === 'group',
        ) as GroupLayer | undefined
        if (grp) {
          // Inverse-bake the group's scale so the new layer appears at its natural size/position
          const localLayer: Layer = bakeLayerScale(
            { ...layerToAdd, x: layerToAdd.x - grp.x, y: layerToAdd.y - grp.y },
            1 / (grp.scale ?? 1),
          )
          get().addToGroup(editingGroupId, localLayer)
          set({ selection: { slideGroupId: activeSlideGroupId, layerId: localLayer.id } })
          return
        }
      }
      mutateActiveGroup((g) => ({ ...g, layers: [...g.layers, layerToAdd] }))
      set({ selection: { slideGroupId: get().activeSlideGroupId, layerId: layerToAdd.id } })
    },

    removeLayer: (layerId) => {
      const { editingGroupId, activeSlideGroupId } = get()
      if (editingGroupId) {
        // Check if it's a child of the editing group
        const grp = getActiveGroup()?.layers.find(
          (l) => l.id === editingGroupId && l.type === 'group',
        ) as GroupLayer | undefined
        if (grp?.children.some((c) => c.id === layerId)) {
          get().removeFromGroup(editingGroupId, layerId)
          // Stay in group edit mode but deselect the child
          if (get().selection?.layerId === layerId) {
            set({ selection: { slideGroupId: activeSlideGroupId, layerId: null } })
          }
          return
        }
      }
      // Background layer cannot be removed
      const group = getActiveGroup()
      if (group?.layers.find((l) => l.id === layerId)?.type === 'background') return
      mutateActiveGroup((g) => ({ ...g, layers: g.layers.filter((l) => l.id !== layerId) }))
      if (get().selection?.layerId === layerId) set({ selection: null, editingGroupId: null })
      if (editingGroupId === layerId) set({ editingGroupId: null })
    },

    updateLayer: (layerId, patch) => {
      // When in group-edit mode, transparently route to the child if the ID matches
      const { editingGroupId, project, activeCanvasFormat } = get()
      const baseFormat = getProjectBaseFormat(project)
      if (editingGroupId) {
        const slideGroup = getActiveGroup()
        const groupLayer = slideGroup?.layers.find(
          (l) => l.id === editingGroupId && l.type === 'group',
        ) as GroupLayer | undefined
        if (groupLayer?.children.some((c) => c.id === layerId)) {
          get().updateChildLayer(editingGroupId, layerId, patch)
          return
        }
      }
      mutateActiveGroup((g) => ({
        ...g,
        layers: g.layers.map((l) =>
          l.id === layerId ? patchLayerForFormat(l, patch, activeCanvasFormat, baseFormat) : l,
        ),
      }))
    },

    duplicateLayer: (layerId) => {
      const group = getActiveGroup()
      if (!group) return
      const src = group.layers.find((l) => l.id === layerId)
      if (!src) return
      const clone: Layer = { ...JSON.parse(JSON.stringify(src)), id: newId(), x: src.x + 20, y: src.y + 20 }
      get().addLayer(clone)
    },

    moveLayerUp: (layerId) => {
      mutateActiveGroup((g) => {
        const idx = g.layers.findIndex((l) => l.id === layerId)
        // Can't move background, and can't move a layer to index 0 (background slot)
        if (idx <= 1 || g.layers[idx]?.type === 'background') return g
        const layers = [...g.layers]
        ;[layers[idx - 1], layers[idx]] = [layers[idx], layers[idx - 1]]
        return { ...g, layers }
      })
    },

    moveLayerDown: (layerId) => {
      mutateActiveGroup((g) => {
        const idx = g.layers.findIndex((l) => l.id === layerId)
        if (idx < 0 || idx >= g.layers.length - 1 || g.layers[idx]?.type === 'background') return g
        const layers = [...g.layers]
        ;[layers[idx], layers[idx + 1]] = [layers[idx + 1], layers[idx]]
        return { ...g, layers }
      })
    },

    reorderLayers: (layerIds) => {
      mutateActiveGroup((g) => {
        const map = new Map(g.layers.map((l) => [l.id, l]))
        // Background stays at index 0
        const bgLayer = g.layers.find((l) => l.type === 'background')
        const ordered = layerIds
          .filter((id) => map.get(id)?.type !== 'background')
          .map((id) => map.get(id)!)
        return { ...g, layers: bgLayer ? [bgLayer, ...ordered] : ordered }
      })
    },

    setLayerVisibility: (layerId, visible) => {
      get().updateLayer(layerId, { visible } as Partial<Layer>)
    },

    setLayerLocked: (layerId, locked) => {
      get().updateLayer(layerId, { locked } as Partial<Layer>)
    },

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

    // ─ Group actions
    createGroup: (layerIds) => {
      const group = getActiveGroup()
      const ids = layerIds.length > 0 ? layerIds : get().selectedLayerIds
      if (!group || ids.length < 2) return

      const toGroup = group.layers.filter((l) => ids.includes(l.id))
      if (toGroup.length < 2) return

      // Auto-flatten: dissolve any nested groups into their children (absolute coords)
      const flatLayers: Layer[] = []
      for (const l of toGroup) {
        if (l.type === 'group') {
          const grp = l as GroupLayer
          const grpScale = grp.scale ?? 1
          for (const child of grp.children) {
            const baked = bakeLayerScale(child, grpScale)
            flatLayers.push({ ...baked, x: baked.x + grp.x, y: baked.y + grp.y } as Layer)
          }
        } else {
          flatLayers.push(l)
        }
      }
      if (flatLayers.length < 2) return

      const minX = Math.min(...flatLayers.map((l) => l.x))
      const minY = Math.min(...flatLayers.map((l) => l.y))

      const newGroup: GroupLayer = {
        id: newId(),
        name: 'Group',
        type: 'group',
        x: minX,
        y: minY,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        children: flatLayers.map((l) => ({
          ...l,
          x: l.x - minX,
          y: l.y - minY,
        })),
      }

      mutateActiveGroup((g) => ({
        ...g,
        layers: [
          ...g.layers.filter((l) => !ids.includes(l.id)),
          newGroup,
        ],
      }))
      set({ selectedLayerIds: [] })
      get().select(newGroup.id)
    },

    dissolveGroup: (groupId) => {
      const group = getActiveGroup()
      if (!group) return
      const grp = group.layers.find((l) => l.id === groupId) as GroupLayer | undefined
      if (!grp || grp.type !== 'group') return

      const grpScale = grp.scale ?? 1
      const children = grp.children.map((c) => {
        const baked = bakeLayerScale(c, grpScale)
        return { ...baked, x: baked.x + grp.x, y: baked.y + grp.y }
      })

      mutateActiveGroup((g) => ({
        ...g,
        layers: [
          ...g.layers.filter((l) => l.id !== groupId),
          ...children,
        ],
      }))
    },

    addToGroup: (groupId, layer) => {
      mutateActiveGroup((g) => ({
        ...g,
        layers: g.layers.map((l) => {
          if (l.id !== groupId || l.type !== 'group') return l
          const grp = l as GroupLayer
          return { ...grp, children: [...grp.children, layer] }
        }),
      }))
    },

    removeFromGroup: (groupId, layerId) => {
      mutateActiveGroup((g) => ({
        ...g,
        layers: g.layers.map((l) => {
          if (l.id !== groupId || l.type !== 'group') return l
          const grp = l as GroupLayer
          return { ...grp, children: grp.children.filter((c) => c.id !== layerId) }
        }),
      }))
    },

    reorderGroupChildren: (groupId, childIds) => {
      mutateActiveGroup((g) => ({
        ...g,
        layers: g.layers.map((l) => {
          if (l.id !== groupId || l.type !== 'group') return l
          const grp = l as GroupLayer
          const map = new Map(grp.children.map((c) => [c.id, c]))
          return { ...grp, children: childIds.map((id) => map.get(id)!).filter(Boolean) }
        }),
      }))
    },

    moveLayerIntoGroup: (layerId, groupId, insertBeforeChildId) => {
      mutateActiveGroup((g) => {
        const layer = g.layers.find((l) => l.id === layerId)
        const grp = g.layers.find((l) => l.id === groupId) as GroupLayer | undefined
        // Don't allow nesting groups inside groups, or background layers
        if (!layer || !grp || layer.type === 'background' || layer.type === 'group') return g
        const relLayer = bakeLayerScale(
          { ...layer, x: layer.x - grp.x, y: layer.y - grp.y },
          1 / (grp.scale ?? 1),
        )
        const children = [...grp.children]
        const idx = insertBeforeChildId ? children.findIndex((c) => c.id === insertBeforeChildId) : -1
        if (idx >= 0) children.splice(idx, 0, relLayer)
        else children.push(relLayer)
        return {
          ...g,
          layers: g.layers
            .filter((l) => l.id !== layerId)
            .map((l) => (l.id === groupId ? { ...grp, children } : l)),
        }
      })
    },

    moveChildToTopLevel: (groupId, childId, insertBeforeLayerId) => {
      mutateActiveGroup((g) => {
        const grp = g.layers.find((l) => l.id === groupId) as GroupLayer | undefined
        if (!grp) return g
        const child = grp.children.find((c) => c.id === childId)
        if (!child) return g
        // Absolute coords (bake the group's scale so visual size is preserved)
        const baked = bakeLayerScale(child as Layer, grp.scale ?? 1)
        const absChild: Layer = { ...baked, x: baked.x + grp.x, y: baked.y + grp.y } as Layer
        const updatedGrp = { ...grp, children: grp.children.filter((c) => c.id !== childId) }
        const newLayers = g.layers.map((l) => (l.id === groupId ? updatedGrp : l))
        const bg = newLayers.find((l) => l.type === 'background')
        const content: Layer[] = newLayers.filter((l) => l.type !== 'background')
        // Panel is reversed: "insert before X in panel" = "insert after X in store array"
        const idx = insertBeforeLayerId ? content.findIndex((l) => l.id === insertBeforeLayerId) : -1
        if (idx >= 0) content.splice(idx + 1, 0, absChild)
        else content.push(absChild)
        return { ...g, layers: [...(bg ? [bg] : []), ...content] }
      })
    },

    moveChildBetweenGroups: (fromGroupId, childId, toGroupId, insertBeforeChildId) => {
      mutateActiveGroup((g) => {
        const fromGrp = g.layers.find((l) => l.id === fromGroupId) as GroupLayer | undefined
        const toGrp = g.layers.find((l) => l.id === toGroupId) as GroupLayer | undefined
        if (!fromGrp || !toGrp) return g
        const child = fromGrp.children.find((c) => c.id === childId)
        if (!child) return g
        // Convert through absolute → relative to target group (bake/unbake group scales)
        const abs = bakeLayerScale(child as Layer, fromGrp.scale ?? 1)
        const relChild: Layer = bakeLayerScale(
          { ...abs, x: abs.x + fromGrp.x - toGrp.x, y: abs.y + fromGrp.y - toGrp.y } as Layer,
          1 / (toGrp.scale ?? 1),
        )
        const newFromChildren = fromGrp.children.filter((c) => c.id !== childId)
        const newToChildren = [...toGrp.children]
        const idx = insertBeforeChildId ? newToChildren.findIndex((c) => c.id === insertBeforeChildId) : -1
        if (idx >= 0) newToChildren.splice(idx, 0, relChild)
        else newToChildren.push(relChild)
        return {
          ...g,
          layers: g.layers.map((l) => {
            if (l.id === fromGroupId) return { ...fromGrp, children: newFromChildren }
            if (l.id === toGroupId) return { ...toGrp, children: newToChildren }
            return l
          }),
        }
      })
    },

    updateChildLayer: (groupId, childId, patch) => {
      const { project, activeCanvasFormat } = get()
      const baseFormat = getProjectBaseFormat(project)
      mutateActiveGroup((g) => ({
        ...g,
        layers: g.layers.map((l) => {
          if (l.id !== groupId || l.type !== 'group') return l
          const grp = l as GroupLayer
          return {
            ...grp,
            children: grp.children.map((c) =>
              c.id === childId ? patchLayerForFormat(c, patch, activeCanvasFormat, baseFormat) : c
            ),
          }
        }),
      }))
    },

    addChipGroup: () => {
      const group = getActiveGroup()
      if (!group) return
      const { settings } = get().project

      const bg: ShapeLayer = {
        id: newId(), name: 'Chip BG', type: 'shape',
        x: 0, y: 0, rotation: 0, opacity: 1, visible: true, locked: false,
        shapeType: 'rect',
        width: 280, height: 72,
        fill: { type: 'linear', angle: 120, stops: [{ offset: 0, color: '#FF6F61' }, { offset: 1, color: '#EC4899' }] },
        cornerRadius: 36,
      }
      const label: TextLayer = {
        id: newId(), name: 'Chip Label', type: 'text',
        x: 32, y: 20, rotation: 0, opacity: 1, visible: true, locked: false,
        text: 'Feature', fontFamily: 'Inter', fontSize: 31, fontWeight: 700,
        fill: '#ffffff', letterSpacing: -0.4, lineHeight: 1, align: 'left',
      }
      const chipGroup: GroupLayer = {
        id: newId(), name: 'Chip', type: 'group',
        x: 100, y: 600, rotation: 0, opacity: 1, visible: true, locked: false,
        children: [bg, label],
      }
      void settings // used for brand context in other factories

      get().addLayer(chipGroup)
    },

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

    // ─ Clipboard actions
    copyLayers: (layerIds) => {
      const { selection, selectedLayerIds } = get()
      const group = getActiveGroup()
      if (!group) return
      const ids = layerIds ?? (selectedLayerIds.length > 0 ? selectedLayerIds : (selection?.layerId ? [selection.layerId] : []))
      if (ids.length === 0) return
      const toCopy = group.layers.filter((l) => ids.includes(l.id) && l.type !== 'background')
      if (toCopy.length === 0) return
      set({ clipboard: toCopy.map((l) => JSON.parse(JSON.stringify(l)) as Layer), pasteCount: 0 })
    },

    cutLayers: (layerIds) => {
      const { selection, selectedLayerIds } = get()
      const group = getActiveGroup()
      if (!group) return
      const ids = layerIds ?? (selectedLayerIds.length > 0 ? selectedLayerIds : (selection?.layerId ? [selection.layerId] : []))
      if (ids.length === 0) return
      const toCut = group.layers.filter((l) => ids.includes(l.id) && l.type !== 'background')
      if (toCut.length === 0) return
      set({ clipboard: toCut.map((l) => JSON.parse(JSON.stringify(l)) as Layer), pasteCount: 0 })
      ids.forEach((id) => get().removeLayer(id))
      get().deselect()
    },

    pasteLayers: () => {
      const { clipboard, pasteCount, activeSlideGroupId } = get()
      if (!clipboard || clipboard.length === 0) return
      const offset = (pasteCount + 1) * 20
      const clones = clipboard.map((l) => {
        const clone = cloneWithNewIds(l)
        clone.x = l.x + offset
        clone.y = l.y + offset
        return clone
      })
      // Bypass addLayer to avoid group-edit routing; insert directly into active group
      mutateActiveGroup((g) => ({ ...g, layers: [...g.layers, ...clones] }))
      set({
        editingGroupId: null,
        pasteCount: pasteCount + 1,
        ...(clones.length === 1
          ? { selection: { slideGroupId: activeSlideGroupId, layerId: clones[0].id }, selectedLayerIds: [] }
          : { selectedLayerIds: clones.map((c) => c.id), selection: null }),
      })
    },

    // ─ Style clipboard actions
    copyLayerStyle: (layerId) => {
      const { editingGroupId } = get()
      const group = getActiveGroup()
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
      const group = getActiveGroup()
      if (!group) return
      let layer: Layer | undefined = group.layers.find((l) => l.id === layerId)
      if (!layer && editingGroupId) {
        const grp = group.layers.find((l) => l.id === editingGroupId && l.type === 'group') as GroupLayer | undefined
        layer = grp?.children.find((c) => c.id === layerId)
      }
      if (!layer || layer.type !== styleClipboard.layerType) return
      get().updateLayer(layerId, styleClipboard.style as Partial<Layer>)
    },

    // ─ Brand color actions
    addBrandColor: (name, value) => {
      const color: BrandColor = { id: newId(), name, value }
      set((s) => ({
        project: {
          ...s.project,
          updatedAt: new Date().toISOString(),
          settings: {
            ...s.project.settings,
            brandColors: [...(s.project.settings.brandColors ?? []), color],
          },
        },
      }))
    },

    updateBrandColor: (id, patch) => {
      set((s) => ({
        project: {
          ...s.project,
          updatedAt: new Date().toISOString(),
          settings: {
            ...s.project.settings,
            brandColors: (s.project.settings.brandColors ?? []).map((c) =>
              c.id === id ? { ...c, ...patch } : c,
            ),
          },
        },
      }))
    },

    removeBrandColor: (id) => {
      set((s) => ({
        project: {
          ...s.project,
          updatedAt: new Date().toISOString(),
          settings: {
            ...s.project.settings,
            brandColors: (s.project.settings.brandColors ?? []).filter((c) => c.id !== id),
          },
        },
      }))
    },

    // ─ Layer factories
    addPhone: () => {
      const group = getActiveGroup()
      if (!group) return
      const layer: PhoneLayer = {
        id: newId(),
        name: 'iPhone 16 Pro',
        type: 'phone',
        x: group.slideWidth / 2 - 195,
        y: group.slideHeight / 2 - 422,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        model: 'iphone-16-pro',
        scale: 2.0,
        screenshotFit: 'cover',
        screenshotOffsetX: 0,
        screenshotOffsetY: 0,
        showStatusBar: true,
        statusBarTheme: 'dark',
        statusBarBg: 'transparent',
        statusBarColor: '#000000',
      }
      get().addLayer(layer)
    },

    addText: () => {
      const group = getActiveGroup()
      if (!group) return
      const layer: TextLayer = {
        id: newId(),
        name: 'Text',
        type: 'text',
        x: 100,
        y: 200,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        text: 'Your headline',
        fontFamily: 'Sora',
        fontSize: 100,
        fontWeight: 800,
        fill: '#ffffff',
        letterSpacing: -4,
        lineHeight: 1.0,
        align: 'left',
        width: 1000,
      }
      get().addLayer(layer)
    },

    addImage: (src, width, height) => {
      const group = getActiveGroup()
      if (!group) return
      const layer: ImageLayer = {
        id: newId(),
        name: 'Image',
        type: 'image',
        x: group.slideWidth / 2 - width / 2,
        y: group.slideHeight / 2 - height / 2,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        src,
        width,
        height,
        cornerRadius: 0,
      }
      get().addLayer(layer)
    },

    addImageAt: (src, width, height, x, y) => {
      const layer: ImageLayer = {
        id: newId(),
        name: 'Image',
        type: 'image',
        x,
        y,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        src,
        width,
        height,
        cornerRadius: 0,
      }
      get().addLayer(layer)
    },

    addShape: () => {
      const group = getActiveGroup()
      if (!group) return
      const layer: ShapeLayer = {
        id: newId(),
        name: 'Shape',
        type: 'shape',
        x: 200,
        y: 200,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        shapeType: 'rect',
        width: 600,
        height: 400,
        fill: {
          type: 'linear',
          angle: 120,
          stops: [
            { offset: 0, color: '#FF6F61' },
            { offset: 1, color: '#EC4899' },
          ],
        },
        cornerRadius: 40,
      }
      get().addLayer(layer)
    },

    addChips: () => {
      const group = getActiveGroup()
      if (!group) return
      const layer: ChipsLayer = {
        id: newId(),
        name: 'Chips',
        type: 'chips',
        x: 100,
        y: 600,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        items: [
          { label: 'Free plan', primary: true,  variant: 'filled'   },
          { label: 'Offline',   primary: false, variant: 'outlined' },
          { label: 'Fast sync', primary: false, variant: 'soft'     },
          { label: 'Secure',    primary: false, variant: 'dark'     },
          { label: 'No ads',    primary: false, variant: 'plain'    },
        ],
        primaryGradientFrom: '#FF6F61',
        primaryGradientTo: '#EC4899',
        primaryTextColor: '#ffffff',
        defaultBg: 'rgba(255,255,255,0.86)',
        defaultTextColor: '#56505a',
        chipFontSize: 31,
        gap: 18,
        direction: 'row',
      }
      get().addLayer(layer)
    },

    addBrand: () => {
      const group = getActiveGroup()
      if (!group) return
      const { settings } = get().project
      const layer: BrandLayer = {
        id: newId(),
        name: 'Brand',
        type: 'brand',
        x: 100,
        y: 92,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        appName: settings.brandName,
        logoDataUrl: settings.brandLogoDataUrl,
        logoSize: 66,
        nameColor: '#E05243',
        nameFontSize: 40,
        nameFontFamily: 'Sora',
        nameFontWeight: 800,
        direction: 'row',
        gap: 18,
      }
      get().addLayer(layer)
    },

    // ─ Project persistence
    exportProject: () => {
      return JSON.stringify(get().project, null, 2)
    },

    importProject: (json) => {
      const project = normalizeProjectFormats(JSON.parse(json) as Project)
      // Migrate: ensure every slide group has a BackgroundLayer as first layer
      for (const sg of project.slideGroups) {
        if (!sg.layers.some((l) => l.type === 'background')) {
          const migrated = sg.background ? bgFromLegacy(sg.background) : createBackgroundLayer()
          sg.layers = [migrated, ...sg.layers]
        }
        // Migrate: convert legacy TextLayer.spans to marks
        sg.layers = sg.layers.map(migrateLayerSpans)
      }
      set({
        project,
        activeSlideGroupId: project.slideGroups[0]?.id ?? '',
        selection: null,
        editingGroupId: null,
        selectedLayerIds: [],
        activeLocale: project.settings.defaultLocale ?? 'en',
        activeCanvasFormat: BASE_CANVAS_FORMAT,
      })
      // Clear undo history — undo must not cross project boundaries
      useEditorStore.temporal.getState().clear()
    },

    resetProject: () => {
      const project = newProject()
      set({
        project,
        activeSlideGroupId: project.slideGroups[0].id,
        selection: null,
        editingGroupId: null,
        selectedLayerIds: [],
        activeLocale: 'en',
        activeCanvasFormat: BASE_CANVAS_FORMAT,
      })
      // Clear undo history — new project starts fresh
      useEditorStore.temporal.getState().clear()
    },

    exportActiveAsTemplate: (opts) => {
      return projectToTemplate(get().project, opts)
    },

    importTemplateAsNewProject: (tpl) => {
      const { slideGroups, settings } = applyTemplate(tpl)
      const now = new Date().toISOString()
      const base = newProject()
      const project: Project = normalizeProjectFormats({
        id: newId(),
        name: tpl.name,
        createdAt: now,
        updatedAt: now,
        settings: { ...base.settings, ...settings },
        slideGroups,
      })
      set({
        project,
        activeSlideGroupId: slideGroups[0]?.id ?? '',
        selection: null,
        editingGroupId: null,
        selectedLayerIds: [],
        activeLocale: project.settings.defaultLocale ?? 'en',
        activeCanvasFormat: BASE_CANVAS_FORMAT,
      })
      // Clear undo history — new project starts fresh
      useEditorStore.temporal.getState().clear()
    },

    addTemplateSlideGroups: (tpl) => {
      const { slideGroups, settings } = applyTemplate(tpl)
      set((s) => {
        // Merge template brand colors into the current palette so {brand:id}
        // tokens in the appended layers resolve. Existing ids win (never
        // overwrite the user's palette); only missing entries are added.
        const existing = s.project.settings.brandColors ?? []
        const existingIds = new Set(existing.map((c) => c.id))
        const incoming = (settings?.brandColors ?? []).filter((c) => !existingIds.has(c.id))
        return {
          project: {
            ...s.project,
            updatedAt: new Date().toISOString(),
            settings: incoming.length > 0
              ? { ...s.project.settings, brandColors: [...existing, ...incoming] }
              : s.project.settings,
            slideGroups: [...s.project.slideGroups, ...slideGroups],
          },
          activeSlideGroupId: slideGroups[0]?.id ?? s.activeSlideGroupId,
        }
      })
    },
  }
    },
    {
      // Only track project changes, ignore all UI state
      partialize: (state) => ({ project: state.project }),
      // Don't create a new history entry if project reference hasn't changed
      equality: (a, b) => a.project === b.project,
      // Keep max 50 undo steps
      limit: 50,
    }
  )
)

// ─── Project persistence (localStorage) ─────────────────────────────────────
// Hydrate saved project before the "init activeSlideGroupId" check below.
const PROJECT_STORAGE_KEY = 'pixeldeck-project'
;(function hydrateProject() {
  try {
    const raw = localStorage.getItem(PROJECT_STORAGE_KEY)
    if (!raw) return
    const { project, activeSlideGroupId } = JSON.parse(raw) as {
      project: Project
      activeSlideGroupId: string
    }
    if (project) {
      const normalizedProject = normalizeProjectFormats(project)
      useEditorStore.setState({
        project: normalizedProject,
        activeSlideGroupId: activeSlideGroupId ?? '',
        activeCanvasFormat: BASE_CANVAS_FORMAT,
      })
      // Don't let the initial hydration pollute the undo history
      useEditorStore.temporal.getState().clear()
    }
  } catch {
    // localStorage unavailable or data corrupt — start fresh
  }
})()

// Save to localStorage whenever project structure or active group changes.
// Selection / zoom / editingGroupId are intentionally excluded (transient UI).
useEditorStore.subscribe((state, prev) => {
  if (state.project === prev.project && state.activeSlideGroupId === prev.activeSlideGroupId) return
  try {
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify({
      project: state.project,
      activeSlideGroupId: state.activeSlideGroupId,
    }))
  } catch (err) {
    // Storage quota exceeded or unavailable. Surface once; silent failure risks data loss.
    console.warn('[PixelDeck] Project autosave failed', err)
    if (!projectStorageWarningShown && typeof window !== 'undefined') {
      projectStorageWarningShown = true
      window.setTimeout(() => {
        alert('Project autosave failed. Export Project now to avoid losing recent changes.')
      }, 0)
    }
  }
})

// Init activeSlideGroupId on first load (no-op when hydrated from storage)
const initial = useEditorStore.getState()
if (!initial.activeSlideGroupId && initial.project.slideGroups.length > 0) {
  useEditorStore.setState({ activeSlideGroupId: initial.project.slideGroups[0].id })
}

// ─── Undo/Redo hook ───────────────────────────────────────────────────────────

export type TemporalEditorStore = TemporalState<Pick<EditorStore, 'project'>>

export const useUndoRedo = () => {
  const undo = useStore(useEditorStore.temporal, (s) => s.undo)
  const redo = useStore(useEditorStore.temporal, (s) => s.redo)
  const canUndo = useStore(useEditorStore.temporal, (s) => s.pastStates.length > 0)
  const canRedo = useStore(useEditorStore.temporal, (s) => s.futureStates.length > 0)
  const pause = () => useEditorStore.temporal.getState().pause()
  const resume = () => useEditorStore.temporal.getState().resume()
  return { undo, redo, canUndo, canRedo, pause, resume }
}
