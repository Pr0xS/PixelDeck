import { describe, it, expect } from 'vitest'
import {
  applyCanvasFormatToGroup,
  getFormatCanvasDims,
  mapLayerToAuthoringSpace,
  resolveLayerFormat,
  countFormatAdjustments,
  BASE_CANVAS_FORMAT,
  getCanvasFormat,
  getProjectActiveFormats,
  getProjectBaseFormat,
  normalizeProjectFormats,
} from './canvasFormats'
import type { Layer, PhoneLayer, Project, SlideGroup, TextLayer, ShapeLayer } from '@/types'

const makeText = (partial?: Partial<TextLayer>): TextLayer => ({
  id: 't1', name: 'Title', type: 'text',
  x: 100, y: 200, rotation: 0, opacity: 1, visible: true, locked: false,
  text: 'Hello', fontFamily: 'Inter', fontSize: 100, fontWeight: 700,
  fill: '#fff', letterSpacing: 0, lineHeight: 1.2, align: 'left',
  ...partial,
})

const makeShape = (partial?: Partial<ShapeLayer>): ShapeLayer => ({
  id: 's1', name: 'Rect', type: 'shape',
  x: 50, y: 60, rotation: 0, opacity: 1, visible: true, locked: false,
  shapeType: 'rect', width: 300, height: 400, fill: '#f00', cornerRadius: 0,
  ...partial,
})

const makeGroup = (layers: Layer[], partial?: Partial<SlideGroup>): SlideGroup => ({
  id: 'g1', name: 'Slide 1', numSlides: 1,
  slideWidth: 1320, slideHeight: 2868,
  layers, slideNames: ['slide-01'],
  ...partial,
})

const makeProject = (settings?: Partial<Project['settings']>): Project => ({
  id: 'p1', name: 'Project', createdAt: '', updatedAt: '',
  settings: {
    defaultSlideWidth: 1320,
    defaultSlideHeight: 2868,
    defaultLocale: 'en',
    brandName: 'App',
    ...settings,
  },
  slideGroups: [makeGroup([])],
})

describe('project format settings migration', () => {
  it('always treats the base canvas as the non-exported base sentinel', () => {
    const project = makeProject({ baseCanvasFormat: 'iphone-69' })
    expect(getProjectBaseFormat(project)).toBe(BASE_CANVAS_FORMAT)
  })

  it('turns legacy base-only iphone settings into iPhone + Android platform tabs', () => {
    const project = makeProject({ baseCanvasFormat: 'iphone-69', activeFormats: ['iphone-69'] })
    expect(getProjectActiveFormats(project)).toEqual(['iphone-69', 'android-phone'])
  })

  it('normalizes persisted projects before hydration/import', () => {
    const normalized = normalizeProjectFormats(makeProject({ baseCanvasFormat: 'iphone-69', activeFormats: ['iphone-69'] }))
    expect(normalized.settings.baseCanvasFormat).toBe('base')
    expect(normalized.settings.activeFormats).toEqual(['iphone-69', 'android-phone'])
  })
})

describe('getFormatCanvasDims', () => {
  it('base format returns the group stored (authoring) dims — including custom sizes', () => {
    const group = makeGroup([], { slideWidth: 1290, slideHeight: 2796 })
    expect(getFormatCanvasDims(group, BASE_CANVAS_FORMAT, BASE_CANVAS_FORMAT)).toEqual({ width: 1290, height: 2796 })
  })

  it('non-base format returns the preset dims', () => {
    const group = makeGroup([], { slideWidth: 1290, slideHeight: 2796 })
    expect(getFormatCanvasDims(group, 'android-phone', BASE_CANVAS_FORMAT)).toEqual({ width: 1080, height: 1920 })
  })
})

describe('applyCanvasFormatToGroup', () => {
  it('base format passes layers through untouched', () => {
    const text = makeText()
    const group = makeGroup([text])
    const resolved = applyCanvasFormatToGroup(group, BASE_CANVAS_FORMAT, BASE_CANVAS_FORMAT)
    expect(resolved.slideWidth).toBe(1320)
    expect(resolved.layers[0]).toBe(text)
  })

  it('legacy groups (1290×2796) scale from stored dims, not the base preset', () => {
    const group = makeGroup([makeText({ x: 1290 })], { slideWidth: 1290, slideHeight: 2796 })
    const resolved = applyCanvasFormatToGroup(group, 'android-phone', BASE_CANVAS_FORMAT)
    const layer = resolved.layers[0] as TextLayer
    // x scales by 1080/1290, so the right edge stays the right edge
    expect(layer.x).toBeCloseTo(1080)
  })

  it('non-base format scales x/y/width/height and applies overrides on top', () => {
    const shape = makeShape({ formatOverrides: { 'android-phone': { x: 999 } } })
    const group = makeGroup([shape])
    const resolved = applyCanvasFormatToGroup(group, 'android-phone', BASE_CANVAS_FORMAT)
    const layer = resolved.layers[0] as ShapeLayer
    const sx = 1080 / 1320
    const sy = 1920 / 2868
    expect(layer.x).toBe(999)                       // override wins
    expect(layer.y).toBeCloseTo(60 * sy)            // auto-scaled
    expect(layer.width).toBeCloseTo(300 * sx)
    expect(layer.height).toBeCloseTo(400 * sy)
  })

  it('filters out layers hidden in the format', () => {
    const shape = makeShape({ formatVisibility: { 'android-phone': false } })
    const group = makeGroup([shape])
    expect(applyCanvasFormatToGroup(group, 'android-phone', BASE_CANVAS_FORMAT).layers).toHaveLength(0)
    expect(applyCanvasFormatToGroup(group, BASE_CANVAS_FORMAT, BASE_CANVAS_FORMAT).layers).toHaveLength(1)
  })

  it('"only this format" visibility also filters in the base view', () => {
    const shape = makeShape({
      formatVisibility: { 'base': false, 'iphone-69': false, 'android-phone': true, 'ipad-13': false, 'android-tablet': false },
    })
    const group = makeGroup([shape])
    expect(applyCanvasFormatToGroup(group, BASE_CANVAS_FORMAT, BASE_CANVAS_FORMAT).layers).toHaveLength(0)
    expect(applyCanvasFormatToGroup(group, 'android-phone', BASE_CANVAS_FORMAT).layers).toHaveLength(1)
  })
})

describe('resolveLayerFormat — groups', () => {
  it('resolves children visibility inside groups', () => {
    const hidden = makeShape({ id: 'c1', formatVisibility: { 'android-phone': false } })
    const visible = makeShape({ id: 'c2' })
    const groupLayer: Layer = {
      id: 'grp', name: 'Group', type: 'group',
      x: 0, y: 0, rotation: 0, opacity: 1, visible: true, locked: false,
      children: [hidden, visible], scale: 1,
    } as Layer
    const resolved = resolveLayerFormat(groupLayer, 'android-phone', false, 1320, 2868, 1080, 1920)
    expect(resolved).not.toBeNull()
    expect((resolved as { children: Layer[] }).children.map((c) => c.id)).toEqual(['c2'])
  })
})

describe('mapLayerToAuthoringSpace', () => {
  it('x/y round-trip through a format is exact', () => {
    const android = getCanvasFormat('android-phone')
    const layer = makeText({ x: 540, y: 960 })
    const inBase = mapLayerToAuthoringSpace(layer, 'android-phone', BASE_CANVAS_FORMAT, 1320, 2868)
    // Map back: base → android = scale by android/base
    expect(inBase.x * (android.width / 1320)).toBeCloseTo(540)
    expect(inBase.y * (android.height / 2868)).toBeCloseTo(960)
  })

  it('returns the layer unchanged when active format is the base', () => {
    const layer = makeText()
    expect(mapLayerToAuthoringSpace(layer, BASE_CANVAS_FORMAT, BASE_CANVAS_FORMAT, 1320, 2868)).toBe(layer)
  })
})

const makePhone = (partial?: Partial<PhoneLayer>): PhoneLayer => ({
  id: 'p1', name: 'Phone', type: 'phone',
  x: 100, y: 200, rotation: 0, opacity: 1, visible: true, locked: false,
  model: 'iphone-16-pro',
  scale: 2,
  screenshotFit: 'cover',
  screenshotOffsetX: 0,
  screenshotOffsetY: 0,
  ...partial,
})

describe('resolveLayerFormat — phone model auto-swap', () => {
  it('swaps iphone model to pixel when format is android-phone', () => {
    const phone = makePhone({ model: 'iphone-16-pro' })
    const resolved = resolveLayerFormat(phone, 'android-phone', false, 1320, 2868, 1080, 1920) as PhoneLayer
    expect(resolved).not.toBeNull()
    expect(resolved.model).toBe('pixel-9')
  })

  it('swaps iphone-plain model to pixel-plain when format is android-phone', () => {
    const phone = makePhone({ model: 'iphone-16-pro-plain' })
    const resolved = resolveLayerFormat(phone, 'android-phone', false, 1320, 2868, 1080, 1920) as PhoneLayer
    expect(resolved.model).toBe('pixel-9-plain')
  })

  it('does NOT swap model when an explicit formatOverride for model exists', () => {
    const phone = makePhone({
      model: 'iphone-16-pro',
      formatOverrides: { 'android-phone': { model: 'pixel-9-plain' } as never },
    })
    const resolved = resolveLayerFormat(phone, 'android-phone', false, 1320, 2868, 1080, 1920) as PhoneLayer
    expect(resolved.model).toBe('pixel-9-plain') // explicit override wins
  })

  it('does NOT swap model when format is iOS (same platform as model)', () => {
    const phone = makePhone({ model: 'iphone-16-pro' })
    const resolved = resolveLayerFormat(phone, 'ipad-13', false, 1320, 2868, 2064, 2752) as PhoneLayer
    expect(resolved.model).toBe('iphone-16-pro')
  })

  it('swaps pixel model to iphone when format is ipad-13', () => {
    const phone = makePhone({ model: 'pixel-9' })
    const resolved = resolveLayerFormat(phone, 'ipad-13', false, 1320, 2868, 2064, 2752) as PhoneLayer
    expect(resolved.model).toBe('iphone-16-pro')
  })

  it('passes model through unchanged for base format', () => {
    const phone = makePhone({ model: 'iphone-16-pro' })
    const resolved = resolveLayerFormat(phone, BASE_CANVAS_FORMAT, true, 1320, 2868, 1320, 2868) as PhoneLayer
    expect(resolved.model).toBe('iphone-16-pro')
    expect(resolved).toBe(phone) // identity: base returns untouched
  })
})

describe('countFormatAdjustments', () => {
  it('returns 0 for the base format', () => {
    const text = makeText({ formatOverrides: { 'iphone-69': { x: 50 } } })
    const group = makeGroup([text])
    expect(countFormatAdjustments(group, BASE_CANVAS_FORMAT, BASE_CANVAS_FORMAT)).toBe(0)
  })

  it('counts layers with formatOverrides for the given format', () => {
    const text = makeText({ formatOverrides: { 'android-phone': { x: 50 } } })
    const shape = makeShape()
    const group = makeGroup([text, shape])
    expect(countFormatAdjustments(group, 'android-phone', BASE_CANVAS_FORMAT)).toBe(1)
  })

  it('counts layers with formatVisibility for the given format', () => {
    const text = makeText({ formatVisibility: { 'android-phone': false } })
    const group = makeGroup([text])
    expect(countFormatAdjustments(group, 'android-phone', BASE_CANVAS_FORMAT)).toBe(1)
  })

  it('counts both override and visibility independently per layer', () => {
    const text = makeText({
      formatOverrides: { 'android-phone': { x: 50 } },
      formatVisibility: { 'android-phone': false },
    })
    const group = makeGroup([text])
    // One layer with both qualifiers → still counts as 1
    expect(countFormatAdjustments(group, 'android-phone', BASE_CANVAS_FORMAT)).toBe(1)
  })

  it('counts children inside groups', () => {
    const child1 = makeShape({ id: 'c1', formatOverrides: { 'android-phone': { x: 10 } } })
    const child2 = makeShape({ id: 'c2', formatVisibility: { 'android-phone': true } })
    const grpLayer: Layer = {
      id: 'grp', name: 'Group', type: 'group',
      x: 0, y: 0, rotation: 0, opacity: 1, visible: true, locked: false,
      children: [child1, child2],
    } as Layer
    const group = makeGroup([grpLayer])
    expect(countFormatAdjustments(group, 'android-phone', BASE_CANVAS_FORMAT)).toBe(2)
  })

  it('ignores overrides for other formats', () => {
    const text = makeText({ formatOverrides: { 'ipad-13': { x: 50 } } })
    const group = makeGroup([text])
    expect(countFormatAdjustments(group, 'android-phone', BASE_CANVAS_FORMAT)).toBe(0)
  })

  it('ignores empty override objects', () => {
    const text = makeText({ formatOverrides: { 'android-phone': {} } })
    const group = makeGroup([text])
    expect(countFormatAdjustments(group, 'android-phone', BASE_CANVAS_FORMAT)).toBe(0)
  })
})

describe('ownerFormat — resolveLayerFormat', () => {
  it('layer with ownerFormat:android-phone is hidden in base format view', () => {
    const shape = makeShape({ ownerFormat: 'android-phone' })
    const group = makeGroup([shape])
    expect(applyCanvasFormatToGroup(group, BASE_CANVAS_FORMAT, BASE_CANVAS_FORMAT).layers).toHaveLength(0)
  })

  it('layer with ownerFormat:android-phone is hidden in iPhone format view', () => {
    const shape = makeShape({ ownerFormat: 'android-phone' })
    const group = makeGroup([shape])
    expect(applyCanvasFormatToGroup(group, 'iphone-69', BASE_CANVAS_FORMAT).layers).toHaveLength(0)
  })

  it('layer with ownerFormat:android-phone is visible in Android format view', () => {
    const shape = makeShape({ ownerFormat: 'android-phone' })
    const group = makeGroup([shape])
    const resolved = applyCanvasFormatToGroup(group, 'android-phone', BASE_CANVAS_FORMAT)
    expect(resolved.layers).toHaveLength(1)
  })

  it('countFormatAdjustments counts owned layers for their format', () => {
    const shape = makeShape({ ownerFormat: 'android-phone' })
    const group = makeGroup([shape])
    expect(countFormatAdjustments(group, 'android-phone', BASE_CANVAS_FORMAT)).toBe(1)
    expect(countFormatAdjustments(group, 'iphone-69', BASE_CANVAS_FORMAT)).toBe(0)
    expect(countFormatAdjustments(group, 'ipad-13', BASE_CANVAS_FORMAT)).toBe(0)
  })

  it('shared layer (no ownerFormat) is visible in all formats', () => {
    const shape = makeShape()
    const group = makeGroup([shape])
    expect(applyCanvasFormatToGroup(group, BASE_CANVAS_FORMAT, BASE_CANVAS_FORMAT).layers).toHaveLength(1)
    expect(applyCanvasFormatToGroup(group, 'android-phone', BASE_CANVAS_FORMAT).layers).toHaveLength(1)
    expect(applyCanvasFormatToGroup(group, 'iphone-69', BASE_CANVAS_FORMAT).layers).toHaveLength(1)
  })
})
