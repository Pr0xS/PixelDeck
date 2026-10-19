import { describe, expect, it } from 'vitest'
import { collectReferencedAssetKeys, findUnusedAssets, getAssetKeyUsage, removalWarning } from './assetUsage'
import type { AssetEntry } from '@/store/assets'
import type { Layer, Project } from '@/types'

const entry = (key: string): AssetEntry => ({ key, name: key, mime: 'image/png', dataUrl: 'data:image/png;base64,AA==', sizeBytes: 1, filename: key })
const base = { x: 0, y: 0, rotation: 0, opacity: 1, visible: true, locked: false }
const proj = (layers: unknown[], settings: Record<string, unknown> = {}): Project =>
  ({ id: 'p', name: 'p', settings, slideGroups: [{ id: 'g', layers }] }) as unknown as Project
const phone = (extra: Record<string, unknown>) => ({ ...base, id: 'ph', name: 'P', type: 'phone', ...extra })

describe('collectReferencedAssetKeys', () => {
  it('collects base, locale, format, bg, brand, settings and group children', () => {
    const p = proj([
      phone({ screenshotPath: 'a', localeContent: { es: { screenshotPath: 'b' } }, formatOverrides: { f: { screenshotPath: 'c' } } }),
      { ...base, id: 'i', name: 'I', type: 'image', src: 'd', localeContent: { fr: { src: 'e' } } },
      { ...base, id: 'bg', name: 'B', type: 'background', imageRef: 'f' },
      { ...base, id: 'br', name: 'Br', type: 'brand', logoRef: 'g' },
      { ...base, id: 'grp', name: 'G', type: 'group', children: [phone({ id: 'n', screenshotPath: 'h' })] },
    ], { brandLogoRef: 'i' })
    expect([...collectReferencedAssetKeys(p)].sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'])
  })
})

describe('findUnusedAssets', () => {
  const all = ['a', 'b', 'c', 'z'].map(entry)
  it('reports only unreferenced keys', () => {
    const current = proj([phone({ screenshotPath: 'a', localeContent: { es: { screenshotPath: 'b' } } })])
    expect(findUnusedAssets(all, [current]).map((e) => e.key)).toEqual(['c', 'z'])
  })
  it('keeps keys that only appear in undo history', () => {
    const current = proj([phone({ screenshotPath: 'a' })])
    const past = proj([phone({ screenshotPath: 'c' })])
    expect(findUnusedAssets(all, [current, past]).map((e) => e.key)).toEqual(['b', 'z'])
  })
  it('keeps keys on the clipboard and in group children', () => {
    const current = proj([{ ...base, id: 'grp', name: 'G', type: 'group', children: [phone({ screenshotPath: 'a' })] }])
    const clip = [phone({ screenshotPath: 'b' })] as unknown as Layer[]
    expect(findUnusedAssets(all, [current], clip).map((e) => e.key)).toEqual(['c', 'z'])
  })
})

describe('getAssetKeyUsage / removalWarning', () => {
  it('counts layers in the current project and warns', () => {
    const cur = proj([phone({ screenshotPath: 'a' }), phone({ id: 'p2', screenshotPath: 'a', localeContent: { es: { screenshotPath: 'b' } } })])
    const u = getAssetKeyUsage('a', cur)
    expect(u.currentLayers).toBe(2)
    expect(removalWarning(u)).toContain('used by 2 layers')
    expect(removalWarning(u)).toContain('Remove anyway?')
  })
  it('flags history-only and clipboard usage, and is silent when unused', () => {
    const cur = proj([phone({ screenshotPath: 'a' })])
    expect(getAssetKeyUsage('c', cur, [proj([phone({ screenshotPath: 'c' })])]).inHistory).toBe(true)
    expect(getAssetKeyUsage('b', cur, [], [phone({ screenshotPath: 'b' })] as unknown as Layer[]).inClipboard).toBe(true)
    expect(removalWarning(getAssetKeyUsage('z', cur))).toBeNull()
  })
  it('counts settings brand logo', () => {
    expect(getAssetKeyUsage('i', proj([], { brandLogoRef: 'i' })).inSettings).toBe(true)
  })
})
