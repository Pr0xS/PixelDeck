import { describe, it, expect } from 'vitest'
import { fillToCss } from './gradients'
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
