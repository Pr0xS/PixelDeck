import { getProjectBaseFormat, LOCALE_DELTA_FIELDS } from '@/utils/canvasFormats'
import type { EditorStore, EditorSet, EditorGet } from '../types'
import {
  mutateActiveGroup,
  resetLocaleFormatOverridesInLayerTree,
  resetLocaleBaseDeltasInLayerTree,
  updateLayerInTree,
  withoutLocaleBaseDelta,
  withoutLocaleBaseDeltaKey,
  withoutLocaleFormatOverride,
  withoutLocaleFormatOverrideKey,
} from '../helpers'

export const createLocaleLayoutSlice = (
  set: EditorSet,
  get: EditorGet,
): Pick<
  EditorStore,
  | 'clearLayerLocaleFormatOverride'
  | 'clearLayerLocaleFormatOverrideKey'
  | 'resetActiveLocaleFormatLayout'
  | 'clearLayerLocaleBaseDelta'
  | 'clearLayerLocaleBaseDeltaKey'
  | 'resetActiveLocaleBaseDelta'
> => ({
  clearLayerLocaleFormatOverride: (layerId, locale, format) => {
    const targetLocale = locale ?? get().activeLocale
    const targetFormat = format ?? get().activeCanvasFormat
    mutateActiveGroup(set, (g) => ({
      ...g,
      layers: updateLayerInTree(g.layers, layerId, (layer) =>
        withoutLocaleFormatOverride(layer, targetLocale, targetFormat)),
    }))
  },

  clearLayerLocaleFormatOverrideKey: (layerId, key, locale, format) => {
    const targetLocale = locale ?? get().activeLocale
    const targetFormat = format ?? get().activeCanvasFormat
    mutateActiveGroup(set, (g) => ({
      ...g,
      layers: updateLayerInTree(g.layers, layerId, (layer) =>
        withoutLocaleFormatOverrideKey(layer, targetLocale, targetFormat, key)),
    }))
  },

  resetActiveLocaleFormatLayout: (locale, format) => {
    const targetLocale = locale ?? get().activeLocale
    const targetFormat = format ?? get().activeCanvasFormat
    const project = get().project
    if (
      targetLocale === project.settings.defaultLocale
      || targetFormat === getProjectBaseFormat(project)
    ) return
    mutateActiveGroup(set, (g) => ({
      ...g,
      layers: resetLocaleFormatOverridesInLayerTree(g.layers, targetLocale, targetFormat),
    }))
  },

  clearLayerLocaleBaseDelta: (layerId, locale) => {
    const targetLocale = locale ?? get().activeLocale
    mutateActiveGroup(set, (g) => ({
      ...g,
      layers: updateLayerInTree(g.layers, layerId, (layer) => withoutLocaleBaseDelta(layer, targetLocale)),
    }))
  },

  clearLayerLocaleBaseDeltaKey: (layerId, key, locale) => {
    const targetLocale = locale ?? get().activeLocale
    const deltaKey = LOCALE_DELTA_FIELDS[key as keyof typeof LOCALE_DELTA_FIELDS]
    if (!deltaKey) return
    mutateActiveGroup(set, (g) => ({
      ...g,
      layers: updateLayerInTree(g.layers, layerId, (layer) => withoutLocaleBaseDeltaKey(layer, targetLocale, deltaKey)),
    }))
  },

  resetActiveLocaleBaseDelta: (locale) => {
    const targetLocale = locale ?? get().activeLocale
    if (targetLocale === get().project.settings.defaultLocale) return
    mutateActiveGroup(set, (g) => ({
      ...g,
      layers: resetLocaleBaseDeltasInLayerTree(g.layers, targetLocale),
    }))
  },
})
