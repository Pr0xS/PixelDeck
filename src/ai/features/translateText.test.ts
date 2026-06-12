import { describe, expect, it } from 'vitest'
import { parseBatchTranslationResponse } from './translateText'
import { buildDesignContext } from '@/ai/context'
import type { Project, SlideGroup, TextLayer, PhoneLayer } from '@/types'

// ─── parseBatchTranslationResponse ────────────────────────────────────────────

describe('parseBatchTranslationResponse', () => {
  const ids = ['a', 'b', 'c']

  it('parses a clean JSON object', () => {
    const raw = '{"a": "Hola", "b": "Mundo", "c": "Adiós"}'
    expect(parseBatchTranslationResponse(raw, ids)).toEqual({ a: 'Hola', b: 'Mundo', c: 'Adiós' })
  })

  it('strips markdown fences', () => {
    const raw = '```json\n{"a": "Hola", "b": "Mundo"}\n```'
    expect(parseBatchTranslationResponse(raw, ids)).toEqual({ a: 'Hola', b: 'Mundo' })
  })

  it('tolerates surrounding prose', () => {
    const raw = 'Here are the translations:\n{"a": "Hola"}\nLet me know if you need more.'
    expect(parseBatchTranslationResponse(raw, ids)).toEqual({ a: 'Hola' })
  })

  it('ignores unexpected ids and non-string values', () => {
    const raw = '{"a": "Hola", "zz": "ignored", "b": 42}'
    expect(parseBatchTranslationResponse(raw, ids)).toEqual({ a: 'Hola' })
  })

  it('trims whitespace in values and skips empty strings', () => {
    const raw = '{"a": "  Hola  ", "b": "   "}'
    expect(parseBatchTranslationResponse(raw, ids)).toEqual({ a: 'Hola' })
  })

  it('throws when there is no JSON object', () => {
    expect(() => parseBatchTranslationResponse('Sorry, I cannot do that.', ids)).toThrow()
  })

  it('throws on invalid JSON', () => {
    expect(() => parseBatchTranslationResponse('{"a": "Hola",}', ids)).toThrow()
  })

  it('throws when no expected ids are present', () => {
    expect(() => parseBatchTranslationResponse('{"x": "Hola"}', ids)).toThrow()
  })

  it('throws on JSON arrays', () => {
    expect(() => parseBatchTranslationResponse('["Hola", "Mundo"]', ids)).toThrow()
  })
})

// ─── buildDesignContext ───────────────────────────────────────────────────────

function makeTextLayer(partial: Partial<TextLayer>): TextLayer {
  return {
    id: 'txt',
    name: 'Text',
    type: 'text',
    x: 0,
    y: 0,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    text: 'Hello',
    fontFamily: 'Inter',
    fontSize: 24,
    fontWeight: 400,
    fill: '#fff',
    letterSpacing: 0,
    lineHeight: 1.2,
    align: 'left',
    ...partial,
  }
}

function makeProject(group: SlideGroup): Project {
  return {
    id: 'p1',
    name: 'My App',
    settings: {
      defaultSlideWidth: 1290,
      defaultSlideHeight: 2796,
      defaultLocale: 'en',
      brandName: 'HabitFlow',
    },
    slideGroups: [group],
  } as Project
}

describe('buildDesignContext', () => {
  it('classifies roles by font size and assigns slides by x position', () => {
    const group: SlideGroup = {
      id: 'g1',
      name: 'Main set',
      numSlides: 2,
      slideWidth: 1000,
      slideHeight: 2000,
      slideNames: ['slide-1', 'slide-2'],
      layers: [
        makeTextLayer({ id: 'h1', text: 'Track your habits', fontSize: 96, x: 100 }),
        makeTextLayer({ id: 'b1', text: 'Stay motivated daily', fontSize: 32, x: 100 }),
        makeTextLayer({ id: 'h2', text: 'Beautiful stats', fontSize: 90, x: 1200 }),
      ],
    }
    const ctx = buildDesignContext(makeProject(group), group)

    expect(ctx.roleById['h1']).toBe('headline on slide 1')
    expect(ctx.roleById['b1']).toBe('subheading on slide 1')
    expect(ctx.roleById['h2']).toBe('headline on slide 2')
    expect(ctx.text).toContain('App: HabitFlow')
    expect(ctx.text).toContain('[headline] "Track your habits"')
    expect(ctx.text).toContain('Slide 2')
  })

  it('walks group layers with offset and skips hidden/empty texts', () => {
    const child = makeTextLayer({ id: 'inner', text: 'Inside group', fontSize: 48, x: 50 })
    const hidden = makeTextLayer({ id: 'ghost', text: 'Invisible', visible: false })
    const empty = makeTextLayer({ id: 'empty', text: '   ' })
    const group: SlideGroup = {
      id: 'g1',
      name: 'Set',
      numSlides: 1,
      slideWidth: 1000,
      slideHeight: 2000,
      slideNames: ['s'],
      layers: [
        {
          id: 'grp',
          name: 'Group',
          type: 'group',
          x: 200,
          y: 0,
          rotation: 0,
          opacity: 1,
          visible: true,
          locked: false,
          children: [child, hidden, empty],
        },
      ],
    }
    const ctx = buildDesignContext(makeProject(group), group)

    expect(ctx.roleById['inner']).toBe('headline on slide 1')
    expect(ctx.roleById['ghost']).toBeUndefined()
    expect(ctx.roleById['empty']).toBeUndefined()
  })

  it('mentions device mockups in the inventory', () => {
    const phone: PhoneLayer = {
      id: 'ph1',
      name: 'Phone',
      type: 'phone',
      x: 300,
      y: 100,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      model: 'iphone-16-pro',
      scale: 1,
      screenshotFit: 'cover',
    } as PhoneLayer
    const group: SlideGroup = {
      id: 'g1',
      name: 'Set',
      numSlides: 1,
      slideWidth: 1000,
      slideHeight: 2000,
      slideNames: ['s'],
      layers: [phone],
    }
    const ctx = buildDesignContext(makeProject(group), group)
    expect(ctx.text).toContain('device mockup')
  })
})
