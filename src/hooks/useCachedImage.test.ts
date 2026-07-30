import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __clearImageCacheForTests, warmImageCache } from './useCachedImage'

let imageConstructors = 0

class FakeImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor() {
    imageConstructors += 1
  }

  set src(_value: string) {
    queueMicrotask(() => this.onload?.())
  }

  decode(): Promise<void> {
    return Promise.resolve()
  }
}

beforeEach(() => {
  imageConstructors = 0
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
