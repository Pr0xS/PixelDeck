import { describe, expect, it } from 'vitest'
import {
  assetKeyFromDataUrl, extForMime, isDataUrl, isHashedAssetKey, mimeForKey, parseDataUrl,
} from './assetKey'

const PNG = 'data:image/png;base64,cG5n'

describe('assetKey', () => {
  it('is deterministic and hashes decoded bytes', () => {
    expect(assetKeyFromDataUrl(PNG)).toBe(assetKeyFromDataUrl(PNG))
    // "png" bytes, same via a different mime parameter ordering / whitespace
    expect(assetKeyFromDataUrl('data:image/png;charset=x;base64,cG5n')).toBe(assetKeyFromDataUrl(PNG))
    expect(parseDataUrl(PNG).bytes).toEqual(new Uint8Array([0x70, 0x6e, 0x67]))
  })

  it('matches the SHA-256 of the decoded bytes', () => {
    // sha256("png") = 8a... verified via node crypto in test below
    return import('node:crypto').then(({ createHash }) => {
      const hex = createHash('sha256').update(Buffer.from('png')).digest('hex').slice(0, 24)
      expect(assetKeyFromDataUrl(PNG)).toBe(`img_${hex}.png`)
    })
  })

  it('uses the mime for the extension', () => {
    expect(assetKeyFromDataUrl('data:image/jpeg;base64,cG5n').endsWith('.jpg')).toBe(true)
    expect(assetKeyFromDataUrl('data:image/webp;base64,cG5n').endsWith('.webp')).toBe(true)
    expect(extForMime('image/svg+xml')).toBe('svg')
    expect(mimeForKey('img_abc.jpg')).toBe('image/jpeg')
  })

  it('same bytes => same hash part, different bytes => different key', () => {
    const other = assetKeyFromDataUrl('data:image/png;base64,anBn')
    expect(other).not.toBe(assetKeyFromDataUrl(PNG))
    const a = assetKeyFromDataUrl('data:image/png;base64,cG5n').split('.')[0]
    const b = assetKeyFromDataUrl('data:image/jpeg;base64,cG5n').split('.')[0]
    expect(a).toBe(b)
  })

  it('recognises data URLs and hashed keys', () => {
    expect(isDataUrl(PNG)).toBe(true)
    expect(isDataUrl('shot.png')).toBe(false)
    expect(isHashedAssetKey(assetKeyFromDataUrl(PNG))).toBe(true)
    expect(isHashedAssetKey('shot.png')).toBe(false)
  })
})
