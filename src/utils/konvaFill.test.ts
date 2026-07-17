import { describe, expect, it } from 'vitest'
import type { BrandColor, LinearGradient, RadialGradient } from '@/types'
import { layerFillToKonvaProps } from './konvaFill'

const palette: BrandColor[] = [{ id: 'primary', name: 'Primary', value: '#123456' }]
const bounds = { width: 200, height: 100 }

describe('layerFillToKonvaProps', () => {
  it('converts a solid color', () => {
    expect(layerFillToKonvaProps('#abcdef', palette, bounds)).toEqual({ fill: '#abcdef' })
  })

  it('resolves a brand token', () => {
    expect(layerFillToKonvaProps('{brand:primary}', palette, bounds)).toEqual({ fill: '#123456' })
  })

  it('converts a linear gradient and resolves its stops', () => {
    const fill: LinearGradient = {
      type: 'linear',
      angle: 90,
      stops: [{ offset: 0, color: '{brand:primary}' }, { offset: 1, color: '#ffffff' }],
    }

    const result = layerFillToKonvaProps(fill, palette, bounds)
    expect(result.fillLinearGradientStartPoint).toMatchObject({ x: 0 })
    expect(result.fillLinearGradientEndPoint).toMatchObject({ x: 200 })
    expect((result.fillLinearGradientStartPoint as { y: number }).y).toBeCloseTo(50)
    expect((result.fillLinearGradientEndPoint as { y: number }).y).toBeCloseTo(50)
    expect(result.fillLinearGradientColorStops).toEqual([0, '#123456', 1, '#ffffff'])
  })

  it('converts a radial gradient', () => {
    const fill: RadialGradient = {
      type: 'radial',
      cx: 0.25,
      cy: 0.75,
      radius: 0.5,
      stops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }],
    }

    expect(layerFillToKonvaProps(fill, palette, bounds)).toEqual({
      fillRadialGradientStartPoint: { x: 50, y: 75 },
      fillRadialGradientEndPoint: { x: 50, y: 75 },
      fillRadialGradientStartRadius: 0,
      fillRadialGradientEndRadius: 100,
      fillRadialGradientColorStops: [0, '#000000', 1, '#ffffff'],
    })
  })

  it('returns no fill props for undefined', () => {
    expect(layerFillToKonvaProps(undefined, palette, bounds)).toEqual({})
  })
})
