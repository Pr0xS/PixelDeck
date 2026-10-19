import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import {
  parseProjectInput,
  resolveJobAssets,
  collectProjectRefs,
  assetKeyFromBytes as nodeKey,
  describeMissing,
  findRemoteImageUrls,
  isZipBuffer,
} from './projectInput.mjs'
import { isZipBytes } from '../src/utils/projectZip'
import { assetKeyFromBytes, assetKeyFromDataUrl } from '../src/utils/assetKey'

const bytesA = Buffer.from([137, 80, 78, 71, 1, 2, 3, 4, 5])
const bytesB = Buffer.from([255, 216, 255, 9, 8, 7, 6])
const dataUrl = (b, mime) => `data:${mime};base64,${b.toString('base64')}`

const keyA = assetKeyFromBytes(bytesA, 'image/png')
const keyB = assetKeyFromBytes(bytesB, 'image/jpeg')

function project(extra = {}) {
  return {
    id: 'p1',
    name: 'P',
    settings: { defaultLocale: 'en' },
    assetManifest: { [keyA]: { name: 'home.png', mime: 'image/png' } },
    slideGroups: [{ id: 'g', layers: [{ id: 'l', type: 'phone', screenshotPath: keyA }] }],
    ...extra,
  }
}

describe('key equivalence with src/utils/assetKey.ts', () => {
  it('node crypto keys equal assetKey.ts keys', () => {
    for (const [bytes, mime] of [[bytesA, 'image/png'], [bytesB, 'image/jpeg'], [bytesA, 'image/webp']]) {
      expect(nodeKey(bytes, mime)).toBe(assetKeyFromBytes(bytes, mime))
      expect(nodeKey(bytes, mime)).toBe(assetKeyFromDataUrl(dataUrl(bytes, mime)))
    }
  })
})

describe('parseProjectInput', () => {
  it('accepts raw project JSON', async () => {
    const { project: p, embedded } = await parseProjectInput(Buffer.from(JSON.stringify(project())))
    expect(p.id).toBe('p1')
    expect(embedded).toEqual({})
  })

  it('accepts bundle v1 (key → dataUrl)', async () => {
    const bundle = { kind: 'project-export', schemaVersion: 1, project: project(), assets: { [keyA]: dataUrl(bytesA, 'image/png') } }
    const { embedded } = await parseProjectInput(Buffer.from(JSON.stringify(bundle)))
    expect(embedded[keyA].dataUrl).toBe(dataUrl(bytesA, 'image/png'))
  })

  it('accepts bundle v2 and merges names into the manifest', async () => {
    const p = project({ assetManifest: undefined })
    const bundle = {
      kind: 'project-export',
      schemaVersion: 2,
      project: p,
      assets: { [keyA]: { name: 'home.png', mime: 'image/png', dataUrl: dataUrl(bytesA, 'image/png') } },
    }
    const { project: out, embedded } = await parseProjectInput(Buffer.from(JSON.stringify(bundle)))
    expect(embedded[keyA].name).toBe('home.png')
    expect(out.assetManifest[keyA].name).toBe('home.png')
  })

  it('accepts a zip with project.json + assets/<key>', async () => {
    const zip = new JSZip()
    zip.file('project.json', JSON.stringify(project()))
    zip.file(`assets/${keyA}`, bytesA)
    const buf = await zip.generateAsync({ type: 'nodebuffer' })
    const { project: out, embedded } = await parseProjectInput(buf)
    expect(out.id).toBe('p1')
    expect(embedded[keyA].dataUrl).toBe(dataUrl(bytesA, 'image/png'))
    expect(embedded[keyA].name).toBe('home.png')
  })

  it('rejects a zip without project.json', async () => {
    const zip = new JSZip()
    zip.file('x.txt', 'hi')
    await expect(parseProjectInput(await zip.generateAsync({ type: 'nodebuffer' }))).rejects.toThrow(/project\.json/)
  })

  it('accepts legacy inline-data-url projects unchanged', async () => {
    const legacy = project({ assetManifest: undefined, slideGroups: [{ id: 'g', layers: [{ id: 'l', type: 'phone', screenshotDataUrl: dataUrl(bytesA, 'image/png') }] }] })
    const { project: out } = await parseProjectInput(Buffer.from(JSON.stringify(legacy)))
    expect(out.slideGroups[0].layers[0].screenshotDataUrl).toBeDefined()
    expect(collectProjectRefs(out).size).toBe(0)
  })

  it('rejects unrelated JSON and invalid JSON', async () => {
    await expect(parseProjectInput(Buffer.from('{"a":1}'))).rejects.toThrow(/slideGroups/)
    await expect(parseProjectInput(Buffer.from('nope'))).rejects.toThrow(/not valid JSON/)
  })
})

describe('resolveJobAssets', () => {
  it('uses embedded assets when no folder is given', () => {
    const embedded = { [keyA]: { dataUrl: dataUrl(bytesA, 'image/png') } }
    const r = resolveJobAssets({ project: project(), embedded })
    expect(r.assets).toEqual({ [keyA]: dataUrl(bytesA, 'image/png') })
    expect(r.missing).toEqual([])
  })

  it('folder file (matched by manifest name) overrides embedded and rewrites refs', () => {
    const embedded = { [keyA]: { dataUrl: dataUrl(bytesA, 'image/png') } }
    const r = resolveJobAssets({ project: project(), embedded, folderFiles: [{ name: 'home.png', bytes: bytesB }] })
    const newKey = assetKeyFromBytes(bytesB, 'image/png')
    expect(r.project.slideGroups[0].layers[0].screenshotPath).toBe(newKey)
    expect(r.assets[newKey]).toBe(dataUrl(bytesB, 'image/png'))
    expect(r.assets[keyA]).toBeUndefined()
    expect(r.project.assetManifest[newKey].name).toBe('home.png')
    expect(r.missing).toEqual([])
  })

  it('reports missing images and describes them with display names', () => {
    const r = resolveJobAssets({ project: project(), embedded: {} })
    expect(r.missing).toEqual([keyA])
    expect(describeMissing(r.project, r.missing)[0]).toContain('home.png')
  })

  it('legacy filename keys: exact and suffix alias matches', () => {
    const p = {
      id: 'x',
      settings: {},
      slideGroups: [{ layers: [
        { type: 'phone', screenshotPath: 'a.png' },
        { type: 'image', src: 'locale-es-g-l-b.png' },
        { type: 'image', src: 'zzz.png' },
      ] }],
    }
    const r = resolveJobAssets({ project: p, folderFiles: [{ name: 'a.png', bytes: bytesA }, { name: 'b.png', bytes: bytesB }] })
    expect(r.assets['locale-es-g-l-b.png']).toBe(dataUrl(bytesB, 'image/png'))
    expect(r.missing).toEqual(['zzz.png'])
  })

  it('only requires locale content of rendered locales', () => {
    const p = project()
    p.slideGroups[0].layers[0].localeContent = { fr: { screenshotPath: 'fr-missing.png' } }
    const embedded = { [keyA]: { dataUrl: dataUrl(bytesA, 'image/png') } }
    expect(resolveJobAssets({ project: p, embedded, locales: ['en'] }).missing).toEqual([])
    expect(resolveJobAssets({ project: p, embedded, locales: ['fr'] }).missing).toEqual(['fr-missing.png'])
  })

  it('covers background imageRef, logoRef, brandLogoRef and group children', () => {
    const p = {
      settings: { brandLogoRef: 'brand.png' },
      slideGroups: [{ layers: [
        { type: 'background', imageRef: 'bg.png' },
        { type: 'group', children: [{ type: 'brand', logoRef: 'logo.png' }] },
      ] }],
    }
    expect([...collectProjectRefs(p)].sort()).toEqual(['bg.png', 'brand.png', 'logo.png'])
  })
})

describe('item 1/4: inline fallback, remote urls, zip magic, ambiguity', () => {
  it('legacy ref with inline data is not missing; without inline it is', () => {
    const mk = (extra) => ({ id: 'x', settings: {}, slideGroups: [{ layers: [{ type: 'phone', screenshotPath: 'a.png', ...extra }] }] })
    expect(resolveJobAssets({ project: mk({ screenshotDataUrl: dataUrl(bytesA, 'image/png') }) }).missing).toEqual([])
    expect(resolveJobAssets({ project: mk({}) }).missing).toEqual(['a.png'])
  })

  it('folder file wins over inline data and strips the stale inline field', () => {
    const p = { id: 'x', settings: {}, slideGroups: [{ layers: [{ type: 'phone', screenshotPath: 'a.png', screenshotDataUrl: dataUrl(bytesA, 'image/png') }] }] }
    const r = resolveJobAssets({ project: p, folderFiles: [{ name: 'a.png', bytes: bytesB }] })
    const layer = r.project.slideGroups[0].layers[0]
    expect(layer.screenshotPath).toBe(assetKeyFromBytes(bytesB, 'image/png'))
    expect('screenshotDataUrl' in layer).toBe(false)
    expect(r.missing).toEqual([])
  })

  it('remote/blob srcs are not refs and produce a warning', () => {
    const p = { id: 'x', settings: {}, slideGroups: [{ layers: [{ type: 'image', src: 'https://x.test/a.png' }, { type: 'image', src: 'blob:abc' }] }] }
    expect(collectProjectRefs(p).size).toBe(0)
    expect(findRemoteImageUrls(p)).toHaveLength(2)
    const r = resolveJobAssets({ project: p })
    expect(r.missing).toEqual([])
    expect(r.warnings.filter((w) => /remote/.test(w))).toHaveLength(2)
  })

  it('zip sniffing matches projectZip.isZipBytes (PK 03 04 only)', async () => {
    const zip = new JSZip()
    zip.file('project.json', '{}')
    const buf = await zip.generateAsync({ type: 'nodebuffer' })
    expect(isZipBuffer(buf)).toBe(true)
    expect(isZipBuffer(Buffer.from([0x50, 0x4b, 0x05, 0x06, 0, 0]))).toBe(false)
    expect(isZipBuffer(Buffer.from([0x50, 0x4b, 0x03]))).toBe(false)
    expect(isZipBytes(new Uint8Array(buf))).toBe(true)
    expect(isZipBytes(new Uint8Array([0x50, 0x4b, 0x05, 0x06]))).toBe(false)
    await expect(parseProjectInput(Buffer.from([0x50, 0x4b, 0x05, 0x06, 0, 0]))).rejects.toThrow(/not valid JSON/)
  })

  it('warns when one folder file matches multiple different images', () => {
    const keyC = assetKeyFromBytes(Buffer.from([1, 2, 3]), 'image/png')
    const p = project({
      assetManifest: { [keyA]: { name: 'screenshot.png' }, [keyC]: { name: 'screenshot.png' } },
      slideGroups: [{ layers: [{ type: 'phone', screenshotPath: keyA }, { type: 'phone', screenshotPath: keyC }] }],
    })
    const r = resolveJobAssets({ project: p, folderFiles: [{ name: 'screenshot.png', bytes: bytesB }] })
    expect(r.warnings.some((w) => w.includes('screenshot.png') && w.includes(keyA) && w.includes(keyC))).toBe(true)
  })
})
