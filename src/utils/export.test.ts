import { describe, it, expect, vi } from 'vitest'
import type Konva from 'konva'
import type { SlideGroup } from '@/types'
import { exportSlide, exportAllSlides, exportGroupImages } from './export'

function makeFakeStage() {
  return {
    x: () => 0, y: () => 0, scaleX: () => 1, scaleY: () => 1,
    toDataURL: vi.fn((opts: unknown) => `data:${JSON.stringify(opts)}`),
  } as unknown as Konva.Stage
}

function makeGroup(partial?: Partial<SlideGroup>): SlideGroup {
  return {
    id: 'group',
    name: 'Group',
    slideWidth: 1000,
    slideHeight: 2000,
    numSlides: 2,
    slideNames: ['a', 'b'],
    layers: [],
    ...partial,
  }
}

describe('exportSlide', () => {
  it('exports a single slide using the pano gap offset', async () => {
    const stage = makeFakeStage()
    const result = await exportSlide(stage, 1, makeGroup(), 24)

    expect(result).toBeTypeOf('string')
    expect(stage.toDataURL).toHaveBeenCalledOnce()
    expect(stage.toDataURL).toHaveBeenCalledWith({
      x: 1024,
      y: 0,
      width: 1000,
      height: 2000,
      pixelRatio: 1,
      mimeType: 'image/png',
    })
  })
})

describe('exportAllSlides', () => {
  it('exports all slides with their configured names', async () => {
    const stage = makeFakeStage()
    const result = await exportAllSlides(stage, makeGroup())

    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('a')
    expect(result[1].name).toBe('b')
    expect(stage.toDataURL).toHaveBeenCalledTimes(2)
  })

  it('falls back to slide names without dropping slides', async () => {
    const stage = makeFakeStage()
    const result = await exportAllSlides(stage, makeGroup({ slideNames: [] }))

    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('slide-1')
    expect(result[1].name).toBe('slide-2')
  })
})

describe('exportGroupImages', () => {
  it('exports a whole pano group using the group name', async () => {
    const stage = makeFakeStage()
    const result = await exportGroupImages(stage, makeGroup({ name: 'Hero' }), 'whole', 24)

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Hero')
  })

  it('falls back to pano for whole-group exports with a falsy group name', async () => {
    const stage = makeFakeStage()
    const result = await exportGroupImages(stage, makeGroup({ name: '' }), 'whole', 24)

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('pano')
  })

  it('falls through to per-slide export in whole mode for single-slide groups', async () => {
    const stage = makeFakeStage()
    const result = await exportGroupImages(stage, makeGroup({ numSlides: 1, slideNames: ['a'] }), 'whole', 24)

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('a')
  })

  it('exports per-slide in split mode and applies the pano gap', async () => {
    const stage = makeFakeStage()
    const result = await exportGroupImages(stage, makeGroup(), 'split', 24)

    expect(result).toHaveLength(2)
    expect(stage.toDataURL).toHaveBeenCalledTimes(2)
    expect(stage.toDataURL).toHaveBeenNthCalledWith(1, expect.objectContaining({ x: 0 }))
    expect(stage.toDataURL).toHaveBeenNthCalledWith(2, expect.objectContaining({ x: 1024 }))
  })
})
