import { beforeEach, describe, expect, it } from 'vitest'
import type { GroupLayer, Layer } from '@/types'
import { resolveProjectView } from '@/utils/canvasFormats'
import { useEditorStore } from './index'

const ANDROID_FORMAT = 'android-phone' as const

function getActiveGroup() {
  const { project, activeSlideGroupId } = useEditorStore.getState()
  return project.slideGroups.find((group) => group.id === activeSlideGroupId)!
}

function getTextLayer() {
  return getActiveGroup().layers.find((layer) => layer.type === 'text')!
}

function enterGermanAndroid() {
  useEditorStore.getState().setActiveLocale('de')
  useEditorStore.getState().setActiveCanvasFormat(ANDROID_FORMAT)
}

function createGroupWithText() {
  useEditorStore.getState().addText()
  useEditorStore.getState().addShape()
  const layers = getActiveGroup().layers
  const textId = layers.find((layer) => layer.type === 'text')!.id
  const shapeId = layers.find((layer) => layer.type === 'shape')!.id
  useEditorStore.getState().createGroup([textId, shapeId])
  const group = getActiveGroup().layers.find((layer) => layer.type === 'group') as GroupLayer
  return { group, textId }
}

beforeEach(() => {
  useEditorStore.getState().resetProject()
  useEditorStore.setState({
    activeLocale: 'en',
    activeCanvasFormat: 'base',
    editingGroupId: null,
    selectedLayerIds: [],
    selection: null,
  })
  useEditorStore.temporal.getState().clear()
})

describe('locale/format layout write routing', () => {
  it('stores non-default locale layout in the active non-base format cell', () => {
    useEditorStore.getState().addText()
    const layer = getTextLayer()
    enterGermanAndroid()

    useEditorStore.getState().updateLayer(layer.id, { x: 200 })

    const updated = getTextLayer()
    expect(updated.x).toBe(layer.x)
    expect(updated.localeLayoutOverrides?.de?.[ANDROID_FORMAT]?.x).toBe(200)
    expect(updated.formatOverrides).toBeUndefined()
  })

  it('resolves a stored locale/format layout value in the rendered project view', () => {
    useEditorStore.getState().addText()
    const layer = getTextLayer()
    enterGermanAndroid()
    useEditorStore.getState().updateLayer(layer.id, { x: 200 })

    const resolved = resolveProjectView(useEditorStore.getState().project, 'de', ANDROID_FORMAT)
    const resolvedLayer = resolved.slideGroups[0].layers.find((candidate) => candidate.id === layer.id)!

    expect(resolvedLayer.x).toBe(200)
  })

  it('guards base geometry for a non-default locale but still writes shared non-layout fields', () => {
    useEditorStore.getState().addText()
    const layer = getTextLayer()
    useEditorStore.getState().setActiveLocale('de')

    useEditorStore.getState().updateLayer(layer.id, { x: 200, visible: false })

    const updated = getTextLayer()
    expect(updated.x).toBe(layer.x)
    expect(updated.visible).toBe(false)
    expect(updated.localeLayoutOverrides).toBeUndefined()
  })

  it('routes Base plus non-default locale edits by content, layout, and shared property category', () => {
    useEditorStore.getState().addText()
    const layer = getTextLayer()
    useEditorStore.getState().setActiveLocale('de')

    useEditorStore.getState().updateLayer(layer.id, {
      x: 200,
      width: 480,
      fontSize: 72,
      rotation: 15,
      text: 'Hallo',
      opacity: 0.5,
      fill: '#ff0000',
      visible: false,
      locked: true,
    })

    const updated = getTextLayer()
    expect(updated).toMatchObject({
      x: layer.x,
      width: layer.width,
      fontSize: layer.fontSize,
      rotation: layer.rotation,
      text: layer.text,
      opacity: 0.5,
      fill: '#ff0000',
      visible: false,
      locked: true,
    })
    expect(updated.localeContent?.de?.text).toBe('Hallo')
    expect(updated.localeLayoutOverrides).toBeUndefined()
    expect(updated.formatOverrides).toBeUndefined()
  })

  it('preserves default-locale non-base routing through formatOverrides', () => {
    useEditorStore.getState().addText()
    const layer = getTextLayer()
    useEditorStore.getState().setActiveCanvasFormat(ANDROID_FORMAT)

    useEditorStore.getState().updateLayer(layer.id, { x: 200 })

    const updated = getTextLayer()
    expect(updated.x).toBe(layer.x)
    expect(updated.formatOverrides?.[ANDROID_FORMAT]?.x).toBe(200)
    expect(updated.localeLayoutOverrides).toBeUndefined()
  })

  it('routes nested child layout to locale/format overrides', () => {
    const { group, textId } = createGroupWithText()
    const original = group.children.find((child) => child.id === textId)!
    enterGermanAndroid()

    useEditorStore.getState().updateChildLayer(group.id, textId, { x: 200 })

    const updatedGroup = getActiveGroup().layers.find((layer) => layer.id === group.id) as GroupLayer
    const updated = updatedGroup.children.find((child) => child.id === textId)!
    expect(updated.x).toBe(original.x)
    expect(updated.localeLayoutOverrides?.de?.[ANDROID_FORMAT]?.x).toBe(200)
    expect(updated.formatOverrides).toBeUndefined()

    const resolved = resolveProjectView(useEditorStore.getState().project, 'de', ANDROID_FORMAT)
    const resolvedGroup = resolved.slideGroups[0].layers.find((layer) => layer.id === group.id) as GroupLayer
    expect(resolvedGroup.children.find((child) => child.id === textId)?.x).toBe(200)
  })

  it('guards nested child base geometry while allowing non-layout fields', () => {
    const { group, textId } = createGroupWithText()
    const original = group.children.find((child) => child.id === textId)!
    useEditorStore.getState().setActiveLocale('de')

    useEditorStore.getState().updateChildLayer(group.id, textId, { x: 200, visible: false })

    const updatedGroup = getActiveGroup().layers.find((layer) => layer.id === group.id) as GroupLayer
    const updated = updatedGroup.children.find((child) => child.id === textId)!
    expect(updated.x).toBe(original.x)
    expect(updated.visible).toBe(false)
    expect(updated.localeLayoutOverrides).toBeUndefined()
  })
})

describe('locale/format layout cleanup actions', () => {
  it('clears one override cell and prunes empty locale maps', () => {
    useEditorStore.getState().addText()
    const layerId = getTextLayer().id
    enterGermanAndroid()
    useEditorStore.getState().updateLayer(layerId, { x: 200 })

    useEditorStore.getState().clearLayerLocaleFormatOverride(layerId)

    expect(getTextLayer().localeLayoutOverrides).toBeUndefined()
  })

  it('clears one override key and prunes the cell only when empty', () => {
    useEditorStore.getState().addText()
    const layerId = getTextLayer().id
    enterGermanAndroid()
    useEditorStore.getState().updateLayer(layerId, { x: 200, y: 300 })

    useEditorStore.getState().clearLayerLocaleFormatOverrideKey(layerId, 'x')
    expect(getTextLayer().localeLayoutOverrides?.de?.[ANDROID_FORMAT]).toEqual({ y: 300 })

    useEditorStore.getState().clearLayerLocaleFormatOverrideKey(layerId, 'y')
    expect(getTextLayer().localeLayoutOverrides).toBeUndefined()
  })

  it('resets the active locale/format cell throughout the active layer tree', () => {
    const { group, textId } = createGroupWithText()
    enterGermanAndroid()
    useEditorStore.getState().updateLayer(group.id, { x: 200 })
    useEditorStore.getState().updateChildLayer(group.id, textId, { y: 300 })

    useEditorStore.getState().resetActiveLocaleFormatLayout()

    const updatedGroup = getActiveGroup().layers.find((layer) => layer.id === group.id) as GroupLayer
    const child = updatedGroup.children.find((layer) => layer.id === textId) as Layer
    expect(updatedGroup.localeLayoutOverrides).toBeUndefined()
    expect(child.localeLayoutOverrides).toBeUndefined()
  })
})
