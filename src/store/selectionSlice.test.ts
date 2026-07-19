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
    selectedAccentIndex: null,
    editingTextId: null,
  })
  useEditorStore.temporal.getState().clear()
})

describe('setZoom', () => {
  it('clamps to the maximum zoom', () => {
    useEditorStore.getState().setZoom(10)

    expect(useEditorStore.getState().zoom).toBe(4)
  })

  it('clamps to the minimum zoom', () => {
    useEditorStore.getState().setZoom(0)

    expect(useEditorStore.getState().zoom).toBe(0.05)
  })

  it('sets zoom values within the allowed range', () => {
    useEditorStore.getState().setZoom(1)

    expect(useEditorStore.getState().zoom).toBe(1)
  })
})

describe('canvas toggles', () => {
  it('toggles grid visibility', () => {
    const original = useEditorStore.getState().showGrid

    useEditorStore.getState().toggleGrid()
    expect(useEditorStore.getState().showGrid).toBe(!original)

    useEditorStore.getState().toggleGrid()
    expect(useEditorStore.getState().showGrid).toBe(original)
  })

  it('toggles seam guide visibility', () => {
    const original = useEditorStore.getState().showSeamGuides

    useEditorStore.getState().toggleSeamGuides()

    expect(useEditorStore.getState().showSeamGuides).toBe(!original)
  })
})

describe('text editing', () => {
  it('only starts the canvas text editor for the default locale', () => {
    const { defaultLocale } = useEditorStore.getState().project.settings

    useEditorStore.setState({ activeLocale: 'de' })
    useEditorStore.getState().startTextEdit('text-layer')
    expect(useEditorStore.getState().editingTextId).toBeNull()

    useEditorStore.setState({ activeLocale: defaultLocale })
    useEditorStore.getState().startTextEdit('text-layer')
    expect(useEditorStore.getState().editingTextId).toBe('text-layer')
  })
})

describe('multi-selection', () => {
  it('toggles a layer id in multi-selection', () => {
    useEditorStore.getState().toggleLayerSelection('a')
    expect(useEditorStore.getState().selectedLayerIds).toEqual(['a'])

    useEditorStore.getState().toggleLayerSelection('a')
    expect(useEditorStore.getState().selectedLayerIds).toEqual([])
  })

  it('sets multiple selected layers and clears single-selection state', () => {
    useEditorStore.getState().select('x')
    useEditorStore.setState({ editingGroupId: 'group-1' })

    useEditorStore.getState().setMultiSelection(['a', 'b'])

    expect(useEditorStore.getState().selectedLayerIds).toEqual(['a', 'b'])
    expect(useEditorStore.getState().selection).toBeNull()
    expect(useEditorStore.getState().editingGroupId).toBeNull()
  })
})

describe('group edit selection', () => {
  it('enters group edit mode with no child selected', () => {
    useEditorStore.getState().addText()
    useEditorStore.getState().addShape()
    const ids = getActiveGroup().layers.filter((l) => l.type !== 'background').map((l) => l.id)
    useEditorStore.getState().createGroup(ids)
    const groupId = getActiveGroup().layers.find((l) => l.type === 'group')!.id

    useEditorStore.getState().enterGroupEdit(groupId)

    expect(useEditorStore.getState().editingGroupId).toBe(groupId)
    expect(useEditorStore.getState().selection).toEqual({
      slideGroupId: useEditorStore.getState().activeSlideGroupId,
      layerId: null,
    })
    expect(useEditorStore.getState().selectedLayerIds).toEqual([])
  })

  it('exits group edit mode and re-selects the group', () => {
    useEditorStore.getState().addText()
    useEditorStore.getState().addShape()
    const ids = getActiveGroup().layers.filter((l) => l.type !== 'background').map((l) => l.id)
    useEditorStore.getState().createGroup(ids)
    const groupId = getActiveGroup().layers.find((l) => l.type === 'group')!.id
    useEditorStore.getState().enterGroupEdit(groupId)

    useEditorStore.getState().exitGroupEdit()

    expect(useEditorStore.getState().editingGroupId).toBeNull()
    expect(useEditorStore.getState().selection).toEqual({
      slideGroupId: useEditorStore.getState().activeSlideGroupId,
      layerId: groupId,
    })
  })

  it('selects a child while preserving group edit mode', () => {
    useEditorStore.getState().addText()
    useEditorStore.getState().addShape()
    const ids = getActiveGroup().layers.filter((l) => l.type !== 'background').map((l) => l.id)
    useEditorStore.getState().createGroup(ids)
    const group = getActiveGroup().layers.find((l) => l.type === 'group')!
    const childId = 'children' in group ? group.children[0].id : ''
    useEditorStore.getState().enterGroupEdit(group.id)

    useEditorStore.getState().selectChild(group.id, childId)

    expect(useEditorStore.getState().editingGroupId).toBe(group.id)
    expect(useEditorStore.getState().selection).toEqual({
      slideGroupId: useEditorStore.getState().activeSlideGroupId,
      layerId: childId,
    })
  })
})

describe('single selection', () => {
  it('selects a single layer and deselects it', () => {
    useEditorStore.setState({ selectedLayerIds: ['a'], editingGroupId: 'group-1' })

    useEditorStore.getState().select('x')
    expect(useEditorStore.getState().selection).toEqual({
      slideGroupId: useEditorStore.getState().activeSlideGroupId,
      layerId: 'x',
    })
    expect(useEditorStore.getState().selectedLayerIds).toEqual([])
    expect(useEditorStore.getState().editingGroupId).toBeNull()

    useEditorStore.getState().deselect()
    expect(useEditorStore.getState().selection).toBeNull()
    expect(useEditorStore.getState().selectedLayerIds).toEqual([])
    expect(useEditorStore.getState().editingGroupId).toBeNull()
  })
})

describe('accent selection', () => {
  it('selects an accent index', () => {
    useEditorStore.getState().selectAccent(2)

    expect(useEditorStore.getState().selectedAccentIndex).toBe(2)
  })

  it('clears the selected accent when another layer is selected', () => {
    useEditorStore.getState().selectAccent(2)

    useEditorStore.getState().select('other-layer')

    expect(useEditorStore.getState().selectedAccentIndex).toBeNull()
  })

  it('clears the selected accent when selection is cleared', () => {
    useEditorStore.getState().selectAccent(2)

    useEditorStore.getState().deselect()

    expect(useEditorStore.getState().selectedAccentIndex).toBeNull()
  })
})
