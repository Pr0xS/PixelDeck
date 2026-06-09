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
  LocaleLayerPatch, TextLayer, PhoneLayer, ImageLayer,
} from '@/types'

// ─── Core resolver ────────────────────────────────────────────────────────────

/** Merge localeOverrides[locale] into a single layer (non-mutating, shallow merge). */
export function resolveLayerLocale<T extends Layer>(layer: T, locale: string): T {
  if (!layer.localeOverrides) return layer
  const patch = layer.localeOverrides[locale]
  if (!patch) return layer
  return { ...layer, ...patch }
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
            ...((layer as TextLayer).spans ? { spans: (layer as TextLayer).spans } : {}),
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
