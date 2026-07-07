import { describe, it, expect } from 'vitest'
import type { BackgroundLayer, GroupLayer, Layer, PhoneLayer, Project, SlideGroup, TextLayer } from '@/types'
import { assertProjectShape, migrateProject, stripDataUrls } from './helpers'

const baseLayer = {
  x: 0,
  y: 0,
  rotation: 0,
  opacity: 1,
  visible: true,
  locked: false,
}

function makeTextLayer(overrides: Partial<TextLayer> = {}): TextLayer {
  return {
    ...baseLayer,
    id: 'text-1',
    name: 'Text',
    type: 'text',
    text: 'Hello',
    fontFamily: 'Inter',
    fontSize: 48,
    fontWeight: 700,
    fill: '#ffffff',
    letterSpacing: 0,
    lineHeight: 1.1,
    align: 'center',
    ...overrides,
  }
}

function makeBackgroundLayer(overrides: Partial<BackgroundLayer> = {}): BackgroundLayer {
  return {
    ...baseLayer,
    id: 'background-1',
    name: 'Background',
    type: 'background',
    locked: true,
    fill: '#000000',
    accents: [],
    ...overrides,
  }
}

function makePhoneLayer(overrides: Partial<PhoneLayer> = {}): PhoneLayer {
  return {
    ...baseLayer,
    id: 'phone-1',
    name: 'Phone',
    type: 'phone',
    model: 'iphone-16-pro',
    scale: 1,
    screenshotFit: 'cover',
    screenshotOffsetX: 0,
    screenshotOffsetY: 0,
    ...overrides,
  }
}

function makeGroupLayer(overrides: Partial<GroupLayer> = {}): GroupLayer {
  return {
    ...baseLayer,
    id: 'group-1',
    name: 'Group',
    type: 'group',
    children: [],
    ...overrides,
  }
}

function makeSlideGroup(overrides: Partial<SlideGroup> = {}): SlideGroup {
  return {
    id: 'slide-group-1',
    name: 'Slide Group',
    numSlides: 1,
    slideWidth: 1290,
    slideHeight: 2796,
    slideNames: ['slide-01'],
    layers: [],
    ...overrides,
  }
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    name: 'Project',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    settings: {
      defaultSlideWidth: 1290,
      defaultSlideHeight: 2796,
      defaultLocale: 'en',
      brandName: 'My App',
    },
    slideGroups: [makeSlideGroup()],
    ...overrides,
  }
}

describe('assertProjectShape', () => {
  it('accepts a minimal valid project shape', () => {
    expect(() => assertProjectShape({ slideGroups: [{ layers: [] }], settings: {} })).not.toThrow()
  })

  it('throws when the value is null', () => {
    expect(() => assertProjectShape(null)).toThrow('Invalid project file: expected a JSON object.')
  })

  it('throws when the value is a string', () => {
    expect(() => assertProjectShape('a string')).toThrow('Invalid project file: expected a JSON object.')
  })

  it('throws when slideGroups is missing', () => {
    expect(() => assertProjectShape({})).toThrow('Invalid project file: missing "slideGroups" array.')
  })

  it('throws when settings is missing', () => {
    expect(() => assertProjectShape({ slideGroups: [] })).toThrow('Invalid project file: missing "settings" object.')
  })

  it('throws when a slide group is missing its layers array', () => {
    expect(() => assertProjectShape({ slideGroups: [{}], settings: {} })).toThrow('Invalid project file: every slide group needs a "layers" array.')
  })
})

describe('migrateProject', () => {
  it('inserts a default background layer when a slide group has none', () => {
    const project = makeProject({ slideGroups: [makeSlideGroup({ layers: [makeTextLayer()] })] })

    const migrated = migrateProject(project)

    expect(migrated.slideGroups[0].layers[0].type).toBe('background')
  })

  it('migrates a legacy background field into a background layer and deletes the legacy field', () => {
    const project = makeProject({
      slideGroups: [makeSlideGroup({
        background: {
          fill: '#123456',
          accents: [{ color: '#abcdef', cx: 50, cy: 60, rx: 100, ry: 120 }],
        },
        layers: [makeTextLayer()],
      })],
    })

    const migrated = migrateProject(project)
    const background = migrated.slideGroups[0].layers[0]

    expect(background.type).toBe('background')
    expect((background as BackgroundLayer).fill).toBe('#123456')
    expect((background as BackgroundLayer).accents).toEqual([{ color: '#abcdef', cx: 50, cy: 60, rx: 100, ry: 120 }])
    expect(migrated.slideGroups[0].background).toBeUndefined()
  })

  it('does not insert a second background layer when one already exists', () => {
    const project = makeProject({
      slideGroups: [makeSlideGroup({ layers: [makeBackgroundLayer(), makeTextLayer()] })],
    })

    const migrated = migrateProject(project)

    expect(migrated.slideGroups[0].layers.filter((layer) => layer.type === 'background')).toHaveLength(1)
  })

  it('adds default pano settings when missing', () => {
    const project = makeProject()

    const migrated = migrateProject(project)

    expect(migrated.settings.pano).toEqual({ gapPx: 24, compensate: false })
  })

  it('preserves existing pano settings', () => {
    const project = makeProject({
      settings: {
        defaultSlideWidth: 1290,
        defaultSlideHeight: 2796,
        defaultLocale: 'en',
        brandName: 'My App',
        pano: { gapPx: 48, compensate: true },
      },
    })

    const migrated = migrateProject(project)

    expect(migrated.settings.pano).toEqual({ gapPx: 48, compensate: true })
  })
})

describe('stripDataUrls', () => {
  it('strips background imageDataUrl while preserving other fields', () => {
    const project = makeProject({
      slideGroups: [makeSlideGroup({ layers: [makeBackgroundLayer({ fill: '#101010', imageDataUrl: 'data:image/png;base64,bg' })] })],
    })

    const stripped = stripDataUrls(project)
    const layer = stripped.slideGroups[0].layers[0] as BackgroundLayer

    expect(layer.imageDataUrl).toBeUndefined()
    expect(layer.fill).toBe('#101010')
  })

  it('strips phone screenshotDataUrl while preserving screenshotPath', () => {
    const project = makeProject({
      slideGroups: [makeSlideGroup({ layers: [makePhoneLayer({ screenshotDataUrl: 'data:image/png;base64,phone', screenshotPath: 'kept.png' })] })],
    })

    const stripped = stripDataUrls(project)
    const layer = stripped.slideGroups[0].layers[0] as PhoneLayer

    expect(layer.screenshotDataUrl).toBeUndefined()
    expect(layer.screenshotPath).toBe('kept.png')
  })

  it('strips screenshotDataUrl from locale overrides while preserving screenshotPath', () => {
    const project = makeProject({
      slideGroups: [makeSlideGroup({ layers: [makePhoneLayer({
        localeOverrides: { es: { screenshotDataUrl: 'data:image/png;base64,es', screenshotPath: 'kept.png' } },
      })] })],
    })

    const stripped = stripDataUrls(project)
    const layer = stripped.slideGroups[0].layers[0]

    expect(layer.localeOverrides?.es.screenshotDataUrl).toBeUndefined()
    expect(layer.localeOverrides?.es.screenshotPath).toBe('kept.png')
  })

  it('does not mutate the original project object', () => {
    const background = makeBackgroundLayer({ imageDataUrl: 'data:image/png;base64,bg' })
    const phone = makePhoneLayer({ screenshotDataUrl: 'data:image/png;base64,phone' })
    const project = makeProject({ slideGroups: [makeSlideGroup({ layers: [background, phone] })] })

    stripDataUrls(project)

    expect((project.slideGroups[0].layers[0] as BackgroundLayer).imageDataUrl).toBe('data:image/png;base64,bg')
    expect((project.slideGroups[0].layers[1] as PhoneLayer).screenshotDataUrl).toBe('data:image/png;base64,phone')
  })

  it('recursively strips screenshotDataUrl from group children', () => {
    const group = makeGroupLayer({
      children: [makePhoneLayer({ screenshotDataUrl: 'data:image/png;base64,child' })],
    })
    const project = makeProject({ slideGroups: [makeSlideGroup({ layers: [group] })] })

    const stripped = stripDataUrls(project)
    const strippedGroup = stripped.slideGroups[0].layers[0] as Extract<Layer, { type: 'group' }>

    expect((strippedGroup.children[0] as PhoneLayer).screenshotDataUrl).toBeUndefined()
  })
})
