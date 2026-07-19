import { beforeEach, describe, expect, it } from 'vitest'
import type { GroupLayer, TextLayer } from '@/types'
import { resolveProjectView } from '@/utils/canvasFormats'
import { useEditorStore } from './index'

const BASE_FORMAT = 'base' as const
const ANDROID_FORMAT = 'android-phone' as const

function getActiveGroup() {
  const { project, activeSlideGroupId } = useEditorStore.getState()
  return project.slideGroups.find((group) => group.id === activeSlideGroupId)!
}

function getTextLayer() {
  return getActiveGroup().layers.find((layer) => layer.type === 'text') as TextLayer
}

function enableGermanAndroid() {
  const store = useEditorStore.getState()
  store.addLocale('de')
  store.updateSettings({ activeFormats: [ANDROID_FORMAT] })
  store.setActiveCanvasFormat(ANDROID_FORMAT)
}

beforeEach(() => {
  useEditorStore.getState().resetProject()
  useEditorStore.setState({
    activeLocale: 'en',
    activeCanvasFormat: BASE_FORMAT,
    editingGroupId: null,
    selectedLayerIds: [],
    selection: null,
  })
  useEditorStore.temporal.getState().clear()
})

describe('locale/format layout store integration', () => {
  it('nudges from the resolved position of a format-only override', () => {
    useEditorStore.getState().addText()
    const layer = getTextLayer()
    useEditorStore.getState().updateSettings({ activeFormats: [ANDROID_FORMAT] })
    useEditorStore.getState().setActiveCanvasFormat(ANDROID_FORMAT)
    useEditorStore.getState().updateLayer(layer.id, { x: 640 })

    const state = useEditorStore.getState()
    const resolvedLayer = resolveProjectView(
      state.project,
      state.activeLocale,
      state.activeCanvasFormat,
    ).slideGroups[0].layers.find((candidate) => candidate.id === layer.id) as TextLayer
    state.updateLayer(layer.id, { x: resolvedLayer.x + 1 })

    expect(getTextLayer().formatOverrides?.[ANDROID_FORMAT]?.x).toBe(641)
  })

  it('nudges from the resolved position of a locale/format override', () => {
    useEditorStore.getState().addText()
    const layer = getTextLayer()
    enableGermanAndroid()
    useEditorStore.getState().updateLayer(layer.id, { x: 2020 })

    const state = useEditorStore.getState()
    const resolvedLayer = resolveProjectView(
      state.project,
      state.activeLocale,
      state.activeCanvasFormat,
    ).slideGroups[0].layers.find((candidate) => candidate.id === layer.id) as TextLayer
    state.updateLayer(layer.id, { x: resolvedLayer.x + 1 })

    expect(getTextLayer().localeLayoutOverrides?.de?.[ANDROID_FORMAT]?.x).toBe(2021)
  })

  it('nudges a group child in the same resolved coordinate space used by override routing', () => {
    useEditorStore.getState().addText()
    useEditorStore.getState().addShape()
    const layers = getActiveGroup().layers
    const textId = layers.find((layer) => layer.type === 'text')!.id
    const shapeId = layers.find((layer) => layer.type === 'shape')!.id
    useEditorStore.getState().createGroup([textId, shapeId])
    const group = getActiveGroup().layers.find((layer) => layer.type === 'group') as GroupLayer
    const baseChildX = group.children.find((child) => child.id === textId)!.x
    useEditorStore.getState().updateLayer(group.id, { scale: 2 })
    enableGermanAndroid()

    const state = useEditorStore.getState()
    const resolvedGroup = resolveProjectView(
      state.project,
      state.activeLocale,
      state.activeCanvasFormat,
    ).slideGroups[0].layers.find((layer) => layer.id === group.id) as GroupLayer
    const resolvedChild = resolvedGroup.children.find((child) => child.id === textId)!
    state.updateChildLayer(group.id, textId, { x: resolvedChild.x + 1 })

    const storedGroup = getActiveGroup().layers.find((layer) => layer.id === group.id) as GroupLayer
    const storedChild = storedGroup.children.find((child) => child.id === textId)!
    const expectedX = resolvedChild.x + 1
    expect(storedChild.x).toBe(baseChildX)
    expect(storedChild.localeLayoutOverrides?.de?.[ANDROID_FORMAT]?.x).toBe(expectedX)

    const reResolvedGroup = resolveProjectView(
      useEditorStore.getState().project,
      'de',
      ANDROID_FORMAT,
    ).slideGroups[0].layers.find((layer) => layer.id === group.id) as GroupLayer
    expect(reResolvedGroup.children.find((child) => child.id === textId)?.x).toBe(expectedX)
  })

  it('routes, resolves, scopes, and prunes overrides across locale and format contexts', () => {
    useEditorStore.getState().addText()
    const layer = getTextLayer()
    const baseX = layer.x
    enableGermanAndroid()

    useEditorStore.getState().select(layer.id)
    useEditorStore.getState().updateLayer(layer.id, { x: 2020 })

    let updated = getTextLayer()
    expect(updated.localeLayoutOverrides?.de?.[ANDROID_FORMAT]?.x).toBe(2020)
    expect(updated.formatOverrides).toBeUndefined()
    expect(updated.x).toBe(baseX)

    useEditorStore.getState().setActiveLocale('en')
    useEditorStore.getState().setActiveCanvasFormat(ANDROID_FORMAT)
    useEditorStore.getState().updateLayer(layer.id, { x: 640 })

    updated = getTextLayer()
    expect(updated.formatOverrides?.[ANDROID_FORMAT]?.x).toBe(640)
    expect(updated.x).toBe(baseX)

    const project = useEditorStore.getState().project
    const resolvedX = (locale: string, format: typeof BASE_FORMAT | typeof ANDROID_FORMAT) =>
      (resolveProjectView(project, locale, format).slideGroups[0].layers
        .find((candidate) => candidate.id === layer.id) as TextLayer).x

    expect(resolvedX('de', ANDROID_FORMAT)).toBe(2020)
    expect(resolvedX('de', BASE_FORMAT)).toBe(baseX)
    expect(resolvedX('en', ANDROID_FORMAT)).toBe(640)

    useEditorStore.getState().setActiveLocale('de')
    useEditorStore.getState().clearLayerLocaleFormatOverride(layer.id)
    expect(getTextLayer().localeLayoutOverrides).toBeUndefined()
  })

  it('keeps locale/format pano overrides in slide-2 coordinates without scaling', () => {
    const group = getActiveGroup()
    useEditorStore.getState().updateSlideGroup(group.id, { numSlides: 2 })
    useEditorStore.getState().addText()
    const layer = getTextLayer()
    const slideTwoX = group.slideWidth + 240
    useEditorStore.getState().updateLayer(layer.id, { x: slideTwoX })
    enableGermanAndroid()

    const overriddenSlideTwoX = group.slideWidth + 480
    useEditorStore.getState().select(layer.id)
    useEditorStore.getState().updateLayer(layer.id, { x: overriddenSlideTwoX })

    const resolved = resolveProjectView(
      useEditorStore.getState().project,
      'de',
      ANDROID_FORMAT,
    )
    const resolvedLayer = resolved.slideGroups[0].layers
      .find((candidate) => candidate.id === layer.id) as TextLayer

    expect(getTextLayer().x).toBe(slideTwoX)
    expect(resolvedLayer.x).toBe(overriddenSlideTwoX)
  })

  it('routes and resolves locale/format overrides on group children', () => {
    useEditorStore.getState().addText()
    useEditorStore.getState().addShape()
    const layers = getActiveGroup().layers
    const textId = layers.find((layer) => layer.type === 'text')!.id
    const shapeId = layers.find((layer) => layer.type === 'shape')!.id
    useEditorStore.getState().createGroup([textId, shapeId])
    const group = getActiveGroup().layers.find((layer) => layer.type === 'group') as GroupLayer
    const originalChildX = group.children.find((child) => child.id === textId)!.x
    enableGermanAndroid()

    useEditorStore.getState().select(textId)
    useEditorStore.getState().updateChildLayer(group.id, textId, { x: 777 })

    const storedGroup = getActiveGroup().layers.find((layer) => layer.id === group.id) as GroupLayer
    const storedChild = storedGroup.children.find((child) => child.id === textId)!
    expect(storedChild.x).toBe(originalChildX)
    expect(storedChild.localeLayoutOverrides?.de?.[ANDROID_FORMAT]?.x).toBe(777)

    const resolved = resolveProjectView(
      useEditorStore.getState().project,
      'de',
      ANDROID_FORMAT,
    )
    const resolvedGroup = resolved.slideGroups[0].layers
      .find((layer) => layer.id === group.id) as GroupLayer
    expect(resolvedGroup.children.find((child) => child.id === textId)?.x).toBe(777)
  })
})
