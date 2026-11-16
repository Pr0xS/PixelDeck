import { describe, it, expect } from 'vitest'
import { stripUnresolvedTemplateImages, templateToProject } from './templates'
import type { GroupLayer, Layer, SlideGroup, Template } from '@/types'

const KEY_A = 'img_aaaaaaaaaaaaaaaaaaaaaaaa.webp'
const KEY_B = 'img_bbbbbbbbbbbbbbbbbbbbbbbb.webp'
const KEY_C = 'img_cccccccccccccccccccccccc.webp'
const DATA = 'data:image/png;base64,AAAA'

const base = { x: 0, y: 0, rotation: 0, opacity: 1, visible: true, locked: false }

function phone(id: string, screenshotPath: string, extra: Record<string, unknown> = {}): Layer {
  return {
    ...base, id, name: id, type: 'phone', model: 'iphone-16-pro', scale: 1,
    screenshotPath, screenshotFit: 'cover', screenshotOffsetX: 0, screenshotOffsetY: 0,
    ...extra,
  } as unknown as Layer
}

function group(layers: Layer[]): Omit<SlideGroup, 'id'> {
  return { name: 'G', numSlides: 1, slideWidth: 1290, slideHeight: 2796, slideNames: ['a'], layers }
}

const missing = (k: string) => k === KEY_A

describe('stripUnresolvedTemplateImages', () => {
  it('strips unresolved layer fields but keeps resolvable ones', () => {
    const [g] = stripUnresolvedTemplateImages([
      group([phone('p1', KEY_A), phone('p2', KEY_B)]),
    ], (k) => !missing(k))
    expect((g.layers[0] as unknown as Record<string, unknown>).screenshotPath).toBeUndefined()
    expect((g.layers[1] as unknown as Record<string, unknown>).screenshotPath).toBe(KEY_B)
  })

  it('keeps src empty on image layers', () => {
    const img = { ...base, id: 'i', name: 'i', type: 'image', src: KEY_A, width: 10, height: 10 } as unknown as Layer
    const [g] = stripUnresolvedTemplateImages([group([img])], () => false)
    expect((g.layers[0] as unknown as { src: string }).src).toBe('')
  })

  it('strips inside localeContent, formatOverrides and group children', () => {
    const nested = phone('n', KEY_A, {
      localeContent: { de: { screenshotPath: KEY_A }, fr: { screenshotPath: KEY_B } },
      formatOverrides: { 'ipad-13': { screenshotPath: KEY_A } },
    })
    const grp = { ...base, id: 'g', name: 'g', type: 'group', children: [nested] } as unknown as GroupLayer
    const [g] = stripUnresolvedTemplateImages([group([grp])], (k) => !missing(k))
    const child = (g.layers[0] as GroupLayer).children[0] as unknown as Record<string, Record<string, Record<string, unknown>>>
    expect((child as unknown as Record<string, unknown>).screenshotPath).toBeUndefined()
    expect(child.localeContent.de.screenshotPath).toBeUndefined()
    expect(child.localeContent.fr.screenshotPath).toBe(KEY_B)
    expect(child.formatOverrides['ipad-13'].screenshotPath).toBeUndefined()
  })

  it('leaves data: URLs untouched and does not mutate input', () => {
    const input = [group([phone('p', DATA)])]
    const out = stripUnresolvedTemplateImages(input, () => false)
    expect((out[0].layers[0] as unknown as Record<string, unknown>).screenshotPath).toBe(DATA)
    const before = JSON.stringify(input)
    stripUnresolvedTemplateImages(input, () => false)
    expect(JSON.stringify(input)).toBe(before)
  })
})

describe('templateToProject', () => {
  const tpl = (): Template => ({
    id: 't', kind: 'template', schemaVersion: 1, name: 'My Tpl', description: '',
    settings: { brandName: 'Acme', defaultSlideWidth: 1000 },
    assetManifest: {
      [KEY_A]: { name: 'a.webp', mime: 'image/webp' },
      [KEY_B]: { name: 'b.webp', mime: 'image/webp' },
      [KEY_C]: { name: 'c.webp', mime: 'image/webp' },
    },
    slideGroups: [group([phone('p1', KEY_A), phone('p2', KEY_B)])],
  })

  it('limits the manifest to referenced + available keys and strips the rest', () => {
    const project = templateToProject(tpl(), [
      { key: KEY_A, name: 'a.webp', mime: 'image/webp' },
      { key: KEY_C, name: 'c.webp', mime: 'image/webp' }, // available but unreferenced
    ])
    expect(Object.keys(project.assetManifest ?? {})).toEqual([KEY_A])
    const layers = project.slideGroups[0].layers as unknown as Array<Record<string, unknown>>
    expect(layers[0].screenshotPath).toBe(KEY_A)
    expect(layers[1].screenshotPath).toBeUndefined()
  })

  it('keeps refs the template never promised (legacy filenames), strips promised-but-missing', () => {
    const t = tpl()
    t.slideGroups = [group([phone('p1', 'home.png'), phone('p2', KEY_B)])]
    const project = templateToProject(t, [])
    const layers = project.slideGroups[0].layers as unknown as Array<Record<string, unknown>>
    expect(layers[0].screenshotPath).toBe('home.png')
    expect(layers[1].screenshotPath).toBeUndefined()
  })

  it('creates a fresh project with the template name and overlaid settings', () => {
    const project = templateToProject(tpl(), [])
    expect(project.id).toBeTruthy()
    expect(project.name).toBe('My Tpl')
    expect(project.settings.brandName).toBe('Acme')
    expect(project.settings.defaultSlideWidth).toBe(1000)
    expect(project.settings.defaultSlideHeight).toBeGreaterThan(0) // from newProject() defaults
    expect(project.assetManifest).toBeUndefined()
    expect(project.slideGroups[0].id).toBeTruthy()
  })

  it('handles an image-free template', () => {
    const t = tpl()
    delete t.assetManifest
    t.slideGroups = [group([{ ...base, id: 'b', name: 'b', type: 'background', fill: '#000', accents: [] } as unknown as Layer])]
    const project = templateToProject(t, [])
    expect(project.assetManifest).toBeUndefined()
    expect(project.slideGroups).toHaveLength(1)
  })
})
