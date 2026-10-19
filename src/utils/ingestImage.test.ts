import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAssetStore } from '@/store/assets'
import { ingestImageFile } from './ingestImage'
import { isHashedAssetKey } from './assetKey'
import { TestFileReader } from './testFileReader'

const png = (bytes: string) => new File([bytes], 'shot.png', { type: 'image/png' })

describe('ingestImageFile', () => {
  afterEach(() => vi.unstubAllGlobals())
  beforeEach(() => {
    vi.stubGlobal('FileReader', TestFileReader)
    useAssetStore.setState({ assets: {} })
  })

  it('returns a hashed key (not the filename) and stores the bytes', async () => {
    const r = await ingestImageFile(png('A'))
    expect(isHashedAssetKey(r.key)).toBe(true)
    expect(r.key).not.toBe('shot.png')
    expect(r.name).toBe('shot.png')
    expect(useAssetStore.getState().resolveAsset(r.key)?.startsWith('data:')).toBe(true)
  })

  it('same filename with different bytes yields different keys', async () => {
    const a = await ingestImageFile(png('A'))
    const b = await ingestImageFile(png('B'))
    expect(a.key).not.toBe(b.key)
    expect(Object.keys(useAssetStore.getState().assets)).toHaveLength(2)
  })

  it('identical bytes dedupe', async () => {
    const a = await ingestImageFile(png('A'))
    const b = await ingestImageFile(png('A'))
    expect(a.key).toBe(b.key)
  })
})
