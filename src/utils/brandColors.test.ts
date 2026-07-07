import { describe, it, expect } from 'vitest'
import type { BrandColor, LinearGradient } from '@/types'
import {
  isBrandToken,
  toBrandToken,
  parseBrandToken,
  resolveBrandColor,
  resolveFill,
} from './brandColors'

describe('brand color tokens', () => {
  it('creates brand tokens', () => {
    expect(toBrandToken('abc')).toBe('{brand:abc}')
  })

  it('parses brand tokens', () => {
    expect(parseBrandToken('{brand:abc}')).toBe('abc')
    expect(parseBrandToken('#ffffff')).toBeNull()
  })

  it('detects brand tokens', () => {
    expect(isBrandToken('{brand:abc}')).toBe(true)
    expect(isBrandToken('#fff')).toBe(false)
  })
})

describe('brand color resolution', () => {
  const palette: BrandColor[] = [{ id: 'x1', name: 'Primary', value: '#ff0000' }]

  it('resolves a known brand color token', () => {
    expect(resolveBrandColor('{brand:x1}', palette)).toBe('#ff0000')
  })

  it('returns unresolved brand tokens unchanged', () => {
    expect(resolveBrandColor('{brand:missing}', palette)).toBe('{brand:missing}')
  })

  it('returns non-token colors unchanged', () => {
    expect(resolveBrandColor('#123456', [])).toBe('#123456')
  })
})

describe('fill resolution', () => {
  const palette: BrandColor[] = [{ id: 'x1', name: 'Primary', value: '#0f0' }]

  it('resolves solid color fills', () => {
    expect(resolveFill('{brand:x1}', palette)).toBe('#0f0')
  })

  it('resolves brand tokens in gradient stops while preserving gradient fields', () => {
    const gradient: LinearGradient = {
      type: 'linear',
      angle: 90,
      stops: [
        { offset: 0, color: '{brand:x1}' },
        { offset: 1, color: '#000' },
      ],
    }

    const result = resolveFill(gradient, palette)

    expect(result).toMatchObject({
      type: 'linear',
      angle: 90,
      stops: [
        { offset: 0, color: '#0f0' },
        { offset: 1, color: '#000' },
      ],
    })
  })
})
