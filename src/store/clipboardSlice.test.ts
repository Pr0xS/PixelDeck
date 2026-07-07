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

describe('copyLayers + pasteLayers', () => {
  it('offsets repeated same-group pastes by paste count', () => {
    useEditorStore.getState().addShape()
    const shapeId = getActiveGroup().layers.find((l) => l.type === 'shape')!.id
    useEditorStore.getState().updateLayer(shapeId, { x: 100, y: 100 })

    useEditorStore.getState().copyLayers([shapeId])
    useEditorStore.getState().pasteLayers()

    const firstPaste = getActiveGroup().layers.at(-1)!
    expect(firstPaste.x).toBe(120)
    expect(firstPaste.y).toBe(120)

    useEditorStore.getState().pasteLayers()

    const secondPaste = getActiveGroup().layers.at(-1)!
    expect(secondPaste.x).toBe(140)
    expect(secondPaste.y).toBe(140)
  })

  it('preserves position on first cross-slide paste and offsets subsequent same-group paste', () => {
    useEditorStore.getState().addShape()
    const shapeId = getActiveGroup().layers.find((l) => l.type === 'shape')!.id
    useEditorStore.getState().updateLayer(shapeId, { x: 100, y: 100 })
    useEditorStore.getState().copyLayers([shapeId])

    useEditorStore.getState().addSlideGroup()
    useEditorStore.getState().pasteLayers()

    const firstCrossSlidePaste = getActiveGroup().layers.at(-1)!
    expect(firstCrossSlidePaste.x).toBe(100)
    expect(firstCrossSlidePaste.y).toBe(100)

    useEditorStore.getState().pasteLayers()

    const secondPasteInNewGroup = getActiveGroup().layers.at(-1)!
    expect(secondPasteInNewGroup.x).toBe(120)
    expect(secondPasteInNewGroup.y).toBe(120)
  })

  it('does not copy background layers', () => {
    const backgroundId = getActiveGroup().layers.find((l) => l.type === 'background')!.id
    const beforeCount = getActiveGroup().layers.length

    useEditorStore.getState().copyLayers([backgroundId])
    useEditorStore.getState().pasteLayers()

    expect(useEditorStore.getState().clipboard).toBeNull()
    expect(getActiveGroup().layers).toHaveLength(beforeCount)
  })
})

describe('cutLayers', () => {
  it('cuts non-background layers into the clipboard and removes them', () => {
    useEditorStore.getState().addShape()
    const shapeId = getActiveGroup().layers.find((l) => l.type === 'shape')!.id

    useEditorStore.getState().cutLayers([shapeId])

    expect(useEditorStore.getState().clipboard?.[0].id).toBe(shapeId)
    expect(getActiveGroup().layers.find((l) => l.id === shapeId)).toBeUndefined()
    expect(useEditorStore.getState().selection).toBeNull()
  })
})
