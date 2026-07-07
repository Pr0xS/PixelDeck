import { describe, it, expect } from 'vitest'
import type { SlideGroup } from '@/types'
import {
  normalizePanoCompensationPx,
  getPanoGapPx,
  getPanoTotalWidth,
  getPanoSlideX,
  getEffectivePano,
  DEFAULT_PANO_COMPENSATION_PX,
  MAX_PANO_COMPENSATION_PX,
} from './panoGeometry'

type PanoSlides = Pick<SlideGroup, 'numSlides'>
type PanoGroup = Pick<SlideGroup, 'slideWidth' | 'numSlides'>

describe('normalizePanoCompensationPx', () => {
  it('returns 0 for NaN', () => {
    expect(normalizePanoCompensationPx(NaN)).toBe(0)
  })

  it('returns 0 for Infinity', () => {
    expect(normalizePanoCompensationPx(Infinity)).toBe(0)
  })

  it('clamps negative values to 0', () => {
    expect(normalizePanoCompensationPx(-5)).toBe(0)
  })

  it('clamps values to MAX_PANO_COMPENSATION_PX', () => {
    expect(MAX_PANO_COMPENSATION_PX).toBe(300)
    expect(normalizePanoCompensationPx(1000)).toBe(300)
  })

  it('rounds finite values', () => {
    expect(normalizePanoCompensationPx(23.6)).toBe(24)
  })
})

describe('getPanoGapPx', () => {
  it('returns 0 for single-slide groups', () => {
    expect(getPanoGapPx({ numSlides: 1 } satisfies PanoSlides, 50)).toBe(0)
  })

  it('returns the normalized gap for pano groups', () => {
    expect(getPanoGapPx({ numSlides: 2 } satisfies PanoSlides, 24)).toBe(24)
  })

  it('normalizes negative gaps to 0', () => {
    expect(getPanoGapPx({ numSlides: 3 } satisfies PanoSlides, -1)).toBe(0)
  })
})

describe('getPanoTotalWidth', () => {
  it('includes one gap for two slides', () => {
    expect(getPanoTotalWidth({ slideWidth: 1000, numSlides: 2 } satisfies PanoGroup, 24)).toBe(2024)
  })

  it('does not include gaps for single-slide groups', () => {
    expect(getPanoTotalWidth({ slideWidth: 1000, numSlides: 1 } satisfies PanoGroup, 24)).toBe(1000)
  })

  it('includes a gap between each slide', () => {
    expect(getPanoTotalWidth({ slideWidth: 1000, numSlides: 3 } satisfies PanoGroup, 24)).toBe(3048)
  })
})

describe('getPanoSlideX', () => {
  it('returns 0 for the first slide', () => {
    expect(getPanoSlideX({ slideWidth: 1000, numSlides: 2 } satisfies PanoGroup, 0, 24)).toBe(0)
  })

  it('adds the gap before subsequent slides', () => {
    expect(getPanoSlideX({ slideWidth: 1000, numSlides: 2 } satisfies PanoGroup, 1, 24)).toBe(1024)
  })

  it('forces the gap to 0 when numSlides is at most 1', () => {
    expect(getPanoSlideX({ slideWidth: 1000, numSlides: 1 } satisfies PanoGroup, 1, 24)).toBe(1000)
  })
})

describe('getEffectivePano', () => {
  it('prefers the render override', () => {
    expect(getEffectivePano(undefined, { gapPx: 99, compensate: true })).toEqual({ gapPx: 99, compensate: true })
  })

  it('uses project settings when the override is null', () => {
    expect(getEffectivePano({ gapPx: 10, compensate: true }, null)).toEqual({ gapPx: 10, compensate: true })
  })

  it('falls back to the default pano settings', () => {
    expect(DEFAULT_PANO_COMPENSATION_PX).toBe(24)
    expect(getEffectivePano(undefined, null)).toEqual({ gapPx: 24, compensate: false })
  })
})
