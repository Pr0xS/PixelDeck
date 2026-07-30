import { beforeEach, describe, expect, it } from 'vitest'
import type { CanvasFormatId } from '@/types'
import { useEditorStore } from '@/store'
import {
  getFreshThumbs,
  getPrecacheScheduleKey,
  isBackgroundPrecacheEligible,
  needsThumbnailCapture,
  shouldRestoreCapturedSlideGroup,
} from './useThumbnails'

function restoreContext() {
  const state = useEditorStore.getState()
  return {
    projectId: state.project.id,
    groupId: state.activeSlideGroupId,
    family: state.activeFamily,
    canvasFormat: state.activeCanvasFormat,
  }
}

beforeEach(() => {
  useEditorStore.getState().resetProject()
  useEditorStore.setState({
    selection: null,
    editingGroupId: null,
    selectedAccentIndex: null,
  })
})

describe('thumbnail capture restoration', () => {
  it('leaves the active group and selection untouched when aborting before the first switch', () => {
    const before = useEditorStore.getState()
    const original = restoreContext()
    useEditorStore.setState({ selection: { slideGroupId: original.groupId, layerId: 'selected-layer' } })

    expect(shouldRestoreCapturedSlideGroup(useEditorStore.getState(), original, original.groupId)).toBe(false)
    expect(useEditorStore.getState().activeSlideGroupId).toBe(before.activeSlideGroupId)
    expect(useEditorStore.getState().selection).toEqual({ slideGroupId: original.groupId, layerId: 'selected-layer' })
  })

  it('does not restore over a user family switch during precache', () => {
    const phone = useEditorStore.getState().project.slideGroups[0]!
    const vision = { ...phone, id: 'vision-group', formats: ['visionpro' as CanvasFormatId] }
    useEditorStore.getState().updateProject({
      settings: { ...useEditorStore.getState().project.settings, activeFormats: ['iphone-69', 'visionpro'] },
      slideGroups: [phone, vision],
    })
    const original = restoreContext()

    useEditorStore.getState().setActiveSlideGroup(vision.id)

    expect(shouldRestoreCapturedSlideGroup(useEditorStore.getState(), original, 'capture-group')).toBe(false)
    expect(useEditorStore.getState().activeSlideGroupId).toBe(vision.id)
    expect(useEditorStore.getState().activeFamily).toBe('vr')
  })

  it('skips the restore write when a chunk exits before any group switch', () => {
    const original = restoreContext()
    let restoreCalls = 0

    if (shouldRestoreCapturedSlideGroup(useEditorStore.getState(), original, original.groupId)) {
      restoreCalls += 1
      useEditorStore.getState().setCaptureSlideGroup(original.groupId)
    }

    expect(restoreCalls).toBe(0)
  })

  it('clears a selection made in the transient capture group when restoring', () => {
    const originalGroup = useEditorStore.getState().project.slideGroups[0]!
    const captureGroup = { ...originalGroup, id: 'capture-group' }
    useEditorStore.getState().updateProject({ slideGroups: [originalGroup, captureGroup] })
    const original = restoreContext()

    useEditorStore.getState().setCaptureSlideGroup(captureGroup.id)
    const selection = { slideGroupId: captureGroup.id, layerId: 'selected-during-capture' }
    useEditorStore.setState({ selection, editingGroupId: 'editing-group', selectedAccentIndex: 2 })

    expect(shouldRestoreCapturedSlideGroup(useEditorStore.getState(), original, captureGroup.id)).toBe(true)
    useEditorStore.getState().setCaptureSlideGroup(original.groupId)
    if (useEditorStore.getState().selection?.slideGroupId !== original.groupId) {
      useEditorStore.setState({ selection: null, editingGroupId: null, selectedAccentIndex: null })
    }

    expect(useEditorStore.getState().selection).toBeNull()
    expect(useEditorStore.getState().editingGroupId).toBeNull()
    expect(useEditorStore.getState().selectedAccentIndex).toBeNull()
  })

  it('preserves a selection already belonging to the restored group', () => {
    const originalGroup = useEditorStore.getState().project.slideGroups[0]!
    const captureGroup = { ...originalGroup, id: 'capture-group' }
    useEditorStore.getState().updateProject({ slideGroups: [originalGroup, captureGroup] })
    const original = restoreContext()

    useEditorStore.getState().setCaptureSlideGroup(captureGroup.id)
    const selection = { slideGroupId: original.groupId, layerId: 'selected-in-original-group' }
    useEditorStore.setState({ selection, editingGroupId: 'editing-group', selectedAccentIndex: 2 })

    expect(shouldRestoreCapturedSlideGroup(useEditorStore.getState(), original, captureGroup.id)).toBe(true)
    useEditorStore.getState().setCaptureSlideGroup(original.groupId)
    if (useEditorStore.getState().selection?.slideGroupId !== original.groupId) {
      useEditorStore.setState({ selection: null, editingGroupId: null, selectedAccentIndex: null })
    }

    expect(useEditorStore.getState().selection).toEqual(selection)
    expect(useEditorStore.getState().editingGroupId).toBe('editing-group')
    expect(useEditorStore.getState().selectedAccentIndex).toBe(2)
  })
})

describe('background thumbnail precache eligibility', () => {
  it('skips canvases larger than 8 megapixels', () => {
    expect(isBackgroundPrecacheEligible({ slideWidth: 3840, slideHeight: 2160, numSlides: 1 })).toBe(false)
    expect(isBackgroundPrecacheEligible({ slideWidth: 1320, slideHeight: 2868, numSlides: 2 })).toBe(true)
  })
})

describe('thumbnail cache keys', () => {
  it('treats key-mismatched thumbnails as stale while retaining matching entries', () => {
    const entries = { group: { key: 'iphone', thumbs: ['data:image/jpeg;base64,thumb'] } }

    expect(getFreshThumbs(entries, 'group', 'iphone')).toEqual(entries.group.thumbs)
    expect(needsThumbnailCapture(entries, 'group', 'iphone', 1)).toBe(false)
    expect(getFreshThumbs(entries, 'group', 'wearos')).toBeUndefined()
    expect(needsThumbnailCapture(entries, 'group', 'wearos', 1)).toBe(true)
  })

  it('requires a complete non-empty thumbnail array for every slide', () => {
    expect(needsThumbnailCapture({ group: { key: 'key', thumbs: ['one'] } }, 'group', 'key', 2)).toBe(true)
    expect(needsThumbnailCapture({ group: { key: 'key', thumbs: ['one', ''] } }, 'group', 'key', 2)).toBe(true)
    expect(needsThumbnailCapture({ group: { key: 'key', thumbs: ['one', 'two'] } }, 'group', 'key', 2)).toBe(false)
  })

  it('changes the precache scheduler identity for format-only swaps in one family', () => {
    const iWatch = getPrecacheScheduleKey('watch', 'apple-watch-45', 'en', { gapPx: 24, compensate: false })
    const wearOs = getPrecacheScheduleKey('watch', 'wearos-round', 'en', { gapPx: 24, compensate: false })

    expect(wearOs).not.toBe(iWatch)
  })
})
