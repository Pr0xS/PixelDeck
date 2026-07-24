import { beforeEach, describe, expect, it } from 'vitest'
import type { GroupLayer, Project, SlideGroup, TextLayer } from '@/types'
import {
  applyCanvasFormatToGroup,
  buildFormatScaleMap,
  getFormatScaleFactor,
  BASE_CANVAS_FORMAT,
  resolveProjectView,
} from './canvasFormats'
import { applyTemplate, projectToTemplate } from './templates'
import { useEditorStore } from '@/store'

const ANDROID_FORMAT = 'android-phone' as const

const makeText = (partial: Partial<TextLayer> = {}): TextLayer => ({
  id: 'text', name: 'Text', type: 'text', x: 100, y: 200, rotation: 0,
  opacity: 1, visible: true, locked: false, text: 'Hello', fontFamily: 'Inter',
  fontSize: 100, fontWeight: 700, fill: '#fff', letterSpacing: 0, lineHeight: 1, align: 'left',
  ...partial,
})

const makeGroup = (partial: Partial<SlideGroup> = {}): SlideGroup => ({
  id: 'group', name: 'Slide', numSlides: 1, slideWidth: 1320, slideHeight: 2868,
  layers: [makeText({ width: 400 })], slideNames: ['slide-01'], ...partial,
})

const makeProject = (group = makeGroup()): Project => ({
  id: 'project', name: 'Project', createdAt: '', updatedAt: '',
  settings: { defaultSlideWidth: 1320, defaultSlideHeight: 2868, defaultLocale: 'en', brandName: 'App' },
  slideGroups: [group],
})

describe('locale base delta scale safety', () => {
  it('matches the scale actually used by applyCanvasFormatToGroup', () => {
    const group = makeGroup()
    const factor = getFormatScaleFactor(group, 'android-phone', BASE_CANVAS_FORMAT)
    const resolved = applyCanvasFormatToGroup(group, 'android-phone', BASE_CANVAS_FORMAT)
    const source = group.layers[0] as TextLayer
    const projected = resolved.layers[0] as TextLayer

    expect(projected.width! / source.width!).toBeCloseTo(factor)
  })

  it('captures pre-format dimensions in the scale map before target dimensions replace them', () => {
    const project = makeProject()
    const scaleMap = buildFormatScaleMap(project, 'android-phone', BASE_CANVAS_FORMAT)
    const postFormatProject = { ...project, slideGroups: [applyCanvasFormatToGroup(project.slideGroups[0], 'android-phone', BASE_CANVAS_FORMAT)] }

    expect(scaleMap.get('group')).toBeCloseTo(Math.min(1080 / 1320, 1920 / 2868))
    expect(buildFormatScaleMap(postFormatProject, 'android-phone', BASE_CANVAS_FORMAT).get('group')).toBe(1)
  })

  it('scales additive base deltas before format-specific locale overrides win', () => {
    const project = makeProject(makeGroup({ layers: [makeText({
      width: 400,
      localeBaseDelta: { de: { dx: 30, mWidth: 2 } },
      localeLayoutOverrides: { de: { 'android-phone': { x: 777 } } },
    })] }))
    const resolved = resolveProjectView(project, 'de', 'android-phone').slideGroups[0].layers[0] as TextLayer
    const factor = Math.min(1080 / 1320, 1920 / 2868)

    expect(resolved.x).toBe(777)
    expect(resolved.width).toBeCloseTo(400 * factor * 2)
  })

  it('composes a locale base delta on top of a format override on the same key', () => {
    const project = makeProject(makeGroup({ layers: [makeText({
      formatOverrides: { [ANDROID_FORMAT]: { x: 600 } },
      localeBaseDelta: { de: { dx: 30 } },
    })] }))
    const factor = Math.min(1080 / 1320, 1920 / 2868)
    const resolved = resolveProjectView(project, 'de', ANDROID_FORMAT).slideGroups[0].layers[0] as TextLayer

    expect(resolved.x).toBeCloseTo(600 + 30 * factor)
  })

  it('scales base delta positions equally for canvas- and origin-anchored layers', () => {
    const dx = 30
    const child = makeText({ id: 'child', x: 100, localeBaseDelta: { de: { dx } } })
    const parent: GroupLayer = {
      id: 'parent', name: 'Group', type: 'group', x: 500, y: 400, rotation: 0,
      opacity: 1, visible: true, locked: false, children: [child],
    }
    const project = makeProject(makeGroup({ layers: [
      makeText({ id: 'top-level', x: 100, localeBaseDelta: { de: { dx } } }),
      parent,
    ] }))
    const withoutDelta = makeProject(makeGroup({ layers: [
      makeText({ id: 'top-level', x: 100 }),
      { ...parent, children: [makeText({ id: 'child', x: 100 })] },
    ] }))
    const factor = Math.min(1080 / 1320, 1920 / 2868)
    const resolved = resolveProjectView(project, 'de', ANDROID_FORMAT).slideGroups[0].layers
    const baseline = resolveProjectView(withoutDelta, 'de', ANDROID_FORMAT).slideGroups[0].layers
    const resolvedTop = resolved.find((layer) => layer.id === 'top-level')!
    const baselineTop = baseline.find((layer) => layer.id === 'top-level')!
    const resolvedChild = (resolved.find((layer) => layer.id === 'parent') as GroupLayer).children[0]
    const baselineChild = (baseline.find((layer) => layer.id === 'parent') as GroupLayer).children[0]

    expect(resolvedTop.x - baselineTop.x).toBeCloseTo(dx * factor)
    expect(resolvedChild.x - baselineChild.x).toBeCloseTo(dx * factor)
  })

  it.each([1, 2, 3])('keeps pano scale algebraically equivalent for %i slide(s)', (numSlides) => {
    const group = makeGroup({ numSlides, slideNames: Array.from({ length: numSlides }, (_, index) => `slide-${index + 1}`) })
    const expected = Math.min((1080 * numSlides) / (1320 * numSlides), 1920 / 2868)

    expect(getFormatScaleFactor(group, ANDROID_FORMAT, BASE_CANVAS_FORMAT)).toBeCloseTo(expected)
  })
})

describe('locale base delta write isolation and persistence', () => {
  function getActiveText() {
    const { project, activeSlideGroupId } = useEditorStore.getState()
    return project.slideGroups.find((group) => group.id === activeSlideGroupId)!.layers
      .find((layer) => layer.type === 'text') as TextLayer
  }

  function getActiveTextById(id: string) {
    const { project, activeSlideGroupId } = useEditorStore.getState()
    return project.slideGroups.find((group) => group.id === activeSlideGroupId)!.layers
      .find((layer) => layer.id === id) as TextLayer
  }

  beforeEach(() => {
    useEditorStore.getState().resetProject()
    useEditorStore.setState({
      activeLocale: 'en', activeCanvasFormat: BASE_CANVAS_FORMAT, editingGroupId: null,
      selectedLayerIds: [], selection: null, styleClipboard: null,
    })
    useEditorStore.temporal.getState().clear()
  })

  it('leaves the default-locale Base view unaffected by a German base-delta write', () => {
    useEditorStore.getState().addText()
    const layer = getActiveText()
    const before = resolveProjectView(useEditorStore.getState().project, 'en', BASE_CANVAS_FORMAT)
      .slideGroups[0].layers.find((candidate) => candidate.id === layer.id) as TextLayer

    useEditorStore.getState().setActiveLocale('de')
    useEditorStore.getState().updateLayer(layer.id, { x: layer.x + 50, y: layer.y - 25 })

    const after = resolveProjectView(useEditorStore.getState().project, 'en', BASE_CANVAS_FORMAT)
      .slideGroups[0].layers.find((candidate) => candidate.id === layer.id) as TextLayer
    expect(after.x).toBe(before.x)
    expect(after.y).toBe(before.y)
    expect(after.rotation).toBe(before.rotation)
    expect(after.width).toBe(before.width)
    expect(after.fontSize).toBe(before.fontSize)
  })

  it('round-trips locale base deltas through project export and import', () => {
    useEditorStore.getState().addText()
    const layer = getActiveText()
    useEditorStore.getState().setActiveLocale('de')
    useEditorStore.getState().updateLayer(layer.id, { x: layer.x + 50 })
    const json = useEditorStore.getState().exportProject()

    useEditorStore.getState().resetProject()
    useEditorStore.getState().importProject(json)

    const imported = getActiveText()
    expect(imported.localeBaseDelta).toEqual({ de: { dx: 50 } })
  })

  it('preserves locale base deltas when duplicating a layer', () => {
    useEditorStore.getState().addText()
    const layer = getActiveText()
    useEditorStore.getState().setActiveLocale('de')
    useEditorStore.getState().updateLayer(layer.id, { x: layer.x + 50 })

    useEditorStore.getState().duplicateLayer(layer.id)

    const duplicate = useEditorStore.getState().project.slideGroups
      .find((group) => group.id === useEditorStore.getState().activeSlideGroupId)!.layers
      .find((candidate) => candidate.type === 'text' && candidate.id !== layer.id) as TextLayer
    expect(duplicate.localeBaseDelta).toEqual({ de: { dx: 50 } })
  })

  it('preserves locale base deltas through template export and apply', () => {
    const project = makeProject(makeGroup({ layers: [makeText({ localeBaseDelta: { de: { dx: 50 } } })] }))

    const applied = applyTemplate(projectToTemplate(project, { name: 'Locale delta' }))

    expect((applied.slideGroups[0].layers[0] as TextLayer).localeBaseDelta).toEqual({ de: { dx: 50 } })
  })

  it('keeps an existing position delta when pasting layout-relevant style properties', () => {
    useEditorStore.getState().addText()
    useEditorStore.getState().addText()
    const [source, target] = useEditorStore.getState().project.slideGroups
      .find((group) => group.id === useEditorStore.getState().activeSlideGroupId)!.layers
      .filter((layer): layer is TextLayer => layer.type === 'text')
    useEditorStore.getState().setActiveLocale('de')
    useEditorStore.getState().updateLayer(target.id, { x: target.x + 50 })
    useEditorStore.getState().copyLayerStyle(source.id)

    useEditorStore.getState().pasteLayerStyle(target.id)

    expect(getActiveTextById(target.id).localeBaseDelta).toEqual({ de: { dx: 50 } })
  })
})
