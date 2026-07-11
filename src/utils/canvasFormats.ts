import type {
  BuiltInFormatId,
  CanvasFormatId,
  CustomCanvasFormat,
  CustomFormatId,
  GroupLayer,
  Layer,
  PhoneLayer,
  Project,
  SlideGroup,
} from '@/types'
import { getModelForPlatform } from '@/assets/mockups/specs'

export const CANVAS_FORMAT_PRESETS = [
  { id: 'iphone-69', label: 'iPhone 6.9"', width: 1320, height: 2868 },
  { id: 'android-phone', label: 'Android Phone', width: 1080, height: 1920 },
  { id: 'ipad-13', label: 'iPad 13"', width: 2064, height: 2752 },
  { id: 'android-tablet', label: 'Android Tablet 10"', width: 1600, height: 2560 },
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
}

/** Layout keys + model — model forks per format (auto-swap + manual override). */
export const FORMAT_FORK_KEYS = [...FORMAT_LAYOUT_KEYS, 'model'] as const

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
  }
  return labels[id]
}

export function getProjectBaseFormat(project: Project): CanvasFormatId {
  void project
  return BASE_CANVAS_FORMAT
}

export function getProjectActiveFormats(project: Project): CanvasFormatId[] {
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

export function getExportTargets(project: Project): CanvasFormatId[] {
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
    const scaled = scaleLayer(effectiveLayer, fromW, fromH, toW, toH)
    const patch = layer.formatOverrides?.[format]
    resolved = patch ? ({ ...scaled, ...patch, id: layer.id, type: layer.type } as Layer) : scaled
  }

  if (resolved.type === 'group') {
    const original = layer as GroupLayer
    return {
      ...(resolved as GroupLayer),
      children: original.children
        .map((child) => resolveLayerFormat(child, format, isBase, fromW, fromH, toW, toH, customFormats))
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
): T {
  if (activeFormat === baseFormat) return layer
  const active = getCanvasFormat(activeFormat, customFormats)
  // Forward factor: s_fwd = min(active.width/groupW, active.height/groupH)
  // Inverse factor: 1/s_fwd — do NOT recompute min() in the reverse direction.
  const sFwd = fitCenterScale(groupW, groupH, active.width, active.height)
  const sInv = 1 / sFwd
  return scaleLayer(layer, active.width, active.height, groupW, groupH, sInv) as T
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

function mapLayerTree(layers: Layer[], fn: (layer: Layer) => Layer): Layer[] {
  return layers.map((layer) => {
    const withChildren = layer.type === 'group'
      ? ({ ...layer, children: mapLayerTree((layer as GroupLayer).children, fn) } as Layer)
      : layer
    return fn(withChildren)
  })
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
  function makeShared(layer: Layer): Layer {
    const mapped = format === baseFormat
      ? layer
      : mapLayerToAuthoringSpace(layer, format, baseFormat, groupW, groupH, customFormats)
    return withoutFormatVisibility({ ...mapped, ownerFormat: undefined } as Layer, format)
  }

  function visit(layer: Layer): Layer {
    if (layer.ownerFormat === format) return makeShared(layer)
    if (layer.type === 'group') {
      return { ...layer, children: (layer as GroupLayer).children.map(visit) } as Layer
    }
    return layer
  }

  return layers.map(visit)
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
