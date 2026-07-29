import { describe, expect, it } from 'vitest'
import type { Layer, Project, SlideGroup, TextLayer } from '@/types'
import { buildExportFileTarget, buildExportPlan, safeExportSegment } from './exportPlan'

const group = (id: string, name: string, slideNames: string[], layers: Layer[] = []): SlideGroup => ({
  id,
  name,
  numSlides: slideNames.length,
  slideWidth: 1320,
  slideHeight: 2868,
  slideNames,
  layers,
})

const project: Project = {
  id: 'project',
  name: 'Project',
  createdAt: '',
  updatedAt: '',
  settings: {
    defaultSlideWidth: 1320,
    defaultSlideHeight: 2868,
    defaultLocale: 'en',
    locales: ['en', 'es'],
    brandName: 'App',
    activeFormats: ['iphone-69', 'android-phone'],
  },
  slideGroups: [
    group('hero', 'Hero', ['Hero', 'Benefit']),
    group('detail', 'Details', ['Details']),
  ],
}

describe('buildExportPlan', () => {
  it('enumerates locale × active format × group × slide with deterministic names', () => {
    const plan = buildExportPlan(project)

    expect(plan.batches).toHaveLength(8)
    expect(plan.entries).toHaveLength(12)
    expect(new Set(plan.entries.map((entry) => entry.locale))).toEqual(new Set(['en', 'es']))
    expect(new Set(plan.entries.map((entry) => entry.formatId))).toEqual(
      new Set(['iphone-69', 'android-phone']),
    )
    expect(plan.entries[0]).toMatchObject({
      locale: 'en',
      formatId: 'iphone-69',
      groupId: 'hero',
      slideIndex: 0,
      name: 'Hero',
      relativePath: 'iphone-69/en/Hero',
    })
    expect(plan.entries[1]).toMatchObject({
      slideIndex: 1,
      name: 'Hero__Benefit',
      relativePath: 'iphone-69/en/Hero__Benefit',
    })
  })

  it('never includes base among default export targets', () => {
    const withBase = {
      ...project,
      settings: { ...project.settings, activeFormats: ['base', 'android-phone'] as const },
    } as Project

    expect(new Set(buildExportPlan(withBase).entries.map((entry) => entry.formatId)))
      .toEqual(new Set(['android-phone']))
  })

  it('omits groups outside the target format scope', () => {
    const scopedProject: Project = {
      ...project,
      slideGroups: [
        group('phone', 'Phone', ['Phone']),
        { ...group('tablet', 'Tablet', ['Tablet']), formats: ['ipad-13'] },
      ],
    }

    const plan = buildExportPlan(scopedProject, {
      locales: ['en'],
      formatIds: ['android-phone', 'ipad-13'],
    })

    expect(plan.batches.map((batch) => [batch.formatId, batch.group.id])).toEqual([
      ['android-phone', 'phone'],
      ['ipad-13', 'phone'],
      ['ipad-13', 'tablet'],
    ])
  })

  it('exports only unpinned groups when explicitly requested to export base', () => {
    const plan = buildExportPlan({ ...project, slideGroups: [group('legacy', 'Legacy', ['Legacy']), { ...group('watch', 'Watch', ['Watch']), formats: ['apple-watch'] }] }, { locales: ['en'], formatIds: ['base'] })
    expect(plan.batches.map((batch) => batch.group.id)).toEqual(['legacy'])
  })

  it('enumerates every slide in pano groups and supports a single whole-pano target', () => {
    const split = buildExportPlan(project, { formatIds: ['base'], locales: ['en'] })
    expect(split.batches.find((batch) => batch.group.id === 'hero')?.entries.map((entry) => entry.slideIndex))
      .toEqual([0, 1])

    const whole = buildExportPlan(project, {
      formatIds: ['base'],
      locales: ['en'],
      panoMode: 'whole',
    })
    expect(whole.batches.find((batch) => batch.group.id === 'hero')?.entries).toHaveLength(1)
    expect(whole.batches.find((batch) => batch.group.id === 'hero')?.entries[0].slideIndex).toBeNull()
  })

  it('keeps the headless CLI filename contract collision-safe across groups', () => {
    const cliProject: Project = {
      ...project,
      settings: { ...project.settings, activeFormats: ['base'] },
      slideGroups: [
        group('first', 'First Group', ['Shared / Slide']),
        group('second', 'Second Group', ['Shared / Slide']),
      ],
    }

    const plan = buildExportPlan(cliProject, {
      formatIds: ['base'],
      locales: ['en'],
      scope: 'project',
    })

    expect(plan.entries.map((entry) => entry.name)).toEqual([
      'First-Group__Shared-Slide',
      'Second-Group__Shared-Slide',
    ])
    expect(plan.entries.map((entry) => entry.relativePath)).toEqual([
      'base/en/First-Group__Shared-Slide',
      'base/en/Second-Group__Shared-Slide',
    ])
  })

  it('applies locale layout overrides only to their locale and format batch', () => {
    const text: TextLayer = {
      id: 'localized-title',
      name: 'Localized title',
      type: 'text',
      x: 100,
      y: 200,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      text: 'Hello',
      fontFamily: 'Inter',
      fontSize: 100,
      fontWeight: 700,
      fill: '#fff',
      letterSpacing: 0,
      lineHeight: 1.2,
      align: 'left',
      // P3: `buildExportPlan` routes through `resolveProjectView`, which now
      // reads the delta-valued `localeAdjust` tier exclusively (the legacy
      // `localeLayoutOverrides` field is no longer read, only still written
      // by the store's dual-write — irrelevant here since this fixture is
      // hand-built, not store-driven). dx chosen so the resolved (de,
      // android) value lands on the same 200 this fixture targeted under
      // the legacy absolute model: dx = 200 - R, where R is this layer's
      // scaled base x (100) at the android-phone preset for this file's
      // 1320x2868 group canvas.
      localeAdjust: {
        de: { 'android-phone': { dx: 34.89539748953973 } },
      },
    }
    const scopedProject: Project = {
      ...project,
      settings: { ...project.settings, locales: ['en', 'de'] },
      slideGroups: [group('localized', 'Localized', ['Localized'], [text])],
    }

    // ExportApp and browser export both consume this plan, so these projections
    // prove headless/browser export parity without testing their render shells.
    const plan = buildExportPlan(scopedProject, {
      locales: ['de', 'en'],
      formatIds: ['android-phone', 'iphone-69'],
    })
    const layerX = (locale: string, formatId: string) => {
      const batch = plan.batches.find((candidate) =>
        candidate.locale === locale && candidate.formatId === formatId)
      return batch?.group.layers.find((layer) => layer.id === text.id)?.x
    }

    expect(layerX('de', 'android-phone')).toBeCloseTo(200)
    expect(layerX('en', 'android-phone')).not.toBeCloseTo(200)
    expect(layerX('de', 'iphone-69')).not.toBeCloseTo(200)
  })
})

describe('safeExportSegment', () => {
  it('sanitizes path separators and falls back for empty names', () => {
    expect(safeExportSegment(' My Hero/Slide ')).toBe('My-Hero-Slide')
    expect(safeExportSegment('   ')).toBe('untitled')
  })
})

describe('buildExportFileTarget', () => {
  it('adds a deterministic suffix when a canonical path is already used', () => {
    expect(buildExportFileTarget({
      formatId: 'base',
      formatLabel: 'Base',
      locale: 'en',
      groupName: 'Hero',
      sourceName: 'Benefit',
      scope: 'project',
      usedRelativePaths: new Set(['base/en/Hero__Benefit']),
    })).toEqual({
      name: 'Hero__Benefit-2',
      relativePath: 'base/en/Hero__Benefit-2',
    })
  })
})
