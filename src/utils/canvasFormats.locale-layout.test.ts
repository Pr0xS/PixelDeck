import { describe, expect, it } from 'vitest'
import type { GroupLayer, Layer, Project, SlideGroup, TextLayer } from '@/types'
import {
  applyCanvasFormat,
  applyLocaleFormatLayout,
  BASE_CANVAS_FORMAT,
  resolveProjectView,
} from './canvasFormats'

const makeText = (partial?: Partial<TextLayer>): TextLayer => ({
  id: 'text',
  name: 'Text',
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
  ...partial,
})

const makeGroup = (layers: Layer[], partial?: Partial<SlideGroup>): SlideGroup => ({
  id: 'group',
  name: 'Slide 1',
  numSlides: 1,
  slideWidth: 1320,
  slideHeight: 2868,
  layers,
  slideNames: ['slide-01'],
  ...partial,
})

const makeProject = (layers: Layer[], group?: Partial<SlideGroup>): Project => ({
  id: 'project',
  name: 'Project',
  createdAt: '',
  updatedAt: '',
  settings: {
    defaultSlideWidth: 1320,
    defaultSlideHeight: 2868,
    defaultLocale: 'en',
    brandName: 'App',
    baseCanvasFormat: BASE_CANVAS_FORMAT,
  },
  slideGroups: [makeGroup(layers, group)],
})

const getText = (project: Project): TextLayer => project.slideGroups[0].layers[0] as TextLayer

describe('locale-format layout resolution', () => {
  it('returns the project unchanged for the default locale', () => {
    const project = makeProject([makeText({
      localeLayoutOverrides: { de: { 'android-phone': { x: 200 } } },
    })])

    expect(applyLocaleFormatLayout(project, 'en', 'android-phone')).toBe(project)
  })

  it('returns the project unchanged for the base format', () => {
    const project = makeProject([makeText({
      localeLayoutOverrides: { de: { 'android-phone': { x: 200 } } },
    })])

    expect(applyLocaleFormatLayout(project, 'de', BASE_CANVAS_FORMAT)).toBe(project)
  })

  it('applies the matching locale and format cell', () => {
    const project = makeProject([makeText({
      localeLayoutOverrides: { de: { 'android-phone': { x: 200 } } },
    })])

    expect(getText(resolveProjectView(project, 'de', 'android-phone')).x).toBe(200)
  })

  it('leaves the override inert for another format', () => {
    const project = makeProject([makeText({
      localeLayoutOverrides: { de: { 'android-phone': { x: 200 } } },
    })])
    const expectedIphoneX = getText(applyCanvasFormat(project, 'iphone-69')).x

    expect(getText(resolveProjectView(project, 'de', 'iphone-69')).x).toBe(expectedIphoneX)
  })

  it('leaves the override inert for the default locale', () => {
    const project = makeProject([makeText({
      localeLayoutOverrides: { de: { 'android-phone': { x: 200 } } },
    })])

    expect(getText(resolveProjectView(project, 'en', 'android-phone')).x).not.toBe(200)
  })

  it('gives locale-format layout precedence over format-only layout', () => {
    const project = makeProject([makeText({
      formatOverrides: { 'android-phone': { x: 100 } },
      localeLayoutOverrides: { de: { 'android-phone': { x: 200 } } },
    })])

    expect(getText(resolveProjectView(project, 'de', 'android-phone')).x).toBe(200)
    expect(getText(resolveProjectView(project, 'en', 'android-phone')).x).toBe(100)
  })

  it('resolves overrides on children nested inside groups', () => {
    const child = makeText({
      id: 'child',
      localeLayoutOverrides: { de: { 'android-phone': { x: 200 } } },
    })
    const parent: GroupLayer = {
      id: 'parent',
      name: 'Group',
      type: 'group',
      x: 0,
      y: 0,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      children: [child],
    }
    const resolved = resolveProjectView(makeProject([parent]), 'de', 'android-phone')
    const resolvedParent = resolved.slideGroups[0].layers[0] as GroupLayer

    expect(resolvedParent.children[0].x).toBe(200)
  })

  it('spreads pano coordinates directly without scaling or translation', () => {
    const targetX = 1500
    const project = makeProject(
      [makeText({ localeLayoutOverrides: { de: { 'android-phone': { x: targetX } } } })],
      { numSlides: 2, slideNames: ['slide-01', 'slide-02'] },
    )

    expect(getText(resolveProjectView(project, 'de', 'android-phone')).x).toBe(targetX)
  })
})
