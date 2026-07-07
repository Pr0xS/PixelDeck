import { describe, it, expect } from 'vitest'
import { buildLocaleAssetKey, getFileLabel } from './helpers'

describe('localization helpers', () => {
  it('builds locale asset keys', () => {
    expect(buildLocaleAssetKey('es', 'grp1', 'lyr1', 'screenshot.png'))
      .toBe('locale::es::grp1::lyr1::screenshot.png')
  })

  it('extracts file labels from locale asset keys', () => {
    const key = buildLocaleAssetKey('es', 'grp1', 'lyr1', 'screenshot.png')
    expect(getFileLabel(key)).toBe('screenshot.png')
    expect(getFileLabel('locale::pt-br::g::l::home_hero.png')).toBe('home_hero.png')
  })

  it('returns friendly labels for embedded and missing images', () => {
    expect(getFileLabel('data:image/png;base64,AAA')).toBe('Embedded image')
    expect(getFileLabel(undefined)).toBe('No image')
  })

  it('extracts file labels from plain paths', () => {
    expect(getFileLabel('assets/foo/bar.png')).toBe('bar.png')
  })
})
