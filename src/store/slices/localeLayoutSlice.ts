import type { EditorStore, EditorSet, EditorGet } from '../types'
import {
  mutateActiveGroup,
  resetLocaleAdjustsInLayerTree,
  updateLayerInTree,
  withoutLocaleAdjust,
  withoutLocaleAdjustKey,
} from '../helpers'

export const createLocaleLayoutSlice = (
  set: EditorSet,
  get: EditorGet,
): Pick<
  EditorStore,
  | 'clearLayerLocaleAdjust'
  | 'clearLayerLocaleAdjustKey'
  | 'resetActiveLocaleAdjust'
> => ({
  // ─ `localeAdjust` tier (unified base-scoped + format-scoped locale
  // adjustments). Scope is `BASE_CANVAS_FORMAT` for the base-scoped cell or
  // an active (non-base) format id for the format-scoped cell — both
  // compose, so callers must pass the exact scope they mean to clear.
  clearLayerLocaleAdjust: (layerId, locale, scope) => {
    const targetLocale = locale ?? get().activeLocale
    const targetScope = scope ?? get().activeCanvasFormat
    mutateActiveGroup(set, (g) => ({
      ...g,
      layers: updateLayerInTree(g.layers, layerId, (layer) =>
        withoutLocaleAdjust(layer, targetLocale, targetScope)),
    }))
  },

  clearLayerLocaleAdjustKey: (layerId, key, locale, scope) => {
    const targetLocale = locale ?? get().activeLocale
    const targetScope = scope ?? get().activeCanvasFormat
    mutateActiveGroup(set, (g) => ({
      ...g,
      layers: updateLayerInTree(g.layers, layerId, (layer) =>
        withoutLocaleAdjustKey(layer, targetLocale, targetScope, key)),
    }))
  },

  resetActiveLocaleAdjust: (locale, scope) => {
    const targetLocale = locale ?? get().activeLocale
    const targetScope = scope ?? get().activeCanvasFormat
    if (targetLocale === get().project.settings.defaultLocale) return
    mutateActiveGroup(set, (g) => ({
      ...g,
      layers: resetLocaleAdjustsInLayerTree(g.layers, targetLocale, targetScope),
    }))
  },
})
