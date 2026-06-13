import type { Layer, GroupLayer, LocaleLayerPatch, LocaleOverrideBatchEntry } from '@/types'
import type { EditorStore, EditorSet, EditorGet } from '../types'
import { touchProject, touchSettings, patchLayerLocale, patchLayerBase } from '../helpers'

export const createLocaleSlice = (
  set: EditorSet,
  get: EditorGet,
): Pick<
  EditorStore,
  | 'setActiveLocale'
  | 'addLocale'
  | 'removeLocale'
  | 'renameDefaultLocale'
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
      project: touchProject(s.project, {
        settings: { ...s.project.settings, locales: finalLocales },
        slideGroups: s.project.slideGroups.map((g) => ({
          ...g,
          layers: g.layers.map(stripLocale),
        })),
      }),
      activeLocale: activeLocale === locale ? project.settings.defaultLocale : activeLocale,
    }))
  },

  renameDefaultLocale: (locale) => {
    const nextLocale = locale.trim().toLowerCase().replace('_', '-')
    if (!nextLocale) return
    const { project, activeLocale } = get()
    const oldDefault = project.settings.defaultLocale
    if (nextLocale === oldDefault) return

    const existing = project.settings.locales ?? [oldDefault]
    // Keep the model simple: changing the base language is only a relabel of
    // the source content, not a promotion of an existing translated locale.
    if (existing.some((l) => l !== oldDefault && l === nextLocale)) return

    const rest = existing.filter((l) => l !== oldDefault)
    const locales = [nextLocale, ...rest]
    set((s) => ({
      project: touchSettings(s.project, { defaultLocale: nextLocale, locales }),
      activeLocale: activeLocale === oldDefault ? nextLocale : activeLocale,
    }))
  },

  updateLayerInSlideGroup: (slideGroupId, layerId, patch) => {
    set((s) => ({
      project: touchProject(s.project, {
        slideGroups: s.project.slideGroups.map((g) => {
          if (g.id !== slideGroupId) return g
          return { ...g, layers: g.layers.map((l) => patchLayerBase(l, layerId, patch)) }
        }),
      }),
    }))
  },

  setLocaleOverride: (slideGroupId, layerId, locale, patch) => {
    set((s) => ({
      project: touchProject(s.project, {
        slideGroups: s.project.slideGroups.map((g) => {
          if (g.id !== slideGroupId) return g
          return { ...g, layers: g.layers.map((l) => patchLayerLocale(l, layerId, locale, patch)) }
        }),
      }),
    }))
  },

  clearLocaleOverride: (slideGroupId, layerId, locale) => {
    set((s) => ({
      project: touchProject(s.project, {
        slideGroups: s.project.slideGroups.map((g) => {
          if (g.id !== slideGroupId) return g
          return { ...g, layers: g.layers.map((l) => patchLayerLocale(l, layerId, locale, null)) }
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
            layers: g.layers.map((l) => {
              const localeMap = layerMap.get(l.id)
              if (!localeMap) return l
              let next = l
              for (const [locale, patch] of localeMap) {
                next = patchLayerLocale(next, l.id, locale, patch)
              }
              return next
            }),
          }
        }),
      }),
    }))
  },
})
