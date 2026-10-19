import { describe, expect, it, vi } from 'vitest'
import type { Layer, Project } from '@/types'
import { assetKeyFromDataUrl } from './assetKey'
import { extractInlineAssets } from './assetMigration'
import { migrateProjectWithAssets } from '@/store/helpers'

const PNG = 'data:image/png;base64,cG5n'
const JPG = 'data:image/jpeg;base64,anBlZw=='
const WEBP = 'data:image/webp;base64,d2VicA=='
const GIF = 'data:image/gif;base64,Z2lm'
const LOGO = 'data:image/png;base64,bG9nbw=='

const base = (id: string, type: string) => ({
  id, name: id, type, x: 0, y: 0, rotation: 0, opacity: 1, visible: true, locked: false,
})

function raw(layers: unknown[], settings: Record<string, unknown> = {}): Project {
  return {
    id: 'p', name: 'P', createdAt: 'x', updatedAt: 'x',
    settings: { defaultSlideWidth: 1, defaultSlideHeight: 1, defaultLocale: 'en', brandName: 'B', ...settings },
    slideGroups: [{
      id: 'g', name: 'G', numSlides: 1, slideWidth: 1, slideHeight: 1, slideNames: ['a'],
      layers,
    }],
  } as unknown as Project
}

const layersOf = (p: Project) => p.slideGroups[0].layers as unknown as Array<Record<string, any>> // eslint-disable-line @typescript-eslint/no-explicit-any

describe('extractInlineAssets', () => {
  it('phone with both key and inline: inline wins, old filename becomes display name', () => {
    const project = raw([{ ...base('p1', 'phone'), screenshotPath: 'shot.png', screenshotDataUrl: PNG }])
    const { project: out, assets } = extractInlineAssets(project)
    const key = assetKeyFromDataUrl(PNG)
    const phone = layersOf(out)[0]
    expect(phone.screenshotPath).toBe(key)
    expect('screenshotDataUrl' in phone).toBe(false)
    expect(assets).toEqual([{ key, name: 'shot.png', dataUrl: PNG, mime: 'image/png' }])
    expect(out.assetManifest?.[key]).toEqual({ name: 'shot.png', mime: 'image/png' })
  })

  it('handles localeContent, formatOverrides and inline data inside screenshotPath/src', () => {
    const project = raw([
      {
        ...base('p1', 'phone'),
        screenshotPath: JPG,
        localeContent: { en: { screenshotPath: 'a.png', screenshotDataUrl: PNG }, es: { screenshotDataUrl: WEBP } },
        formatOverrides: { 'iphone-69': { screenshotDataUrl: GIF } },
      },
      { ...base('i1', 'image'), src: PNG, width: 1, height: 1 },
    ])
    const { project: out, assets } = extractInlineAssets(project)
    const [phone, image] = layersOf(out)
    expect(phone.screenshotPath).toBe(assetKeyFromDataUrl(JPG))
    expect(phone.localeContent.en.screenshotPath).toBe(assetKeyFromDataUrl(PNG))
    expect(phone.localeContent.es.screenshotPath).toBe(assetKeyFromDataUrl(WEBP))
    expect(phone.formatOverrides['iphone-69'].screenshotPath).toBe(assetKeyFromDataUrl(GIF))
    expect(image.src).toBe(assetKeyFromDataUrl(PNG))
    expect(assets).toHaveLength(4)
    expect(JSON.stringify(out)).not.toContain('data:')
  })

  it('background imageDataUrl -> imageRef; brand logoDataUrl -> logoRef; settings logo', () => {
    const project = raw(
      [
        { ...base('b', 'background'), fill: '#000', accents: [], imageDataUrl: PNG },
        { ...base('br', 'brand'), appName: 'x', logoDataUrl: LOGO },
      ],
      { brandLogoDataUrl: LOGO },
    )
    const { project: out, assets } = extractInlineAssets(project)
    const [bg, brand] = layersOf(out)
    expect(bg.imageRef).toBe(assetKeyFromDataUrl(PNG))
    expect('imageDataUrl' in bg).toBe(false)
    expect(brand.logoRef).toBe(assetKeyFromDataUrl(LOGO))
    expect(out.settings.brandLogoRef).toBe(assetKeyFromDataUrl(LOGO))
    expect('brandLogoDataUrl' in out.settings).toBe(false)
    expect(assets.map((a) => a.key).sort()).toEqual([assetKeyFromDataUrl(PNG), assetKeyFromDataUrl(LOGO)].sort())
  })

  it('walks group children', () => {
    const project = raw([{
      ...base('g1', 'group'),
      children: [{ ...base('br', 'brand'), appName: 'x', logoDataUrl: LOGO }],
    }])
    const { project: out } = extractInlineAssets(project)
    const group = layersOf(out)[0]
    expect(group.children[0].logoRef).toBe(assetKeyFromDataUrl(LOGO))
  })

  it('is idempotent and never mutates its input', () => {
    const project = raw([
      { ...base('b', 'background'), fill: '#000', accents: [], imageDataUrl: PNG },
      { ...base('p1', 'phone'), screenshotPath: 's.png', screenshotDataUrl: JPG, localeContent: { en: { screenshotDataUrl: JPG } } },
    ])
    const snapshot = JSON.stringify(project)
    const first = extractInlineAssets(project)
    expect(JSON.stringify(project)).toBe(snapshot)
    const second = extractInlineAssets(first.project)
    expect(second.assets).toEqual([])
    expect(second.project).toEqual(first.project)
  })

  it('leaves plain refs and legacy filenames alone', () => {
    const project = raw([{ ...base('p1', 'phone'), screenshotPath: 'shot.png' }])
    const { project: out, assets } = extractInlineAssets(project)
    expect(assets).toEqual([])
    expect(out.assetManifest).toBeUndefined()
    expect(layersOf(out)[0].screenshotPath).toBe('shot.png')
  })
})

describe('migrateProjectWithAssets', () => {
  it('returns extracted assets and leaves no inline data', () => {
    const project = raw([{ ...base('p1', 'phone'), screenshotDataUrl: PNG, screenshotFit: 'cover' }])
    const { project: out, assets } = migrateProjectWithAssets(project)
    const layer = out.slideGroups[0].layers.find((l: Layer) => l.type === 'phone') as unknown as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(layer.screenshotPath).toBe(assetKeyFromDataUrl(PNG))
    expect(layer.localeContent.en.screenshotPath).toBe(assetKeyFromDataUrl(PNG))
    expect(assets).toHaveLength(1)
    expect(JSON.stringify(out)).not.toContain('data:')
  })
})

describe('resolver: stored asset wins over stale inline data', () => {
  it('keeps a resolvable ref and drops inline', () => {
    const project = raw([{ ...base('p1', 'phone'), screenshotPath: 'img_x.png', screenshotDataUrl: PNG }])
    const { project: out, assets } = extractInlineAssets(project, { resolve: (r) => (r === 'img_x.png' ? JPG : undefined) })
    const phone = layersOf(out)[0]
    expect(phone.screenshotPath).toBe('img_x.png')
    expect('screenshotDataUrl' in phone).toBe(false)
    expect(assets).toEqual([])
  })

  it('extracts inline when the ref does not resolve', () => {
    const project = raw([{ ...base('p1', 'phone'), screenshotPath: 'gone.png', screenshotDataUrl: PNG }])
    const { project: out } = extractInlineAssets(project, { resolve: () => undefined })
    expect(layersOf(out)[0].screenshotPath).toBe(assetKeyFromDataUrl(PNG))
  })

  it('applies to brand logo settings and localeContent', () => {
    const project = raw(
      [{ ...base('p1', 'phone'), localeContent: { es: { screenshotPath: 'es.png', screenshotDataUrl: PNG } } }],
      { brandLogoRef: 'logo.png', brandLogoDataUrl: LOGO },
    )
    const { project: out, assets } = extractInlineAssets(project, { resolve: () => JPG })
    expect(out.settings.brandLogoRef).toBe('logo.png')
    expect('brandLogoDataUrl' in out.settings).toBe(false)
    expect(layersOf(out)[0].localeContent.es.screenshotPath).toBe('es.png')
    expect(assets).toEqual([])
  })
})

describe('malformed data: values never throw', () => {
  const BAD = 'data:image/png;base64'
  it('leaves raw values untouched and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const project = raw([
      { ...base('p1', 'phone'), screenshotPath: BAD },
      { ...base('i1', 'image'), src: BAD, localeContent: { es: { src: BAD } } },
      { ...base('b1', 'background'), imageRef: BAD },
      { ...base('br', 'brand'), logoDataUrl: BAD },
    ], { brandLogoDataUrl: BAD })
    const { project: out, assets } = extractInlineAssets(project)
    const l = layersOf(out)
    expect(assets).toEqual([])
    expect(l[0].screenshotPath).toBe(BAD)
    expect(l[1].src).toBe(BAD)
    expect(l[1].localeContent.es.src).toBe(BAD)
    expect(l[2].imageRef).toBe(BAD)
    expect(l[3].logoDataUrl).toBe(BAD)
    expect((out.settings as any).brandLogoDataUrl).toBe(BAD) // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('migrateProjectWithAssets does not throw', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const project = raw([{ ...base('p1', 'phone'), screenshotDataUrl: BAD }])
    expect(() => migrateProjectWithAssets(project)).not.toThrow()
    warn.mockRestore()
  })
})
