import { describe, expect, it } from 'vitest'
import type { SlideGroup, TextLayer } from '@/types'
import {
  applyCanvasFormatToGroup,
  applyLocaleAdjust,
  applyLocaleAdjustToGroup,
  BASE_CANVAS_FORMAT,
  getFormatScaleFactor,
} from './canvasFormats'

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

// Fit-center scale factor from the 1320x2868 group used throughout this file
// to the android-phone preset (1080x1920). Reused for every scaled-delta
// expectation below.
const s = Math.min(1080 / 1320, 1920 / 2868)

describe('applyLocaleAdjust — P1 3-tier localeAdjust read path', () => {
  it('[case 1] base-scoped delta applies exactly once at base (factor 1) and exactly once scaled at a non-base format', () => {
    // This is the double-apply proof: pre-fix, format === BASE_CANVAS_FORMAT
    // makes `formatScoped` alias the SAME map cell as `baseScoped`, so the
    // base view would incorrectly apply the delta twice (140 -> 180).
    const layer = makeText({ x: 100, localeAdjust: { de: { [BASE_CANVAS_FORMAT]: { dx: 40 } } } })

    const atBase = applyLocaleAdjust(layer, 'de', BASE_CANVAS_FORMAT, 1) as TextLayer
    const atFormat = applyLocaleAdjust(layer, 'de', ANDROID_FORMAT, s) as TextLayer

    expect(atBase.x).toBe(140) // 100 + 40 * 1 — applied exactly once
    expect(atFormat.x).toBeCloseTo(100 + 40 * s) // 100 + 40 * f — applied exactly once, scaled
  })

  it('[case 2] format-scoped delta only applies at that exact format, never at base (scope isolation)', () => {
    const layer = makeText({ x: 100, localeAdjust: { de: { [ANDROID_FORMAT]: { dx: 25 } } } })

    const atFormat = applyLocaleAdjust(layer, 'de', ANDROID_FORMAT, s) as TextLayer
    const atBase = applyLocaleAdjust(layer, 'de', BASE_CANVAS_FORMAT, 1) as TextLayer

    expect(atFormat.x).toBe(125) // 100 + 25 * 1 — already authored in format-space, no scale factor
    expect(atBase.x).toBe(100) // untouched — format-scoped cell never reaches the base view
  })

  it('[case 3] base-scoped and format-scoped deltas on the same key truly compose: R + f*d_base + d_F', () => {
    const layer = makeText({
      x: 100,
      localeAdjust: { de: { [BASE_CANVAS_FORMAT]: { dx: 40 }, [ANDROID_FORMAT]: { dx: 25 } } },
    })

    const resolved = applyLocaleAdjust(layer, 'de', ANDROID_FORMAT, s) as TextLayer

    expect(resolved.x).toBeCloseTo(100 + s * 40 + 25)
  })

  it('[case 4] multiplicative base-scoped and format-scoped deltas compose as m_base * m_F', () => {
    const layer = makeText({
      width: 200,
      localeAdjust: { de: { [BASE_CANVAS_FORMAT]: { mWidth: 1.5 }, [ANDROID_FORMAT]: { mWidth: 2 } } },
    })

    const resolved = applyLocaleAdjust(layer, 'de', ANDROID_FORMAT, s) as TextLayer

    // Multiplicative deltas apply directly to the already-resolved value —
    // they are never scaled by `f` themselves (only additive x/y/rotation are).
    expect(resolved.width).toBeCloseTo(200 * 1.5 * 2)
  })

  it('[case 5] composes on top of an unshadowed formatOverrides[F] anchor — re-proves T1\'s composition property in the new model', () => {
    const group = makeGroup({
      layers: [makeText({
        x: 100,
        formatOverrides: { [ANDROID_FORMAT]: { x: 600 } },
        localeAdjust: { de: { [BASE_CANVAS_FORMAT]: { dx: 30 } } },
      })],
    })
    const formatResolved = applyCanvasFormatToGroup(group, ANDROID_FORMAT, BASE_CANVAS_FORMAT)
    const f = getFormatScaleFactor(group, ANDROID_FORMAT, BASE_CANVAS_FORMAT)

    const resolved = applyLocaleAdjustToGroup(formatResolved, 'de', ANDROID_FORMAT, 'en', f)
    const layer = resolved.layers[0] as TextLayer

    // No localeAdjust cell exists at exactly [de][android-phone], so the
    // format override anchor (600, absolute) is not shadowed — the
    // base-scoped delta genuinely composes on top of it, scaled by f.
    expect(layer.x).toBeCloseTo(600 + 30 * f)
  })

  it('[case 6] applyLocaleAdjustToGroup is a no-op at the default locale, even if localeAdjust[defaultLocale] exists', () => {
    const layer = makeText({ x: 100, localeAdjust: { en: { [BASE_CANVAS_FORMAT]: { dx: 999 } } } })
    const group = makeGroup({ layers: [layer] })

    const resolvedGroup = applyLocaleAdjustToGroup(group, 'en', ANDROID_FORMAT, 'en', 0.5)

    // Identity short-circuit: default-locale is skipped before any per-layer
    // resolution runs, regardless of what localeAdjust[defaultLocale] holds.
    expect(resolvedGroup).toBe(group)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// Pure getFormatScaleFactor scale-safety tests.
// ─────────────────────────────────────────────────────────────────────────
describe('getFormatScaleFactor scale safety', () => {
  it('matches the scale actually used by applyCanvasFormatToGroup', () => {
    const group = makeGroup()
    const factor = getFormatScaleFactor(group, ANDROID_FORMAT, BASE_CANVAS_FORMAT)
    const resolved = applyCanvasFormatToGroup(group, ANDROID_FORMAT, BASE_CANVAS_FORMAT)
    const source = group.layers[0] as TextLayer
    const projected = resolved.layers[0] as TextLayer

    expect(projected.width! / source.width!).toBeCloseTo(factor)
  })

  // Guards the dropped `numSlides` multiplier in getFormatScaleFactor: n
  // cancels out of min((width*n)/(slideWidth*n), height/slideHeight)
  // algebraically, but that needs to stay true beyond numSlides:1.
  it.each([1, 2, 3])('keeps pano scale algebraically equivalent for %i slide(s)', (numSlides) => {
    const group = makeGroup({
      numSlides,
      slideNames: Array.from({ length: numSlides }, (_, index) => `slide-${index + 1}`),
    })
    const expected = Math.min((1080 * numSlides) / (1320 * numSlides), 1920 / 2868)

    expect(getFormatScaleFactor(group, ANDROID_FORMAT, BASE_CANVAS_FORMAT)).toBeCloseTo(expected)
  })
})
