/**
 * locale.ts — Localization utilities for PixelDeck
 *
 * The core primitive is applyLocale(project, locale) → Project.
 * It deep-walks all layers and merges localeOverrides[locale] into each layer.
 * The original project is never mutated.
 *
 * Supporting utilities:
 *   getLocalizableLayers  — enumerate all layers that have localizable content
 *   buildLocaleManifest   — export the project's locale data as a portable JSON manifest
 *   applyLocaleManifest   — import a locale manifest back into a project
 */

import type {
  Project, Layer, GroupLayer, SlideGroup,
  LocaleLayerPatch, TextLayer, PhoneLayer, ImageLayer, TextMark, TextSpan,
} from '@/types'

// ─── Core resolver ────────────────────────────────────────────────────────────

/**
 * Convert legacy TextSpan[] in a locale patch to TextMark[] (pure, no browser APIs).
 * The mark offsets are computed over the concatenated span texts.
 */
function migrateSpansInPatch(patch: LocaleLayerPatch): LocaleLayerPatch {
  if (!patch.spans?.length || patch.marks?.length) return patch
  const spans = patch.spans as TextSpan[]
  let offset = 0
  const marks: TextMark[] = []
  const textParts: string[] = []
  for (const span of spans) {
    textParts.push(span.text)
    const end = offset + span.text.length
    const hasStyle =
      span.fill !== undefined || span.fontWeight !== undefined ||
      span.italic !== undefined || span.underline !== undefined ||
      span.strikethrough !== undefined
    if (hasStyle) {
      marks.push({ start: offset, end, fill: span.fill, fontWeight: span.fontWeight,
        italic: span.italic, underline: span.underline, strikethrough: span.strikethrough })
    }
    offset = end
  }
  const migratedText = patch.text ?? textParts.join('')
  return {
    ...patch,
    text: migratedText,
    marks: marks.length ? marks : undefined,
    spans: undefined,
  }
}

/** Merge localeOverrides[locale] into a single layer (non-mutating, shallow merge). */
export function resolveLayerLocale<T extends Layer>(layer: T, locale: string): T {
  if (!layer.localeOverrides) return layer
  const rawPatch = layer.localeOverrides[locale]
  if (!rawPatch) return layer
  // Migrate legacy spans in locale patch first
  const patch = rawPatch.spans?.length ? migrateSpansInPatch(rawPatch) : rawPatch
  const merged = { ...layer, ...patch } as T
  // When locale overrides text without providing its own marks, the base layer's
  // marks reference positions in the original text and would style the wrong
  // characters. Drop them so translated text renders without misplaced styling.
  if (patch.text !== undefined && patch.marks === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(merged as any).marks = undefined
  }
  return merged
}

/**
 * Walk an entire project and apply locale overrides to all layers.
 * Returns a new Project; the original is not mutated.
 *
 * Call this:
 *  - In ExportApp before mounting the canvas (CLI path).
 *  - In the editor when activeLocale changes (live preview).
 */
export function applyLocale(project: Project, locale: string): Project {
  if (locale === project.settings.defaultLocale) return project
  return {
    ...project,
    slideGroups: project.slideGroups.map((g) => applyLocaleToGroup(g, locale)),
  }
}

function applyLocaleToGroup(group: SlideGroup, locale: string): SlideGroup {
  return { ...group, layers: group.layers.map((l) => applyLocaleToLayer(l, locale)) }
}

function applyLocaleToLayer(layer: Layer, locale: string): Layer {
  const resolved = resolveLayerLocale(layer, locale)
  if (resolved.type === 'group') {
    return {
      ...resolved,
      children: (resolved as GroupLayer).children.map((c) => applyLocaleToLayer(c, locale)),
    }
  }
  return resolved
}

// ─── Localizable layer discovery ──────────────────────────────────────────────

export interface LocalizableLayerRef {
  slideGroupId: string
  slideGroupName: string
  layerId: string
  layerName: string
  layerType: 'text' | 'phone' | 'image'
  /** Human-readable CLI reference: "{slideGroupName}/{layerName}" */
  ref: string
  /** Default (base-locale) text content — TextLayer only */
  defaultText?: string
  /** Default (base-locale) image reference — PhoneLayer.screenshotPath or ImageLayer.src */
  defaultImageRef?: string
}

/** Extract every layer with localizable content from the project, including inside groups. */
export function getLocalizableLayers(project: Project): LocalizableLayerRef[] {
  const result: LocalizableLayerRef[] = []
  for (const group of project.slideGroups) {
    collectFromLayers(group.layers, group.id, group.name, result)
  }
  return result
}

function collectFromLayers(
  layers: Layer[],
  groupId: string,
  groupName: string,
  result: LocalizableLayerRef[],
): void {
  for (const layer of layers) {
    if (layer.type === 'group') {
      collectFromLayers((layer as GroupLayer).children, groupId, groupName, result)
    } else if (layer.type === 'text' || layer.type === 'phone' || layer.type === 'image') {
      result.push({
        slideGroupId: groupId,
        slideGroupName: groupName,
        layerId: layer.id,
        layerName: layer.name,
        layerType: layer.type,
        ref: `${groupName}/${layer.name}`,
        defaultText: layer.type === 'text' ? (layer as TextLayer).text : undefined,
        defaultImageRef:
          layer.type === 'phone'
            ? (layer as PhoneLayer).screenshotPath ?? (layer as PhoneLayer).screenshotDataUrl
            : layer.type === 'image'
              ? (layer as ImageLayer).src
              : undefined,
      })
    }
  }
}

// ─── Locale manifest (CLI round-trip) ────────────────────────────────────────
//
// The manifest is a portable JSON document that lists every localizable layer
// and its per-locale overrides.  It can be exported (buildLocaleManifest),
// hand-edited or auto-translated by an external tool, then imported back
// (applyLocaleManifest) without touching the main project file.

export interface LocaleManifestEntry {
  /** Human-readable CLI ref: "{slideGroupName}/{layerName}" */
  ref: string
  /** Layer nanoid — used for precise round-trip matching */
  id: string
  name: string
  type: 'text' | 'phone' | 'image'
  /** Default (base-locale) values */
  default: LocaleLayerPatch
  /** Per-locale overrides; null means "not yet translated" */
  overrides: Record<string, LocaleLayerPatch | null>
}

export interface LocaleManifestGroup {
  name: string
  id: string
  layers: LocaleManifestEntry[]
}

export interface LocaleManifest {
  project: string
  defaultLocale: string
  locales: string[]
  groups: LocaleManifestGroup[]
}

/** Build a locale manifest from a project — used by `cli locale-manifest`. */
export function buildLocaleManifest(project: Project): LocaleManifest {
  const { defaultLocale, locales = [defaultLocale] } = project.settings
  const nonDefaultLocales = locales.filter((l) => l !== defaultLocale)

  const groups: LocaleManifestGroup[] = project.slideGroups.map((group) => {
    const layers: LocaleManifestEntry[] = []
    collectManifestEntries(group.layers, group.name, nonDefaultLocales, layers)
    return { name: group.name, id: group.id, layers }
  })

  return { project: project.name, defaultLocale, locales, groups }
}

function collectManifestEntries(
  layers: Layer[],
  groupName: string,
  locales: string[],
  result: LocaleManifestEntry[],
): void {
  for (const layer of layers) {
    if (layer.type === 'group') {
      collectManifestEntries((layer as GroupLayer).children, groupName, locales, result)
      continue
    }
    if (layer.type !== 'text' && layer.type !== 'phone' && layer.type !== 'image') continue

    const defaultPatch: LocaleLayerPatch =
      layer.type === 'text'
        ? {
            text: (layer as TextLayer).text,
            ...((layer as TextLayer).marks ? { marks: (layer as TextLayer).marks } : {}),
          }
        : layer.type === 'phone'
          ? { screenshotPath: (layer as PhoneLayer).screenshotPath }
          : { src: (layer as ImageLayer).src }

    const overrides: Record<string, LocaleLayerPatch | null> = {}
    for (const locale of locales) {
      overrides[locale] = layer.localeOverrides?.[locale] ?? null
    }

    result.push({
      ref: `${groupName}/${layer.name}`,
      id: layer.id,
      name: layer.name,
      type: layer.type,
      default: defaultPatch,
      overrides,
    })
  }
}

/** Apply a locale manifest back into a project — used by `cli locale-import`. */
export function applyLocaleManifest(project: Project, manifest: LocaleManifest): Project {
  // Build a flat id → localeOverrides map from manifest entries
  const overrideMap = new Map<string, Record<string, LocaleLayerPatch>>()
  for (const group of manifest.groups) {
    for (const entry of group.layers) {
      const localeOverrides: Record<string, LocaleLayerPatch> = {}
      for (const [locale, patch] of Object.entries(entry.overrides)) {
        if (patch !== null) localeOverrides[locale] = patch
      }
      if (Object.keys(localeOverrides).length > 0) {
        overrideMap.set(entry.id, localeOverrides)
      }
    }
  }

  function patchLayer(layer: Layer): Layer {
    const patched = overrideMap.has(layer.id)
      ? { ...layer, localeOverrides: overrideMap.get(layer.id) }
      : layer
    if (patched.type === 'group') {
      return {
        ...patched,
        children: (patched as GroupLayer).children.map(patchLayer),
      } as Layer
    }
    return patched
  }

  return {
    ...project,
    settings: {
      ...project.settings,
      locales: manifest.locales,
      defaultLocale: manifest.defaultLocale,
    },
    slideGroups: project.slideGroups.map((g) => ({
      ...g,
      layers: g.layers.map(patchLayer),
    })),
  }
}

// ─── Locale detection from filename ───────────────────────────────────────────

/**
 * Well-known locale codes for filename-based auto-detection.
 * Used by detectLocaleFromFilename to validate extracted suffixes.
 */
const KNOWN_LOCALES = new Set([
  'en', 'es', 'fr', 'de', 'it', 'pt', 'pt-br', 'nl', 'pl', 'ru', 'ja', 'ko',
  'zh', 'zh-hans', 'zh-hant', 'ar', 'tr', 'sv', 'da', 'fi', 'nb', 'cs', 'sk',
  'hu', 'ro', 'el', 'uk', 'ca', 'hr', 'bg', 'lt', 'lv', 'et', 'sl', 'sr', 'he',
  'th', 'vi', 'id', 'ms', 'en-us', 'en-gb', 'fr-fr', 'de-de', 'es-es', 'es-mx',
  'pt-pt', 'zh-tw', 'zh-cn',
])

/**
 * Attempts to detect a locale code from a filename suffix.
 *
 * Supported patterns (at end of basename, before extension):
 *   screenshot_es.png      → 'es'
 *   app-screen-fr.png      → 'fr'
 *   home_pt-BR.png         → 'pt-br'
 *   slide_zh-Hans.png      → 'zh-hans'
 *
 * Returns the normalised (lowercase, hyphen-separated) locale code,
 * or `null` if no recognised locale was found.
 */
export function detectLocaleFromFilename(filename: string): string | null {
  // Strip extension
  const base = filename.replace(/\.[^.]+$/, '')
  // Match suffix: _xx or -xx optionally followed by _XX or -XX for region/script
  const match = base.match(/[_-]([a-z]{2,3}(?:[_-][a-zA-Z]{2,4})?)$/i)
  if (!match) return null
  // Normalise: lowercase, underscores to hyphens
  const code = match[1].toLowerCase().replace('_', '-')
  return KNOWN_LOCALES.has(code) ? code : null
}
