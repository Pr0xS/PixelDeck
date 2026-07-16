import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from './index'
import type { CustomFormatId, GroupLayer, Layer } from '@/types'

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
    useEditorStore.setState({ selectedLayerIds: [layerId], editingGroupId: 'group-1', selectedAccentIndex: 1 })

    useEditorStore.getState().setActiveCanvasFormat('iphone-69')

    expect(useEditorStore.getState().activeCanvasFormat).toBe('iphone-69')
    expect(useEditorStore.getState().selection).toBeNull()
    expect(useEditorStore.getState().selectedLayerIds).toEqual([])
    expect(useEditorStore.getState().editingGroupId).toBeNull()
    expect(useEditorStore.getState().selectedAccentIndex).toBeNull()
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
    })
  })

  it('hides a layer in every other active format including a custom format', () => {
    useEditorStore.getState().addCustomFormat('Banner', 1200, 500)
    const customId = useEditorStore.getState().activeCanvasFormat as CustomFormatId
    useEditorStore.getState().addText()
    const layerId = getActiveGroup().layers.find((l) => l.type === 'text')!.id

    useEditorStore.getState().setLayerOnlyInFormat(layerId, 'android-phone')

    expect(getActiveGroup().layers.find((l) => l.id === layerId)!.formatVisibility).toEqual({
      'iphone-69': false,
      'android-phone': true,
      [customId]: false,
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

describe('custom formats', () => {
  it('adds a custom format, activates it, and switches to it', () => {
    useEditorStore.getState().addCustomFormat('Banner', 1200, 500)

    const { project, activeCanvasFormat } = useEditorStore.getState()
    const custom = project.settings.customFormats?.[0]
    expect(custom).toMatchObject({ label: 'Banner', width: 1200, height: 500 })
    expect(custom?.id).toMatch(/^custom:/)
    expect(project.settings.activeFormats).toContain(custom?.id)
    expect(activeCanvasFormat).toBe(custom?.id)
  })

  it('removes a custom format from settings and active formats and returns to base', () => {
    useEditorStore.getState().addCustomFormat('Banner', 1200, 500)
    const id = useEditorStore.getState().activeCanvasFormat as CustomFormatId

    useEditorStore.getState().removeCustomFormat(id)

    const { project, activeCanvasFormat } = useEditorStore.getState()
    expect(project.settings.customFormats).toEqual([])
    expect(project.settings.activeFormats).not.toContain(id)
    expect(activeCanvasFormat).toBe('base')
  })

  it('purges custom-format references in nested layers across all slide groups', () => {
    useEditorStore.getState().addCustomFormat('Banner', 1200, 500)
    const id = useEditorStore.getState().activeCanvasFormat as CustomFormatId
    useEditorStore.getState().addText()
    const state = useEditorStore.getState()
    const first = getActiveGroup()
    const text = first.layers.find((layer) => layer.type === 'text')!
    const scoped = {
      ...text,
      ownerFormat: id,
      formatOverrides: { [id]: { x: 300 } },
      formatVisibility: { [id]: true },
    } as Layer
    const nested: GroupLayer = {
      id: 'nested-group', name: 'Nested', type: 'group', x: 0, y: 0,
      rotation: 0, opacity: 1, visible: true, locked: false, children: [scoped],
    }
    const second = {
      ...first,
      id: 'second-group',
      name: 'Second',
      layers: first.layers.map((layer) => layer.type === 'background' ? layer : nested),
    }
    state.updateProject({
      slideGroups: [
        { ...first, layers: first.layers.map((layer) => layer.id === text.id ? scoped : layer) },
        second,
      ],
    })

    useEditorStore.getState().removeCustomFormat(id)

    const groups = useEditorStore.getState().project.slideGroups
    const cleanedTop = groups[0].layers.find((layer) => layer.id === text.id)!
    const cleanedChild = (groups[1].layers.find((layer) => layer.type === 'group') as GroupLayer).children[0]
    for (const layer of [cleanedTop, cleanedChild]) {
      expect(layer.ownerFormat).toBeUndefined()
      expect(layer.formatOverrides?.[id]).toBeUndefined()
      expect(layer.formatVisibility?.[id]).toBeUndefined()
    }
  })

  it('updates a custom format label and dimensions', () => {
    useEditorStore.getState().addCustomFormat('Banner', 1200, 500)
    const id = useEditorStore.getState().activeCanvasFormat as CustomFormatId

    useEditorStore.getState().updateCustomFormat(id, { label: 'Square', width: 1080, height: 1080 })

    expect(useEditorStore.getState().project.settings.customFormats?.[0]).toEqual({
      id, label: 'Square', width: 1080, height: 1080,
    })
  })

  it('promotes overrides and shares owned layers without throwing for a custom format', () => {
    useEditorStore.getState().addCustomFormat('Banner', 1200, 500)
    const id = useEditorStore.getState().activeCanvasFormat as CustomFormatId
    useEditorStore.getState().addText()
    const text = getActiveGroup().layers.find((layer) => layer.type === 'text')!
    useEditorStore.getState().updateProject({
      slideGroups: useEditorStore.getState().project.slideGroups.map((group) => ({
        ...group,
        layers: group.layers.map((layer) => layer.id === text.id ? {
          ...layer,
          ownerFormat: id,
          formatOverrides: { [id]: { x: 240 } },
        } as Layer : layer),
      })),
    })

    expect(() => useEditorStore.getState().promoteActiveFormatLayoutToShared()).not.toThrow()
    expect(() => useEditorStore.getState().shareActiveFormatOwnedLayers()).not.toThrow()
  })
})
