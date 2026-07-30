import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __clearImageCacheForTests, getPendingImageLoadCount, useCachedImage, warmImageCache } from './useCachedImage'

const { effectCallbacks } = vi.hoisted(() => ({ effectCallbacks: [] as Array<() => void | (() => void)> }))

vi.mock('react', () => ({
  useEffect: (callback: () => void | (() => void)) => effectCallbacks.push(callback),
  useState: <T,>(initial: T) => [initial, vi.fn()],
}))

let imageConstructors = 0
let autoLoad = true
const images: FakeImage[] = []

class FakeImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor() {
    imageConstructors += 1
    images.push(this)
  }

  set src(_value: string) {
    if (autoLoad) queueMicrotask(() => this.onload?.())
  }

  decode(): Promise<void> {
    return Promise.resolve()
  }
}

beforeEach(() => {
  imageConstructors = 0
  autoLoad = true
  images.length = 0
  effectCallbacks.length = 0
  __clearImageCacheForTests()
  vi.stubGlobal('Image', FakeImage)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('warmImageCache', () => {
  it('reuses a decoded image for a repeated source', async () => {
    await warmImageCache('data:image/png;base64,test')
    await warmImageCache('data:image/png;base64,test')

    expect(imageConstructors).toBe(1)
  })

  it('does nothing for an empty source', async () => {
    await warmImageCache('')

    expect(imageConstructors).toBe(0)
  })
})

describe('useCachedImage pending loads', () => {
  it('tracks concurrent consumers of the same cold source separately', async () => {
    autoLoad = false
    useCachedImage('data:image/png;base64,test')
    useCachedImage('data:image/png;base64,test')
    const cleanups = effectCallbacks.map((effect) => effect())

    expect(getPendingImageLoadCount()).toBe(2)

    images[0].onload?.()
    await Promise.resolve()
    await Promise.resolve()
    expect(getPendingImageLoadCount()).toBe(1)

    images[1].onload?.()
    await Promise.resolve()
    await Promise.resolve()
    expect(getPendingImageLoadCount()).toBe(0)
    cleanups.forEach((cleanup) => cleanup?.())
  })
})
