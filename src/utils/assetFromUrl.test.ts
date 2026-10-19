import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAssetStore } from '@/store/assets'
import { AssetFromUrlError, fetchImageAsAsset, MAX_URL_IMAGE_BYTES } from './assetFromUrl'
import { isHashedAssetKey } from './assetKey'
import { TestFileReader } from './testFileReader'

const respond = (blob: Blob, ok = true) => vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 404, blob: async () => blob })

describe('fetchImageAsAsset', () => {
  beforeEach(() => {
    vi.stubGlobal('FileReader', TestFileReader)
    useAssetStore.setState({ assets: {} })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('stores a fetched image under a hashed key with basename as name', async () => {
    const f = respond(new Blob(['abc'], { type: 'image/png' }))
    vi.stubGlobal('fetch', f)
    const key = await fetchImageAsAsset('https://example.com/a/pic.png?x=1')
    expect(f).toHaveBeenCalledWith('https://example.com/a/pic.png?x=1', { mode: 'cors' })
    expect(isHashedAssetKey(key)).toBe(true)
    expect(useAssetStore.getState().assets[key].name).toBe('pic.png')
  })

  it('rejects non-http(s) urls', async () => {
    await expect(fetchImageAsAsset('ftp://x/y.png')).rejects.toMatchObject({ code: 'invalid-url' })
    await expect(fetchImageAsAsset('nope')).rejects.toBeInstanceOf(AssetFromUrlError)
  })

  it('rejects non-image responses', async () => {
    vi.stubGlobal('fetch', respond(new Blob(['<html>'], { type: 'text/html' })))
    await expect(fetchImageAsAsset('https://example.com/x')).rejects.toMatchObject({ code: 'not-image' })
  })

  it('maps network/CORS failure to a blocked error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(fetchImageAsAsset('https://example.com/x.png')).rejects.toMatchObject({ code: 'blocked' })
  })

  it('rejects images over 25 MB', async () => {
    const big = { type: 'image/png', size: MAX_URL_IMAGE_BYTES } as Blob
    vi.stubGlobal('fetch', respond(big))
    await expect(fetchImageAsAsset('https://example.com/x.png')).rejects.toMatchObject({ code: 'too-large' })
  })
})
