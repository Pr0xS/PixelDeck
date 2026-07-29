import { describe, expect, it } from 'vitest'
import type { CanvasFormatId, Project, SlideGroup } from '@/types'
import { hasFormatLayout } from '@/utils/canvasFormats'

const group = (id: string, formats: SlideGroup['formats']): SlideGroup => ({
  id,
  name: id,
  numSlides: 1,
  slideWidth: 1320,
  slideHeight: 2868,
  slideNames: ['slide-01'],
  layers: [],
  formats,
})

const project = (slideGroups: SlideGroup[], activeFormats: Project['settings']['activeFormats']): Project => ({
  id: 'project', name: 'Project', createdAt: '', updatedAt: '',
  settings: {
    defaultSlideWidth: 1320,
    defaultSlideHeight: 2868,
    defaultLocale: 'en',
    brandName: 'App',
    activeFormats,
  },
  slideGroups,
})

describe('hasFormatLayout', () => {
  it('does not treat an active export format without a backing group as a created layout', () => {
    const value = project([
      group('phone', ['iphone-69', 'android-phone']),
      group('vr', ['meta-quest']),
    ], ['iphone-69', 'android-phone', 'visionpro'])

    expect(hasFormatLayout(value, 'visionpro')).toBe(false)
    expect(hasFormatLayout(value, 'meta-quest')).toBe(true)
  })

  it('treats a canonical family member as uncreated until it is export-active', () => {
    const value = project([
      group('phone', ['iphone-69', 'android-phone']),
      group('vr', ['visionpro', 'meta-quest']),
    ], ['iphone-69', 'android-phone', 'visionpro'])
    const activeFormats = value.settings.activeFormats ?? []
    const isCreated = (formatId: CanvasFormatId) => activeFormats.includes(formatId) && hasFormatLayout(value, formatId)

    expect(hasFormatLayout(value, 'meta-quest')).toBe(true)
    expect(isCreated('meta-quest')).toBe(false)
    const familyFormats: CanvasFormatId[] = ['visionpro', 'meta-quest']
    expect(familyFormats.filter(isCreated)).toEqual(['visionpro'])
    expect(familyFormats.filter((formatId) => !isCreated(formatId))).toEqual(['meta-quest'])
  })
})
