import { describe, it, expect } from 'vitest'
import { fillToCss, parseColorAlpha, toTransparentColor, withAlpha } from './gradients'
import type { LinearGradient, RadialGradient } from '@/types'

describe('fillToCss', () => {
  it('returns a solid colour string unchanged', () => {
    expect(fillToCss('#ff0000')).toBe('#ff0000')
    expect(fillToCss('rgba(0,0,0,0.5)')).toBe('rgba(0,0,0,0.5)')
  })

  it('does not crash on any plain string input (typeof guard)', () => {
    expect(() => fillToCss('transparent')).not.toThrow()
    expect(fillToCss('transparent')).toBe('transparent')
  })

  it('converts a two-stop linear gradient to a CSS linear-gradient() string', () => {
    const fill: LinearGradient = {
      type: 'linear',
      angle: 90,
      stops: [
        { offset: 0, color: '#ff0000' },
        { offset: 1, color: '#0000ff' },
      ],
    }
    const result = fillToCss(fill)
    expect(result).toMatch(/^linear-gradient\(/)
    expect(result).toContain('90deg')
    expect(result).toContain('#ff0000')
    expect(result).toContain('#0000ff')
    expect(result).toContain('0%')
    expect(result).toContain('100%')
  })

  it('converts a multi-stop linear gradient and encodes all stops', () => {
    const fill: LinearGradient = {
      type: 'linear',
      angle: 180,
      stops: [
        { offset: 0, color: '#111111' },
        { offset: 0.5, color: '#888888' },
        { offset: 1, color: '#ffffff' },
      ],
    }
    const result = fillToCss(fill)
    expect(result).toContain('180deg')
    expect(result).toContain('50%')
  })

  it('converts a radial gradient to a CSS radial-gradient() string', () => {
    const fill: RadialGradient = {
      type: 'radial',
      cx: 0.5,
      cy: 0.5,
      radius: 1,
      stops: [
        { offset: 0, color: '#ffffff' },
        { offset: 1, color: '#000000' },
      ],
    }
    const result = fillToCss(fill)
    expect(result).toMatch(/^radial-gradient\(/)
    expect(result).toContain('50%')
    expect(result).toContain('#ffffff')
    expect(result).toContain('#000000')
  })

  it('encodes radial gradient center position from cx/cy fractions', () => {
    const fill: RadialGradient = {
      type: 'radial',
      cx: 0.25,
      cy: 0.75,
      radius: 0.5,
      stops: [{ offset: 0, color: '#aaaaaa' }, { offset: 1, color: '#bbbbbb' }],
    }
    const result = fillToCss(fill)
    // cx=0.25 → 25%, cy=0.75 → 75%
    expect(result).toContain('25%')
    expect(result).toContain('75%')
  })
})

describe('color alpha helpers', () => {
  it('applies alpha to six-digit hex colors', () => {
    expect(withAlpha('#7c6ef6', 0.25)).toBe('rgba(124,110,246,0.25)')
  })

  it('expands three-digit hex colors before applying alpha', () => {
    expect(withAlpha('#f0a', 0.5)).toBe('rgba(255,0,170,0.5)')
  })

  it('applies alpha to rgb colors', () => {
    expect(withAlpha('rgb(12, 34, 56)', 0.4)).toBe('rgba(12,34,56,0.4)')
  })

  it('replaces the alpha in rgba colors', () => {
    expect(withAlpha('rgba(12, 34, 56, 0.2)', 0.8)).toBe('rgba(12,34,56,0.8)')
  })

  it('passes unparseable colors through unchanged', () => {
    expect(withAlpha('brand:accent', 0.5)).toBe('brand:accent')
  })

  it('extracts rgba alpha and treats hex and rgb colors as opaque', () => {
    expect(parseColorAlpha('rgba(124, 58, 237, 0.28)')).toBe(0.28)
    expect(parseColorAlpha('#7c6ef6')).toBe(1)
    expect(parseColorAlpha('rgb(124, 58, 237)')).toBe(1)
  })

  it('makes a color transparent without changing its RGB channels', () => {
    expect(toTransparentColor('rgba(124, 58, 237, 0.28)')).toBe('rgba(124,58,237,0)')
  })
})
