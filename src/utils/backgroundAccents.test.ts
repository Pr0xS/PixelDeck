import { describe, expect, it } from 'vitest'
import {
  getBackgroundAccentOpacity,
  getBackgroundAccentRenderColor,
  getNextBackgroundAccentIndex,
  updateBackgroundAccentAt,
} from './backgroundAccents'
import type { BackgroundAccent } from '@/types'

const baseAccent: BackgroundAccent = {
  color: 'rgba(124,58,237,0.3)',
  cx: 50,
  cy: 20,
  rx: 500,
  ry: 450,
}

describe('background accent updates', () => {
  const otherAccent: BackgroundAccent = { ...baseAccent, cx: 20, cy: 80 }

  it('patches the target accent', () => {
    const accents = [baseAccent, otherAccent]

    expect(updateBackgroundAccentAt(accents, 1, { cx: 35, opacity: 0.5 })[1]).toEqual({
      ...otherAccent,
      cx: 35,
      opacity: 0.5,
    })
  })

  it('retains the identity of other accents', () => {
    const accents = [baseAccent, otherAccent]
    const updated = updateBackgroundAccentAt(accents, 1, { cx: 35 })

    expect(updated[0]).toBe(baseAccent)
    expect(updated[1]).not.toBe(otherAccent)
  })

  it('leaves every accent unchanged and identical for an out-of-range index', () => {
    const accents = [baseAccent, otherAccent]
    const updated = updateBackgroundAccentAt(accents, 2, { cx: 35 })

    expect(updated).toEqual(accents)
    expect(updated[0]).toBe(baseAccent)
    expect(updated[1]).toBe(otherAccent)
  })
})

describe('background accent appearance', () => {
  it('supports legacy accents with alpha encoded in rgba()', () => {
    expect(getBackgroundAccentOpacity(baseAccent)).toBe(0.3)
    expect(getBackgroundAccentRenderColor(baseAccent, baseAccent.color)).toBe(baseAccent.color)
  })

  it('uses independent opacity without multiplying legacy color alpha', () => {
    const accent = { ...baseAccent, opacity: 0.65 }

    expect(getBackgroundAccentOpacity(accent)).toBe(0.65)
    expect(getBackgroundAccentRenderColor(accent, accent.color)).toBe('rgba(124,58,237,1)')
  })

  it('applies independent opacity to resolved brand colors', () => {
    const accent = { ...baseAccent, color: '{brand:primary}', opacity: 0.4 }

    expect(getBackgroundAccentOpacity(accent)).toBe(0.4)
    expect(getBackgroundAccentRenderColor(accent, '#336699')).toBe('rgba(51,102,153,1)')
  })

  it('clamps invalid persisted opacity values', () => {
    expect(getBackgroundAccentOpacity({ ...baseAccent, opacity: -1 })).toBe(0)
    expect(getBackgroundAccentOpacity({ ...baseAccent, opacity: 2 })).toBe(1)
  })
})

describe('background accent canvas selection', () => {
  const overlappingAccents: BackgroundAccent[] = [
    { ...baseAccent, cx: 50, cy: 50, rx: 300, ry: 300 },
    { ...baseAccent, cx: 55, cy: 50, rx: 300, ry: 300 },
  ]

  it('selects the clicked accent immediately', () => {
    expect(getNextBackgroundAccentIndex(
      overlappingAccents,
      { x: 500, y: 500 },
      1000,
      1000,
      1,
      null,
    )).toBe(1)
  })

  it('cycles to the accent underneath on a repeated click in an overlap', () => {
    expect(getNextBackgroundAccentIndex(
      overlappingAccents,
      { x: 525, y: 500 },
      1000,
      1000,
      1,
      1,
    )).toBe(0)
  })

  it('keeps the selected accent when no other accent is under the pointer', () => {
    expect(getNextBackgroundAccentIndex(
      overlappingAccents,
      { x: 200, y: 500 },
      1000,
      1000,
      0,
      0,
    )).toBe(0)
  })
})
