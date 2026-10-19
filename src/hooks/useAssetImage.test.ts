import { describe, expect, it } from 'vitest'
import { computeAssetImageState, resolveImageRef } from './useAssetImage'

const ASSET_REF = 'img_0123456789abcdef01234567.png'
const URL = 'data:image/png;base64,AAAA'

describe('resolveImageRef', () => {
  it('returns undefined for no ref', () => {
    expect(resolveImageRef(undefined, {})).toBeUndefined()
    expect(resolveImageRef('', {})).toBeUndefined()
  })
  it('resolves a key through the assets map', () => {
    expect(resolveImageRef(ASSET_REF, { [ASSET_REF]: { dataUrl: URL } })).toBe(URL)
  })
  it('passes data URLs through', () => {
    expect(resolveImageRef(URL, {})).toBe(URL)
  })
  it('returns undefined for unknown keys', () => {
    expect(resolveImageRef(ASSET_REF, {})).toBeUndefined()
  })
})

describe('computeAssetImageState', () => {
  it('none without ref', () => {
    expect(computeAssetImageState(undefined, undefined, true).status).toBe('none')
  })
  it('loading when not hydrated and absent', () => {
    expect(computeAssetImageState(ASSET_REF, undefined, false).status).toBe('loading')
  })
  it('missing when hydrated and absent', () => {
    expect(computeAssetImageState(ASSET_REF, undefined, true, 'shot.png')).toEqual({ status: 'missing', name: 'shot.png' })
  })
  it('missing name falls back to key', () => {
    expect(computeAssetImageState(ASSET_REF, undefined, true).name).toBe(ASSET_REF)
  })
  it('loaded when present even if not hydrated', () => {
    expect(computeAssetImageState(ASSET_REF, URL, false)).toMatchObject({ status: 'loaded', src: URL })
  })
})
