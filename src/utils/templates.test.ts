import { describe, it, expect } from 'vitest'
import {
  looksLikeTemplate,
  isTemplate,
  projectToTemplate,
  applyTemplate,
} from './templates'
import type { Project, PhoneLayer, TextLayer, Layer, SlideGroup } from '@/types'

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeProject(): Project {
  const bgLayer: Layer = {
    id: 'bg1',
    name: 'Background',
    type: 'background',
    x: 0,
    y: 0,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: true,
    fill: '#000000',
    accents: [],
  }

  const phoneLayer: PhoneLayer = {
    id: 'phone1',
    name: 'iPhone',
    type: 'phone',
    x: 100,
    y: 100,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    model: 'iphone-16-pro',
    scale: 2.0,
    screenshotFit: 'cover',
    screenshotOffsetX: 0,
    screenshotOffsetY: 0,
    screenshotPath: 'my-screenshot.jpg',
  }

  const textLayer: TextLayer = {
    id: 'text1',
    name: 'Title',
    type: 'text',
    x: 50,
    y: 50,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    text: 'Hello',
    fontFamily: 'Inter',
    fontSize: 48,
    fontWeight: 700,
    fill: '#ffffff',
    letterSpacing: 0,
    lineHeight: 1,
    align: 'left',
  }

  const slideGroup: SlideGroup = {
    id: 'sg1',
    name: 'Slide 1',
    numSlides: 1,
    slideWidth: 1290,
    slideHeight: 2796,
    slideNames: ['slide-01'],
    layers: [bgLayer, phoneLayer, textLayer],
  }

  return {
    id: 'proj1',
    name: 'Test Project',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    settings: {
      defaultSlideWidth: 1290,
      defaultSlideHeight: 2796,
      defaultLocale: 'en',
      brandName: 'TestApp',
      outputPath: '/users/test/output', // should NOT appear in template
    },
    slideGroups: [slideGroup],
  }
}

// ─── looksLikeTemplate ────────────────────────────────────────────────────────

describe('looksLikeTemplate', () => {
  it('returns true for objects with kind:template', () => {
    expect(looksLikeTemplate({ kind: 'template', schemaVersion: 1, slideGroups: [] })).toBe(true)
  })

  it('returns true for legacy templates: slideGroups without id fields and no timestamps', () => {
    // Legacy pattern: groups lack "id", no createdAt/updatedAt
    expect(
      looksLikeTemplate({
        slideGroups: [{ name: 'Slide 1', layers: [] }],
        description: 'old template',
      }),
    ).toBe(true)
  })

  it('returns false for null', () => {
    expect(looksLikeTemplate(null)).toBe(false)
  })

  it('returns false for strings', () => {
    expect(looksLikeTemplate('template')).toBe(false)
  })

  it('returns false for plain objects without slideGroups', () => {
    expect(looksLikeTemplate({ name: 'foo', id: '123' })).toBe(false)
  })

  it('returns false for project-like objects that have slideGroup ids and timestamps', () => {
    // A Project has createdAt/updatedAt and slide groups with ids
    expect(
      looksLikeTemplate({
        slideGroups: [{ id: 'sg1', layers: [] }],
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      }),
    ).toBe(false)
  })
})

// ─── isTemplate ───────────────────────────────────────────────────────────────

describe('isTemplate', () => {
  it('returns true only for objects with kind:template and schemaVersion:1', () => {
    expect(isTemplate({ kind: 'template', schemaVersion: 1 })).toBe(true)
    expect(isTemplate({ kind: 'template', schemaVersion: 2 })).toBe(false)
    expect(isTemplate({ kind: 'project' })).toBe(false)
    expect(isTemplate(null)).toBe(false)
  })
})

// ─── projectToTemplate ────────────────────────────────────────────────────────

describe('projectToTemplate', () => {
  it('output has kind:template and schemaVersion:1', () => {
    const tpl = projectToTemplate(makeProject(), { name: 'My Template' })
    expect(tpl.kind).toBe('template')
    expect(tpl.schemaVersion).toBe(1)
  })

  it('uses the provided name', () => {
    const tpl = projectToTemplate(makeProject(), { name: 'Export Test' })
    expect(tpl.name).toBe('Export Test')
  })

  it('strips screenshotPath from PhoneLayers', () => {
    const tpl = projectToTemplate(makeProject(), { name: 'Strip Test' })
    const phoneLayer = tpl.slideGroups[0].layers.find((l) => l.type === 'phone') as PhoneLayer | undefined
    expect(phoneLayer).toBeDefined()
    expect(phoneLayer!.screenshotPath).toBeUndefined()
  })

  it('does not include outputPath or brandLogoDataUrl in settings', () => {
    const project = makeProject()
    project.settings.brandLogoDataUrl = 'data:image/png;base64,abc'
    const tpl = projectToTemplate(project, { name: 'Settings Test' })
    expect(tpl.settings?.outputPath).toBeUndefined()
    expect(tpl.settings?.brandLogoDataUrl).toBeUndefined()
  })

  it('includes brandColors in settings so {brand:id} tokens keep resolving', () => {
    const project = makeProject()
    project.settings.brandColors = [
      { id: 'bc1', name: 'Primary', value: '#1ED760' },
      { id: 'bc2', name: 'Surface', value: '#14151F' },
    ]
    const tpl = projectToTemplate(project, { name: 'Brand Test' })
    expect(tpl.settings?.brandColors).toEqual(project.settings.brandColors)
    // Deep copy — mutating the template must not touch the project
    expect(tpl.settings?.brandColors?.[0]).not.toBe(project.settings.brandColors[0])
  })

  it('omits brandColors from settings when the project has none', () => {
    const tpl = projectToTemplate(makeProject(), { name: 'No Brand Test' })
    expect(tpl.settings).not.toHaveProperty('brandColors')
  })

  it('assigns deterministic layer ids (l0, l1, …) for clean diffs', () => {
    const tpl = projectToTemplate(makeProject(), { name: 'ID Test' })
    const ids = tpl.slideGroups[0].layers.map((l) => l.id)
    expect(ids[0]).toBe('l0')
    expect(ids[1]).toBe('l1')
  })

  it('excludes specified slide group ids when slideGroupIds option is given', () => {
    const project = makeProject()
    // Only export the first (and only) group
    const tpl = projectToTemplate(project, { name: 'Filtered', slideGroupIds: ['sg1'] })
    expect(tpl.slideGroups).toHaveLength(1)
  })

  it('sets createdAt to an ISO date string', () => {
    const tpl = projectToTemplate(makeProject(), { name: 'Date Test' })
    expect(tpl.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

// ─── applyTemplate ────────────────────────────────────────────────────────────

describe('applyTemplate', () => {
  it('produces SlideGroups with fresh nanoid IDs different from template layer IDs', () => {
    const tpl = projectToTemplate(makeProject(), { name: 'Apply Test' })
    const { slideGroups } = applyTemplate(tpl)

    expect(slideGroups).toHaveLength(1)
    // Group gets a fresh id
    expect(slideGroups[0].id).toBeDefined()
    expect(slideGroups[0].id).not.toBe('sg1')
  })

  it('all layer ids are regenerated (not the deterministic l0/l1 template ids)', () => {
    const tpl = projectToTemplate(makeProject(), { name: 'New IDs Test' })
    const { slideGroups } = applyTemplate(tpl)

    const ids = slideGroups[0].layers.map((l) => l.id)
    for (const id of ids) {
      expect(id).not.toMatch(/^l\d+$/)
    }
  })

  it('preserves the layer count and types from the template', () => {
    const project = makeProject()
    const tpl = projectToTemplate(project, { name: 'Preserve Types' })
    const { slideGroups } = applyTemplate(tpl)

    const types = slideGroups[0].layers.map((l) => l.type)
    expect(types).toContain('background')
    expect(types).toContain('phone')
    expect(types).toContain('text')
    expect(slideGroups[0].layers).toHaveLength(3)
  })

  it('returns optional settings from the template', () => {
    const tpl = projectToTemplate(makeProject(), { name: 'Settings Test' })
    const { settings } = applyTemplate(tpl)
    expect(settings).toBeDefined()
    expect(settings?.defaultLocale).toBe('en')
  })
})
