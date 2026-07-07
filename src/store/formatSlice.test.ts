import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from './index'

function getActiveGroup() {
  const { project, activeSlideGroupId } = useEditorStore.getState()
  return project.slideGroups.find((g) => g.id === activeSlideGroupId)!
}

beforeEach(() => {
  useEditorStore.getState().resetProject()
  useEditorStore.setState({
    editingGroupId: null,
    selectedLayerIds: [],
    clipboard: null,
    clipboardSourceGroupId: null,
    pasteCount: 0,
    selection: null,
  })
  useEditorStore.temporal.getState().clear()
})

describe('setActiveCanvasFormat', () => {
  it('changes the active canvas format and clears selection state', () => {
    useEditorStore.getState().addText()
    const layerId = getActiveGroup().layers.find((l) => l.type === 'text')!.id
    useEditorStore.getState().select(layerId)
    useEditorStore.setState({ selectedLayerIds: [layerId], editingGroupId: 'group-1' })

    useEditorStore.getState().setActiveCanvasFormat('iphone-69')

    expect(useEditorStore.getState().activeCanvasFormat).toBe('iphone-69')
    expect(useEditorStore.getState().selection).toBeNull()
    expect(useEditorStore.getState().selectedLayerIds).toEqual([])
    expect(useEditorStore.getState().editingGroupId).toBeNull()
  })
})

describe('toggleActiveFormat', () => {
  it('adds an inactive format and removes it when toggled again', () => {
    const formatId = 'ipad-13'
    expect(useEditorStore.getState().project.settings.activeFormats).not.toContain(formatId)

    useEditorStore.getState().toggleActiveFormat(formatId)
    expect(useEditorStore.getState().project.settings.activeFormats).toContain(formatId)

    useEditorStore.getState().toggleActiveFormat(formatId)
    expect(useEditorStore.getState().project.settings.activeFormats).not.toContain(formatId)
  })

  it('reverts to the base format when the current active format is removed', () => {
    useEditorStore.getState().setActiveCanvasFormat('android-phone')

    useEditorStore.getState().toggleActiveFormat('android-phone')


    expect(useEditorStore.getState().activeCanvasFormat).toBe('base')
    expect(useEditorStore.getState().project.settings.activeFormats).not.toContain('android-phone')
  })

  it('does not toggle off the base format', () => {
    const before = useEditorStore.getState().project.settings.activeFormats

    useEditorStore.getState().toggleActiveFormat('base')


    expect(useEditorStore.getState().project.settings.activeFormats).toEqual(before)
  })
})

describe('format visibility', () => {
  it('sets a layer visible only in the target format', () => {
    useEditorStore.getState().addText()
    const layerId = getActiveGroup().layers.find((l) => l.type === 'text')!.id

    useEditorStore.getState().setLayerOnlyInFormat(layerId, 'android-phone')

    const layer = getActiveGroup().layers.find((l) => l.id === layerId)!
    expect(layer.formatVisibility).toEqual({
      'iphone-69': false,
      'android-phone': true,
      'ipad-13': false,
      'android-tablet': false,
    })
  })

  it('clears layer format visibility', () => {
    useEditorStore.getState().addText()
    const layerId = getActiveGroup().layers.find((l) => l.type === 'text')!.id
    useEditorStore.getState().setLayerOnlyInFormat(layerId, 'android-phone')

    useEditorStore.getState().clearLayerFormatVisibility(layerId)

    const layer = getActiveGroup().layers.find((l) => l.id === layerId)!
    expect(layer.formatVisibility).toBeUndefined()
  })

  it('removes a format visibility key and clears the map when empty', () => {
    useEditorStore.getState().addText()
    const layerId = getActiveGroup().layers.find((l) => l.type === 'text')!.id
    useEditorStore.getState().setLayerFormatVisibility(layerId, 'android-phone', false)

    useEditorStore.getState().setLayerFormatVisibility(layerId, 'android-phone', undefined)

    const layer = getActiveGroup().layers.find((l) => l.id === layerId)!
    expect(layer.formatVisibility).toBeUndefined()
  })
})

describe('format overrides', () => {
  it('clears only the target format override', () => {
    useEditorStore.getState().addText()
    const layerId = getActiveGroup().layers.find((l) => l.type === 'text')!.id
    useEditorStore.getState().setActiveCanvasFormat('android-phone')
    useEditorStore.getState().updateLayer(layerId, { x: 300 })
    useEditorStore.getState().setActiveCanvasFormat('ipad-13')
    useEditorStore.getState().updateLayer(layerId, { y: 400 })

    useEditorStore.getState().clearLayerFormatOverride(layerId, 'android-phone')

    const layer = getActiveGroup().layers.find((l) => l.id === layerId)!
    expect(layer.formatOverrides?.['android-phone']).toBeUndefined()
    expect(layer.formatOverrides?.['ipad-13']).toEqual({ y: 400 })
  })

  it('does not sync a layer format override when target format is base', () => {
    useEditorStore.getState().addText()
    const layerId = getActiveGroup().layers.find((l) => l.type === 'text')!.id
    const before = getActiveGroup().layers.find((l) => l.id === layerId)!

    useEditorStore.getState().syncLayerFormatToShared(layerId, 'base')

    const after = getActiveGroup().layers.find((l) => l.id === layerId)!
    expect(after).toEqual(before)
  })
})
