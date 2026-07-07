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

describe('addSlideGroup', () => {
  it('creates a non-first group with one distinct slide name per slide', () => {
    useEditorStore.getState().addSlideGroup()

    const group = getActiveGroup()
    expect(group.slideNames).toHaveLength(group.numSlides)
    expect(new Set(group.slideNames).size).toBe(group.slideNames.length)
  })
})

describe('updateSlideGroup', () => {
  it('pads slide names when increasing numSlides', () => {
    const groupId = getActiveGroup().id

    useEditorStore.getState().updateSlideGroup(groupId, { numSlides: 3 })

    const group = getActiveGroup()
    expect(group.slideNames).toHaveLength(3)
    expect(new Set(group.slideNames).size).toBe(3)
    expect(group.slideNames.every((name) => typeof name === 'string' && name.length > 0)).toBe(true)
  })

  it('trims slide names when decreasing numSlides', () => {
    const groupId = getActiveGroup().id
    useEditorStore.getState().updateSlideGroup(groupId, { numSlides: 2 })

    useEditorStore.getState().updateSlideGroup(groupId, { numSlides: 1 })

    const group = getActiveGroup()
    expect(group.slideNames).toHaveLength(1)
  })
})
