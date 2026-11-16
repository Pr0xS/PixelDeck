/**
 * Integrity of the generated gallery templates in public/templates/.
 * These files are build outputs of scripts/templates/; this suite fails when
 * an output is stale, hand-edited, or out of step with the app's data model.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Layer, Template } from '@/types'
import { migrateProjectWithAssets } from '@/store/helpers'
import type { TemplateManifestEntry } from '@/store/templates'
import { assetKeyFromBytes, isHashedAssetKey, mimeForKey } from '@/utils/assetKey'
import { parseBrandToken } from '@/utils/brandColors'
import { FONT_LIST, WEB_SAFE_FONTS } from '@/utils/fonts'
import { forEachLayerTree } from '@/utils/layerTree'
import { collectAssetKeys } from '@/utils/projectAssets'
import { templateToProject } from '@/utils/templates'

const DIR = join(process.cwd(), 'public/templates')
const index = JSON.parse(readFileSync(join(DIR, 'index.json'), 'utf8')) as { templates: TemplateManifestEntry[] }
const publicPath = (path: string) => join(process.cwd(), 'public', path.replace(/^\//, ''))
const load = (entry: TemplateManifestEntry) => JSON.parse(readFileSync(publicPath(entry.file), 'utf8')) as Template

const REF_FIELDS = ['screenshotPath', 'src', 'imageRef', 'logoRef'] as const

function layerRefs(layer: Layer): string[] {
  const refs: string[] = []
  const read = (record: object | undefined) => {
    if (!record) return
    for (const field of REF_FIELDS) {
      const value = (record as Record<string, unknown>)[field]
      if (typeof value === 'string' && value) refs.push(value)
    }
  }
  read(layer)
  Object.values(layer.localeContent ?? {}).forEach(read)
  Object.values(layer.formatOverrides ?? {}).forEach((patch) => read(patch))
  return refs
}

function brandTokens(value: unknown, out: Set<string>): void {
  if (typeof value === 'string') {
    const id = parseBrandToken(value)
    if (id) out.add(id)
  } else if (Array.isArray(value)) {
    value.forEach((item) => brandTokens(item, out))
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => brandTokens(item, out))
  }
}

describe('gallery index', () => {
  it('lists the Welcome tour first, then five templates', () => {
    expect(index.templates[0]).toMatchObject({ slug: 'welcome', tour: true })
    expect(index.templates.filter((entry) => entry.tour)).toHaveLength(1)
    expect(index.templates.filter((entry) => !entry.tour)).toHaveLength(5)
    expect(new Set(index.templates.map((entry) => entry.slug)).size).toBe(index.templates.length)
  })

  it('points at files that exist and reports the real slide count', () => {
    for (const entry of index.templates) {
      expect(existsSync(publicPath(entry.file)), entry.file).toBe(true)
      if (entry.thumbnail) expect(existsSync(publicPath(entry.thumbnail)), entry.thumbnail).toBe(true)
      const slides = load(entry).slideGroups.reduce((sum, group) => sum + group.numSlides, 0)
      expect(entry.slides, entry.slug).toBe(slides)
    }
  })

  it('gives every gallery template a thumbnail', () => {
    for (const entry of index.templates) expect(entry.thumbnail, entry.slug).toBeTruthy()
  })
})

describe.each(index.templates.map((entry) => [entry.slug, entry] as const))('template %s', (_slug, entry) => {
  const template = load(entry)
  const defaultLocale = template.settings?.defaultLocale ?? 'en'
  const locales = template.settings?.locales ?? [defaultLocale]

  it('has the template envelope and well-formed slide groups', () => {
    expect(template.kind).toBe('template')
    expect(template.schemaVersion).toBe(1)
    const names = template.slideGroups.flatMap((group) => group.slideNames)
    expect(new Set(names).size).toBe(names.length)
    for (const group of template.slideGroups) {
      expect(group.layers[0]?.type, group.name).toBe('background')
      expect(group.slideNames, group.name).toHaveLength(group.numSlides)
      const ids: string[] = []
      forEachLayerTree(group.layers, (layer) => ids.push(layer.id))
      expect(new Set(ids).size, `${group.name}: duplicate layer ids`).toBe(ids.length)
    }
  })

  it('references only images it ships, and each file matches its content-hash key', () => {
    const manifest = template.assetManifest ?? {}
    const used = new Set<string>()
    for (const group of template.slideGroups) {
      forEachLayerTree(group.layers, (layer) => layerRefs(layer).forEach((ref) => used.add(ref)))
    }
    expect([...used].sort()).toEqual(Object.keys(manifest).sort())
    for (const key of used) {
      expect(isHashedAssetKey(key), key).toBe(true)
      const file = join(DIR, 'assets', key)
      expect(existsSync(file), `missing public/templates/assets/${key}`).toBe(true)
      expect(assetKeyFromBytes(new Uint8Array(readFileSync(file)), mimeForKey(key)), key).toBe(key)
    }
  })

  it('uses only fonts and weights the editor can load', () => {
    const known = new Map([...FONT_LIST, ...WEB_SAFE_FONTS].map((font) => [font.family, font.weights]))
    for (const group of template.slideGroups) {
      forEachLayerTree(group.layers, (layer) => {
        const uses: Array<[string, number]> = []
        if (layer.type === 'text') {
          uses.push([layer.fontFamily, layer.fontWeight])
          const variants = [layer.marks, ...Object.values(layer.localeContent ?? {}).map((content) => content.marks)]
          for (const marks of variants) {
            for (const mark of marks ?? []) if (mark.fontWeight) uses.push([layer.fontFamily, mark.fontWeight])
          }
        }
        if (layer.type === 'brand') uses.push([layer.nameFontFamily, layer.nameFontWeight])
        for (const [family, weight] of uses) {
          expect(known.get(family), `${group.name}/${layer.name}: unknown font ${family}`).toBeDefined()
          expect(known.get(family), `${group.name}/${layer.name}: ${family} ${weight}`).toContain(weight)
        }
      })
    }
  })

  it('resolves every brand colour token from its own palette', () => {
    const tokens = new Set<string>()
    brandTokens(template.slideGroups, tokens)
    const palette = new Set((template.settings?.brandColors ?? []).map((color) => color.id))
    for (const id of tokens) expect(palette.has(id), `{brand:${id}}`).toBe(true)
  })

  it('mirrors default-locale content and translates every text for each extra locale', () => {
    for (const group of template.slideGroups) {
      forEachLayerTree(group.layers, (layer) => {
        if (layer.type !== 'text' && layer.type !== 'phone' && layer.type !== 'image') return
        const where = `${group.name}/${layer.name}`
        const mirror = layer.localeContent?.[defaultLocale]
        expect(mirror, `${where}: no localeContent.${defaultLocale}`).toBeDefined()
        if (layer.type === 'text') {
          expect(mirror?.text, where).toBe(layer.text)
          for (const locale of locales) {
            expect(layer.localeContent?.[locale]?.text?.trim(), `${where}: no ${locale} text`).toBeTruthy()
            for (const mark of layer.localeContent?.[locale]?.marks ?? []) {
              expect(mark.end, `${where}: ${locale} mark out of range`).toBeLessThanOrEqual(layer.localeContent![locale].text!.length)
              expect(mark.start, where).toBeLessThan(mark.end)
            }
          }
        }
        if (layer.type === 'phone') expect(mirror?.screenshotPath, where).toBe(layer.screenshotPath)
        if (layer.type === 'image') expect(mirror?.src, where).toBe(layer.src)
      })
    }
  })

  it('becomes a project that the normal import migration leaves unchanged', () => {
    const assets = Object.entries(template.assetManifest ?? {}).map(([key, meta]) => ({ key, ...meta }))
    const project = templateToProject(template, assets)
    expect(project.name).toBe(template.name)
    expect([...collectAssetKeys(project)].sort()).toEqual(Object.keys(template.assetManifest ?? {}).sort())

    const before = JSON.parse(JSON.stringify(project.slideGroups))
    const migrated = migrateProjectWithAssets(JSON.parse(JSON.stringify(project)))
    expect(migrated.assets).toEqual([])
    // slideKey is assigned by the migration; everything else must survive untouched.
    const strip = (groups: Array<Record<string, unknown>>) => groups.map((group) => {
      const rest = { ...group }
      delete rest.slideKey
      return rest
    })
    expect(strip(JSON.parse(JSON.stringify(migrated.project.slideGroups)))).toEqual(strip(before))
  })
})
