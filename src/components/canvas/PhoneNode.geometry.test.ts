import { describe, it, expect } from 'vitest'
import { calcScreenshotLayout } from './PhoneNode.geometry'

describe('calcScreenshotLayout', () => {
  it('fills the screen and ignores offsets in fill mode', () => {
    expect(calcScreenshotLayout(100, 100, 200, 400, 'fill', 5, 7)).toEqual({
      x: 0,
      y: 0,
      width: 200,
      height: 400,
    })
  })

  it('covers a tall screen by cropping horizontally', () => {
    expect(calcScreenshotLayout(100, 100, 200, 400, 'cover', 0, 0)).toEqual({
      x: -100,
      y: 0,
      width: 400,
      height: 400,
    })
  })

  it('contains a square image in a tall screen by letterboxing vertically', () => {
    expect(calcScreenshotLayout(100, 100, 200, 400, 'contain', 0, 0)).toEqual({
      x: 0,
      y: 100,
      width: 200,
      height: 200,
    })
  })

  it('applies offsets in cover mode', () => {
    expect(calcScreenshotLayout(100, 100, 200, 400, 'cover', 10, 20)).toEqual({
      x: -90,
      y: 20,
      width: 400,
      height: 400,
    })
  })

  it('applies offsets in contain mode', () => {
    expect(calcScreenshotLayout(100, 100, 200, 400, 'contain', 10, 20)).toEqual({
      x: 10,
      y: 120,
      width: 200,
      height: 200,
    })
  })
})
