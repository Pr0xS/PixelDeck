import { beforeEach, describe, expect, it } from 'vitest'
import type { GroupLayer, Layer, TextLayer } from '@/types'
import { BASE_CANVAS_FORMAT, resolveProjectView } from '@/utils/canvasFormats'
import { applyTemplate, projectToTemplate } from '@/utils/templates'
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
    styleClipboard: null,
  })
  useEditorStore.temporal.getState().clear()
})

describe('locale/format layout write routing', () => {
  it('stores non-default locale layout as a format-scoped localeAdjust delta', () => {
    useEditorStore.getState().addText()
    const layer = getTextLayer()
    enterGermanAndroid()

    useEditorStore.getState().updateLayer(layer.id, { x: 200 })

    const updated = getTextLayer()
    expect(updated.x).toBe(layer.x) // shared base untouched
    expect(updated.localeAdjust?.de?.[ANDROID_FORMAT]?.dx).toBeDefined()
    expect(updated.formatOverrides).toBeUndefined()

    const resolved = resolveProjectView(useEditorStore.getState().project, 'de', ANDROID_FORMAT)
    const resolvedLayer = resolved.slideGroups[0].layers.find((candidate) => candidate.id === layer.id)!
    expect(resolvedLayer.x).toBe(200)
  })

  it('stores base geometry as a non-default locale base-scoped delta while writing shared non-layout fields', () => {
    useEditorStore.getState().addText()
    const layer = getTextLayer()
    useEditorStore.getState().setActiveLocale('de')

    useEditorStore.getState().updateLayer(layer.id, { x: 200, visible: false })

    const updated = getTextLayer()
    expect(updated.x).toBe(layer.x)
    expect(updated.visible).toBe(false)
    // Base scope: raw === resolved, so the derived delta is exact.
    expect(updated.localeAdjust?.de?.[BASE_CANVAS_FORMAT]?.dx).toBe(200 - layer.x)
    expect(updated.localeAdjust?.de?.[ANDROID_FORMAT]).toBeUndefined()
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

    const updated = getTextLayer() as TextLayer
    expect(updated).toMatchObject({
      x: layer.x,
      width: (layer as TextLayer).width,
      fontSize: (layer as TextLayer).fontSize,
      rotation: layer.rotation,
      text: (layer as TextLayer).text,
      opacity: 0.5,
      fill: '#ff0000',
      visible: false,
      locked: true,
    })
    expect(updated.localeContent?.de?.text).toBe('Hallo')
    expect(updated.localeAdjust?.de?.[BASE_CANVAS_FORMAT]).toMatchObject({
      dx: 200 - layer.x,
      mWidth: 480 / ((layer as TextLayer).width ?? 1),
      mFontSize: 72 / (layer as TextLayer).fontSize,
      dRotation: 15 - layer.rotation,
    })
    expect(updated.localeAdjust?.de?.[ANDROID_FORMAT]).toBeUndefined()
    expect(updated.formatOverrides).toBeUndefined()
  })

  it('prunes no-op base-scoped deltas and removes an empty localeAdjust cell', () => {
    useEditorStore.getState().addText()
    const layer = getTextLayer()
    useEditorStore.getState().setActiveLocale('de')

    useEditorStore.getState().updateLayer(layer.id, { x: layer.x + 50, y: layer.y })
    expect(getTextLayer().localeAdjust?.de?.[BASE_CANVAS_FORMAT]).toEqual({ dx: 50 })

    useEditorStore.getState().updateLayer(layer.id, { x: layer.x, y: layer.y })
    expect(getTextLayer().localeAdjust).toBeUndefined()
  })

  it('preserves default-locale non-base routing through formatOverrides', () => {
    useEditorStore.getState().addText()
    const layer = getTextLayer()
    useEditorStore.getState().setActiveCanvasFormat(ANDROID_FORMAT)

    useEditorStore.getState().updateLayer(layer.id, { x: 200 })

    const updated = getTextLayer()
    expect(updated.x).toBe(layer.x)
    expect(updated.formatOverrides?.[ANDROID_FORMAT]?.x).toBe(200)
    expect(updated.localeAdjust).toBeUndefined()
  })

  it('routes nested child layout to a format-scoped localeAdjust cell', () => {
    const { group, textId } = createGroupWithText()
    const original = group.children.find((child) => child.id === textId)!
    enterGermanAndroid()

    useEditorStore.getState().updateChildLayer(group.id, textId, { x: 200 })

    const updatedGroup = getActiveGroup().layers.find((layer) => layer.id === group.id) as GroupLayer
    const updated = updatedGroup.children.find((child) => child.id === textId)!
    expect(updated.x).toBe(original.x)
    expect(updated.localeAdjust?.de?.[ANDROID_FORMAT]?.dx).toBeDefined()
    expect(updated.formatOverrides).toBeUndefined()

    const resolved = resolveProjectView(useEditorStore.getState().project, 'de', ANDROID_FORMAT)
    const resolvedGroup = resolved.slideGroups[0].layers.find((layer) => layer.id === group.id) as GroupLayer
    expect(resolvedGroup.children.find((child) => child.id === textId)?.x).toBe(200)
  })

  it('stores nested child base geometry as a base-scoped localeAdjust delta while allowing non-layout fields', () => {
    const { group, textId } = createGroupWithText()
    const original = group.children.find((child) => child.id === textId)!
    useEditorStore.getState().setActiveLocale('de')

    useEditorStore.getState().updateChildLayer(group.id, textId, { x: 200, visible: false })

    const updatedGroup = getActiveGroup().layers.find((layer) => layer.id === group.id) as GroupLayer
    const updated = updatedGroup.children.find((child) => child.id === textId)!
    expect(updated.x).toBe(original.x)
    expect(updated.visible).toBe(false)
    expect(updated.localeAdjust?.de?.[BASE_CANVAS_FORMAT]?.dx).toBe(200 - original.x)
    expect(updated.localeAdjust?.de?.[ANDROID_FORMAT]).toBeUndefined()
  })
})

describe('locale/format layout cleanup actions', () => {
  it('clears one format-scoped localeAdjust cell and prunes empty locale maps', () => {
    useEditorStore.getState().addText()
    const layerId = getTextLayer().id
    enterGermanAndroid()
    useEditorStore.getState().updateLayer(layerId, { x: 200 })

    useEditorStore.getState().clearLayerLocaleAdjust(layerId)

    expect(getTextLayer().localeAdjust).toBeUndefined()
  })

  it('clears one format-scoped localeAdjust key and prunes the cell only when empty', () => {
    useEditorStore.getState().addText()
    const layerId = getTextLayer().id
    enterGermanAndroid()
    useEditorStore.getState().updateLayer(layerId, { x: 200, y: 300 })

    useEditorStore.getState().clearLayerLocaleAdjustKey(layerId, 'x')
    expect(getTextLayer().localeAdjust?.de?.[ANDROID_FORMAT]).toEqual({ dy: expect.any(Number) })

    useEditorStore.getState().clearLayerLocaleAdjustKey(layerId, 'y')
    expect(getTextLayer().localeAdjust).toBeUndefined()
  })

  it('resets the active localeAdjust scope throughout the active layer tree', () => {
    const { group, textId } = createGroupWithText()
    enterGermanAndroid()
    useEditorStore.getState().updateLayer(group.id, { x: 200 })
    useEditorStore.getState().updateChildLayer(group.id, textId, { y: 300 })

    useEditorStore.getState().resetActiveLocaleAdjust()

    const updatedGroup = getActiveGroup().layers.find((layer) => layer.id === group.id) as GroupLayer
    const child = updatedGroup.children.find((layer) => layer.id === textId) as Layer
    expect(updatedGroup.localeAdjust).toBeUndefined()
    expect(child.localeAdjust).toBeUndefined()
  })

  it('clears a base-scoped localeAdjust delta by layout key and prunes the delta map when empty', () => {
    useEditorStore.getState().addText()
    const layer = getTextLayer()
    useEditorStore.getState().setActiveLocale('de')
    useEditorStore.getState().updateLayer(layer.id, { x: layer.x + 50, y: layer.y + 25 })

    useEditorStore.getState().clearLayerLocaleAdjustKey(layer.id, 'x', undefined, BASE_CANVAS_FORMAT)
    expect(getTextLayer().localeAdjust?.de?.[BASE_CANVAS_FORMAT]).toEqual({ dy: 25 })

    useEditorStore.getState().clearLayerLocaleAdjustKey(layer.id, 'y', undefined, BASE_CANVAS_FORMAT)
    expect(getTextLayer().localeAdjust).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────
// Ported from the deleted `canvasFormats.locale-base-delta.test.ts` (P4
// zombie-file cleanup): this describe already wrote through real store
// actions and read back via the live resolveProjectView — only the internal
// field name being asserted changes (localeBaseDelta -> localeAdjust base
// scope), the behavior under test is unchanged.
// ─────────────────────────────────────────────────────────────────────────
describe('locale base-scoped adjustment write isolation and persistence', () => {
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

  it('leaves the default-locale Base view unaffected by a German base-scoped write', () => {
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

  it('round-trips base-scoped localeAdjust deltas through project export and import', () => {
    useEditorStore.getState().addText()
    const layer = getActiveText()
    useEditorStore.getState().setActiveLocale('de')
    useEditorStore.getState().updateLayer(layer.id, { x: layer.x + 50 })
    const json = useEditorStore.getState().exportProject()

    useEditorStore.getState().resetProject()
    useEditorStore.getState().importProject(json)

    const imported = getActiveText()
    expect(imported.localeAdjust).toEqual({ de: { [BASE_CANVAS_FORMAT]: { dx: 50 } } })
  })

  it('preserves base-scoped localeAdjust deltas when duplicating a layer', () => {
    useEditorStore.getState().addText()
    const layer = getActiveText()
    useEditorStore.getState().setActiveLocale('de')
    useEditorStore.getState().updateLayer(layer.id, { x: layer.x + 50 })

    useEditorStore.getState().duplicateLayer(layer.id)

    const duplicate = useEditorStore.getState().project.slideGroups
      .find((group) => group.id === useEditorStore.getState().activeSlideGroupId)!.layers
      .find((candidate) => candidate.type === 'text' && candidate.id !== layer.id) as TextLayer
    expect(duplicate.localeAdjust).toEqual({ de: { [BASE_CANVAS_FORMAT]: { dx: 50 } } })
  })

  it('preserves base-scoped localeAdjust deltas through template export and apply', () => {
    useEditorStore.getState().addText()
    const layer = getActiveText()
    useEditorStore.getState().setActiveLocale('de')
    useEditorStore.getState().updateLayer(layer.id, { x: layer.x + 50 })
    useEditorStore.getState().setActiveLocale('en')

    const applied = applyTemplate(projectToTemplate(useEditorStore.getState().project, { name: 'Locale delta' }))

    const appliedLayer = applied.slideGroups[0].layers.find((candidate) => candidate.type === 'text') as TextLayer
    expect(appliedLayer.localeAdjust).toEqual({ de: { [BASE_CANVAS_FORMAT]: { dx: 50 } } })
  })

  it('keeps an existing base-scoped delta when pasting layout-relevant style properties', () => {
    useEditorStore.getState().addText()
    useEditorStore.getState().addText()
    const [source, target] = useEditorStore.getState().project.slideGroups
      .find((group) => group.id === useEditorStore.getState().activeSlideGroupId)!.layers
      .filter((layer): layer is TextLayer => layer.type === 'text')
    useEditorStore.getState().setActiveLocale('de')
    useEditorStore.getState().updateLayer(target.id, { x: target.x + 50 })
    useEditorStore.getState().copyLayerStyle(source.id)

    useEditorStore.getState().pasteLayerStyle(target.id)

    expect(getActiveTextById(target.id).localeAdjust).toEqual({ de: { [BASE_CANVAS_FORMAT]: { dx: 50 } } })
  })
})
