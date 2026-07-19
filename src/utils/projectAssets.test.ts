import { describe, expect, it } from 'vitest'
import type { FormatLayerPatch, GroupLayer, ImageLayer, PhoneLayer, Project } from '@/types'
import { newProject } from '@/store/helpers'
import {
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
    localeOverrides: { es: { screenshotPath: 'locale-phone.png' } },
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
    localeOverrides: { fr: { src: 'locale-image.png' } },
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
    image.localeOverrides = { es: { src: '' } }
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
    phone.localeOverrides = undefined
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

    expect(bundle.assets).toEqual({ 'base-phone.png': 'data:image/png;base64,resolved' })
    expect(missing).toEqual(['missing.png'])
  })

  it('recognizes bundles but rejects bare projects and templates', () => {
    const project = newProject()
    const { bundle } = buildProjectExportBundle(project, () => undefined)

    expect(isProjectExportBundle(bundle)).toBe(true)
    expect(isProjectExportBundle(project)).toBe(false)
    expect(isProjectExportBundle({ kind: 'template' })).toBe(false)
  })

  it('preserves asset keys and data URLs through a JSON round trip', () => {
    const project = projectWithAssets()
    const { bundle } = buildProjectExportBundle(project, (key) => dataFor(key))
    const parsed: unknown = JSON.parse(JSON.stringify(bundle))

    expect(isProjectExportBundle(parsed)).toBe(true)
    if (!isProjectExportBundle(parsed)) return
    expect(parsed.assets['nested-phone.png']).toBe(dataFor('nested-phone.png'))
    expect([...collectAssetKeys(parsed.project)]).toEqual([...collectAssetKeys(project)])
  })
})

function dataFor(key: string): string {
  return `data:image/png;base64,${key}`
}
