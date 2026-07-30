import { nanoid } from 'nanoid'
import type {
  Project, SlideGroup, Layer, LayerType, GroupLayer,
  BackgroundLayer, CanvasBackground, ProjectSettings,
  LocaleLayerPatch, LocaleContent, CanvasFormatId, FormatLayerPatch, LayoutDelta,
  LegacyLocaleLayoutFields,
} from '@/types'
import { spansToMarks } from '@/utils/textRendering'
import { mapLayerTree } from '@/utils/layerTree'
import { LOCALE_DELTA_FIELDS, resolveLayerLocaleAdjustBaseOnly } from '@/utils/canvasFormats'
import {
  BASE_CANVAS_FORMAT,
  FORMAT_FORK_KEYS,
  LOCALE_LAYOUT_FORK_KEYS,
  getFormatFamilyKey,
  normalizeProjectFormats,
} from '@/utils/canvasFormats'
import type { EditorSet, EditorGet } from './types'

/** Bumped by each one-time project-shape migration. See migrateProject(). */
export const LOCALE_SYMMETRIC_SCHEMA_VERSION = 1

/**
 * Bumped by the `localeAdjust` unification migration. See
 * migrateProjectToLocaleAdjust() / migrateProject(). Old project files on
 * disk may still carry the legacy `localeBaseDelta`/`localeLayoutOverrides`
 * fields (deleted from `BaseLayer`'s type in P4) — this migration folds
 * them INTO `localeAdjust`, the sole locale-layout storage since P4.
 */
export const LOCALE_ADJUST_SCHEMA_VERSION = 2

export { findLayerInTree, mapLayerTree, updateLayerInTree } from '@/utils/layerTree'

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function newId() { return nanoid(10) }

/**
 * Proportional shrink factor for newly-added layer defaults on non-standard
 * canvases (e.g. Apple Watch, 422×514). Clamped at 1 so it only ever shrinks
 * defaults to fit a smaller canvas — it must never enlarge them on a canvas
 * that's already >= the project's default size (this is what keeps it a
 * no-op for the common case, including fixtures that resize to a
 * same-family, slightly larger canvas like the 1320×2868 iPhone preset).
 */
export function getLayerDefaultsScaleFactor(group: SlideGroup, settings: ProjectSettings): number {
  return Math.min(
    1,
    group.slideWidth / settings.defaultSlideWidth,
    group.slideHeight / settings.defaultSlideHeight,
  )
}

/** Deep-clone a layer tree while assigning fresh IDs to every node. */
export function cloneLayerWithNewIds(layer: Layer): Layer {
  const clone = JSON.parse(JSON.stringify(layer)) as Layer
  const reId = (value: Layer): Layer => value.type === 'group'
    ? { ...value, id: newId(), children: (value as GroupLayer).children.map(reId) } as Layer
    : { ...value, id: newId() } as Layer
  return reId(clone)
}

/**
 * Old (pre-0.6.0) project files, or files produced by the CLI manifest tool
 * before it fully switched over, may still have a `localeOverrides` key on a
 * layer even though the current type no longer declares it. Read it
 * defensively for one-time migration purposes only — never write it back.
 */
function getLegacyLocaleOverrides(layer: Layer): Record<string, LocaleLayerPatch> | undefined {
  return (layer as unknown as { localeOverrides?: Record<string, LocaleLayerPatch> }).localeOverrides
}

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
  phone: ['scale', 'screenshotFit', 'screenshotOffsetX', 'screenshotOffsetY', 'showStatusBar', 'statusBarTheme', 'statusBarBg', 'statusBarColor', 'border', 'blur', 'shadow', 'opacity'],
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
    // Migrate legacy locale override patches that still carry spans.
    const legacyOverrides = getLegacyLocaleOverrides(result)
    if (legacyOverrides) {
      const migratedOverrides: Record<string, LocaleLayerPatch> = {}
      for (const [locale, patch] of Object.entries(legacyOverrides)) {
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
      // Keep the spans-free legacy value only as a migration intermediate.
      // foldLayerToSymmetric runs next and consumes/removes this raw key.
      result = { ...result, localeOverrides: migratedOverrides } as unknown as Layer
    }
    return result
  }
  return layer
}

/**
 * v0.6.0 symmetric locale model migration.
 * Populates `layer.localeContent[defaultLocale]` from the layer's current
 * base fields, and folds each legacy `localeOverrides[locale]` entry into
 * `localeContent[locale]`. The legacy key is removed from migrated output.
 */
export function foldLayerToSymmetric(layer: Layer, defaultLocale: string): Layer {
  const legacyOverrides = getLegacyLocaleOverrides(layer)
  const { localeOverrides: _legacy, ...layerWithoutLegacy } = layer as unknown as Layer & {
    localeOverrides?: Record<string, LocaleLayerPatch>
  }
  void _legacy
  if (layer.localeContent) return layerWithoutLegacy as Layer // already migrated
  if (layer.type !== 'text' && layer.type !== 'phone' && layer.type !== 'image') return layerWithoutLegacy as Layer

  const defaultContent: LocaleContent =
    layer.type === 'text'
      ? { text: layer.text, ...(layer.marks?.length ? { marks: layer.marks } : {}) }
      : layer.type === 'phone'
        ? {
            ...(layer.screenshotPath !== undefined ? { screenshotPath: layer.screenshotPath } : {}),
            ...(layer.screenshotDataUrl !== undefined ? { screenshotDataUrl: layer.screenshotDataUrl } : {}),
          }
        : { src: layer.src }

  const localeContent: Record<string, LocaleContent> = { [defaultLocale]: defaultContent }
  if (legacyOverrides) {
    for (const [locale, patch] of Object.entries(legacyOverrides)) {
      // patch is LocaleLayerPatch; spans should already be migrated to marks
      // by migrateLayerSpans (which must run before this in migrateProject).
      // Defensively drop spans if somehow still present rather than carrying
      // a field LocaleContent doesn't declare.
      const { spans: _spans, ...rest } = patch
      void _spans
      localeContent[locale] = rest as LocaleContent
    }
  }

  return { ...layerWithoutLegacy, localeContent } as Layer
}

/**
 * Seed localeContent[defaultLocale] for a brand-new layer at creation time.
 * Existing project layers are handled by foldLayerToSymmetric during migration.
 */
export function seedLocaleContent(layer: Layer, defaultLocale: string): Layer {
  if (layer.localeContent) return layer
  if (layer.type !== 'text' && layer.type !== 'phone' && layer.type !== 'image') return layer
  const content: LocaleContent =
    layer.type === 'text'
      ? { text: layer.text, ...(layer.marks?.length ? { marks: layer.marks } : {}) }
      : layer.type === 'phone'
        ? {
            ...(layer.screenshotPath !== undefined ? { screenshotPath: layer.screenshotPath } : {}),
            ...(layer.screenshotDataUrl !== undefined ? { screenshotDataUrl: layer.screenshotDataUrl } : {}),
          }
        : { src: layer.src }
  return { ...layer, localeContent: { [defaultLocale]: content } } as Layer
}

/**
 * Read the legacy pre-P4 `localeBaseDelta`/`localeLayoutOverrides` fields off
 * a RAW (pre-migration) layer. These fields were deleted from `BaseLayer`'s
 * public type in P4 — new projects never carry them — but old project files
 * saved on disk (and the frozen `legacy-4tier-project.json` migration
 * fixture) can still contain these keys in their raw JSON, and this
 * migration is the one place that still needs to read them. Explicit
 * narrow cast to `LegacyLocaleLayoutFields` (not a blanket `any` on the
 * whole layer) so this stays the single, obvious, greppable escape hatch —
 * do not delete this read or replace it with an `any` cast; that would
 * silently drop every legacy project's locale layout on load.
 */
function getLegacyLocaleLayoutFields(layer: Layer): LegacyLocaleLayoutFields {
  return layer as unknown as LegacyLocaleLayoutFields
}

/**
 * Migration: fold the legacy 4-tier locale layout fields (`localeBaseDelta`,
 * `localeLayoutOverrides`) into the 3-tier `localeAdjust` field, per the
 * deepwork spec's algorithm. Reads the legacy fields defensively (see
 * `getLegacyLocaleLayoutFields`) since they no longer exist on `BaseLayer`'s
 * type — this is read-only migration input, never written back.
 *
 * Returns the migrated project plus a `dropped` counter for keys that could
 * not be expressed as a delta (multiplicative R===0 zero-guard, dead
 * base-format cells, or keys outside the 7 fork keys) — surfaced so callers
 * can assert on it directly (dropped keys can't be fixture-ized cleanly
 * through the public store API).
 */
export function migrateProjectToLocaleAdjust(project: Project): { project: Project; dropped: number } {
  const baseFormat = BASE_CANVAS_FORMAT
  let dropped = 0

  const slideGroups = project.slideGroups.map((group) => {
    // Step 1: fold localeBaseDelta[locale] -> localeAdjust[locale][BASE] verbatim.
    const step1Layers = mapLayerTree(group.layers, (layer) => {
      const legacyBaseDelta = getLegacyLocaleLayoutFields(layer).localeBaseDelta
      if (!legacyBaseDelta) return layer
      let localeAdjust = layer.localeAdjust
      for (const [locale, delta] of Object.entries(legacyBaseDelta)) {
        if (!delta || !Object.keys(delta).length) continue
        localeAdjust = {
          ...(localeAdjust ?? {}),
          [locale]: {
            ...(localeAdjust?.[locale] ?? {}),
            [baseFormat]: { ...delta },
          },
        }
      }
      return localeAdjust !== layer.localeAdjust ? ({ ...layer, localeAdjust } as Layer) : layer
    })
    const step1Group: SlideGroup = { ...group, layers: step1Layers }

    // Step 2: convert localeLayoutOverrides[locale][format] cells (format !== base)
    // into localeAdjust[locale][format] deltas, derived against R (the value
    // resolved via the real render path, INCLUDING the just-folded base-scoped
    // delta, EXCLUDING this cell).
    const step2Layers = mapLayerTree(step1Group.layers, (layer) => {
      const legacyLayoutOverrides = getLegacyLocaleLayoutFields(layer).localeLayoutOverrides
      if (!legacyLayoutOverrides) return layer
      let localeAdjust = layer.localeAdjust
      for (const [locale, byFormat] of Object.entries(legacyLayoutOverrides)) {
        if (!byFormat) continue
        for (const [format, patch] of Object.entries(byFormat)) {
          if (!patch) continue
          // Dead cell: no writer ever produces localeLayoutOverrides[locale][baseFormat].
          // Count keys (not cells) to match the documented "dropped counts keys" contract.
          if (format === baseFormat) {
            dropped += Object.keys(patch).length
            continue
          }
          const resolvedFormat = format as CanvasFormatId
          const R = resolveLayerLocaleAdjustBaseOnly(
            step1Group,
            layer.id,
            locale,
            resolvedFormat,
            baseFormat,
            project.settings.customFormats,
          )
          if (!R) {
            // Layer filtered out of this format's resolved view entirely
            // (ownerFormat mismatch, formatVisibility[format] === false, …) —
            // every key in this cell is unrepresentable, so count them all
            // rather than silently dropping the whole cell uncounted.
            dropped += Object.keys(patch).length
            continue
          }
          const { delta, dropped: keyDropped } = deriveLocaleAdjustDelta(patch, R)
          dropped += keyDropped
          if (!Object.keys(delta).length) continue
          localeAdjust = {
            ...(localeAdjust ?? {}),
            [locale]: {
              ...(localeAdjust?.[locale] ?? {}),
              [resolvedFormat]: {
                ...(localeAdjust?.[locale]?.[resolvedFormat] ?? {}),
                ...delta,
              },
            },
          }
        }
      }
      return localeAdjust !== layer.localeAdjust ? ({ ...layer, localeAdjust } as Layer) : layer
    })

    return { ...step1Group, layers: step2Layers }
  })

  return { project: { ...project, slideGroups }, dropped }
}

/**
 * Derive a `LayoutDelta` from one legacy absolute `localeLayoutOverrides`
 * patch cell, given `R` (the resolved value excluding that cell). Additive
 * for x/y/rotation (`d = V - R`), multiplicative for width/height/fontSize/
 * scale (`m = V / R`). Prunes no-ops (0/1). Drops (and counts) keys outside
 * the 7 fork keys, and multiplicative keys where `R === 0` (inexpressible as
 * a ratio).
 */
export function deriveLocaleAdjustDelta(patch: FormatLayerPatch, R: Layer): { delta: LayoutDelta; dropped: number } {
  const delta: LayoutDelta = {}
  let localDropped = 0
  const rSource = R as unknown as Record<string, unknown>
  const additiveKeys = new Set(['x', 'y', 'rotation'])
  for (const [key, value] of Object.entries(patch)) {
    const deltaKey = (LOCALE_DELTA_FIELDS as Record<string, keyof LayoutDelta>)[key]
    if (!deltaKey) {
      localDropped++ // key outside the 7 fork keys — no legit writer produced it
      continue
    }
    const rValue = rSource[key]
    if (typeof value !== 'number' || typeof rValue !== 'number') {
      localDropped++
      continue
    }
    if (additiveKeys.has(key)) {
      const derived = value - rValue
      if (derived !== 0) (delta as Record<string, number>)[deltaKey] = derived
    } else {
      if (rValue === 0) {
        localDropped++ // inexpressible as a ratio
        continue
      }
      const derived = value / rValue
      if (derived !== 1) (delta as Record<string, number>)[deltaKey] = derived
    }
  }
  return { delta, dropped: localDropped }
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
 * Split persisted pre-family-split desktop groups into one group per new family.
 * A legacy desktop group could own mac, Apple TV, and Vision Pro simultaneously;
 * those formats are now incompatible families and must not remain first-ID-wins.
 */
export function normalizeGroupFamilies<T extends Project>(project: T): T {
  const legacyDesktopFormats = new Set<CanvasFormatId>(['mac', 'appletv', 'visionpro'])
  const slideGroups = project.slideGroups.flatMap((group) => {
    const formats = group.formats
    if (!formats?.length) return [group]
    const legacy = formats.filter((format) => legacyDesktopFormats.has(format))
    if (legacy.length < 2) return [group]
    const customs = formats.filter((format) => !legacyDesktopFormats.has(format))

    const byFamily = new Map<string, CanvasFormatId[]>()
    for (const format of legacy) {
      const family = getFormatFamilyKey(format)
      if (!family) continue
      byFamily.set(family, [...(byFamily.get(family) ?? []), format])
    }
    if (byFamily.size <= 1) return [group]

    return Array.from(byFamily.values()).map((familyFormats, index) => (
      index === 0
        ? { ...group, formats: [...familyFormats, ...customs], slideNames: [...group.slideNames] }
        : { ...group, id: newId(), formats: familyFormats, layers: group.layers.map(cloneLayerWithNewIds), slideNames: [...group.slideNames] }
    ))
  })
  return { ...project, slideGroups }
}

/**
 * Normalize + migrate a parsed project: canvas formats, legacy CanvasBackground
 * → BackgroundLayer, and legacy TextLayer.spans → marks. Shared by import and
 * localStorage hydration so both paths produce the same shape.
 */
export function migrateProject(raw: Project): Project {
  const project = normalizeGroupFamilies(normalizeProjectFormats(raw))
  for (const sg of project.slideGroups) {
    if (!sg.layers.some((l) => l.type === 'background')) {
      const migrated = sg.background ? bgFromLegacy(sg.background) : createBackgroundLayer()
      sg.layers = [migrated, ...sg.layers]
    }
    sg.layers = sg.layers.map(migrateLayerSpans)
    sg.layers = mapLayerTree(sg.layers, (l) => foldLayerToSymmetric(l, project.settings.defaultLocale))
    // Legacy field — fully superseded by the BackgroundLayer in layers[0]
    delete sg.background
  }
  if (!project.settings.pano) {
    project.settings = { ...project.settings, pano: { gapPx: 24, compensate: false } }
  }
  if ((project.settings.schemaVersion ?? 0) < LOCALE_SYMMETRIC_SCHEMA_VERSION) {
    project.settings = { ...project.settings, schemaVersion: LOCALE_SYMMETRIC_SCHEMA_VERSION }
  }
  if ((project.settings.schemaVersion ?? 0) < LOCALE_ADJUST_SCHEMA_VERSION) {
    const { project: migrated } = migrateProjectToLocaleAdjust(project)
    project.slideGroups = migrated.slideGroups
    project.settings = { ...project.settings, schemaVersion: LOCALE_ADJUST_SCHEMA_VERSION }
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

/** Split a patch into per-locale, per-format layout keys and everything else. */
export const splitLocaleFormatLayoutPatch = (patch: Partial<Layer>): { layout: FormatLayerPatch; rest: Partial<Layer> } => {
  const layout: Record<string, unknown> = {}
  const rest: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(patch)) {
    if ((LOCALE_LAYOUT_FORK_KEYS as readonly string[]).includes(key)) layout[key] = value
    else rest[key] = value
  }
  return { layout: layout as FormatLayerPatch, rest: rest as Partial<Layer> }
}

/** Keys whose values are per-locale content (v0.6.0 symmetric locale model). */
export const LOCALE_CONTENT_KEYS = ['text', 'marks', 'screenshotPath', 'screenshotDataUrl', 'src'] as const

/**
 * Split a layer patch into locale-content keys (text/marks/screenshotPath/
 * screenshotDataUrl/src) and everything else. Mirrors splitFormatPatch for
 * the orthogonal locale axis.
 */
export const splitLocalePatch = (patch: Partial<Layer>): { locale: LocaleContent; rest: Partial<Layer> } => {
  const locale: Record<string, unknown> = {}
  const rest: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(patch)) {
    if ((LOCALE_CONTENT_KEYS as readonly string[]).includes(key)) locale[key] = value
    else rest[key] = value
  }
  return { locale: locale as LocaleContent, rest: rest as Partial<Layer> }
}

/**
 * Route a layer patch's locale-content keys into localeContent[activeLocale].
 * When editing the default locale, keep the layer's flat default-locale fields
 * in sync as well.
 * Returns the updated layer plus the non-locale `rest` of the patch for the
 * caller to apply via the existing format-patch pipeline. If the patch has
 * no locale-content keys, returns the layer unchanged and the full patch as
 * `rest` (zero-cost passthrough).
 */
export const patchLayerForLocale = (
  layer: Layer,
  patch: Partial<Layer>,
  activeLocale: string,
  defaultLocale: string,
): { layer: Layer; rest: Partial<Layer> } => {
  const { locale: localePatch, rest } = splitLocalePatch(patch)
  if (Object.keys(localePatch).length === 0) return { layer, rest }

  const localeContent = { ...(layer.localeContent ?? {}) }
  localeContent[activeLocale] = { ...(localeContent[activeLocale] ?? {}), ...localePatch }
  let next = { ...layer, localeContent } as Layer

  if (activeLocale === defaultLocale) {
    next = { ...next, ...localePatch } as Layer
  }
  return { layer: next, rest }
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

/**
 * Derive+merge a `LayoutDelta` for one `localeAdjust[locale][scope]` cell —
 * the single write path for non-default-locale layout edits. `scope` is
 * `BASE_CANVAS_FORMAT` for the base-authoring-context write, or the active
 * (non-base) format id for the format-scoped write.
 *
 * `resolved` is the format-resolved value the incoming patch is relative to,
 * EXCLUDING this cell:
 *  - base-scoped (`scope === BASE_CANVAS_FORMAT`): raw === resolved there, so
 *    callers can just pass the (pre-patch) layer itself — free, no extra
 *    resolution needed.
 *  - format-scoped: callers MUST pre-resolve this via
 *    `resolveLayerLocaleAdjustBaseOnly` (or equivalent) BEFORE calling, since
 *    it needs `formatOverrides[F]` + the already-composed base-scoped delta
 *    factored in — this is the one non-trivial cost this write path carries
 *    (measured comfortably under budget, see the deepwork doc's perf writeup).
 *
 * Reuses `deriveLocaleAdjustDelta` (the exact derive/prune math shared with
 * the migration) rather than re-deriving a second time. Replace-not-
 * accumulate semantics per key: each written key's delta is recomputed fresh
 * against `resolved`, not accumulated onto any prior stored delta. Prunes
 * no-op keys (0/1) and empty parent maps.
 */
export const patchLayerForLocaleAdjust = (
  layer: Layer,
  patch: Partial<Layer>,
  locale: string,
  defaultLocale: string,
  scope: CanvasFormatId,
  resolved: Layer,
): { layer: Layer; rest: Partial<Layer> } => {
  const { layout, rest } = splitLocaleFormatLayoutPatch(patch)
  if (locale === defaultLocale || !Object.keys(layout).length) return { layer, rest }

  const { delta: derivedDelta } = deriveLocaleAdjustDelta(layout as FormatLayerPatch, resolved)
  const existing = layer.localeAdjust?.[locale]?.[scope] ?? {}
  const merged: Record<string, number> = { ...(existing as Record<string, number>) }
  for (const layoutKey of Object.keys(layout)) {
    const deltaKey = (LOCALE_DELTA_FIELDS as Record<string, keyof LayoutDelta>)[layoutKey]
    if (!deltaKey) continue
    if (deltaKey in derivedDelta) merged[deltaKey] = (derivedDelta as Record<string, number>)[deltaKey]
    else delete merged[deltaKey]
  }

  if (!Object.keys(merged).length) {
    if (!layer.localeAdjust?.[locale]?.[scope]) return { layer, rest }
    const { [scope]: _removedScope, ...remainingScopes } = layer.localeAdjust[locale]
    void _removedScope
    const { [locale]: _removedLocale, ...remainingLocales } = layer.localeAdjust
    void _removedLocale
    const localeAdjust = Object.keys(remainingScopes).length
      ? { ...remainingLocales, [locale]: remainingScopes }
      : remainingLocales
    return {
      layer: { ...layer, localeAdjust: Object.keys(localeAdjust).length ? localeAdjust : undefined } as Layer,
      rest,
    }
  }

  return {
    layer: {
      ...layer,
      localeAdjust: {
        ...(layer.localeAdjust ?? {}),
        [locale]: {
          ...(layer.localeAdjust?.[locale] ?? {}),
          [scope]: merged as LayoutDelta,
        },
      },
    } as Layer,
    rest,
  }
}

/**
 * Remove one `localeAdjust[locale][scope]` cell and prune empty parent
 * maps. `scope` is `BASE_CANVAS_FORMAT` for the base-scoped cell or an
 * active (non-base) format id for the format-scoped cell — both cells
 * compose rather than shadow, so this only ever clears its own scope.
 */
export const withoutLocaleAdjust = (layer: Layer, locale: string, scope: CanvasFormatId): Layer => {
  if (!layer.localeAdjust?.[locale]?.[scope]) return layer
  const { [scope]: _removedScope, ...remainingScopes } = layer.localeAdjust[locale]
  void _removedScope
  const { [locale]: _removedLocale, ...remainingLocales } = layer.localeAdjust
  void _removedLocale
  const localeAdjust = Object.keys(remainingScopes).length
    ? { ...remainingLocales, [locale]: remainingScopes }
    : remainingLocales
  return { ...layer, localeAdjust: Object.keys(localeAdjust).length ? localeAdjust : undefined } as Layer
}

/**
 * Remove one key from a `localeAdjust[locale][scope]` cell and prune empty
 * maps. Accepts a LAYOUT key (e.g. `'x'`), translating internally via
 * `LOCALE_DELTA_FIELDS` (`OverrideDot` always passes layout keys).
 */
export const withoutLocaleAdjustKey = (
  layer: Layer,
  locale: string,
  scope: CanvasFormatId,
  layoutKey: string,
): Layer => {
  const deltaKey = (LOCALE_DELTA_FIELDS as Record<string, keyof LayoutDelta>)[layoutKey]
  if (!deltaKey) return layer
  const delta = layer.localeAdjust?.[locale]?.[scope]
  if (!delta || !(deltaKey in delta)) return layer
  const { [deltaKey]: _removed, ...remainingDelta } = delta as Record<string, unknown>
  void _removed
  if (!Object.keys(remainingDelta).length) return withoutLocaleAdjust(layer, locale, scope)
  return {
    ...layer,
    localeAdjust: {
      ...layer.localeAdjust,
      [locale]: {
        ...layer.localeAdjust![locale],
        [scope]: remainingDelta as LayoutDelta,
      },
    },
  } as Layer
}

/** Remove one `localeAdjust[locale][scope]` cell across a complete layer tree. */
export const resetLocaleAdjustsInLayerTree = (
  layers: Layer[],
  locale: string,
  scope: CanvasFormatId,
): Layer[] => mapLayerTree(layers, (layer) => withoutLocaleAdjust(layer, locale, scope))

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
  // Strip per-locale inline data URLs
  if (layer.localeContent) {
    for (const patch of Object.values(layer.localeContent)) {
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
