import { describe, it, expect } from 'vitest'
import {
  applyCanvasFormatToGroup,
  getFormatCanvasDims,
  mapLayerToAuthoringSpace,
  resolveLayerFormat,
  countFormatAdjustments,
  BASE_CANVAS_FORMAT,
  getProjectActiveFormats,
  getProjectBaseFormat,
  normalizeProjectFormats,
  makeOwnedFormatLayersSharedInLayerTree,
  promoteFormatOverridesToSharedInLayerTree,
  resetFormatOverridesInLayerTree,
  resetFormatVisibilityInLayerTree,
  applyCanvasFormat,
  getCanvasFormat,
  getExportTargets,
  getFormatLabel,
  getFormatPlatform,
  groupTargetsFormat,
  resolveForkSourceFormat,
  selectForkSourceCandidates,
  selectForkSourceGroups,
  normalizeActiveFormats,
  CANVAS_FORMAT_PRESETS,
  DEFAULT_ACTIVE_CANVAS_FORMATS,
  FORMAT_FAMILY,
  FORMAT_FAMILY_ANCHOR,
  FORMAT_PLATFORM,
  getFormatFamilyKey,
  getFormatScaleFactor,
  selectFormatViewGroups,
  selectProjectFamilies,
} from './canvasFormats'
import type { CustomCanvasFormat, Layer, PhoneLayer, Project, SlideGroup, TextLayer, ShapeLayer } from '@/types'

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

const customFormat: CustomCanvasFormat = {
  id: 'custom:square', label: 'Square', width: 1080, height: 1080,
}

const newBuiltInFormats = [
  { id: 'ipad-11', label: 'iPad 11"', width: 1668, height: 2420, platform: 'ios', family: 'tablet' },
  { id: 'apple-watch', label: 'Apple Watch', width: 422, height: 514, platform: 'ios', family: 'watch' },
  { id: 'wear-os', label: 'Wear OS', width: 480, height: 480, platform: 'android', family: 'watch' },
  { id: 'mac', label: 'Mac', width: 2880, height: 1800, platform: 'ios', family: 'desktop' },
  { id: 'appletv', label: 'Apple TV', width: 3840, height: 2160, platform: 'ios', family: 'desktop' },
  { id: 'visionpro', label: 'Vision Pro', width: 3840, height: 2160, platform: 'ios', family: 'desktop' },
] as const

describe('additional built-in canvas formats', () => {
  it.each(newBuiltInFormats)('provides $label preset dimensions', ({ id, label, width, height }) => {
    expect(CANVAS_FORMAT_PRESETS).toContainEqual({ id, label, width, height })
  })

  it.each(newBuiltInFormats)('maps $label to its platform and family', ({ id, platform, family }) => {
    expect(FORMAT_PLATFORM[id]).toBe(platform)
    expect(FORMAT_FAMILY[id]).toBe(family)
    expect(getFormatPlatform(id)).toBe(platform)
  })

  it.each(newBuiltInFormats)('returns the $label format label', ({ id, label }) => {
    expect(getFormatLabel(id)).toBe(label)
  })

  it('keeps only iPhone and Android Phone as the default active formats', () => {
    expect(DEFAULT_ACTIVE_CANVAS_FORMATS).toEqual(['iphone-69', 'android-phone'])
    expect(getProjectActiveFormats(makeProject())).toEqual(['iphone-69', 'android-phone'])
  })
})

describe('custom canvas formats', () => {
  it('resolves a custom format and throws for an unknown format', () => {
    expect(getCanvasFormat(customFormat.id, [customFormat])).toBe(customFormat)
    expect(() => getCanvasFormat('custom:missing', [customFormat])).toThrow('Unknown canvas format: custom:missing')
  })

  it('uses custom dimensions independently of the group dimensions', () => {
    const group = makeGroup([], { slideWidth: 500, slideHeight: 900 })
    expect(getFormatCanvasDims(group, customFormat.id, BASE_CANVAS_FORMAT, [customFormat]))
      .toEqual({ width: 1080, height: 1080 })
  })

  it('normalizes undefined, explicit empty, legacy, and dangling format lists', () => {
    expect(normalizeActiveFormats(undefined)).toEqual(['iphone-69', 'android-phone'])
    expect(normalizeActiveFormats([])).toEqual([])
    expect(normalizeActiveFormats(['iphone-69'], 'iphone-69')).toEqual(['iphone-69', 'android-phone'])
    expect(normalizeActiveFormats(['android-phone', 'custom:missing'], undefined, [customFormat])).toEqual(['android-phone'])
    expect(normalizeActiveFormats([customFormat.id], undefined, [customFormat])).toEqual([customFormat.id])
  })

  it('resolves platforms only for built-in formats', () => {
    expect(getFormatPlatform(customFormat.id)).toBeNull()
    expect(getFormatPlatform('iphone-69')).toBe('ios')
    expect(getFormatPlatform('android-phone')).toBe('android')
  })

  it('returns active custom export targets and falls back to base when empty', () => {
    expect(getExportTargets(makeProject({ activeFormats: [customFormat.id], customFormats: [customFormat] })))
      .toEqual([customFormat.id])
    expect(getExportTargets(makeProject({ activeFormats: [], customFormats: [customFormat] }))).toEqual(['base'])
  })

  it('applies a project custom format without throwing', () => {
    const project = makeProject({ activeFormats: [customFormat.id], customFormats: [customFormat] })
    expect(() => applyCanvasFormat(project, customFormat.id)).not.toThrow()
    expect(applyCanvasFormat(project, customFormat.id).slideGroups[0]).toMatchObject({
      slideWidth: 1080,
      slideHeight: 1080,
    })
  })
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

describe('groupTargetsFormat', () => {
  it('keeps legacy unscoped groups in every format', () => {
    const group = makeGroup([])
    expect(groupTargetsFormat(group, 'iphone-69')).toBe(true)
    expect(groupTargetsFormat(group, 'ipad-13')).toBe(true)
    expect(groupTargetsFormat(group, BASE_CANVAS_FORMAT)).toBe(true)
  })

  it('limits scoped groups except for their always-available base authoring view', () => {
    const group = makeGroup([], { formats: ['ipad-13'] })
    expect(groupTargetsFormat(group, 'ipad-13')).toBe(true)
    expect(groupTargetsFormat(group, 'android-phone')).toBe(false)
    expect(groupTargetsFormat(group, BASE_CANVAS_FORMAT)).toBe(true)
  })
})

describe('derived format families', () => {
  it('keeps non-base tab targeting byte-identical to groupTargetsFormat', () => {
    const project = makeProject()
    project.slideGroups = [
      makeGroup([], { id: 'phone', formats: ['iphone-69', 'android-phone'] }),
      makeGroup([], { id: 'tablet', formats: ['ipad-13'] }),
      makeGroup([], { id: 'legacy', formats: undefined }),
    ]
    for (const format of ['iphone-69', 'ipad-13', 'apple-watch', 'visionpro'] as const) {
      expect(selectFormatViewGroups(project, format, 'phone').map((group) => group.id))
        .toEqual(project.slideGroups.filter((group) => groupTargetsFormat(group, format)).map((group) => group.id))
    }
  })

  it('derives project families from groups that exist', () => {
    const project = makeProject()
    project.slideGroups.push(makeGroup([], { id: 'watch', formats: ['apple-watch'] }))
    expect(selectProjectFamilies(project)).toEqual(['phone', 'watch'])
  })

  it('uses anchors that never upscale another family member', () => {
    for (const family of ['phone', 'tablet', 'watch', 'desktop'] as const) {
      const anchor = FORMAT_FAMILY_ANCHOR[family]
      const group = makeGroup([], { slideWidth: getCanvasFormat(anchor).width, slideHeight: getCanvasFormat(anchor).height })
      for (const preset of CANVAS_FORMAT_PRESETS) {
        if (getFormatFamilyKey(preset.id) === family) {
          expect(getFormatScaleFactor(group, preset.id, BASE_CANVAS_FORMAT)).toBeLessThanOrEqual(1)
        }
      }
    }
  })
})

describe('selectForkSourceGroups', () => {
  it.each([
    ['unscoped at base', undefined, BASE_CANVAS_FORMAT, ['g1']],
    ['unscoped at a non-base source', undefined, 'iphone-69', ['g1']],
    ['single-format scoped at base versus its format', ['iphone-69'], BASE_CANVAS_FORMAT, []],
    ['single-format scoped at its format', ['iphone-69'], 'iphone-69', ['g1']],
    ['fully covered target', ['iphone-69', 'ipad-13'], 'iphone-69', []],
    ['unrelated scope', ['apple-watch'], 'iphone-69', []],
  ] as const)('%s', (_label, formats, sourceFormat, expectedIds) => {
    const project = makeProject()
    project.slideGroups = [makeGroup([], { formats: formats ? [...formats] : undefined })]

    expect(selectForkSourceGroups(project, sourceFormat, 'ipad-13').map((group) => group.id)).toEqual(expectedIds)
  })
})

describe('fork source candidate resolution', () => {
  it.each([
    {
      name: 'a fresh unscoped project',
      project: makeProject(),
      targetFormatId: 'ipad-13',
      activeCanvasFormat: BASE_CANVAS_FORMAT,
      activeSlideGroupId: 'g1',
    },
    {
      name: 'a post-first-fork pinned project',
      project: makeProject({ activeFormats: ['iphone-69', 'android-phone', 'ipad-13'] }),
      targetFormatId: 'apple-watch',
      activeCanvasFormat: BASE_CANVAS_FORMAT,
      activeSlideGroupId: 'phone',
    },
    {
      name: 'a stale active format whose family was deleted',
      project: makeProject({ activeFormats: ['iphone-69', 'android-phone', 'ipad-13'] }),
      targetFormatId: 'ipad-13',
      activeCanvasFormat: 'ipad-13',
      activeSlideGroupId: 'phone',
    },
    {
      name: 'an active group unrelated to every viable source',
      project: makeProject({ activeFormats: ['iphone-69', 'ipad-13'] }),
      targetFormatId: 'ipad-13',
      activeCanvasFormat: BASE_CANVAS_FORMAT,
      activeSlideGroupId: 'target-only',
    },
  ] as const)('always returns a candidate for $name', ({ project, targetFormatId, activeCanvasFormat, activeSlideGroupId }) => {
    if (activeSlideGroupId === 'phone') {
      project.slideGroups = [
        makeGroup([], { id: 'phone', formats: ['iphone-69', 'android-phone'] }),
        makeGroup([], { id: 'ipad', formats: ['ipad-13'] }),
      ]
    }
    if (activeSlideGroupId === 'target-only') {
      project.slideGroups = [
        makeGroup([], { id: 'phone', formats: ['iphone-69'] }),
        makeGroup([], { id: 'target-only', formats: ['ipad-13'] }),
      ]
    }

    const candidates = selectForkSourceCandidates(project, targetFormatId)
    const resolved = resolveForkSourceFormat(project, activeCanvasFormat, activeSlideGroupId, targetFormatId)

    expect(candidates.length === 0 || candidates.includes(resolved)).toBe(true)
    if (activeCanvasFormat === 'ipad-13' && targetFormatId === 'ipad-13') {
      expect(resolved).not.toBe('ipad-13')
      expect(candidates).toContain(resolved)
    }
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
    // fit-center: s = min(1080/1290, 1920/2796) ≈ 0.6867
    // newX = 540 + (1290 - 645) * 0.6867 ≈ 540 + 443.0 ≈ 983.0
    const s = Math.min(1080 / 1290, 1920 / 2796)
    expect(layer.x).toBeCloseTo(540 + (1290 - 1290 / 2) * s)
  })

  it('non-base format scales x/y/width/height and applies overrides on top', () => {
    const shape = makeShape({ formatOverrides: { 'android-phone': { x: 999 } } })
    const group = makeGroup([shape])
    const resolved = applyCanvasFormatToGroup(group, 'android-phone', BASE_CANVAS_FORMAT)
    const layer = resolved.layers[0] as ShapeLayer
    // fit-center: s = min(1080/1320, 1920/2868) ≈ 0.6694
    const s = Math.min(1080 / 1320, 1920 / 2868)
    expect(layer.x).toBe(999)                                                    // override wins
    expect(layer.y).toBeCloseTo(1920 / 2 + (60 - 2868 / 2) * s)                // auto-scaled, fit-center
    expect(layer.width).toBeCloseTo(300 * s)                                     // uniform scale
    expect(layer.height).toBeCloseTo(400 * s)                                    // uniform scale
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

  it('scales child coordinates from the group-local origin, matching baked forks', () => {
    const child = makeShape({ id: 'child', x: 10, y: 20 })
    const groupLayer: Layer = { id: 'grp', name: 'Group', type: 'group', x: 200, y: 300, rotation: 0, opacity: 1, visible: true, locked: false, children: [child] } as Layer
    const resolved = resolveLayerFormat(groupLayer, 'appletv', false, 1320, 2868, 3840, 2160) as import('@/types').GroupLayer
    const factor = Math.min(3840 / 1320, 2160 / 2868)

    expect(resolved.children[0].x).toBeCloseTo(10 * factor)
    expect(resolved.children[0].y).toBeCloseTo(20 * factor)
  })

  it('round-trips group-child coordinates through a letterboxed format', () => {
    const child = makeShape({ id: 'child', x: 69.75, y: 120.25 })
    const groupLayer: Layer = { id: 'grp', name: 'Group', type: 'group', x: 200, y: 300, rotation: 0, opacity: 1, visible: true, locked: false, children: [child] } as Layer
    const inFormat = resolveLayerFormat(groupLayer, 'appletv', false, 1320, 2868, 3840, 2160) as import('@/types').GroupLayer
    const roundTripped = mapLayerToAuthoringSpace(
      inFormat.children[0], 'appletv', BASE_CANVAS_FORMAT, 1320, 2868, undefined, 'origin',
    )

    expect(roundTripped.x).toBeCloseTo(child.x)
    expect(roundTripped.y).toBeCloseTo(child.y)
  })
})

describe('mapLayerToAuthoringSpace', () => {
  it('x/y round-trip through a format is exact', () => {
    // A layer at the canvas centre of android (540, 960) should map back to
    // the canvas centre of base (660, 1434) and then forward again to (540, 960).
    const layer = makeText({ x: 540, y: 960 })
    const inBase = mapLayerToAuthoringSpace(layer, 'android-phone', BASE_CANVAS_FORMAT, 1320, 2868)
    // Centre of base canvas
    expect(inBase.x).toBeCloseTo(660)
    expect(inBase.y).toBeCloseTo(1434)
    // Forward pass: base → android should recover the original position
    const s = Math.min(1080 / 1320, 1920 / 2868)
    expect(1080 / 2 + (inBase.x - 1320 / 2) * s).toBeCloseTo(540)
    expect(1920 / 2 + (inBase.y - 2868 / 2) * s).toBeCloseTo(960)
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

describe('global format slide actions', () => {
  it('resets all overrides for one format without touching other formats', () => {
    const text = makeText({
      formatOverrides: {
        'android-phone': { x: 10 },
        'ipad-13': { y: 20 },
      },
    })
    const groupLayer: Layer = {
      id: 'grp', name: 'Group', type: 'group',
      x: 0, y: 0, rotation: 0, opacity: 1, visible: true, locked: false,
      children: [makeShape({ id: 'child', formatOverrides: { 'android-phone': { width: 99 } as never } })],
    } as Layer

    const [nextText, nextGroup] = resetFormatOverridesInLayerTree([text, groupLayer], 'android-phone')

    expect(nextText.formatOverrides).toEqual({ 'ipad-13': { y: 20 } })
    expect(((nextGroup as { children: Layer[] }).children[0]).formatOverrides).toBeUndefined()
  })

  it('resets all visibility entries for one format only', () => {
    const shape = makeShape({
      formatVisibility: { 'android-phone': false, 'ipad-13': true },
    })

    const [next] = resetFormatVisibilityInLayerTree([shape], 'android-phone')

    expect(next.formatVisibility).toEqual({ 'ipad-13': true })
  })

  it('promotes format overrides to shared authoring coordinates', () => {
    const shape = makeShape({
      x: 100,
      width: 300,
      formatOverrides: { 'android-phone': { x: 540, width: 216 } as never },
    })

    const [next] = promoteFormatOverridesToSharedInLayerTree(
      [shape],
      'android-phone',
      BASE_CANVAS_FORMAT,
      1320,
      2868,
    ) as ShapeLayer[]

    // fit-center inverse: s_fwd = min(1080/1320, 1920/2868), s_inv = 1/s_fwd
    const sFwd = Math.min(1080 / 1320, 1920 / 2868)
    const sInv = 1 / sFwd
    // x=540 is at the android canvas centre → maps to base canvas centre (660)
    expect(next.formatOverrides).toBeUndefined()
    expect(next.x).toBeCloseTo(1320 / 2 + (540 - 1080 / 2) * sInv) // ≈ 660
    expect(next.width).toBeCloseTo(216 * sInv)
  })

  it('makes platform-owned layers shared and maps them back to authoring space', () => {
    const shape = makeShape({ ownerFormat: 'android-phone', x: 540, y: 960, width: 216, height: 192 })

    const [next] = makeOwnedFormatLayersSharedInLayerTree(
      [shape],
      'android-phone',
      BASE_CANVAS_FORMAT,
      1320,
      2868,
    ) as ShapeLayer[]

    // fit-center inverse: s_fwd = min(1080/1320, 1920/2868), s_inv = 1/s_fwd
    const sFwd = Math.min(1080 / 1320, 1920 / 2868)
    const sInv = 1 / sFwd
    expect(next.ownerFormat).toBeUndefined()
    expect(next.x).toBeCloseTo(1320 / 2 + (540 - 1080 / 2) * sInv) // ≈ 660
    expect(next.y).toBeCloseTo(2868 / 2 + (960 - 1920 / 2) * sInv) // ≈ 1434
    expect(next.width).toBeCloseTo(216 * sInv)
    expect(next.height).toBeCloseTo(192 * sInv)
  })
})
