import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from './index'
import { BASE_CANVAS_FORMAT, FORMAT_FAMILY_ANCHOR, getFormatScaleFactor, getGroupFamilyKey, groupTargetsFormat, resolveForkSourceFormat, selectFamilyFormats, selectFamilyGroups, selectFormatViewGroups, selectForkSourceCandidates, selectForkSourceGroups, selectProjectFamilies } from '@/utils/canvasFormats'
import type { BackgroundLayer, CanvasFormatId, ShapeLayer, TextLayer } from '@/types'

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

  it('inherits the active group format scope', () => {
    const active = getActiveGroup()
    useEditorStore.getState().updateSlideGroup(active.id, { formats: ['ipad-13'] })
    useEditorStore.getState().addSlideGroup()

    expect(getActiveGroup().formats).toEqual(['ipad-13'])
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

describe('setActiveSlideGroup', () => {
  it('derives family and format from the target group during a cross-family sweep', () => {
    const activeGroup = getActiveGroup()
    const watchGroupId = 'watch-group'
    const appleWatch = 'apple-watch' as CanvasFormatId
    useEditorStore.getState().updateProject({
      slideGroups: [
        activeGroup,
        { ...activeGroup, id: watchGroupId, name: 'Watch', formats: [appleWatch] },
      ],
    })
    useEditorStore.temporal.getState().clear()
    useEditorStore.getState().setActiveCanvasFormat('android-phone')

    for (const group of useEditorStore.getState().project.slideGroups) useEditorStore.getState().setActiveSlideGroup(group.id)

    expect(useEditorStore.getState().activeFamily).toBe('watch')
    expect(useEditorStore.getState().activeCanvasFormat).toBe(BASE_CANVAS_FORMAT)
    expect(useEditorStore.getState().lastGroupByFamily.watch).toBe(watchGroupId)
  })

  it('does not write a dangling active group or family memory for an unknown id', () => {
    const before = useEditorStore.getState()

    useEditorStore.getState().setActiveSlideGroup('missing-group')

    const after = useEditorStore.getState()
    expect(after.activeSlideGroupId).toBe(before.activeSlideGroupId)
    expect(after.activeFamily).toBe(before.activeFamily)
    expect(after.activeCanvasFormat).toBe(before.activeCanvasFormat)
    expect(after.lastGroupByFamily).toEqual(before.lastGroupByFamily)
  })
})

describe('setCaptureSlideGroup', () => {
  it('does not write a dangling active group or family memory for an unknown id', () => {
    const before = useEditorStore.getState()

    useEditorStore.getState().setCaptureSlideGroup('missing-group')

    const after = useEditorStore.getState()
    expect(after.activeSlideGroupId).toBe(before.activeSlideGroupId)
    expect(after.activeFamily).toBe(before.activeFamily)
    expect(after.activeCanvasFormat).toBe(before.activeCanvasFormat)
    expect(after.lastGroupByFamily).toEqual(before.lastGroupByFamily)
  })
})

describe('forkSlideGroupForFormat', () => {
  it('creates a blank, target-scoped group and supports undo/redo', () => {
    const source = getActiveGroup()
    const forkId = useEditorStore.getState().forkSlideGroupForFormat(source.id, 'ipad-13', { blank: true })
    const fork = useEditorStore.getState().project.slideGroups.find((group) => group.id === forkId)!

    expect(fork).toMatchObject({
      slideWidth: 2064,
      slideHeight: 2752,
      formats: ['ipad-13', 'android-tablet', 'ipad-11'],
    })
    expect(fork.layers).toHaveLength(1)
    expect(fork.layers[0]).toMatchObject({ type: 'background' })

    useEditorStore.temporal.getState().undo()
    expect(useEditorStore.getState().project.slideGroups.some((group) => group.id === forkId)).toBe(false)
    useEditorStore.temporal.getState().redo()
    expect(useEditorStore.getState().project.slideGroups.some((group) => group.id === forkId)).toBe(true)
  })

  it('assigns fresh ids recursively and scales locale dx/dy with the fork', () => {
    const source = getActiveGroup()
    const child: ShapeLayer = { id: 'child', name: 'Child', type: 'shape', x: 10, y: 20, rotation: 0, opacity: 1, visible: true, locked: false, shapeType: 'rect', width: 30, height: 40, fill: '#000', cornerRadius: 0, localeAdjust: { es: { base: { dx: 50, dy: 25 }, 'apple-watch': { dx: 13, dy: 9 } } } }
    const parent = { id: 'parent', name: 'Parent', type: 'group', x: 200, y: 300, rotation: 0, opacity: 1, visible: true, locked: false, children: [child] } as import('@/types').GroupLayer
    useEditorStore.getState().updateSlideGroup(source.id, { slideWidth: 1320, slideHeight: 2868, layers: [parent] })
    const updated = getActiveGroup()
    const factor = getFormatScaleFactor(updated, 'apple-watch', BASE_CANVAS_FORMAT)
    const forkId = useEditorStore.getState().forkSlideGroupForFormat(updated.id, 'apple-watch')
    const forkChild = (useEditorStore.getState().project.slideGroups.find((group) => group.id === forkId)!.layers[0] as import('@/types').GroupLayer).children[0]

    expect(forkChild.id).not.toBe(child.id)
    expect(forkChild.localeAdjust?.es?.base?.dx).toBeCloseTo(50 * factor)
    expect(forkChild.localeAdjust?.es?.base?.dy).toBeCloseTo(25 * factor)
    expect(forkChild.localeAdjust?.es?.['apple-watch']).toEqual({ dx: 13, dy: 9 })
  })

  it('shares and backfills a slideKey across forks while dropping source-family locale scopes', () => {
    const source = getActiveGroup()
    const layer: ShapeLayer = {
      id: 'shape', name: 'Shape', type: 'shape', x: 10, y: 20, rotation: 0, opacity: 1, visible: true, locked: false,
      shapeType: 'rect', width: 30, height: 40, fill: '#000', cornerRadius: 0,
      localeAdjust: { es: { base: { dx: 50 }, 'iphone-69': { dx: 13 } } },
    }
    useEditorStore.getState().updateProject({ slideGroups: [{ ...source, slideKey: undefined, layers: [layer] }] })

    const tabletId = useEditorStore.getState().forkSlideGroupForFormat(source.id, 'ipad-13')
    const watchId = useEditorStore.getState().forkSlideGroupForFormat(source.id, 'apple-watch')
    const groups = useEditorStore.getState().project.slideGroups
    const backfilled = groups.find((group) => group.id === source.id)!
    const tablet = groups.find((group) => group.id === tabletId)!
    const watchLayer = groups.find((group) => group.id === watchId)!.layers[0] as ShapeLayer
    const factor = getFormatScaleFactor(backfilled, 'apple-watch', BASE_CANVAS_FORMAT)

    expect(backfilled.slideKey).toBeTruthy()
    expect(tablet.slideKey).toBe(backfilled.slideKey)
    expect(groups.find((group) => group.id === watchId)?.slideKey).toBe(backfilled.slideKey)
    expect(watchLayer.localeAdjust?.es?.base?.dx).toBeCloseTo(50 * factor)
    expect(watchLayer.localeAdjust?.es?.['iphone-69']).toBeUndefined()
  })

  it('deep-copies and bakes the resolver fit-centre scale into the new base coordinates', () => {
    const source = getActiveGroup()
    const layer: ShapeLayer = {
      id: 'source-shape', name: 'Source shape', type: 'shape',
      x: 100, y: 200, rotation: 15, opacity: 1, visible: true, locked: false,
      shapeType: 'rect', width: 300, height: 400, fill: '#f00', cornerRadius: 0,
      localeContent: { es: {} },
    }
    useEditorStore.getState().updateSlideGroup(source.id, {
      slideWidth: 1320,
      slideHeight: 2868,
      layers: [layer],
    })

    const updatedSource = getActiveGroup()
    const forkId = useEditorStore.getState().forkSlideGroupForFormat(updatedSource.id, 'android-phone')
    const fork = useEditorStore.getState().project.slideGroups.find((group) => group.id === forkId)!
    const copied = fork.layers[0] as ShapeLayer
    const scaleFactor = getFormatScaleFactor(updatedSource, FORMAT_FAMILY_ANCHOR.phone, 'base')

    expect(copied).not.toBe(layer)
    expect(copied.x).toBeCloseTo(1320 / 2 + (layer.x - 1320 / 2) * scaleFactor)
    expect(copied.y).toBeCloseTo(2868 / 2 + (layer.y - 2868 / 2) * scaleFactor)
    expect(copied.width).toBeCloseTo(layer.width * scaleFactor)
    expect(copied.height).toBeCloseTo(layer.height * scaleFactor)
    expect(copied.rotation).toBe(layer.rotation)
    expect(copied.localeContent).toEqual(layer.localeContent)
    expect(fork.formats).toEqual(['iphone-69', 'android-phone'])
  })
})

describe('createFormatLayout', () => {
  it('creates a complete target family from five unscoped source groups', () => {
    const first = getActiveGroup()
    const sources = Array.from({ length: 5 }, (_, index) => ({
      ...first,
      id: `phone-${index + 1}`,
      name: `Phone ${index + 1}`,
      formats: undefined,
    }))
    useEditorStore.getState().updateProject({ slideGroups: sources })
    useEditorStore.temporal.getState().clear()

    const { createdGroupIds } = useEditorStore.getState().createFormatLayout('ipad-13', {
      content: 'copy', sourceFormat: BASE_CANVAS_FORMAT,
    })

    const groups = useEditorStore.getState().project.slideGroups
    expect(createdGroupIds).toHaveLength(5)
    expect(groups.filter((group) => groupTargetsFormat(group, 'ipad-13'))).toHaveLength(5)
    expect(groups.filter((group) => groupTargetsFormat(group, 'iphone-69'))).toHaveLength(5)
    expect(groups.filter((group) => groupTargetsFormat(group, 'android-phone'))).toHaveLength(5)
    expect(useEditorStore.getState().project.settings.activeFormats).toContain('ipad-13')
    expect(useEditorStore.temporal.getState().pastStates).toHaveLength(1)

    useEditorStore.temporal.getState().undo()
    expect(useEditorStore.getState().project.slideGroups).toHaveLength(5)
  })

  it('seeds blank forks with the source background and preserves the source name', () => {
    const source = getActiveGroup()
    const sourceBackground = source.layers.find((layer): layer is BackgroundLayer => layer.type === 'background')!
    useEditorStore.getState().updateSlideGroup(source.id, {
      name: 'Onboarding',
      layers: [{ ...sourceBackground, fill: '#123456' }],
    })

    const { createdGroupIds } = useEditorStore.getState().createFormatLayout('ipad-13', {
      content: 'blank', sourceFormat: BASE_CANVAS_FORMAT,
    })

    const fork = useEditorStore.getState().project.slideGroups.find((group) => group.id === createdGroupIds[0])!
    expect(fork.name).toBe('Onboarding')
    expect(fork.layers).toHaveLength(1)
    expect(fork.layers[0]).toMatchObject({ type: 'background', fill: '#123456' })
  })

  it('does not duplicate source groups that already target the target format', () => {
    const first = getActiveGroup()
    const alreadyTargeted = { ...first, id: 'already-targeted', formats: ['iphone-69', 'ipad-13'] as CanvasFormatId[] }
    const uncovered = { ...first, id: 'uncovered', formats: ['iphone-69'] as CanvasFormatId[] }
    useEditorStore.getState().updateProject({ slideGroups: [alreadyTargeted, uncovered] })

    const { createdGroupIds } = useEditorStore.getState().createFormatLayout('ipad-13', {
      content: 'copy', sourceFormat: 'iphone-69',
    })

    expect(createdGroupIds).toHaveLength(1)
    expect(useEditorStore.getState().project.slideGroups).toHaveLength(3)
  })

  it('recomputes scale factors for every source group', () => {
    const first = getActiveGroup()
    const firstLayer: ShapeLayer = { id: 'first-shape', name: 'First', type: 'shape', x: 100, y: 200, rotation: 0, opacity: 1, visible: true, locked: false, shapeType: 'rect', width: 50, height: 80, fill: '#000', cornerRadius: 0 }
    const secondLayer: ShapeLayer = { ...firstLayer, id: 'second-shape', x: 175, y: 400 }
    const wide = { ...first, id: 'wide', name: 'Wide', slideWidth: 1000, slideHeight: 1000, layers: [firstLayer], formats: undefined }
    const tall = { ...first, id: 'tall', name: 'Tall', slideWidth: 500, slideHeight: 2000, layers: [secondLayer], formats: undefined }
    useEditorStore.getState().updateProject({ slideGroups: [wide, tall] })

    const { createdGroupIds } = useEditorStore.getState().createFormatLayout('ipad-13', {
      content: 'copy', sourceFormat: BASE_CANVAS_FORMAT,
    })

    const forks = useEditorStore.getState().project.slideGroups.filter((group) => createdGroupIds.includes(group.id))
    const wideFork = forks.find((group) => group.name === 'Wide')!
    const tallFork = forks.find((group) => group.name === 'Tall')!
    const wideFactor = getFormatScaleFactor(wide, 'ipad-13', BASE_CANVAS_FORMAT)
    const tallFactor = getFormatScaleFactor(tall, 'ipad-13', BASE_CANVAS_FORMAT)
    expect((wideFork.layers[0] as ShapeLayer).x).toBeCloseTo(2064 / 2 + (firstLayer.x - 1000 / 2) * wideFactor)
    expect((tallFork.layers[0] as ShapeLayer).x).toBeCloseTo(2064 / 2 + (secondLayer.x - 500 / 2) * tallFactor)
    expect((tallFork.layers[0] as ShapeLayer).y).toBeCloseTo(2752 / 2 + (secondLayer.y - 2000 / 2) * tallFactor)
    expect((tallFork.layers[0] as ShapeLayer).width).toBeCloseTo(secondLayer.width * tallFactor)
  })

  it('creates another layout from Base after a prior layout is deleted', () => {
    const source = getActiveGroup()
    useEditorStore.getState().createFormatLayout('ipad-13', {
      content: 'copy', sourceFormat: BASE_CANVAS_FORMAT,
    })
    useEditorStore.getState().deleteFormatLayout('ipad-13')
    const project = useEditorStore.getState().project
    const resolved = resolveForkSourceFormat(project, BASE_CANVAS_FORMAT, source.id, 'apple-watch')

    expect(project.slideGroups.every((group) => group.formats !== undefined)).toBe(true)
    expect(resolved).not.toBe(BASE_CANVAS_FORMAT)
    expect(selectForkSourceGroups(project, resolved, 'apple-watch')).not.toHaveLength(0)
    expect(useEditorStore.getState().createFormatLayout('apple-watch', {
      content: 'copy', sourceFormat: resolved,
    }).createdGroupIds).toHaveLength(1)
  })

  it('uses the newly active fork family as the Base-tab default for a third target', () => {
    const source = getActiveGroup()
    useEditorStore.getState().createFormatLayout('ipad-13', {
      content: 'copy', sourceFormat: BASE_CANVAS_FORMAT,
    })
    const { project, activeSlideGroupId } = useEditorStore.getState()

    expect(activeSlideGroupId).not.toBe(source.id)
    expect(resolveForkSourceFormat(project, BASE_CANVAS_FORMAT, activeSlideGroupId, 'apple-watch')).toBe('ipad-13')
  })

  it('falls back to a viable source after the active iPad family is deleted', () => {
    const source = getActiveGroup()
    const { createdGroupIds } = useEditorStore.getState().createFormatLayout('ipad-13', {
      content: 'copy', sourceFormat: BASE_CANVAS_FORMAT,
    })
    useEditorStore.setState({ activeCanvasFormat: 'ipad-13' })
    useEditorStore.getState().removeSlideGroup(createdGroupIds[0]!)

    const { project, activeCanvasFormat, activeSlideGroupId } = useEditorStore.getState()
    const candidates = selectForkSourceCandidates(project, 'ipad-13')
    const resolved = resolveForkSourceFormat(project, activeCanvasFormat, activeSlideGroupId, 'ipad-13')

    expect(activeCanvasFormat).toBe(BASE_CANVAS_FORMAT)
    expect(project.slideGroups.some((group) => group.id === source.id)).toBe(true)
    expect(candidates).toContain(resolved)
    expect(resolved).not.toBe('ipad-13')
    expect(selectForkSourceGroups(project, resolved, 'ipad-13')).not.toHaveLength(0)
  })

  it('does not create a layout for the Base sentinel', () => {
    const before = useEditorStore.getState().project

    expect(useEditorStore.getState().createFormatLayout(BASE_CANVAS_FORMAT, {
      content: 'copy', sourceFormat: BASE_CANVAS_FORMAT,
    })).toEqual({ createdGroupIds: [] })
    expect(useEditorStore.getState().project).toBe(before)
  })
})

describe('deleteFormatLayout', () => {
  it('removes exclusively pinned groups, active format membership, and undoes in one step', () => {
    const source = getActiveGroup()
    const ipadGroup = { ...source, id: 'ipad-group', name: 'iPad', formats: ['ipad-13' as CanvasFormatId] }
    useEditorStore.getState().updateProject({
      settings: { ...useEditorStore.getState().project.settings, activeFormats: ['iphone-69', 'ipad-13'] },
      slideGroups: [source, ipadGroup],
    })
    useEditorStore.setState({ activeSlideGroupId: ipadGroup.id, activeCanvasFormat: 'ipad-13' })
    useEditorStore.temporal.getState().clear()

    useEditorStore.getState().deleteFormatLayout('ipad-13')

    expect(useEditorStore.getState().project.slideGroups.some((group) => group.id === ipadGroup.id)).toBe(false)
    expect(useEditorStore.getState().project.settings.activeFormats).not.toContain('ipad-13')
    expect(useEditorStore.getState().activeSlideGroupId).toBe(source.id)
    expect(useEditorStore.getState().activeCanvasFormat).toBe(BASE_CANVAS_FORMAT)
    expect(useEditorStore.temporal.getState().pastStates).toHaveLength(1)

    useEditorStore.temporal.getState().undo()
    expect(useEditorStore.getState().project.slideGroups.find((group) => group.id === ipadGroup.id)?.formats).toEqual(['ipad-13'])
    expect(useEditorStore.getState().project.settings.activeFormats).toContain('ipad-13')
  })

  it('keeps the last remaining slide group intact', () => {
    const source = getActiveGroup()
    useEditorStore.getState().updateProject({
      settings: { ...useEditorStore.getState().project.settings, activeFormats: ['ipad-13'] },
      slideGroups: [{ ...source, formats: ['ipad-13'] }],
    })
    useEditorStore.temporal.getState().clear()

    useEditorStore.getState().deleteFormatLayout('ipad-13')

    expect(useEditorStore.getState().project.slideGroups).toHaveLength(1)
    expect(useEditorStore.getState().project.slideGroups[0]?.formats).toEqual(['ipad-13'])
    expect(useEditorStore.getState().project.settings.activeFormats).toEqual(['ipad-13'])
    expect(useEditorStore.temporal.getState().pastStates).toHaveLength(0)
  })

  it('blocks deletion of the final active format for a single unscoped phone family', () => {
    const before = useEditorStore.getState().project

    useEditorStore.getState().deleteFormatLayout('iphone-69')
    useEditorStore.getState().deleteFormatLayout('android-phone')

    const state = useEditorStore.getState()
    expect(state.project.slideGroups).toHaveLength(1)
    expect(state.project).not.toBe(before)
    expect(state.project.settings.activeFormats).toContain('android-phone')
  })
})

describe('format-family layout actions', () => {
  it('keeps Base views family-scoped after creating a vision layout', () => {
    useEditorStore.getState().createFormatLayout('visionpro', {
      content: 'copy', sourceFormat: BASE_CANVAS_FORMAT,
    })
    const project = useEditorStore.getState().project

    expect(selectFormatViewGroups(project, BASE_CANVAS_FORMAT, 'vr')).toHaveLength(1)
    expect(selectFormatViewGroups(project, BASE_CANVAS_FORMAT, 'phone')).toHaveLength(1)
    expect(selectProjectFamilies(project)).toEqual(['phone', 'vr'])
  })

  it('pins a Base-source fork only to its source family', () => {
    const initial = getActiveGroup()
    useEditorStore.getState().updateProject({
      settings: { ...useEditorStore.getState().project.settings, activeFormats: ['iphone-69', 'android-phone', 'apple-watch'] },
      slideGroups: [{ ...initial, formats: undefined }],
    })

    useEditorStore.getState().createFormatLayout('ipad-13', { content: 'copy', sourceFormat: BASE_CANVAS_FORMAT })

    expect(useEditorStore.getState().project.slideGroups.find((group) => group.id === initial.id)?.formats)
      .toEqual(selectFamilyFormats(useEditorStore.getState().project, 'phone'))
    expect(useEditorStore.getState().project.slideGroups.find((group) => group.id === initial.id)?.formats)
      .not.toContain('apple-watch')
  })

  it('adopts a format into existing family groups without creating another group', () => {
    useEditorStore.getState().createFormatLayout('ipad-13', { content: 'copy', sourceFormat: BASE_CANVAS_FORMAT })
    const before = useEditorStore.getState().project.slideGroups.length

    useEditorStore.getState().addFormatToFamily('ipad-11')

    const tablet = useEditorStore.getState().project.slideGroups.find((group) => group.formats?.includes('ipad-13'))!
    expect(useEditorStore.getState().project.slideGroups).toHaveLength(before)
    expect(tablet.formats).toEqual(expect.arrayContaining(['ipad-13', 'ipad-11']))
  })

  it('materializes an unscoped family with all canonical formats when re-adopting a deleted format', () => {
    const group = getActiveGroup()
    expect(group.formats).toBeUndefined()

    useEditorStore.getState().deleteFormatLayout('iphone-69')
    expect(useEditorStore.getState().project.settings.activeFormats).toEqual(['android-phone'])

    useEditorStore.getState().createFormatLayout('iphone-69', {
      content: 'copy', sourceFormat: BASE_CANVAS_FORMAT,
    })

    const formats = useEditorStore.getState().project.slideGroups[0]?.formats
    expect(formats).toEqual(expect.arrayContaining(['iphone-69', 'android-phone']))
    expect(new Set(formats).size).toBe(formats?.length)
  })

  it('does not refork a family that already has an authored group', () => {
    useEditorStore.getState().createFormatLayout('ipad-13', { content: 'copy', sourceFormat: BASE_CANVAS_FORMAT })
    const before = useEditorStore.getState().project.slideGroups.length

    expect(useEditorStore.getState().createFormatLayout('ipad-11', {
      content: 'copy', sourceFormat: BASE_CANVAS_FORMAT,
    })).toEqual({ createdGroupIds: [] })
    expect(useEditorStore.getState().project.slideGroups).toHaveLength(before)
  })

  it('navigates to a newly forked family and target format', () => {
    const { createdGroupIds } = useEditorStore.getState().createFormatLayout('visionpro', {
      content: 'copy', sourceFormat: BASE_CANVAS_FORMAT,
    })
    const state = useEditorStore.getState()

    expect(state.activeFamily).toBe('vr')
    expect(state.activeCanvasFormat).toBe('visionpro')
    expect(createdGroupIds).toContain(state.activeSlideGroupId)
  })

  it('navigates to the existing family through the no-refork adoption shortcut', () => {
    useEditorStore.getState().createFormatLayout('ipad-13', { content: 'copy', sourceFormat: BASE_CANVAS_FORMAT })
    const phoneGroup = selectFamilyGroups(useEditorStore.getState().project, 'phone')[0]!
    useEditorStore.setState({ activeFamily: 'phone', activeCanvasFormat: 'iphone-69', activeSlideGroupId: phoneGroup.id })

    expect(useEditorStore.getState().createFormatLayout('ipad-11', {
      content: 'copy', sourceFormat: BASE_CANVAS_FORMAT,
    })).toEqual({ createdGroupIds: [] })

    const state = useEditorStore.getState()
    expect(state.activeFamily).toBe('tablet')
    expect(state.activeCanvasFormat).toBe('ipad-11')
    expect(selectFamilyGroups(state.project, 'tablet').map((group) => group.id)).toContain(state.activeSlideGroupId)
  })

  it('keeps forked/adopted scopes inside exactly one canonical family', () => {
    useEditorStore.getState().createFormatLayout('ipad-13', { content: 'copy', sourceFormat: BASE_CANVAS_FORMAT })
    useEditorStore.getState().createFormatLayout('visionpro', { content: 'copy', sourceFormat: 'iphone-69' })
    useEditorStore.getState().addFormatToFamily('ipad-11')
    const project = useEditorStore.getState().project

    for (const group of project.slideGroups) {
      const matchingFamilies = ['phone', 'tablet', 'watch', 'desktop', 'tv', 'vr', 'game'] as const
      const matching = matchingFamilies.filter((family) => group.formats?.every((format) => selectFamilyFormats(project, family).includes(format)))
      expect(matching).toHaveLength(1)
    }
  })

  it('relocates the active family when deleting its only layout', () => {
    const phone = getActiveGroup()
    const tablet = { ...phone, id: 'tablet-only', name: 'Tablet', formats: ['ipad-13' as CanvasFormatId] }
    useEditorStore.getState().updateProject({
      settings: { ...useEditorStore.getState().project.settings, activeFormats: ['iphone-69', 'ipad-13'] },
      slideGroups: [{ ...phone, formats: ['iphone-69' as CanvasFormatId] }, tablet],
    })
    useEditorStore.setState({ activeFamily: 'tablet', activeSlideGroupId: tablet.id, activeCanvasFormat: 'ipad-13' })

    useEditorStore.getState().deleteFormatLayout('ipad-13')

    expect(useEditorStore.getState().activeFamily).toBe('phone')
  })

  it('removes a complete family through format deletion and relocates to a survivor', () => {
    const phone = getActiveGroup()
    const tablet = { ...phone, id: 'tablet-family', formats: ['ipad-13', 'android-tablet', 'ipad-11'] as CanvasFormatId[] }
    useEditorStore.getState().updateProject({
      settings: { ...useEditorStore.getState().project.settings, activeFormats: ['iphone-69', 'ipad-13', 'android-tablet', 'ipad-11'] },
      slideGroups: [{ ...phone, formats: ['iphone-69' as CanvasFormatId] }, tablet],
    })
    useEditorStore.setState({ activeFamily: 'tablet', activeSlideGroupId: tablet.id, activeCanvasFormat: 'ipad-13' })

    for (const format of ['ipad-13', 'android-tablet', 'ipad-11'] as const) useEditorStore.getState().deleteFormatLayout(format)

    const state = useEditorStore.getState()
    expect(selectProjectFamilies(state.project)).not.toContain('tablet')
    expect(state.activeFamily).toBe('phone')
    expect(state.activeCanvasFormat).toBe(BASE_CANVAS_FORMAT)
    expect(state.activeSlideGroupId).toBe(phone.id)
  })

  it('removes a canonical tablet family when its only active format is deleted', () => {
    const { createdGroupIds } = useEditorStore.getState().createFormatLayout('ipad-11', {
      content: 'copy', sourceFormat: BASE_CANVAS_FORMAT,
    })
    const created = useEditorStore.getState().project.slideGroups.find((group) => group.id === createdGroupIds[0])!
    expect(created.formats).toEqual(['ipad-13', 'android-tablet', 'ipad-11'])
    expect(useEditorStore.getState().project.settings.activeFormats).toContain('ipad-11')

    useEditorStore.getState().deleteFormatLayout('ipad-11')

    const state = useEditorStore.getState()
    expect(state.project.slideGroups.filter((group) => getGroupFamilyKey(group) === 'tablet')).toHaveLength(0)
    expect(selectProjectFamilies(state.project)).not.toContain('tablet')
    expect(state.activeFamily).toBe('phone')
    expect(state.activeCanvasFormat).toBe(BASE_CANVAS_FORMAT)
  })

  it('keeps canonical group membership until the final active family format is deleted', () => {
    useEditorStore.getState().createFormatLayout('ipad-13', { content: 'copy', sourceFormat: BASE_CANVAS_FORMAT })
    useEditorStore.getState().addFormatToFamily('ipad-11')
    const before = selectFamilyGroups(useEditorStore.getState().project, 'tablet')[0]!
    const canonicalFormats = [...before.formats!]

    useEditorStore.getState().deleteFormatLayout('ipad-13')

    let state = useEditorStore.getState()
    const surviving = selectFamilyGroups(state.project, 'tablet')[0]!
    expect(surviving.formats).toEqual(canonicalFormats)
    expect(state.project.settings.activeFormats).toContain('ipad-11')
    expect(selectProjectFamilies(state.project)).toContain('tablet')

    useEditorStore.getState().deleteFormatLayout('ipad-11')

    state = useEditorStore.getState()
    expect(selectProjectFamilies(state.project)).not.toContain('tablet')
  })

  it('creates a fresh family again after its last active format was deleted', () => {
    useEditorStore.getState().createFormatLayout('ipad-11', { content: 'copy', sourceFormat: BASE_CANVAS_FORMAT })
    useEditorStore.getState().deleteFormatLayout('ipad-11')

    const recreated = useEditorStore.getState().createFormatLayout('ipad-13', {
      content: 'copy', sourceFormat: 'iphone-69',
    })

    expect(recreated.createdGroupIds).toHaveLength(1)
    expect(selectFamilyGroups(useEditorStore.getState().project, 'tablet')).toHaveLength(1)
  })
})

describe('removeSlideGroup family relocation', () => {
  it('relocates an active family after its last group is removed', () => {
    const phone = getActiveGroup()
    const tablet = { ...phone, id: 'tablet-only', formats: ['ipad-13' as CanvasFormatId] }
    useEditorStore.getState().updateProject({ slideGroups: [{ ...phone, formats: ['iphone-69' as CanvasFormatId] }, tablet] })
    useEditorStore.setState({ activeFamily: 'tablet', activeCanvasFormat: 'ipad-13', activeSlideGroupId: tablet.id })

    useEditorStore.getState().removeSlideGroup(tablet.id)

    const state = useEditorStore.getState()
    expect(selectProjectFamilies(state.project)).not.toContain('tablet')
    expect(state.activeFamily).toBe('phone')
    expect(state.activeCanvasFormat).toBe(BASE_CANVAS_FORMAT)
    expect(state.activeSlideGroupId).toBe(phone.id)
  })

  it('keeps active family context when another group in it survives', () => {
    const initial = getActiveGroup()
    const tabletOne = { ...initial, id: 'tablet-one', formats: ['ipad-13' as CanvasFormatId] }
    const tabletTwo = { ...initial, id: 'tablet-two', formats: ['ipad-13' as CanvasFormatId] }
    useEditorStore.getState().updateProject({
      settings: { ...useEditorStore.getState().project.settings, activeFormats: ['ipad-13'] },
      slideGroups: [tabletOne, tabletTwo],
    })
    useEditorStore.setState({ activeFamily: 'tablet', activeCanvasFormat: 'ipad-13', activeSlideGroupId: tabletOne.id })

    useEditorStore.getState().removeSlideGroup(tabletTwo.id)

    const state = useEditorStore.getState()
    expect(state.activeFamily).toBe('tablet')
    expect(state.activeCanvasFormat).toBe('ipad-13')
    expect(state.activeSlideGroupId).toBe(tabletOne.id)
  })
})

describe('undo/redo family navigation reconciliation', () => {
  const expectValidNavigation = () => {
    const state = useEditorStore.getState()
    expect(selectProjectFamilies(state.project)).toContain(state.activeFamily)
    expect(state.project.slideGroups.map((group) => group.id)).toContain(state.activeSlideGroupId)
  }

  it('repairs navigation after undoing and redoing a family fork', () => {
    useEditorStore.getState().createFormatLayout('ipad-13', { content: 'copy', sourceFormat: BASE_CANVAS_FORMAT })

    useEditorStore.temporal.getState().undo()
    expectValidNavigation()

    useEditorStore.temporal.getState().redo()
    expectValidNavigation()
  })

  it('repairs navigation after undoing a deletion that emptied a family', () => {
    useEditorStore.getState().createFormatLayout('ipad-11', { content: 'copy', sourceFormat: BASE_CANVAS_FORMAT })
    useEditorStore.temporal.getState().clear()
    useEditorStore.getState().deleteFormatLayout('ipad-11')

    useEditorStore.temporal.getState().undo()
    expectValidNavigation()

    useEditorStore.temporal.getState().redo()
    expectValidNavigation()
  })

  it('keeps the active group inside the surviving active family after undoing an added slide', () => {
    const initial = getActiveGroup()
    const phone = { ...initial, id: 'phone', formats: ['iphone-69' as CanvasFormatId] }
    const tabletOne = { ...initial, id: 'tablet-1', formats: ['ipad-13' as CanvasFormatId] }
    const tabletTwo = { ...initial, id: 'tablet-2', formats: ['ipad-13' as CanvasFormatId] }
    useEditorStore.getState().updateProject({
      settings: { ...useEditorStore.getState().project.settings, activeFormats: ['iphone-69', 'ipad-13'] },
      slideGroups: [phone, tabletOne, tabletTwo],
    })
    useEditorStore.setState({ activeFamily: 'tablet', activeCanvasFormat: 'ipad-13', activeSlideGroupId: tabletTwo.id })
    useEditorStore.temporal.getState().clear()

    useEditorStore.getState().addSlideGroup()
    useEditorStore.temporal.getState().undo()

    const state = useEditorStore.getState()
    const activeGroup = state.project.slideGroups.find((group) => group.id === state.activeSlideGroupId)!
    expect(state.activeFamily).toBe('tablet')
    expect(getGroupFamilyKey(activeGroup)).toBe(state.activeFamily)
  })
})

describe('pullContentFromFamily', () => {
  const textLayer = (id: string, value: string): TextLayer => ({
    id, name: id, type: 'text', x: 0, y: 0, rotation: 0, opacity: 1, visible: true, locked: false,
    text: value, fontFamily: 'Inter', fontSize: 24, fontWeight: 700, fill: '#fff', letterSpacing: 0, lineHeight: 1.2, align: 'left',
    localeContent: { en: { text: value }, es: { text: `${value} ES` } },
  })

  it('commits an ordinal family match in one undo step', () => {
    const initial = getActiveGroup()
    const phone = { ...initial, id: 'phone-1', formats: ['iphone-69' as CanvasFormatId], layers: [textLayer('phone-text', 'Phone content')] }
    const tablet = { ...initial, id: 'tablet-1', formats: ['ipad-13' as CanvasFormatId], layers: [textLayer('tablet-text', 'Tablet content')] }
    useEditorStore.getState().updateProject({ slideGroups: [phone, tablet] })
    useEditorStore.setState({ activeFamily: 'tablet', activeSlideGroupId: tablet.id })
    useEditorStore.temporal.getState().clear()

    const plan = useEditorStore.getState().pullContentFromFamily('phone')

    expect(plan.updatedCount).toBe(1)
    expect((useEditorStore.getState().project.slideGroups.find((group) => group.id === tablet.id)?.layers[0] as import('@/types').TextLayer).text).toBe('Phone content')
    expect(useEditorStore.temporal.getState().pastStates).toHaveLength(1)
  })

  it('is a project-reference-preserving no-op without an ordinal source or for the same family', () => {
    const initial = getActiveGroup()
    const phone = { ...initial, id: 'phone-only', slideKey: undefined, formats: ['iphone-69' as CanvasFormatId] }
    const tabletOne = { ...initial, id: 'tablet-1', slideKey: undefined, formats: ['ipad-13' as CanvasFormatId] }
    const tabletTwo = { ...initial, id: 'tablet-2', slideKey: undefined, formats: ['ipad-13' as CanvasFormatId] }
    useEditorStore.getState().updateProject({ slideGroups: [phone, tabletOne, tabletTwo] })
    useEditorStore.setState({ activeFamily: 'tablet', activeSlideGroupId: tabletTwo.id })
    useEditorStore.temporal.getState().clear()
    const before = useEditorStore.getState().project

    expect(useEditorStore.getState().pullContentFromFamily('phone')).toMatchObject({ updatedCount: 0, skippedCount: 0, entries: [] })
    expect(useEditorStore.getState().project).toBe(before)
    expect(useEditorStore.getState().pullContentFromFamily('tablet')).toMatchObject({ updatedCount: 0, skippedCount: 0, entries: [] })
    expect(useEditorStore.getState().project).toBe(before)
    expect(useEditorStore.temporal.getState().pastStates).toHaveLength(0)
  })

  it('uses the matching group ordinal rather than the first or third source group', () => {
    const initial = getActiveGroup()
    const phoneGroups = ['First', 'Second', 'Third'].map((value, index) => ({
      ...initial, id: `phone-${index}`, name: `Phone ${index}`, slideKey: undefined, formats: ['iphone-69' as CanvasFormatId], layers: [textLayer(`phone-text-${index}`, value)],
    }))
    const tabletGroups = ['One', 'Two', 'Three'].map((value, index) => ({
      ...initial, id: `tablet-${index}`, name: `Tablet ${index}`, slideKey: undefined, formats: ['ipad-13' as CanvasFormatId], layers: [textLayer(`tablet-text-${index}`, value)],
    }))
    useEditorStore.getState().updateProject({ slideGroups: [...phoneGroups, ...tabletGroups] })
    useEditorStore.setState({ activeFamily: 'tablet', activeSlideGroupId: 'tablet-1' })

    useEditorStore.getState().pullContentFromFamily('phone')

    expect((useEditorStore.getState().project.slideGroups.find((group) => group.id === 'tablet-1')?.layers[0] as import('@/types').TextLayer).text).toBe('Second')
  })

  it('uses slideKey over the wrong positional counterpart after a family deletion', () => {
    const initial = getActiveGroup()
    const phoneA = { ...initial, id: 'phone-a', slideKey: 'a', formats: ['iphone-69' as CanvasFormatId], layers: [textLayer('a', 'Wrong positional source')] }
    const phoneB = { ...initial, id: 'phone-b', slideKey: 'b', formats: ['iphone-69' as CanvasFormatId], layers: [textLayer('b', 'Linked source')] }
    const tabletB = { ...initial, id: 'tablet-b', slideKey: 'b', formats: ['ipad-13' as CanvasFormatId], layers: [textLayer('target', 'Target')] }
    useEditorStore.getState().updateProject({ slideGroups: [phoneA, phoneB, tabletB] })
    useEditorStore.setState({ activeFamily: 'tablet', activeSlideGroupId: tabletB.id })

    useEditorStore.getState().pullContentFromFamily('phone')

    expect((useEditorStore.getState().project.slideGroups.find((group) => group.id === tabletB.id)?.layers[0] as TextLayer).text).toBe('Linked source')
  })
})

describe('duplicateSlideGroup', () => {
  it('creates a new conceptual slideKey', () => {
    const source = getActiveGroup()
    useEditorStore.getState().duplicateSlideGroup(source.id)

    expect(getActiveGroup().slideKey).not.toBe(source.slideKey)
  })
})
