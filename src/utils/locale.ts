/**
 * locale.ts — Localization utilities for PixelDeck
 *
 * The core primitive is applyLocale(project, locale) → Project.
 * It deep-walks all layers and merges localeContent[locale] into each layer.
 * The original project is never mutated.
 *
 * Supporting utilities:
 *   getLocalizableLayers  — enumerate all layers that have localizable content
 *   buildLocaleManifest   — export the project's locale data as a portable JSON manifest
 *   applyLocaleManifest   — import a locale manifest back into a project
 */

import type {
  Project, Layer, GroupLayer,
  LocaleContent, LocaleLayerPatch, LocalizationMode,
} from '@/types'
import { mapLayerTree } from '@/utils/layerTree'

// ─── Core resolver ────────────────────────────────────────────────────────────

function mergeLocaleContentIntoLayer<T extends Layer>(
  layer: T,
  patch: LocaleContent | LocaleLayerPatch,
): T {
  const merged = { ...layer, ...patch } as T
  if (patch.text !== undefined && patch.marks === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(merged as any).marks = undefined
  }
  return merged
}

/** Merge localeContent[locale] into a single layer (non-mutating, shallow merge). */
export function resolveLayerLocale<T extends Layer>(layer: T, locale: string): T {
  const content = layer.localeContent?.[locale]
  if (!content) return layer
  return mergeLocaleContentIntoLayer(layer, content)
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
    slideGroups: project.slideGroups.map((g) => ({
      ...g,
      layers: mapLayerTree(g.layers, (layer) => resolveLayerLocale(layer, locale)),
    })),
  }
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
    collectFromLayers(group.layers, group.id, group.name, project.settings.defaultLocale, result)
  }
  return result
}

/**
 * Resolve a layer's effective localization mode.
 * Text layers default to 'auto'. Image/phone layers can never be 'auto'
 * (no AI image pipeline yet) — they are capped at 'manual'.
 */
export function effectiveLocalizationMode(layer: Layer): LocalizationMode {
  const explicit = layer.localizationMode
  if (layer.type === 'image' || layer.type === 'phone') {
    return explicit === 'skip' ? 'skip' : 'manual'
  }
  return explicit ?? 'auto'
}

/** Whether locale content has the meaningful value required by its layer type. */
export function isLocaleContentComplete(layer: Layer, content: LocaleContent | undefined): boolean {
  if (!content) return false
  if (layer.type === 'text') return typeof content.text === 'string' && content.text.trim().length > 0
  if (layer.type === 'phone') return Boolean(content.screenshotPath?.trim() || content.screenshotDataUrl)
  if (layer.type === 'image') return Boolean(content.src?.trim())
  return false
}

function collectFromLayers(
  layers: Layer[],
  groupId: string,
  groupName: string,
  defaultLocale: string,
  result: LocalizableLayerRef[],
): void {
  for (const layer of layers) {
    if (layer.type === 'group') {
      collectFromLayers((layer as GroupLayer).children, groupId, groupName, defaultLocale, result)
    } else if (layer.type === 'text' || layer.type === 'phone' || layer.type === 'image') {
      result.push({
        slideGroupId: groupId,
        slideGroupName: groupName,
        layerId: layer.id,
        layerName: layer.name,
        layerType: layer.type,
        ref: `${groupName}/${layer.name}`,
        defaultText: layer.type === 'text' ? layer.localeContent?.[defaultLocale]?.text : undefined,
        defaultImageRef: layer.type === 'phone'
          ? layer.localeContent?.[defaultLocale]?.screenshotPath
          : layer.type === 'image'
            ? layer.localeContent?.[defaultLocale]?.src
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
  /** Effective localization mode — CLI must NOT translate 'skip' layers. */
  mode: LocalizationMode
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
    collectManifestEntries(group.layers, group.name, nonDefaultLocales, defaultLocale, layers)
    return { name: group.name, id: group.id, layers }
  })

  return { project: project.name, defaultLocale, locales, groups }
}

function collectManifestEntries(
  layers: Layer[],
  groupName: string,
  locales: string[],
  defaultLocale: string,
  result: LocaleManifestEntry[],
): void {
  for (const layer of layers) {
    if (layer.type === 'group') {
      collectManifestEntries((layer as GroupLayer).children, groupName, locales, defaultLocale, result)
      continue
    }
    if (layer.type !== 'text' && layer.type !== 'phone' && layer.type !== 'image') continue

    const defaultContent = layer.localeContent?.[defaultLocale]
    const defaultPatch: LocaleLayerPatch =
      layer.type === 'text'
        ? {
            text: defaultContent?.text,
            ...(defaultContent?.marks ? { marks: defaultContent.marks } : {}),
          }
        : layer.type === 'phone'
          ? { screenshotPath: defaultContent?.screenshotPath }
          : { src: defaultContent?.src }

    const overrides: Record<string, LocaleLayerPatch | null> = {}
    for (const locale of locales) {
      overrides[locale] = layer.localeContent?.[locale] ?? null
    }

    result.push({
      ref: `${groupName}/${layer.name}`,
      id: layer.id,
      name: layer.name,
      type: layer.type,
      mode: effectiveLocalizationMode(layer),
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

  const patchLayer = (layer: Layer): Layer => {
    const localeOverrides = overrideMap.get(layer.id)
    if (!localeOverrides) return layer
    const mergedLocaleContent = { ...(layer.localeContent ?? {}) }
    for (const [locale, patch] of Object.entries(localeOverrides)) {
      mergedLocaleContent[locale] = patch as LocaleContent
    }
    return { ...layer, localeContent: mergedLocaleContent }
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
      layers: mapLayerTree(g.layers, patchLayer),
    })),
  }
}

// ─── Locale detection from filename ───────────────────────────────────────────

export interface LanguageOption {
  code: string;   // normalized, lowercase, hyphenated: 'pt-br'
  name: string;   // human-readable: 'Portuguese (Brazil)'
}

/** Full list of supported languages for the locale combobox. */
export const LANGUAGES: LanguageOption[] = [
  { code: 'en',      name: 'English' },
  { code: 'en-us',   name: 'English (US)' },
  { code: 'en-gb',   name: 'English (UK)' },
  { code: 'es',      name: 'Spanish' },
  { code: 'es-es',   name: 'Spanish (Spain)' },
  { code: 'es-mx',   name: 'Spanish (Mexico)' },
  { code: 'fr',      name: 'French' },
  { code: 'fr-fr',   name: 'French (France)' },
  { code: 'de',      name: 'German' },
  { code: 'de-de',   name: 'German (Germany)' },
  { code: 'it',      name: 'Italian' },
  { code: 'pt',      name: 'Portuguese' },
  { code: 'pt-br',   name: 'Portuguese (Brazil)' },
  { code: 'pt-pt',   name: 'Portuguese (Portugal)' },
  { code: 'nl',      name: 'Dutch' },
  { code: 'pl',      name: 'Polish' },
  { code: 'ru',      name: 'Russian' },
  { code: 'ja',      name: 'Japanese' },
  { code: 'ko',      name: 'Korean' },
  { code: 'zh',      name: 'Chinese' },
  { code: 'zh-hans', name: 'Chinese (Simplified)' },
  { code: 'zh-hant', name: 'Chinese (Traditional)' },
  { code: 'zh-cn',   name: 'Chinese (China)' },
  { code: 'zh-tw',   name: 'Chinese (Taiwan)' },
  { code: 'ar',      name: 'Arabic' },
  { code: 'tr',      name: 'Turkish' },
  { code: 'sv',      name: 'Swedish' },
  { code: 'da',      name: 'Danish' },
  { code: 'fi',      name: 'Finnish' },
  { code: 'nb',      name: 'Norwegian (Bokmål)' },
  { code: 'cs',      name: 'Czech' },
  { code: 'sk',      name: 'Slovak' },
  { code: 'hu',      name: 'Hungarian' },
  { code: 'ro',      name: 'Romanian' },
  { code: 'el',      name: 'Greek' },
  { code: 'uk',      name: 'Ukrainian' },
  { code: 'ca',      name: 'Catalan' },
  { code: 'hr',      name: 'Croatian' },
  { code: 'bg',      name: 'Bulgarian' },
  { code: 'lt',      name: 'Lithuanian' },
  { code: 'lv',      name: 'Latvian' },
  { code: 'et',      name: 'Estonian' },
  { code: 'sl',      name: 'Slovenian' },
  { code: 'sr',      name: 'Serbian' },
  { code: 'he',      name: 'Hebrew' },
  { code: 'th',      name: 'Thai' },
  { code: 'vi',      name: 'Vietnamese' },
  { code: 'id',      name: 'Indonesian' },
  { code: 'ms',      name: 'Malay' },
]

/** Human-readable language name for a locale code (falls back to the uppercased code). */
export function getLanguageName(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.name ?? code.toUpperCase()
}

/** Derived set for filename-based locale detection. */
const KNOWN_LOCALE_CODES = new Set(LANGUAGES.map((l) => l.code))

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
  return KNOWN_LOCALE_CODES.has(code) ? code : null
}
