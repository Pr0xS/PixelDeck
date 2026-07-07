import { describe, it, expect, vi } from 'vitest'
import { acquireCaptureLock, runExclusiveCapture, withIdentityTransform } from './stageCapture'

describe('stage capture mutex', () => {
  it('serializes concurrent captures in FIFO order', async () => {
    const releaseA = await acquireCaptureLock()
    const order: string[] = []
    const pB = runExclusiveCapture(async () => { order.push('B') })
    order.push('A')
    expect(order).toEqual(['A'])
    releaseA()
    await pB
    expect(order).toEqual(['A', 'B'])
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
