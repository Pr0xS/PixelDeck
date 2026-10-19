import { describe, expect, it } from 'vitest'
import { findMissingAssets } from './missingAssets'
import type { Layer, Project } from '@/types'

const A = 'img_aaaaaaaaaaaaaaaaaaaaaaaa.png'
const B = 'img_bbbbbbbbbbbbbbbbbbbbbbbb.png'
const C = 'img_cccccccccccccccccccccccc.png'
const D = 'img_dddddddddddddddddddddddd.png'
const E = 'img_eeeeeeeeeeeeeeeeeeeeeeee.png'

function layer(partial: Record<string, unknown>): Layer {
  return { id: 'l', name: 'L', x: 0, y: 0, rotation: 0, opacity: 1, visible: true, locked: false, ...partial } as unknown as Layer
}

function project(layers: Layer[], extra: Record<string, unknown> = {}): Project {
  return {
    id: 'p',
    name: 'P',
    settings: { ...(extra.settings as object | undefined) },
    assetManifest: extra.assetManifest,
    slideGroups: [{ id: 'g', name: 'G1', layers }],
  } as unknown as Project
}

describe('findMissingAssets', () => {
  const none = () => undefined

  it('is empty when everything resolves', () => {
    const p = project([layer({ type: 'phone', screenshotPath: A })])
    expect(findMissingAssets(p, () => 'data:x')).toEqual([])
  })

  it('finds phone, group children, background and logo refs', () => {
    const p = project([
      layer({ type: 'phone', name: 'Phone', screenshotPath: A }),
      layer({ type: 'background', name: 'Bg', imageRef: B }),
      layer({ type: 'group', name: 'Grp', children: [layer({ type: 'image', name: 'Img', src: C })] }),
      layer({ type: 'brand', name: 'Brand', logoRef: D }),
    ], { settings: { brandLogoRef: E }, assetManifest: { [A]: { name: 'home.png', mime: 'image/png' } } })
    const out = findMissingAssets(p, none)
    expect(out.map((m) => m.ref).sort()).toEqual([A, B, C, D, E].sort())
    expect(out.find((m) => m.ref === A)?.name).toBe('home.png')
    expect(out.find((m) => m.ref === B)?.name).toBe(B)
    expect(out.find((m) => m.ref === C)?.where).toContain('Img')
  })

  it('finds locale content and format override refs', () => {
    const p = project([
      layer({
        type: 'phone',
        screenshotPath: A,
        localeContent: { de: { screenshotPath: B } },
        formatOverrides: { 'ipad-13': { screenshotPath: C } },
      }),
    ])
    const out = findMissingAssets(p, (ref) => (ref === A ? 'data:x' : undefined))
    expect(out.map((m) => m.ref).sort()).toEqual([B, C])
    expect(out.find((m) => m.ref === B)?.where).toContain('locale de')
  })

  it('ignores data URLs', () => {
    const p = project([layer({ type: 'image', src: 'data:image/png;base64,AA' })])
    expect(findMissingAssets(p, none)).toEqual([])
  })
})
