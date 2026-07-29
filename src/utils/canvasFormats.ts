import type {
  BuiltInFormatId,
  CanvasFormatId,
  CustomCanvasFormat,
  CustomFormatId,
  GroupLayer,
  Layer,
  LayoutDelta,
  PhoneLayer,
  Project,
  SlideGroup,
} from '@/types'
import { getModelForPlatform } from '@/assets/mockups/specs'
import { findLayerInTree, forEachLayerTree, mapLayerTree } from '@/utils/layerTree'
import { applyLocale } from './locale'

export const CANVAS_FORMAT_PRESETS = [
  { id: 'iphone-69', label: 'iPhone 6.9"', width: 1320, height: 2868 },
  { id: 'android-phone', label: 'Android Phone', width: 1080, height: 1920 },
  { id: 'ipad-13', label: 'iPad 13"', width: 2064, height: 2752 },
  { id: 'android-tablet', label: 'Android Tablet 10"', width: 1600, height: 2560 },
  { id: 'ipad-11', label: 'iPad 11"', width: 1668, height: 2420 },
  { id: 'apple-watch', label: 'Apple Watch', width: 422, height: 514 },
  { id: 'wear-os', label: 'Wear OS', width: 480, height: 480 },
  { id: 'mac', label: 'Mac', width: 2880, height: 1800 },
  { id: 'appletv', label: 'Apple TV', width: 3840, height: 2160 },
  { id: 'visionpro', label: 'Vision Pro', width: 3840, height: 2160 },
] as const satisfies readonly { id: CanvasFormatId; label: string; width: number; height: number }[]

export const BASE_CANVAS_FORMAT: CanvasFormatId = 'base'

export const DEFAULT_ACTIVE_CANVAS_FORMATS: CanvasFormatId[] = ['iphone-69', 'android-phone']

const PLATFORM_FORMAT_IDS = new Set<CanvasFormatId>(CANVAS_FORMAT_PRESETS.map((format) => format.id))

/**
 * Layer properties that are stored per-format when edited in a non-base format.
 * Everything else (text, fills, images, models…) is always shared across formats.
 */
export const FORMAT_LAYOUT_KEYS = ['x', 'y', 'width', 'height', 'fontSize', 'scale', 'rotation'] as const

/** Which platform each format targets — drives phone model auto-swap. */
export const FORMAT_PLATFORM: Record<BuiltInFormatId, 'ios' | 'android'> = {
  'base': 'ios',
  'iphone-69': 'ios',
  'ipad-13': 'ios',
  'android-phone': 'android',
  'android-tablet': 'android',
  'ipad-11': 'ios',
  'apple-watch': 'ios',
  'wear-os': 'android',
  mac: 'ios',
  appletv: 'ios',
  visionpro: 'ios',
}

/**
 * Presentation-only format family lookup. `base` is the authoring sentinel,
 * not an independently exportable preset; it is labelled phone solely to keep
 * this exhaustive built-in map straightforward until family-specific bases are
 * introduced in a later phase.
 */
export const FORMAT_FAMILY: Record<BuiltInFormatId, 'phone' | 'tablet' | 'watch' | 'desktop'> = {
  base: 'phone',
  'iphone-69': 'phone',
  'android-phone': 'phone',
  'ipad-13': 'tablet',
  'android-tablet': 'tablet',
  'ipad-11': 'tablet',
  'apple-watch': 'watch',
  'wear-os': 'watch',
  mac: 'desktop',
  appletv: 'desktop',
  visionpro: 'desktop',
}

export type FormatFamilyKey = 'phone' | 'tablet' | 'watch' | 'desktop'

/** Stable authoring canvas for every derived format family. */
export const FORMAT_FAMILY_ANCHOR: Record<FormatFamilyKey, BuiltInFormatId> = {
  phone: 'iphone-69',
  tablet: 'ipad-13',
  watch: 'apple-watch',
  desktop: 'appletv',
}

/** Layout keys + model — model forks per format (auto-swap + manual override). */
export const FORMAT_FORK_KEYS = [...FORMAT_LAYOUT_KEYS, 'model'] as const

/** Locale layout forks spatial keys only; it never swaps a device model. */
export const LOCALE_LAYOUT_FORK_KEYS = FORMAT_LAYOUT_KEYS

/** Maps locale layout properties to their base-coordinate delta fields. */
export const LOCALE_DELTA_FIELDS = {
  x: 'dx',
  y: 'dy',
  rotation: 'dRotation',
  width: 'mWidth',
  height: 'mHeight',
  fontSize: 'mFontSize',
  scale: 'mScale',
} as const satisfies Record<typeof LOCALE_LAYOUT_FORK_KEYS[number], keyof LayoutDelta>

export function isCustomFormatId(id: CanvasFormatId): id is CustomFormatId {
  return id.startsWith('custom:')
}

export function getCanvasFormat(id: CanvasFormatId, customFormats?: CustomCanvasFormat[]) {
  if (id === 'base') return CANVAS_FORMAT_PRESETS.find((f) => f.id === 'iphone-69')!
  const format = isCustomFormatId(id)
    ? customFormats?.find((customFormat) => customFormat.id === id)
    : CANVAS_FORMAT_PRESETS.find((preset) => preset.id === id)
  if (!format) throw new Error(`Unknown canvas format: ${id}`)
  return format
}

export function getFormatPlatform(id: CanvasFormatId): 'ios' | 'android' | null {
  return isCustomFormatId(id) ? null : FORMAT_PLATFORM[id]
}

export function getFormatLabel(id: CanvasFormatId, customFormats?: CustomCanvasFormat[]): string {
  if (isCustomFormatId(id)) return customFormats?.find((format) => format.id === id)?.label ?? id
  const labels: Record<BuiltInFormatId, string> = {
    base: 'Base',
    'iphone-69': 'iPhone',
    'android-phone': 'Android',
    'ipad-13': 'iPad',
    'android-tablet': 'Android Tab',
    'ipad-11': 'iPad 11"',
    'apple-watch': 'Apple Watch',
    'wear-os': 'Wear OS',
    mac: 'Mac',
    appletv: 'Apple TV',
    visionpro: 'Vision Pro',
  }
  return labels[id]
}

export function getProjectBaseFormat(project: Pick<Project, 'settings'>): CanvasFormatId {
  void project
  return BASE_CANVAS_FORMAT
}

/**
 * Whether a slide group participates in a format. The base sentinel always
 * targets a group's own authored dimensions, even for format-scoped groups.
 */
export function groupTargetsFormat(group: SlideGroup, format: CanvasFormatId): boolean {
  return format === BASE_CANVAS_FORMAT || group.formats === undefined || group.formats.includes(format)
}

/** Return a built-in format's family. Custom formats are adopted by groups. */
export function getFormatFamilyKey(formatId: CanvasFormatId): FormatFamilyKey | null {
  return isCustomFormatId(formatId) ? null : FORMAT_FAMILY[formatId]
}

/**
 * Resolve family membership from a group's first built-in format. Unscoped
 * groups retain the legacy/default phone family; custom-only groups are
 * deliberately singleton and therefore have no named family.
 */
export function getGroupFamilyKey(group: SlideGroup): FormatFamilyKey | null {
  if (group.formats === undefined) return 'phone'
  return group.formats.map(getFormatFamilyKey).find((family): family is FormatFamilyKey => family !== null) ?? null
}

/** Canonical preset set plus custom formats explicitly adopted by this family. */
export function selectFamilyFormats(project: Project, family: FormatFamilyKey): CanvasFormatId[] {
  const builtIns = CANVAS_FORMAT_PRESETS
    .map((format) => format.id)
    .filter((format) => FORMAT_FAMILY[format] === family)
  const customs = project.slideGroups.flatMap((group) => (
    getGroupFamilyKey(group) === family
      ? (group.formats ?? []).filter(isCustomFormatId)
      : []
  ))
  return Array.from(new Set([...builtIns, ...customs]))
}

/** All groups belonging to one named built-in family, retaining project order. */
export function selectFamilyGroups(project: Project, family: FormatFamilyKey): SlideGroup[] {
  return project.slideGroups.filter((group) => getGroupFamilyKey(group) === family)
}

/** Add a format to every group in a family, preserving unscoped canonical membership. */
export function appendFormatToFamilyGroups(
  project: Project,
  family: FormatFamilyKey,
  formatId: CanvasFormatId,
): SlideGroup[] {
  return project.slideGroups.map((group) => (
    getGroupFamilyKey(group) !== family || group.formats?.includes(formatId)
      ? group
      : { ...group, formats: Array.from(new Set([...(group.formats ?? selectFamilyFormats(project, family)), formatId])) }
  ))
}

/** Named built-in families currently represented by at least one group. */
export function selectProjectFamilies(project: Project): FormatFamilyKey[] {
  return Array.from(new Set(project.slideGroups.flatMap((group) => {
    const family = getGroupFamilyKey(group)
    return family === null ? [] : [family]
  })))
}

/** Select groups displayed by a format tab; Base is explicitly family-scoped. */
export function selectFormatViewGroups(
  project: Project,
  format: CanvasFormatId,
  family: FormatFamilyKey,
): SlideGroup[] {
  return format === BASE_CANVAS_FORMAT
    ? selectFamilyGroups(project, family)
    : project.slideGroups.filter((group) => groupTargetsFormat(group, format))
}

/**
 * Select source groups that participate in a source format but do not already
 * have a dedicated target-format layout. Unscoped groups are only sources from
 * the base view so creating a format family cannot duplicate another family.
 */
export function selectForkSourceGroups(
  project: Project,
  sourceFormat: CanvasFormatId,
  targetFormatId: CanvasFormatId,
): SlideGroup[] {
  return project.slideGroups.filter((group) => (
    (sourceFormat === BASE_CANVAS_FORMAT
      ? group.formats === undefined
      : groupTargetsFormat(group, sourceFormat))
    && !(group.formats !== undefined && groupTargetsFormat(group, targetFormatId))
  ))
}

/** All non-empty source families available for creating a target layout. */
export function selectForkSourceCandidates(project: Project, targetFormatId: CanvasFormatId): CanvasFormatId[] {
  return Array.from(new Set([
    ...(project.slideGroups.some((group) => group.formats === undefined) ? [BASE_CANVAS_FORMAT] : []),
    ...getProjectActiveFormats(project),
    ...project.slideGroups.flatMap((group) => group.formats ?? []),
  ])).filter((format) => (
    format !== targetFormatId && selectForkSourceGroups(project, format, targetFormatId).length > 0
  ))
}

/**
 * Choose a viable source family when the Base tab has no remaining unscoped
 * groups. This keeps source selection explicit in the UI while providing a
 * useful default after a project has already been forked once.
 */
export function resolveForkSourceFormat(
  project: Project,
  activeCanvasFormat: CanvasFormatId,
  activeSlideGroupId: string,
  targetFormatId: CanvasFormatId,
): CanvasFormatId {
  const candidates = selectForkSourceCandidates(project, targetFormatId)
  if (candidates.length === 0) return BASE_CANVAS_FORMAT
  if (candidates.includes(activeCanvasFormat)) return activeCanvasFormat
  if (candidates.includes(BASE_CANVAS_FORMAT)) return BASE_CANVAS_FORMAT

  const activeGroup = project.slideGroups.find((group) => group.id === activeSlideGroupId)
  const activeGroupFormat = activeGroup?.formats?.find((format) => candidates.includes(format))
  if (activeGroupFormat) return activeGroupFormat

  return candidates[0]!
}

export function getProjectActiveFormats(project: Pick<Project, 'settings'>): CanvasFormatId[] {
  return normalizeActiveFormats(
    project.settings.activeFormats,
    project.settings.baseCanvasFormat,
    project.settings.customFormats,
  )
}

export function normalizeActiveFormats(
  activeFormats?: CanvasFormatId[],
  legacyBaseFormat?: CanvasFormatId,
  customFormats?: CustomCanvasFormat[],
): CanvasFormatId[] {
  const formats = (activeFormats ?? []).filter((format) =>
    format !== BASE_CANVAS_FORMAT && (
      PLATFORM_FORMAT_IDS.has(format)
      || (isCustomFormatId(format) && customFormats?.some((customFormat) => customFormat.id === format))
    ),
  )

  if (activeFormats !== undefined && activeFormats.length === 0) return []

  // Legacy projects used iphone-69 as the "base". A saved activeFormats list of
  // only iphone-69 therefore means "base only", not "the user removed Android".
  if (
    formats.length === 0 ||
    (legacyBaseFormat === 'iphone-69' && formats.length === 1 && formats[0] === 'iphone-69')
  ) {
    return [...DEFAULT_ACTIVE_CANVAS_FORMATS]
  }

  return Array.from(new Set(formats))
}

export function getExportTargets(project: Pick<Project, 'settings'>): CanvasFormatId[] {
  const formats = getProjectActiveFormats(project)
  return formats.length > 0 ? formats : [BASE_CANVAS_FORMAT]
}

export function normalizeProjectFormats<T extends Project>(project: T): T {
  return {
    ...project,
    settings: {
      ...project.settings,
      baseCanvasFormat: BASE_CANVAS_FORMAT,
      activeFormats: getProjectActiveFormats(project),
    },
  }
}

/**
 * Canvas dimensions for a group in a given format.
 * Base format = the group's own stored (authoring) dimensions — including custom sizes.
 * Other formats = the preset dimensions.
 */
export function getFormatCanvasDims(
  group: SlideGroup,
  format: CanvasFormatId,
  baseFormat: CanvasFormatId,
  customFormats?: CustomCanvasFormat[],
): { width: number; height: number } {
  if (format === baseFormat || format === 'base') return { width: group.slideWidth, height: group.slideHeight }
  const preset = getCanvasFormat(format, customFormats)
  return { width: preset.width, height: preset.height }
}

/**
 * Compute the uniform fit-center scale factor when mapping from one canvas size
 * to another. Uses min(sx, sy) so the content fits inside the target canvas
 * without clipping, with symmetric letterbox margins when aspect ratios differ.
 */
function fitCenterScale(fromW: number, fromH: number, toW: number, toH: number): number {
  return Math.min(toW / fromW, toH / fromH)
}

/**
 * Return the fit-centre scale used by applyCanvasFormatToGroup for this group.
 * Kept parallel to that engine deliberately; tests guard against math drift.
 */
export function getFormatScaleFactor(
  group: SlideGroup,
  format: CanvasFormatId,
  baseFormat: CanvasFormatId,
  customFormats?: CustomCanvasFormat[],
): number {
  if (format === baseFormat) return 1
  const target = getFormatCanvasDims(group, format, baseFormat, customFormats)
  return fitCenterScale(group.slideWidth, group.slideHeight, target.width, target.height)
}

/** Build base-to-format scale factors before applyCanvasFormat replaces group dimensions. */
export function buildFormatScaleMap(
  project: Project,
  format: CanvasFormatId,
  baseFormat: CanvasFormatId,
): ReadonlyMap<string, number> {
  return new Map(project.slideGroups.map((group) => [
    group.id,
    getFormatScaleFactor(group, format, baseFormat, project.settings.customFormats),
  ]))
}

/**
 * Scale a layer using a uniform factor `s` anchored to the canvas centre.
 *
 * `anchor` controls how x/y are treated:
 *  - 'canvas'  (default): x/y are absolute canvas coordinates → apply the
 *    letterbox translation so the visual centre of the canvas stays centred.
 *  - 'origin': x/y are relative to a parent (group children) → pure multiply,
 *    no translation.
 *
 * width/height scale by `s` uniformly; fontSize and scale (phone) also use `s`.
 */
function scaleLayer(
  layer: Layer,
  fromW: number,
  fromH: number,
  toW: number,
  toH: number,
  s?: number,
  anchor: 'canvas' | 'origin' = 'canvas',
): Layer {
  const factor = s ?? fitCenterScale(fromW, fromH, toW, toH)

  let newX: number
  let newY: number
  if (anchor === 'canvas') {
    // Anchor to canvas centre: translate so the midpoint maps to the new midpoint.
    newX = toW / 2 + (layer.x - fromW / 2) * factor
    newY = toH / 2 + (layer.y - fromH / 2) * factor
  } else {
    // Relative coordinates (group children): pure scale from origin.
    newX = layer.x * factor
    newY = layer.y * factor
  }

  const scaled = { ...layer, x: newX, y: newY } as Layer

  const l = scaled as Layer & { width?: number; height?: number; fontSize?: number; scale?: number }
  if (typeof l.width === 'number') l.width *= factor
  if (typeof l.height === 'number') l.height *= factor
  if (typeof l.fontSize === 'number') l.fontSize *= factor
  if (typeof l.scale === 'number' && scaled.type !== 'group') l.scale *= factor

  if (scaled.type === 'group') {
    const group = scaled as GroupLayer
    // Group children use 'origin' anchor — their x/y are relative to the group.
    return {
      ...group,
      children: group.children.map((child) =>
        scaleLayer(child, fromW, fromH, toW, toH, factor, 'origin'),
      ),
    }
  }

  return scaled
}

/**
 * Bake the same fit-centre projection used by format resolution into a layer.
 * Callers that fork an independently authored group use this once; normal
 * resolution continues to use the private `scaleLayer` path above.
 */
export function scaleLayerToCanvas<T extends Layer>(
  layer: T,
  fromW: number,
  fromH: number,
  toW: number,
  toH: number,
  scaleFactor?: number,
): T {
  return scaleLayer(layer, fromW, fromH, toW, toH, scaleFactor) as T
}

/**
 * Resolve a single layer for a format view.
 * - Filters out layers hidden in this format.
 * - Base format: layers pass through untouched (authoring space).
 * - Other formats: auto-scale from the group's authoring dims, then apply the
 *   format's stored layout overrides on top.
 */
export function resolveLayerFormat(
  layer: Layer,
  format: CanvasFormatId,
  isBase: boolean,
  fromW: number,
  fromH: number,
  toW: number,
  toH: number,
  customFormats?: CustomCanvasFormat[],
  anchor: 'canvas' | 'origin' = 'canvas',
): Layer | null {
  // If layer is owned by a specific format, only show it in that format
  if (layer.ownerFormat !== undefined && layer.ownerFormat !== format) return null

  if (layer.formatVisibility?.[format] === false) return null

  let resolved: Layer
  if (isBase) {
    resolved = layer
  } else {
    // Phone model auto-swap: if the target format's platform differs from the
    // model's native platform and there is no explicit model override, swap the
    // model to the equivalent device for the target platform.
    let effectiveLayer: Layer = layer
    if (layer.type === 'phone') {
      const targetPlatform = getFormatPlatform(format)
      const phoneLayer = layer as PhoneLayer
      if (targetPlatform !== null && (layer.formatOverrides?.[format] as Record<string, unknown> | undefined)?.model === undefined) {
        const swappedModel = getModelForPlatform(phoneLayer.model, targetPlatform)
        if (swappedModel !== phoneLayer.model) {
          effectiveLayer = { ...layer, model: swappedModel } as Layer
        }
      }
    }
    const scaled = scaleLayer(effectiveLayer, fromW, fromH, toW, toH, undefined, anchor)
    const patch = layer.formatOverrides?.[format]
    resolved = patch ? ({ ...scaled, ...patch, id: layer.id, type: layer.type } as Layer) : scaled
  }

  if (resolved.type === 'group') {
    const original = layer as GroupLayer
    return {
      ...(resolved as GroupLayer),
      children: original.children
        .map((child) => resolveLayerFormat(child, format, isBase, fromW, fromH, toW, toH, customFormats, 'origin'))
        .filter((child): child is Layer => Boolean(child)),
    }
  }

  return resolved
}

export function applyCanvasFormatToGroup(
  group: SlideGroup,
  format: CanvasFormatId,
  baseFormat: CanvasFormatId,
  customFormats?: CustomCanvasFormat[],
): SlideGroup {
  const isBase = format === baseFormat
  const target = getFormatCanvasDims(group, format, baseFormat, customFormats)
  // For pano groups (numSlides > 1) the authoring canvas is slideWidth × numSlides wide.
  // Pass the full pano width as fromW/toW so scaleLayer anchors to the true canvas
  // centre instead of the single-slide centre — otherwise slide 2+ layers are
  // projected outside the per-slide capture window and export as blank.
  const n = group.numSlides ?? 1
  const fromW = group.slideWidth * n
  const toW = target.width * n
  return {
    ...group,
    slideWidth: target.width,
    slideHeight: target.height,
    layers: group.layers
      .map((layer) => resolveLayerFormat(layer, format, isBase, fromW, group.slideHeight, toW, target.height, customFormats))
      .filter((layer): layer is Layer => Boolean(layer)),
  }
}

/** Project-wide format projection. Used by canvas render, panels, and exports. */
export function applyCanvasFormat(project: Project, format: CanvasFormatId): Project {
  const baseFormat = getProjectBaseFormat(project)
  return {
    ...project,
    slideGroups: project.slideGroups.map((group) =>
      applyCanvasFormatToGroup(group, format, baseFormat, project.settings.customFormats),
    ),
  }
}

/**
 * Apply one per-key `LayoutDelta` to an already format-resolved layer.
 * Shared math for the `localeAdjust` model — NOT legacy despite the deltas
 * it was originally built for: `applyLocaleAdjust` calls this TWICE (once at
 * the group's format scale factor `f` for the base-scoped cell, once at
 * factor `1` for the format-scoped cell, since that one is already authored
 * in format-space). Additive keys (x/y) are scaled by `f`; rotation is not;
 * multiplicative keys (width/height/fontSize/scale) multiply the
 * already-resolved value directly and are never scaled by `f` themselves.
 */
export function applyLayoutDelta(layer: Layer, delta: LayoutDelta | undefined, f: number): Layer {
  if (!delta) return layer
  const next = { ...layer } as Layer & Record<string, unknown>
  const add = (property: 'x' | 'y' | 'rotation', deltaKey: 'dx' | 'dy' | 'dRotation') => {
    const value = delta[deltaKey]
    if (typeof value === 'number' && typeof layer[property] === 'number') {
      next[property] = layer[property] + value * (property === 'rotation' ? 1 : f)
    }
  }
  add('x', LOCALE_DELTA_FIELDS.x)
  add('y', LOCALE_DELTA_FIELDS.y)
  add('rotation', LOCALE_DELTA_FIELDS.rotation)

  const multiply = (property: 'width' | 'height' | 'fontSize' | 'scale', multiplier: number | undefined) => {
    const value = next[property]
    if (typeof multiplier === 'number' && typeof value === 'number' && value !== 0) {
      next[property] = value * multiplier
    }
  }
  multiply('width', delta[LOCALE_DELTA_FIELDS.width])
  multiply('height', delta[LOCALE_DELTA_FIELDS.height])
  multiply('fontSize', delta[LOCALE_DELTA_FIELDS.fontSize])
  if (layer.type !== 'group') multiply('scale', delta[LOCALE_DELTA_FIELDS.scale])
  return next as Layer
}

/**
 * P1 of the 3-tier `localeAdjust` unification. Merges a layer's per-locale
 * adjustment deltas onto an already format-resolved layer, per the deepwork
 * spec's composition precedence:
 *
 *   base (authored) -> auto-scaled per format -> formatOverrides[F] (pinned)
 *     -> + localeAdjust[L][BASE] * f   (composes, every format)
 *       -> + localeAdjust[L][F] * 1    (composes, this format only, format-space)
 *
 * Both cells COMPOSE — there is no "wins"/shadowing here. Reuses
 * `applyLayoutDelta` for the actual per-key math (same additive/
 * multiplicative rules), called twice: once with the group's format scale
 * factor for the base-scoped cell, once with factor 1 for the format-scoped
 * cell (already authored in format space).
 */
export function applyLocaleAdjust(layer: Layer, locale: string, format: CanvasFormatId, f: number): Layer {
  const baseScoped = layer.localeAdjust?.[locale]?.[BASE_CANVAS_FORMAT]
  // `localeAdjust[locale][BASE_CANVAS_FORMAT]` and `localeAdjust[locale][format]`
  // are the LITERAL SAME map cell when format === BASE_CANVAS_FORMAT — guard so
  // the base-scoped cell is never composed twice at the base format view.
  const formatScoped = format === BASE_CANVAS_FORMAT ? undefined : layer.localeAdjust?.[locale]?.[format]
  const withBaseScoped = applyLayoutDelta(layer, baseScoped, f)
  return applyLayoutDelta(withBaseScoped, formatScoped, 1)
}

/** Group-scoped `localeAdjust` resolver, mirroring `applyCanvasFormatToGroup`. */
export function applyLocaleAdjustToGroup(
  group: SlideGroup,
  locale: string,
  format: CanvasFormatId,
  defaultLocale: string,
  scaleFactor: number,
): SlideGroup {
  if (locale === defaultLocale) return group
  // Mirror the same base/format collapse guard as applyLocaleAdjust: at the
  // base format, localeAdjust[locale][format] IS localeAdjust[locale][BASE],
  // so only probe it separately when format is a distinct, non-base cell.
  const checkFormatScoped = format !== BASE_CANVAS_FORMAT
  let hasApplicableAdjust = false
  forEachLayerTree(group.layers, (layer) => {
    if (layer.localeAdjust?.[locale]?.[BASE_CANVAS_FORMAT] || (checkFormatScoped && layer.localeAdjust?.[locale]?.[format])) {
      hasApplicableAdjust = true
    }
  })
  if (!hasApplicableAdjust) return group
  return {
    ...group,
    layers: mapLayerTree(group.layers, (layer) => applyLocaleAdjust(layer, locale, format, scaleFactor)),
  }
}

/** Project-wide `localeAdjust` projection. Mirrors `applyCanvasFormat`. */
export function applyLocaleAdjustProject(
  project: Project,
  locale: string,
  format: CanvasFormatId,
  scaleByGroupId: ReadonlyMap<string, number>,
): Project {
  if (locale === project.settings.defaultLocale) return project
  const slideGroups = project.slideGroups.map((group) => applyLocaleAdjustToGroup(
    group,
    locale,
    format,
    project.settings.defaultLocale,
    scaleByGroupId.get(group.id) ?? 1,
  ))
  if (slideGroups.every((group, index) => group === project.slideGroups[index])) return project
  return {
    ...project,
    slideGroups,
  }
}

/**
 * Resolve a single layer's value for (locale, format), including the
 * base-scoped `localeAdjust[locale][BASE]` cell but EXCLUDING the
 * format-scoped `localeAdjust[locale][format]` cell. Used by the migration
 * to compute `R` (the "resolved value before this cell") when deriving a
 * delta from a legacy absolute `localeLayoutOverrides` cell, and by the
 * write path to pre-resolve the format-scoped write's anchor — reuses the
 * real render path instead of hand-rolling the scale/override arithmetic a
 * second time.
 */
export function resolveLayerLocaleAdjustBaseOnly(
  group: SlideGroup,
  layerId: string,
  locale: string,
  format: CanvasFormatId,
  baseFormat: CanvasFormatId,
  customFormats?: CustomCanvasFormat[],
): Layer | undefined {
  const scaleFactor = getFormatScaleFactor(group, format, baseFormat, customFormats)
  const formatResolvedGroup = applyCanvasFormatToGroup(group, format, baseFormat, customFormats)
  const resolvedLayer = findLayerInTree(formatResolvedGroup.layers, layerId)
  if (!resolvedLayer) return undefined
  const originalLayer = findLayerInTree(group.layers, layerId)
  const baseScoped = originalLayer?.localeAdjust?.[locale]?.[BASE_CANVAS_FORMAT]
  return applyLayoutDelta(resolvedLayer, baseScoped, scaleFactor)
}

/**
 * Resolve content, format projection, then locale/format layout in precedence order.
 *
 * Reads the `localeAdjust` tier exclusively via `applyLocaleAdjustProject`.
 * The legacy 4-tier engine (`localeBaseDelta`/`localeLayoutOverrides`) was
 * fully retired in P4 (fields deleted, functions deleted) — do not re-add a
 * second read pass here: composing two read paths over the same data would
 * double-count every delta (see git history / deepwork doc for the P1
 * double-apply investigation this guarded against before the read-path
 * flip).
 */
export function resolveProjectView(project: Project, locale: string, format: CanvasFormatId): Project {
  const baseFormat = getProjectBaseFormat(project)
  const scaleByGroupId = buildFormatScaleMap(project, format, baseFormat)
  return applyLocaleAdjustProject(
    applyCanvasFormat(applyLocale(project, locale), format),
    locale,
    format,
    scaleByGroupId,
  )
}

/**
 * Map a layer expressed in a format's coordinate space back into the group's
 * authoring (base) space. Used when adding layers while previewing a non-base
 * format, and when promoting a format adjustment to the shared base.
 *
 * Uses the exact reciprocal of the forward fit-center scale factor so that
 * base → format → base is a lossless round-trip.
 */
export function mapLayerToAuthoringSpace<T extends Layer>(
  layer: T,
  activeFormat: CanvasFormatId,
  baseFormat: CanvasFormatId,
  groupW: number,
  groupH: number,
  customFormats?: CustomCanvasFormat[],
  anchor: 'canvas' | 'origin' = 'canvas',
): T {
  if (activeFormat === baseFormat) return layer
  const active = getCanvasFormat(activeFormat, customFormats)
  // Forward factor: s_fwd = min(active.width/groupW, active.height/groupH)
  // Inverse factor: 1/s_fwd — do NOT recompute min() in the reverse direction.
  const sFwd = fitCenterScale(groupW, groupH, active.width, active.height)
  const sInv = 1 / sFwd
  return scaleLayer(layer, active.width, active.height, groupW, groupH, sInv, anchor) as T
}

function withoutFormatOverride(layer: Layer, format: CanvasFormatId): Layer {
  if (!layer.formatOverrides?.[format]) return layer
  const { [format]: _removed, ...rest } = layer.formatOverrides
  void _removed
  return { ...layer, formatOverrides: Object.keys(rest).length ? rest : undefined } as Layer
}

function withoutFormatVisibility(layer: Layer, format: CanvasFormatId): Layer {
  if (layer.formatVisibility?.[format] === undefined) return layer
  const { [format]: _removed, ...rest } = layer.formatVisibility
  void _removed
  return { ...layer, formatVisibility: Object.keys(rest).length ? rest : undefined } as Layer
}

/** Remove every layout/model override for a format in one slide group. */
export function resetFormatOverridesInLayerTree(layers: Layer[], format: CanvasFormatId): Layer[] {
  return mapLayerTree(layers, (layer) => withoutFormatOverride(layer, format))
}

/** Remove every explicit visibility entry for a format in one slide group. */
export function resetFormatVisibilityInLayerTree(layers: Layer[], format: CanvasFormatId): Layer[] {
  return mapLayerTree(layers, (layer) => withoutFormatVisibility(layer, format))
}

/**
 * Promote all per-format override keys in a slide group back to the shared
 * authoring layer, then remove those overrides. Content remains shared by
 * design; this only consumes values already present in formatOverrides.
 */
export function promoteFormatOverridesToSharedInLayerTree(
  layers: Layer[],
  format: CanvasFormatId,
  baseFormat: CanvasFormatId,
  groupW: number,
  groupH: number,
  customFormats?: CustomCanvasFormat[],
): Layer[] {
  if (format === baseFormat) return layers

  const childIds = new Set<string>()
  forEachLayerTree(layers, (layer) => {
    if (layer.type === 'group') layer.children.forEach((child) => childIds.add(child.id))
  })

  return mapLayerTree(layers, (layer) => {
    const patch = layer.formatOverrides?.[format]
    if (!patch) return layer

    // Override values are stored in the target format's coordinate space.
    // Map a temporary layer back to authoring space, then copy only the keys
    // that were actually overridden. Group children may be scaled in the temp
    // value, but they are intentionally not copied unless they are patch keys.
    const inTargetSpace = { ...layer, ...patch, id: layer.id, type: layer.type } as Layer
    const mapped = mapLayerToAuthoringSpace(
      inTargetSpace,
      format,
      baseFormat,
      groupW,
      groupH,
      customFormats,
      childIds.has(layer.id) ? 'origin' : 'canvas',
    ) as unknown as Record<string, unknown>
    const sharedPatch: Record<string, unknown> = {}
    for (const key of Object.keys(patch)) sharedPatch[key] = mapped[key]

    return withoutFormatOverride({ ...layer, ...sharedPatch } as Layer, format)
  })
}

/**
 * Convert all layers owned by `format` into shared layers for the active slide.
 * Owned subtrees are mapped back to authoring coordinates as a whole so their
 * appearance in the source platform stays as close as possible after sharing.
 */
export function makeOwnedFormatLayersSharedInLayerTree(
  layers: Layer[],
  format: CanvasFormatId,
  baseFormat: CanvasFormatId,
  groupW: number,
  groupH: number,
  customFormats?: CustomCanvasFormat[],
): Layer[] {
  function makeShared(layer: Layer, anchor: 'canvas' | 'origin'): Layer {
    const mapped = format === baseFormat
      ? layer
      : mapLayerToAuthoringSpace(layer, format, baseFormat, groupW, groupH, customFormats, anchor)
    return withoutFormatVisibility({ ...mapped, ownerFormat: undefined } as Layer, format)
  }

  function visit(layer: Layer, anchor: 'canvas' | 'origin' = 'canvas'): Layer {
    if (layer.ownerFormat === format) return makeShared(layer, anchor)
    if (layer.type === 'group') {
      return { ...layer, children: (layer as GroupLayer).children.map((child) => visit(child, 'origin')) } as Layer
    }
    return layer
  }

  return layers.map((layer) => visit(layer))
}

/**
 * Count how many layers (including group children) in a slide group have
 * format-specific customisations for the given format:
 * - at least one key in `formatOverrides[format]`, OR
 * - an explicit `formatVisibility[format]` entry.
 */
export function countFormatAdjustments(
  group: SlideGroup,
  format: CanvasFormatId,
  baseFormat: CanvasFormatId,
): number {
  if (format === baseFormat) return 0

  function countLayer(layer: Layer): number {
    let count = 0
    const overrides = layer.formatOverrides?.[format]
    const hasOverrides = overrides !== undefined && Object.keys(overrides).length > 0
    const hasVisibility = layer.formatVisibility?.[format] !== undefined
    const isOwned = layer.ownerFormat === format
    if (hasOverrides || hasVisibility || isOwned) count++
    if (layer.type === 'group') {
      for (const child of (layer as GroupLayer).children) {
        count += countLayer(child)
      }
    }
    return count
  }

  return group.layers.reduce((sum, layer) => sum + countLayer(layer), 0)
}

/**
 * Unified `localeAdjust[locale][scope]` counter — `scope` is
 * `BASE_CANVAS_FORMAT` for the base-scoped count or an active (non-base)
 * format id for the format-scoped count. Both scopes read through this same
 * code path, closing the old "no indicator on a non-base tab for a
 * base-scoped-only adjustment" visibility gap for any caller that queries
 * the base scope regardless of the active tab.
 */
export function countLocaleAdjustments(group: SlideGroup, locale: string, scope: CanvasFormatId): number {
  let count = 0
  mapLayerTree(group.layers, (layer) => {
    const delta = layer.localeAdjust?.[locale]?.[scope]
    if (delta && Object.keys(delta).length > 0) count++
    return layer
  })
  return count
}
