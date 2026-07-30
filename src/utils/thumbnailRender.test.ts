import { describe, expect, it } from 'vitest'
import type { BackgroundLayer, GroupLayer, Layer } from '@/types'
import {
  enqueueRequests,
  getThumbnailStageGeometry,
  NAV_THUMB_CAPTURE_HEIGHT_PX,
  stripExpensiveEffects,
  type ThumbnailRequest,
} from './thumbnailRender'

const background = (overrides = {}) => ({ type: 'background', imageBlur: 0, accents: [], ...overrides }) as unknown as BackgroundLayer
const text = { type: 'text', blur: 12 } as unknown as Layer
const group = { type: 'group', children: [background({ imageBlur: 8 })] } as unknown as GroupLayer

describe('stripExpensiveEffects', () => {
  it('zeros expensive background blur effects only', () => {
    const layer = background({ imageBlur: 12, accents: [{ blur: 8 }, { blur: 0 }, {}] })
    const result = stripExpensiveEffects([layer])[0]!
    expect(result).not.toBe(layer)
    expect((result as BackgroundLayer).imageBlur).toBe(0)
    expect((result as BackgroundLayer).accents[0]).not.toBe(layer.accents[0])
    expect((result as BackgroundLayer).accents[1]).toBe(layer.accents[1])
  })

  it('preserves layers with no expensive background effects and never recurses', () => {
    const clean = background()
    expect(stripExpensiveEffects([clean])[0]).toBe(clean)
    expect(stripExpensiveEffects([text])[0]).toBe(text)
    expect(stripExpensiveEffects([group])[0]).toBe(group)
    expect(group.children[0]).toBe(group.children[0])
  })
})

describe('getThumbnailStageGeometry', () => {
  it('calculates single-slide geometry', () => {
    const geometry = getThumbnailStageGeometry({ slideWidth: 100, slideHeight: 200, numSlides: 1 }, 300)
    expect(geometry.scale).toBe(NAV_THUMB_CAPTURE_HEIGHT_PX / 200)
    expect(geometry.stageHeight).toBe(88)
    expect(geometry.sliceXs).toEqual([0])
    expect(geometry.totalWidth).toBe(100)
  })

  it('accounts for pano compensation in slice positions', () => {
    expect(getThumbnailStageGeometry({ slideWidth: 200, slideHeight: 400, numSlides: 3 }, 0).sliceXs).toEqual([0, 44, 88])
    expect(getThumbnailStageGeometry({ slideWidth: 200, slideHeight: 400, numSlides: 3 }, 24).sliceXs).toEqual([0, 49, 99])
  })

  it('never reads a slice beyond the scaled stage edge', () => {
    for (const [slideWidth, slideHeight] of [[3840, 2160], [1290, 2796], [1320, 2868]]) {
      for (const numSlides of [1, 2, 3]) {
        for (const compensationPx of [0, 24, 300]) {
          const geometry = getThumbnailStageGeometry({ slideWidth, slideHeight, numSlides }, compensationPx)
          expect(geometry.sliceXs.at(-1)! + geometry.sliceWidth).toBeLessThanOrEqual(geometry.stageWidth)
        }
      }
    }
  })
})

const request = (groupId: string, key: string): ThumbnailRequest => ({
  groupId, key, format: 'iphone-69', locale: 'en', pano: { gapPx: 24, compensate: false },
})

describe('enqueueRequests', () => {
  it('adds distinct requests in order and ignores exact duplicates', () => {
    const first = request('one', 'a')
    const second = request('two', 'b')
    expect(enqueueRequests([], [first, second])).toEqual([first, second])
    expect(enqueueRequests([first], [first])).toEqual([first])
  })

  it('replaces an older pending request for the same group', () => {
    const first = request('one', 'a')
    const newer = request('one', 'new')
    const second = request('two', 'b')
    expect(enqueueRequests([first, second], [newer])).toEqual([newer, second])
  })
})
