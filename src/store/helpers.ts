import { nanoid } from 'nanoid'
import type {
  Project, SlideGroup, Layer, LayerType, GroupLayer,
  BackgroundLayer, CanvasBackground, ProjectSettings,
  LocaleLayerPatch, CanvasFormatId, FormatLayerPatch,
} from '@/types'
import { spansToMarks } from '@/utils/textRendering'
import {
  BASE_CANVAS_FORMAT,
  FORMAT_FORK_KEYS,
  normalizeProjectFormats,
} from '@/utils/canvasFormats'
import type { EditorSet, EditorGet } from './types'

export { findLayerInTree, mapLayerTree, updateLayerInTree } from '@/utils/layerTree'

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function newId() { return nanoid(10) }

/**
 * Bake a group's uniform scale into a child layer's own properties.
 * Used when dissolving / flattening a scaled group so the visual result is unchanged.
 */
export function bakeLayerScale(layer: Layer, s: number): Layer {
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
    case 'emoji':
      scaled.fontSize *= s
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
export function cloneWithNewIds(layer: Layer): Layer {
  const clone = JSON.parse(JSON.stringify(layer)) as Layer
  clone.id = newId()
  if (clone.type === 'group') {
    (clone as GroupLayer).children = (clone as GroupLayer).children.map(cloneWithNewIds)
  }
  return clone
}

export const STYLE_KEYS: Partial<Record<LayerType, string[]>> = {
  background: ['fill', 'accents', 'imageDataUrl', 'imageFit', 'imageBlur', 'imageOverlayColor', 'imageOverlayOpacity', 'noise', 'blur', 'shadow', 'opacity'],
  text: ['fill', 'fontFamily', 'fontSize', 'fontWeight', 'italic', 'underline', 'strikethrough', 'letterSpacing', 'lineHeight', 'align', 'width', 'height', 'verticalAlign', 'blur', 'shadow', 'opacity'],
  shape: ['fill', 'stroke', 'strokeWidth', 'cornerRadius', 'shapeType', 'width', 'height', 'blur', 'shadow', 'opacity'],
  emoji: ['emoji', 'fontSize', 'blur', 'shadow', 'opacity'],
  brand: ['nameColor', 'nameFontSize', 'nameFontFamily', 'nameFontWeight', 'logoSize', 'direction', 'gap', 'blur', 'shadow', 'opacity'],
  image: ['cornerRadius', 'blur', 'shadow', 'opacity'],
  phone: ['model', 'scale', 'screenshotFit', 'screenshotOffsetX', 'screenshotOffsetY', 'showStatusBar', 'statusBarTheme', 'statusBarBg', 'statusBarColor', 'border', 'blur', 'shadow', 'opacity'],
  group: ['blur', 'shadow', 'opacity'],
}

export function createBackgroundLayer(overrides?: Partial<BackgroundLayer>): BackgroundLayer {
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
export function bgFromLegacy(bg: CanvasBackground): BackgroundLayer {
  return createBackgroundLayer({
    fill: bg.fill,
    accents: (bg.accents ?? []).map((a) => ({ ...a })),
  })
}

/** Recursively migrate legacy TextLayer.spans → marks in a layer tree. */
export function migrateLayerSpans(layer: Layer): Layer {
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

export function newSlideGroup(overrides?: Partial<SlideGroup>): SlideGroup {
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

export function newProject(): Project {
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
      customFormats: [],
      pano: { gapPx: 24, compensate: false },
    },
    slideGroups: [newSlideGroup({ name: 'Slide 1' })],
  }
}

/**
 * Minimal shape guard for user-supplied project JSON. Catches malformed or
 * non-project files with a clear message instead of a deep migration crash.
 */
export function assertProjectShape(value: unknown): asserts value is Project {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Invalid project file: expected a JSON object.')
  }
  const p = value as Partial<Project>
  if (!Array.isArray(p.slideGroups)) {
    throw new Error('Invalid project file: missing "slideGroups" array.')
  }
  if (typeof p.settings !== 'object' || p.settings === null) {
    throw new Error('Invalid project file: missing "settings" object.')
  }
  for (const sg of p.slideGroups) {
    if (typeof sg !== 'object' || sg === null || !Array.isArray((sg as SlideGroup).layers)) {
      throw new Error('Invalid project file: every slide group needs a "layers" array.')
    }
  }
}

/**
 * Normalize + migrate a parsed project: canvas formats, legacy CanvasBackground
 * → BackgroundLayer, and legacy TextLayer.spans → marks. Shared by import and
 * localStorage hydration so both paths produce the same shape.
 */
export function migrateProject(raw: Project): Project {
  const project = normalizeProjectFormats(raw)
  for (const sg of project.slideGroups) {
    if (!sg.layers.some((l) => l.type === 'background')) {
      const migrated = sg.background ? bgFromLegacy(sg.background) : createBackgroundLayer()
      sg.layers = [migrated, ...sg.layers]
    }
    sg.layers = sg.layers.map(migrateLayerSpans)
    // Legacy field — fully superseded by the BackgroundLayer in layers[0]
    delete sg.background
  }
  if (!project.settings.pano) {
    project.settings = { ...project.settings, pano: { gapPx: 24, compensate: false } }
  }
  return project
}

/**
 * Immutable project patch with an `updatedAt` bump — the single write path
 * for project mutations. Always go through this (or touchSettings) so the
 * timestamp can never be forgotten.
 */
export const touchProject = (p: Project, patch: Partial<Project>): Project => ({
  ...p,
  ...patch,
  updatedAt: new Date().toISOString(),
})

/** Same as touchProject, for nested ProjectSettings patches. */
export const touchSettings = (p: Project, patch: Partial<ProjectSettings>): Project =>
  touchProject(p, { settings: { ...p.settings, ...patch } })

/**
 * Split a layer patch into layout keys (stored per-format) and content keys
 * (always written to the shared base layer). Content stays shared across
 * formats by design — only positioning/sizing forks.
 */
export const splitFormatPatch = (patch: Partial<Layer>): { layout: FormatLayerPatch; content: Partial<Layer> } => {
  const layout: Record<string, unknown> = {}
  const content: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(patch)) {
    if ((FORMAT_FORK_KEYS as readonly string[]).includes(key)) layout[key] = value
    else content[key] = value
  }
  return { layout: layout as FormatLayerPatch, content: content as Partial<Layer> }
}

/**
 * Pick a subset of keys off a layer as a patch object. This is the single
 * place where a Layer is read through dynamic string keys — the discriminated
 * union cannot be indexed directly, so the cast is contained here.
 */
export const pickLayerKeys = (layer: Layer, keys: string[]): Partial<Layer> => {
  const source = layer as unknown as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of keys) out[key] = source[key]
  return out as Partial<Layer>
}

export const withFormatOverride = (layer: Layer, format: CanvasFormatId, patch: FormatLayerPatch): Layer => ({
  ...layer,
  formatOverrides: {
    ...(layer.formatOverrides ?? {}),
    [format]: {
      ...(layer.formatOverrides?.[format] ?? {}),
      ...patch,
    },
  },
} as Layer)

export const withoutFormatOverride = (layer: Layer, format: CanvasFormatId): Layer => {
  if (!layer.formatOverrides?.[format]) return layer
  const { [format]: _removed, ...rest } = layer.formatOverrides
  void _removed
  return { ...layer, formatOverrides: Object.keys(rest).length ? rest : undefined } as Layer
}

/** Apply a patch to a layer respecting the active format: content → base, layout → override. */
export const patchLayerForFormat = (
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

/**
 * Strip inline base64 data URL fields from every layer in a project before
 * persisting to localStorage. Assets are stored separately in IndexedDB via
 * the asset store; stripping avoids QuotaExceededError on large projects.
 *
 * Returns a new deep-cloned project — the in-memory store is NOT mutated.
 */
export function stripDataUrls(project: Project): Project {
  const cloned: Project = JSON.parse(JSON.stringify(project))
  for (const sg of cloned.slideGroups) {
    sg.layers = sg.layers.map(stripLayerDataUrls)
  }
  return cloned
}

function stripLayerDataUrls(layer: Layer): Layer {
  // Strip per-type inline data URL fields
  if (layer.type === 'background') {
    delete (layer as { imageDataUrl?: string }).imageDataUrl
  }
  if (layer.type === 'phone') {
    delete (layer as { screenshotDataUrl?: string }).screenshotDataUrl
  }
  // Strip localeOverrides patches that carry inline data URLs
  if (layer.localeOverrides) {
    for (const patch of Object.values(layer.localeOverrides)) {
      delete patch.screenshotDataUrl
    }
  }
  // Recurse into group children
  if (layer.type === 'group') {
    const grp = layer as GroupLayer
    grp.children = grp.children.map(stripLayerDataUrls)
  }
  return layer
}

export const getActiveGroup = (get: EditorGet) => {
  const { project, activeSlideGroupId } = get()
  return project.slideGroups.find((g) => g.id === activeSlideGroupId)
}

export const mutateActiveGroup = (set: EditorSet, fn: (g: SlideGroup) => SlideGroup) => {
  set((s) => ({
    project: touchProject(s.project, {
      slideGroups: s.project.slideGroups.map((g) => (g.id === s.activeSlideGroupId ? fn(g) : g)),
    }),
  }))
}
