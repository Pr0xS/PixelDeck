import { getProjectBaseFormat } from '@/utils/canvasFormats'
import type { EditorStore, EditorSet, EditorGet } from '../types'
import {
  mutateActiveGroup,
  resetLocaleFormatOverridesInLayerTree,
  updateLayerInTree,
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
})
