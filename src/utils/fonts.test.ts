import { describe, expect, it } from 'vitest'
import type { BrandLayer, GroupLayer, SlideGroup, TextLayer } from '@/types'
import { collectProjectFontUses, ensureFontsLoaded, ensureProjectFontsLoaded } from './fonts'

const base = { x: 0, y: 0, rotation: 0, opacity: 1, visible: true, locked: false }

function textLayer(patch: Partial<TextLayer>): TextLayer {
  return {
    ...base,
    id: 't',
    name: 'Text',
    type: 'text',
    text: 'Hello',
    fontFamily: 'Sora',
    fontSize: 100,
    fontWeight: 800,
    fill: '#fff',
    letterSpacing: 0,
    lineHeight: 1,
    align: 'left',
    ...patch,
  }
}

function group(layers: SlideGroup['layers']): SlideGroup {
  return { id: 'g', name: 'G', numSlides: 1, slideWidth: 1290, slideHeight: 2796, layers, slideNames: ['s'] }
}

describe('collectProjectFontUses', () => {
  it('merges layers that share a face and dedupes their characters', () => {
    const uses = collectProjectFontUses({
      slideGroups: [group([textLayer({ text: 'abc' }), textLayer({ id: 't2', text: 'cab d' })])],
    })
    expect(uses).toHaveLength(1)
    expect(uses[0]).toMatchObject({ family: 'Sora', weight: 800, italic: false })
    expect([...uses[0].text].sort().join('')).toBe(' abcd')
  })

  it('separates italic from upright faces', () => {
    const uses = collectProjectFontUses({
      slideGroups: [group([textLayer({}), textLayer({ id: 't2', italic: true })])],
    })
    expect(uses.map((u) => u.italic).sort()).toEqual([false, true])
  })

  it('includes rich-text marks with only their own characters', () => {
    const uses = collectProjectFontUses({
      slideGroups: [group([textLayer({
        text: 'Plain bold',
        fontWeight: 400,
        marks: [{ start: 6, end: 10, fontWeight: 700 }, { start: 0, end: 5, italic: true }],
      })])],
    })
    const bold = uses.find((u) => u.weight === 700)
    const italic = uses.find((u) => u.italic)
    expect([...bold!.text].sort().join('')).toBe('bdlo')
    expect(italic).toMatchObject({ weight: 400, family: 'Sora' })
  })

  it('covers every locale so non-Latin subsets get loaded', () => {
    const uses = collectProjectFontUses({
      slideGroups: [group([textLayer({
        text: 'Hi',
        localeContent: { en: { text: 'Hi' }, ru: { text: 'Привет', marks: [{ start: 0, end: 2, fontWeight: 400 }] } },
      })])],
    })
    expect(uses.find((u) => u.weight === 800)!.text).toContain('П')
    expect(uses.find((u) => u.weight === 400)!.text).toBe('Пр')
  })

  it('walks into groups and includes brand lockups', () => {
    const brand: BrandLayer = {
      ...base, id: 'b', name: 'Brand', type: 'brand', appName: 'Pulse', logoSize: 60, nameColor: '#fff',
      nameFontSize: 40, nameFontFamily: 'Barlow Condensed', nameFontWeight: 700, direction: 'row', gap: 10,
    }
    const nested: GroupLayer = { ...base, id: 'grp', name: 'Group', type: 'group', children: [textLayer({ fontFamily: 'Inter', fontWeight: 500 })] }
    const uses = collectProjectFontUses({ slideGroups: [group([brand, nested])] })
    expect(uses.map((u) => `${u.family} ${u.weight}`).sort()).toEqual(['Barlow Condensed 700', 'Inter 500'])
  })
})

describe('ensureFontsLoaded outside a browser', () => {
  it('resolves without a document', async () => {
    await expect(ensureFontsLoaded([{ family: 'Sora', weight: 800, italic: false, text: 'a' }])).resolves.toBeUndefined()
    await expect(ensureProjectFontsLoaded({ slideGroups: [] })).resolves.toBeUndefined()
  })
})

describe('collectProjectFontUses: phone status bar', () => {
  const phone = (model: string, extra: Record<string, unknown> = {}) => ({
    id: 'p', name: 'p', type: 'phone', x: 0, y: 0, rotation: 0, opacity: 1, visible: true, locked: false,
    model, scale: 1, screenshotFit: 'cover', screenshotOffsetX: 0, screenshotOffsetY: 0, ...extra,
  })
  const project = (layer: unknown) => ({ slideGroups: [{ layers: [layer] }] }) as never

  it('collects Roboto 700 for an Android phone with a status bar', async () => {
    const { PHONE_MODELS } = await import('@/assets/mockups/specs')
    const android = PHONE_MODELS.find((m) => m.statusBar.height > 0 && m.statusBar.platform === 'android')!.id
    const uses = collectProjectFontUses(project(phone(android)))
    expect(uses.some((u) => u.family === 'Roboto' && u.weight === 700)).toBe(true)
    expect(collectProjectFontUses(project(phone(android, { showStatusBar: false })))).toEqual([])
  })

  it('collects nothing for iOS phones (system font)', () => {
    expect(collectProjectFontUses(project(phone('iphone-16-pro')))).toEqual([])
  })
})
