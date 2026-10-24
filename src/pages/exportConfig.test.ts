import { describe, expect, it } from 'vitest'
import type { Project, SlideGroup } from '@/types'
import { buildExportPlan } from '@/utils/exportPlan'
import { resolveExportFormatIds } from './exportConfig'

const group = (id: string, format: 'iphone-69' | 'ipad-13'): SlideGroup => ({
  id,
  name: id,
  formats: [format],
  numSlides: 1,
  slideWidth: 1320,
  slideHeight: 2868,
  slideNames: [id],
  layers: [],
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
    brandName: 'App',
    activeFormats: ['iphone-69', 'ipad-13'],
  },
  slideGroups: [group('phone', 'iphone-69'), group('tablet', 'ipad-13')],
}

describe('resolveExportFormatIds', () => {
  it('uses active project formats by default so scoped groups are exported', () => {
    const formatIds = resolveExportFormatIds(project)
    const plan = buildExportPlan(project, { formatIds, locales: ['en'] })

    expect(formatIds).toEqual(['iphone-69', 'ipad-13'])
    expect(plan.batches.map(({ formatId, group: target }) => [formatId, target.id]))
      .toEqual([['iphone-69', 'phone'], ['ipad-13', 'tablet']])
  })

  it('uses an explicit CLI format selection instead of project defaults', () => {
    expect(resolveExportFormatIds(project, ['ipad-13'])).toEqual(['ipad-13'])
  })
})
