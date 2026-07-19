import type {
  Layer,
  LocaleContent,
  LocaleLayerPatch,
  LocaleOverrideBatchEntry,
  TextLayer,
  TextMark,
} from '@/types'
import type { EditorStore, EditorSet, EditorGet } from '../types'
import { mapLayerTree, touchProject, touchSettings, updateLayerInTree } from '../helpers'

/**
 * v0.6.0 default-locale promotion: `targetLocale` becomes the new default.
 * Because localeContent is already symmetric (every locale, including the
 * old default, is stored the same way — Phases 1-3), this is NOT a
 * bidirectional swap. It is:
 *  1. Capture the layer's CURRENT legacy base fields as the definitive
 *     snapshot for `oldDefault` (defense in depth — Phase 3 keeps
 *     localeContent[oldDefault] synced on every edit, but this guarantees
 *     correctness regardless of that invariant).
 *  2. Seed: use `targetLocale`'s existing localeContent entry if present and
 *     non-empty, else fall back to the oldDefault snapshot — so the new
 *     default never has holes. This is the one place a "swap-like" step
 *     survives from the original design: an incomplete promoted locale
 *     inherits the old default's content for whatever it's missing.
 *  3. Write the seeded target content into the LEGACY BASE FIELDS — this is
 *     required because applyLocale()'s fast path
 *     (`locale === defaultLocale → return project unchanged`) reads those
 *     fields directly and bypasses localeContent entirely for the default
 *     locale. Without this the canvas would keep showing the old default's
 *     content after promotion.
 *  4. Sync localeOverrides: the demoted oldDefault gets an entry (so
 *     anything still reading localeOverrides directly — PhoneProperties.tsx,
 *     the Localization page cells — sees it), and the promoted target's
 *     entry is removed (a default locale's content was never conventionally
 *     read from localeOverrides).
 * Only text/phone/image layers carry localizable content; everything else
 * passes through unchanged. Recursion into group children is handled by
 * wrapping this in mapLayerTree() at the call site.
 */
function promoteLayerToLocale(layer: Layer, targetLocale: string, oldDefault: string): Layer {
  if (layer.type !== 'text' && layer.type !== 'phone' && layer.type !== 'image') return layer

  const oldDefaultContent: LocaleContent =
    layer.type === 'text'
      ? { text: layer.text, ...(layer.marks?.length ? { marks: layer.marks } : {}) }
      : layer.type === 'phone'
        ? {
            ...(layer.screenshotPath !== undefined ? { screenshotPath: layer.screenshotPath } : {}),
            ...(layer.screenshotDataUrl !== undefined ? { screenshotDataUrl: layer.screenshotDataUrl } : {}),
          }
        : { src: layer.src }

  const existingLocaleContent = layer.localeContent ?? {}
  const existingTarget = existingLocaleContent[targetLocale]
  const targetContent: LocaleContent =
    existingTarget && Object.keys(existingTarget).length > 0 ? existingTarget : oldDefaultContent

  const localeContent = { ...existingLocaleContent, [targetLocale]: targetContent, [oldDefault]: oldDefaultContent }

  const localeOverrides = { ...(layer.localeOverrides ?? {}) }
  localeOverrides[oldDefault] = oldDefaultContent as LocaleLayerPatch
  delete localeOverrides[targetLocale]

  let patched = { ...layer, ...targetContent, localeContent } as Layer
  // Text marks must travel explicitly, even when undefined — otherwise a
  // translated text with no marks would keep the old default's stale marks
  // (they'd reference character offsets into text that no longer exists).
  // Mirrors the same rule in src/utils/locale.ts's mergeLocaleContentIntoLayer.
  if (layer.type === 'text') {
    (patched as TextLayer).marks = (targetContent as { marks?: TextMark[] }).marks
  }
  patched = {
    ...patched,
    localeOverrides: Object.keys(localeOverrides).length ? localeOverrides : undefined,
  } as Layer

  return patched
}

export const createLocaleSlice = (
  set: EditorSet,
  get: EditorGet,
): Pick<
  EditorStore,
  | 'setActiveLocale'
  | 'addLocale'
  | 'removeLocale'
  | 'relabelDefaultLocale'
  | 'promoteLocaleToDefault'
  | 'updateLayerInSlideGroup'
  | 'setLocaleOverride'
  | 'clearLocaleOverride'
  | 'setLocaleOverridesBatch'
> => ({
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
      project: touchSettings(s.project, { locales: [...existing, locale] }),
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
      const hasOverride = layer.localeOverrides?.[locale]
      const hasContent = layer.localeContent?.[locale]
      if (!hasOverride && !hasContent) return layer
      const { [locale]: _removedOverride, ...restOverrides } = layer.localeOverrides ?? {}
      void _removedOverride
      const { [locale]: _removedContent, ...restContent } = layer.localeContent ?? {}
      void _removedContent
      return {
        ...layer,
        localeOverrides: Object.keys(restOverrides).length > 0 ? restOverrides : undefined,
        localeContent: Object.keys(restContent).length > 0 ? restContent : undefined,
      }
    }

    set((s) => ({
      project: touchProject(s.project, {
        settings: { ...s.project.settings, locales: finalLocales },
        slideGroups: s.project.slideGroups.map((g) => ({
          ...g,
          layers: mapLayerTree(g.layers, stripLocale),
        })),
      }),
      activeLocale: activeLocale === locale ? project.settings.defaultLocale : activeLocale,
    }))
  },

  relabelDefaultLocale: (locale) => {
    const nextLocale = locale.trim().toLowerCase().replace('_', '-')
    if (!nextLocale) return
    const { project, activeLocale } = get()
    const oldDefault = project.settings.defaultLocale
    if (nextLocale === oldDefault) return

    const existing = project.settings.locales ?? [oldDefault]
    // Relabel only works for codes that don't already exist as a distinct
    // locale — promoting an existing translated locale is promoteLocaleToDefault's job.
    if (existing.some((l) => l !== oldDefault && l === nextLocale)) return

    const rest = existing.filter((l) => l !== oldDefault)
    const locales = [nextLocale, ...rest]
    function relabelLayer(layer: Layer): Layer {
      if (!layer.localeContent?.[oldDefault]) return layer
      const { [oldDefault]: content, ...restContent } = layer.localeContent
      return { ...layer, localeContent: { ...restContent, [nextLocale]: content } }
    }

    set((s) => ({
      project: touchProject(s.project, {
        settings: { ...s.project.settings, defaultLocale: nextLocale, locales },
        slideGroups: s.project.slideGroups.map((g) => ({ ...g, layers: mapLayerTree(g.layers, relabelLayer) })),
      }),
      activeLocale: activeLocale === oldDefault ? nextLocale : activeLocale,
    }))
  },

  promoteLocaleToDefault: (targetLocale) => {
    const { project, activeLocale } = get()
    const oldDefault = project.settings.defaultLocale
    if (targetLocale === oldDefault) return
    const existing = project.settings.locales ?? [oldDefault]
    if (!existing.includes(targetLocale)) return

    const rest = existing.filter((l) => l !== oldDefault && l !== targetLocale)
    const locales = [targetLocale, oldDefault, ...rest]

    set((s) => ({
      project: touchProject(s.project, {
        settings: { ...s.project.settings, defaultLocale: targetLocale, locales },
        slideGroups: s.project.slideGroups.map((g) => ({
          ...g,
          layers: mapLayerTree(g.layers, (l) => promoteLayerToLocale(l, targetLocale, oldDefault)),
        })),
      }),
      activeLocale: activeLocale === oldDefault ? targetLocale : activeLocale,
    }))
  },

  updateLayerInSlideGroup: (slideGroupId, layerId, patch) => {
    set((s) => ({
      project: touchProject(s.project, {
        slideGroups: s.project.slideGroups.map((g) => {
          if (g.id !== slideGroupId) return g
          return { ...g, layers: updateLayerInTree(g.layers, layerId, patch) }
        }),
      }),
    }))
  },

  setLocaleOverride: (slideGroupId, layerId, locale, patch) => {
    set((s) => ({
      project: touchProject(s.project, {
        slideGroups: s.project.slideGroups.map((g) => {
          if (g.id !== slideGroupId) return g
          return { ...g, layers: updateLayerInTree(g.layers, layerId, (layer) => {
            const { spans: _spans, ...contentPatch } = patch
            void _spans
            return {
              ...layer,
              localeOverrides: { ...(layer.localeOverrides ?? {}), [locale]: patch },
              localeContent: {
                ...(layer.localeContent ?? {}),
                [locale]: { ...(layer.localeContent?.[locale] ?? {}), ...contentPatch },
              },
            }
          }) }
        }),
      }),
    }))
  },

  clearLocaleOverride: (slideGroupId, layerId, locale) => {
    set((s) => ({
      project: touchProject(s.project, {
        slideGroups: s.project.slideGroups.map((g) => {
          if (g.id !== slideGroupId) return g
          return { ...g, layers: updateLayerInTree(g.layers, layerId, (layer) => {
            const next = { ...(layer.localeOverrides ?? {}) }
            delete next[locale]
            const nextContent = { ...(layer.localeContent ?? {}) }
            delete nextContent[locale]
            return {
              ...layer,
              localeOverrides: Object.keys(next).length > 0 ? next : undefined,
              localeContent: Object.keys(nextContent).length > 0 ? nextContent : undefined,
            }
          }) }
        }),
      }),
    }))
  },

  setLocaleOverridesBatch: (entries: LocaleOverrideBatchEntry[]) => {
    if (entries.length === 0) return
    const byGroup = new Map<string, Map<string, Map<string, LocaleLayerPatch>>>()
    for (const e of entries) {
      const layers = byGroup.get(e.slideGroupId) ?? new Map<string, Map<string, LocaleLayerPatch>>()
      const locales = layers.get(e.layerId) ?? new Map<string, LocaleLayerPatch>()
      locales.set(e.locale, e.patch)
      layers.set(e.layerId, locales)
      byGroup.set(e.slideGroupId, layers)
    }
    set((s) => ({
      project: touchProject(s.project, {
        slideGroups: s.project.slideGroups.map((g) => {
          const layerMap = byGroup.get(g.id)
          if (!layerMap) return g
          return {
            ...g,
            layers: mapLayerTree(g.layers, (layer) => {
              const localeMap = layerMap.get(layer.id)
              if (!localeMap) return layer
              let localeOverrides = { ...(layer.localeOverrides ?? {}) }
              let localeContent = { ...(layer.localeContent ?? {}) }
              for (const [locale, patch] of localeMap) {
                localeOverrides = { ...localeOverrides, [locale]: patch }
                const { spans: _spans, ...contentPatch } = patch
                void _spans
                localeContent = {
                  ...localeContent,
                  [locale]: { ...(localeContent[locale] ?? {}), ...contentPatch },
                }
              }
              return { ...layer, localeOverrides, localeContent }
            }),
          }
        }),
      }),
    }))
  },
})
