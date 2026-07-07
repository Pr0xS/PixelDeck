import { describe, it, expect } from 'vitest'
import { collectAssetRefsFromProject, resolveAssetAliases } from './export.mjs'

describe('CLI export asset helpers', () => {
  it('collects non-data URI phone and image asset refs', () => {
    const project = {
      slideGroups: [{ layers: [
        { type: 'phone', screenshotPath: 'a.png' },
        { type: 'image', src: 'b.png' },
        { type: 'phone', screenshotPath: 'data:image/png;base64,XXX' },
      ] }],
    }

    expect(Array.from(collectAssetRefsFromProject(project)).sort()).toEqual(['a.png', 'b.png'])
  })

  it('collects asset refs from locale override patches', () => {
    const project = {
      slideGroups: [{ layers: [
        { type: 'phone', screenshotPath: 'a.png', localeOverrides: { es: { screenshotPath: 'c.png' } } },
      ] }],
    }

    expect(collectAssetRefsFromProject(project)).toEqual(new Set(['a.png', 'c.png']))
  })

  it('recursively collects refs from group children', () => {
    const project = {
      slideGroups: [{ layers: [
        { type: 'group', children: [{ type: 'image', src: 'nested.png' }] },
      ] }],
    }

    expect(collectAssetRefsFromProject(project)).toEqual(new Set(['nested.png']))
  })

  it('resolves slash suffix aliases', () => {
    expect(resolveAssetAliases(['sub/dir/x.png'], ['x.png'])).toEqual({ 'sub/dir/x.png': 'x.png' })
  })

  it('resolves legacy dash suffix aliases', () => {
    expect(resolveAssetAliases(['prefix-x.png'], ['x.png'])).toEqual({ 'prefix-x.png': 'x.png' })
  })

  it('resolves exact aliases', () => {
    expect(resolveAssetAliases(['x.png'], ['x.png'])).toEqual({ 'x.png': 'x.png' })
  })

  it('does not create false-positive aliases', () => {
    expect(resolveAssetAliases(['zzz.png'], ['x.png'])).toEqual({})
  })
})
