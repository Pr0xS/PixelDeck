import { describe, expect, it } from 'vitest'
import type { FormatLayerPatch, GroupLayer, ImageLayer, PhoneLayer, Project } from '@/types'
import { newProject } from '@/store/helpers'
import { assetKeyFromDataUrl } from './assetKey'
import {
  bundleAssetRecords,
  rekeyLegacyAssets,
  buildProjectExportBundle,
  collectAssetKeys,
  isProjectExportBundle,
} from './projectAssets'

const baseLayer = {
  x: 0,
  y: 0,
  rotation: 0,
  opacity: 1,
  visible: true,
  locked: false,
}

function projectWithAssets(): Project {
  const project = newProject()
  const phone: PhoneLayer = {
    ...baseLayer,
    id: 'phone',
    name: 'Phone',
    type: 'phone',
    model: 'iphone-16-pro',
    scale: 1,
    screenshotPath: 'base-phone.png',
    screenshotFit: 'cover',
    screenshotOffsetX: 0,
    screenshotOffsetY: 0,
    localeContent: { es: { screenshotPath: 'locale-phone.png' } },
    formatOverrides: {
      'iphone-69': { screenshotPath: 'format-phone.png' } as FormatLayerPatch,
    },
  }
  const image: ImageLayer = {
    ...baseLayer,
    id: 'image',
    name: 'Image',
    type: 'image',
    src: 'base-image.png',
    width: 100,
    height: 100,
    cornerRadius: 0,
    localeContent: { fr: { src: 'locale-image.png' } },
    formatOverrides: { 'android-phone': { src: 'format-image.png' } as FormatLayerPatch },
  }
  const child: PhoneLayer = { ...phone, id: 'child', screenshotPath: 'nested-phone.png' }
  const group: GroupLayer = {
    ...baseLayer,
    id: 'group',
    name: 'Group',
    type: 'group',
    children: [child],
  }
  project.slideGroups[0].layers.push(phone, image, group)
  return project
}

describe('project asset bundles', () => {
  it('collects base, nested, locale, and format asset references', () => {
    expect([...collectAssetKeys(projectWithAssets())]).toEqual([
      'base-phone.png',
      'locale-phone.png',
      'format-phone.png',
      'base-image.png',
      'locale-image.png',
      'format-image.png',
      'nested-phone.png',
    ])
  })

  it('excludes data URLs and empty asset references', () => {
    const project = projectWithAssets()
    const image = project.slideGroups[0].layers.find((layer) => layer.type === 'image') as ImageLayer
    image.src = 'data:image/png;base64,inline'
    image.localeContent = { es: { src: '' } }
    image.formatOverrides = undefined

    const keys = collectAssetKeys(project)

    expect(keys.has('data:image/png;base64,inline')).toBe(false)
    expect(keys.has('')).toBe(false)
  })

  it('embeds resolvable assets and reports unresolved references', () => {
    const project = newProject()
    const phone = projectWithAssets().slideGroups[0].layers.find(
      (layer) => layer.type === 'phone',
    ) as PhoneLayer
    phone.localeContent = undefined
    phone.formatOverrides = undefined
    const image: ImageLayer = {
      ...baseLayer,
      id: 'missing-image',
      name: 'Missing image',
      type: 'image',
      src: 'missing.png',
      width: 100,
      height: 100,
      cornerRadius: 0,
    }
    project.slideGroups[0].layers.push(phone, image)

    const { bundle, missing } = buildProjectExportBundle(
      project,
      (key) => key === 'base-phone.png' ? 'data:image/png;base64,resolved' : undefined,
    )

    const key = assetKeyFromDataUrl('data:image/png;base64,resolved')
    expect(bundle.schemaVersion).toBe(2)
    expect(bundle.assets).toEqual({
      [key]: { name: 'base-phone.png', mime: 'image/png', dataUrl: 'data:image/png;base64,resolved' },
    })
    expect(missing).toEqual(['missing.png'])
    // A phone referencing the filename now references the hash key.
    expect(collectAssetKeys(bundle.project).has(key)).toBe(true)
    expect(bundle.project.assetManifest?.[key]).toEqual({ name: 'base-phone.png', mime: 'image/png' })
    expect(bundle.project.assetManifest?.['missing.png']).toEqual({ name: 'missing.png', mime: 'image/png' })
  })

  it('recognizes bundles but rejects bare projects and templates', () => {
    const project = newProject()
    const { bundle } = buildProjectExportBundle(project, () => undefined)

    expect(isProjectExportBundle(bundle)).toBe(true)
    expect(isProjectExportBundle(project)).toBe(false)
    expect(isProjectExportBundle({ kind: 'template' })).toBe(false)
  })

  it('v2 bundle has no data URLs in the project and stores each image once', () => {
    const project = projectWithAssets()
    // Same bytes under two different filenames => one asset.
    const phones = project.slideGroups[0].layers.filter((l) => l.type === 'phone') as PhoneLayer[]
    phones[0].localeContent = { es: { screenshotPath: 'copy-of-base.png' } }
    const { bundle, missing } = buildProjectExportBundle(project, (key) =>
      key === 'copy-of-base.png' ? dataFor('base-phone.png') : dataFor(key))
    const parsed: unknown = JSON.parse(JSON.stringify(bundle))

    expect(missing).toEqual([])
    expect(isProjectExportBundle(parsed)).toBe(true)
    if (!isProjectExportBundle(parsed) || parsed.schemaVersion !== 2) return
    expect(JSON.stringify(parsed.project)).not.toContain('data:')
    const dataUrls = Object.values(parsed.assets).map((a) => a.dataUrl)
    expect(new Set(dataUrls).size).toBe(dataUrls.length)
    expect(parsed.assets[assetKeyFromDataUrl(dataFor('nested-phone.png'))].name).toBe('nested-phone.png')
    for (const key of collectAssetKeys(parsed.project)) expect(parsed.assets[key]).toBeDefined()
  })

  it('accepts v1 bundles and flattens their assets', () => {
    const v1 = { kind: 'project-export', schemaVersion: 1, project: newProject(), assets: { 'a.png': dataFor('a') } }
    expect(isProjectExportBundle(v1)).toBe(true)
    if (!isProjectExportBundle(v1)) return
    expect(bundleAssetRecords(v1)).toEqual([
      { key: 'a.png', name: 'a.png', mime: 'image/png', dataUrl: dataFor('a') },
    ])
  })

  it('collects background, brand and settings refs', () => {
    const project = newProject()
    project.slideGroups[0].layers.push({
      ...baseLayer, id: 'br', name: 'Brand', type: 'brand', appName: 'x', logoRef: 'logo.png', logoSize: 1,
      nameColor: '#fff', nameFontSize: 1, nameFontFamily: 'Inter', nameFontWeight: 400, direction: 'row', gap: 1,
    })
    const bg = project.slideGroups[0].layers.find((l) => l.type === 'background')
    if (bg?.type === 'background') bg.imageRef = 'bg.png'
    project.settings.brandLogoRef = 'settings-logo.png'
    expect([...collectAssetKeys(project)].sort()).toEqual(['bg.png', 'logo.png', 'settings-logo.png'])
  })
})

describe('rekeyLegacyAssets', () => {
  const projectWith = (...paths: string[]) => {
    const project = newProject()
    paths.forEach((src, i) => project.slideGroups[0].layers.push({
      ...baseLayer, id: `i${i}`, name: 'i', type: 'image', src, width: 1, height: 1, cornerRadius: 0,
    } as ImageLayer))
    return project
  }

  it('is idempotent and uses the old filename as the display name', () => {
    const resolve = (k: string) => dataFor(k)
    const first = rekeyLegacyAssets(projectWith('a.png'), resolve)
    const key = assetKeyFromDataUrl(dataFor('a.png'))
    expect(first.assets).toEqual([{ key, name: 'a.png', mime: 'image/png', dataUrl: dataFor('a.png') }])
    expect(first.project.assetManifest?.[key]?.name).toBe('a.png')
    const second = rekeyLegacyAssets(first.project, resolve)
    expect(second.assets).toEqual([])
    expect(second.project).toEqual(first.project)
  })

  it('keeps refs with missing bytes and names the manifest entry after the ref (idempotent)', () => {
    const first = rekeyLegacyAssets(projectWith('gone.png'), () => undefined)
    expect(first.missing).toEqual(['gone.png'])
    expect(collectAssetKeys(first.project)).toEqual(new Set(['gone.png']))
    expect(first.project.assetManifest?.['gone.png']?.name).toBe('gone.png')
    const second = rekeyLegacyAssets(first.project, () => undefined)
    expect(second.project).toEqual(first.project)
  })

  it('gives duplicate filenames with different bytes distinct keys', () => {
    const a = rekeyLegacyAssets(projectWith('shot.png'), () => dataFor('one'))
    const b = rekeyLegacyAssets(projectWith('shot.png'), () => dataFor('two'))
    expect([...collectAssetKeys(a.project)][0]).not.toBe([...collectAssetKeys(b.project)][0])
  })
})

function dataFor(key: string): string {
  return `data:image/png;base64,${key}`
}
