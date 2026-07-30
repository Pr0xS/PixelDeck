import { describe, it, expect, vi } from 'vitest'

const { getPendingImageLoadCount } = vi.hoisted(() => ({
  getPendingImageLoadCount: vi.fn(() => 0),
}))

vi.mock('@/hooks/useCachedImage', () => ({ getPendingImageLoadCount }))

import {
  acquireCaptureLock,
  classifyStageImages,
  isCaptureLocked,
  isImagelessBlocking,
  runExclusiveCapture,
  waitForStageSettled,
  withIdentityTransform,
} from './stageCapture'

describe('stage capture mutex', () => {
  it('serializes concurrent captures in FIFO order', async () => {
    expect(isCaptureLocked()).toBe(false)
    const releaseA = await acquireCaptureLock()
    expect(isCaptureLocked()).toBe(true)
    const order: string[] = []
    const pB = runExclusiveCapture(async () => { order.push('B') })
    order.push('A')
    expect(order).toEqual(['A'])
    releaseA()
    await pB
    expect(order).toEqual(['A', 'B'])
    expect(isCaptureLocked()).toBe(false)
  })

  it('releases the lock even if the callback throws', async () => {
    await expect(runExclusiveCapture(async () => { throw new Error('x') })).rejects.toThrow('x')
    await expect(runExclusiveCapture(async () => 42)).resolves.toBe(42)
  })

  it("returns the callback's resolved value", async () => {
    await expect(runExclusiveCapture(async () => 7)).resolves.toBe(7)
  })
})

describe('withIdentityTransform', () => {
  it('applies identity transform during fn and restores previous values after', () => {
    const state = { x: 5, y: 6, scaleX: 2, scaleY: 3 }
    const fakeStage = {
      x: vi.fn((v?: number) => { if (v !== undefined) state.x = v; return state.x }),
      y: vi.fn((v?: number) => { if (v !== undefined) state.y = v; return state.y }),
      scaleX: vi.fn((v?: number) => { if (v !== undefined) state.scaleX = v; return state.scaleX }),
      scaleY: vi.fn((v?: number) => { if (v !== undefined) state.scaleY = v; return state.scaleY }),
    } as unknown as Parameters<typeof withIdentityTransform>[0]
    let observedDuringFn: typeof state | null = null
    const result = withIdentityTransform(fakeStage, () => {
      observedDuringFn = { x: fakeStage.x(), y: fakeStage.y(), scaleX: fakeStage.scaleX(), scaleY: fakeStage.scaleY() }
      return 'done'
    })
    expect(observedDuringFn).toEqual({ x: 0, y: 0, scaleX: 1, scaleY: 1 })
    expect(state).toEqual({ x: 5, y: 6, scaleX: 2, scaleY: 3 })
    expect(result).toBe('done')
  })

  it('restores previous values after fn throws', () => {
    const state = { x: 5, y: 6, scaleX: 2, scaleY: 3 }
    const fakeStage = {
      x: vi.fn((v?: number) => { if (v !== undefined) state.x = v; return state.x }),
      y: vi.fn((v?: number) => { if (v !== undefined) state.y = v; return state.y }),
      scaleX: vi.fn((v?: number) => { if (v !== undefined) state.scaleX = v; return state.scaleX }),
      scaleY: vi.fn((v?: number) => { if (v !== undefined) state.scaleY = v; return state.scaleY }),
    } as unknown as Parameters<typeof withIdentityTransform>[0]

    expect(() => withIdentityTransform(fakeStage, () => { throw new Error('x') })).toThrow('x')
    expect(state).toEqual({ x: 5, y: 6, scaleX: 2, scaleY: 3 })
  })
})

describe('classifyStageImages', () => {
  it('treats complete image elements as loaded', () => {
    expect(classifyStageImages([{ image: () => ({ complete: true }) }])).toEqual({ pending: 0, imageless: 0 })
  })

  it('counts nodes without an image as imageless', () => {
    expect(classifyStageImages([{ image: () => undefined }])).toEqual({ pending: 0, imageless: 1 })
  })

  it('counts incomplete image elements as pending', () => {
    expect(classifyStageImages([{ image: () => ({ complete: false }) }])).toEqual({ pending: 1, imageless: 0 })
  })

  it('treats non-image objects as loaded', () => {
    expect(classifyStageImages([{ image: () => ({ width: 100, height: 100 }) }])).toEqual({ pending: 0, imageless: 0 })
  })

  it('handles an empty node collection', () => {
    expect(classifyStageImages([])).toEqual({ pending: 0, imageless: 0 })
  })
})

describe('isImagelessBlocking', () => {
  it('does not block when there are no imageless nodes', () => {
    expect(isImagelessBlocking(0, null, 100)).toBe(false)
    expect(isImagelessBlocking(0, 0, 100)).toBe(false)
  })

  it('blocks during the imageless grace period', () => {
    expect(isImagelessBlocking(1, 100, 349)).toBe(true)
  })

  it('stops blocking after the imageless grace period', () => {
    expect(isImagelessBlocking(1, 100, 350)).toBe(false)
  })
})

describe('waitForStageSettled', () => {
  it('waits for hook-tracked pending image loads to finish', async () => {
    let pendingLoads = 1
    getPendingImageLoadCount.mockImplementation(() => pendingLoads)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 0))
    const stage = { find: vi.fn(() => []) } as unknown as Parameters<typeof waitForStageSettled>[0]
    let resolved = false
    const settled = waitForStageSettled(stage, { quietFrames: 1, timeoutMs: 100 })
      .then((result) => { resolved = true; return result })

    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(resolved).toBe(false)
    pendingLoads = 0
    await expect(settled).resolves.toBe(true)
    vi.unstubAllGlobals()
  })
})
