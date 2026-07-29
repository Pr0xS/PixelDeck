import { describe, expect, it } from 'vitest'
import type { BackgroundLayer, GroupLayer, Layer, ShapeLayer, TextLayer } from '@/types'
import { FORMAT_FORK_KEYS } from './canvasFormats'
import { CONTENT_SYNC_KEYS, planContentSync } from './contentSync'

const text = (partial: Partial<TextLayer> = {}): TextLayer => ({
  id: 'text', name: 'Title', type: 'text', x: 10, y: 20, rotation: 5, opacity: 1, visible: true, locked: false,
  text: 'Target', fontFamily: 'Inter', fontSize: 24, fontWeight: 700, fill: '#fff', letterSpacing: 0, lineHeight: 1.2, align: 'left', width: 200,
  ...partial,
})
const shape = (partial: Partial<ShapeLayer> = {}): ShapeLayer => ({
  id: 'shape', name: 'Shape', type: 'shape', x: 30, y: 40, rotation: 0, opacity: 1, visible: true, locked: false,
  shapeType: 'rect', width: 100, height: 80, fill: '#f00', cornerRadius: 0, ...partial,
})
const background = (fill: string): BackgroundLayer => ({
  id: 'bg', name: 'Background', type: 'background', x: 0, y: 0, rotation: 0, opacity: 1, visible: true, locked: false, fill, accents: [],
})
const group = (children: Layer[], partial: Partial<GroupLayer> = {}): GroupLayer => ({
  id: 'group', name: 'Group', type: 'group', x: 0, y: 0, rotation: 0, opacity: 1, visible: true, locked: false, children, ...partial,
})

describe('planContentSync', () => {
  it('copies all text content and locale entries from a family counterpart', () => {
    const source = text({ text: 'Source copy', marks: [{ start: 0, end: 6, fontWeight: 400 }], localeContent: { en: { text: 'Source copy' }, es: { text: 'Texto' } } })
    const target = text({ text: 'Target copy', marks: undefined, localeContent: { en: { text: 'Target copy' } } })

    const plan = planContentSync([source], [target])

    expect(plan.entries[0]).toMatchObject({ status: 'updated', changedKeys: ['text', 'marks', 'localeContent'] })
    expect(plan.layers[0]).toMatchObject({ text: 'Source copy', marks: source.marks, localeContent: source.localeContent })
  })

  it('has no overlap with fork keys and preserves every excluded target property', () => {
    expect(CONTENT_SYNC_KEYS.filter((key) => (FORMAT_FORK_KEYS as readonly string[]).includes(key))).toEqual([])
    const source = text({ text: 'Incoming', x: 999, y: 998, width: 999, fontSize: 99, rotation: 45, formatOverrides: { 'ipad-13': { x: 1 } }, localeAdjust: { es: { base: { dx: 2 } } }, ownerFormat: 'ipad-13' })
    const target = text({ id: 'target-id', name: 'Target name', text: 'Old', x: 1, y: 2, width: 3, fontSize: 4, rotation: 6, formatOverrides: { 'android-phone': { y: 2 } }, formatVisibility: { 'android-phone': false }, localeAdjust: { es: { base: { dx: 3 } } }, ownerFormat: 'android-phone' })
    const before = structuredClone(target)
    const synced = planContentSync([source], [target]).layers[0] as TextLayer

    for (const key of ['x', 'y', 'width', 'height', 'fontSize', 'scale', 'rotation', 'model', 'formatOverrides', 'formatVisibility', 'localeAdjust', 'ownerFormat', 'id', 'name'] as const) {
      expect((synced as unknown as Record<string, unknown>)[key]).toEqual((before as unknown as Record<string, unknown>)[key])
    }
  })

  it('never copies fill values', () => {
    const plan = planContentSync([background('#111')], [background('#222')])
    expect((plan.layers[0] as BackgroundLayer).fill).toBe('#222')
    expect(plan.entries[0]?.status).toBe('unchanged')
  })

  it('skips a mismatched layer but continues syncing its siblings', () => {
    const plan = planContentSync([text({ text: 'Source' }), text({ id: 's2', text: 'Second' })], [shape(), text({ id: 't2', text: 'Old' })])
    expect(plan.entries[0]?.status).toBe('skipped-type-mismatch')
    expect(plan.layers[0]).toEqual(shape())
    expect((plan.layers[1] as TextLayer).text).toBe('Second')
  })

  it('reports structural extras without inserting or deleting target layers', () => {
    const target = [text({ text: 'Old' }), shape()]
    const plan = planContentSync([text({ text: 'New' }), text({ id: 'extra', text: 'Extra' })], target)
    expect(plan.entries.map((entry) => entry.status)).toContain('skipped-type-mismatch')
    expect(plan.layers).toHaveLength(2)

    const sourceExtra = planContentSync([text({ text: 'New' }), text({ id: 'extra', text: 'Extra' })], [text({ text: 'Old' })])
    const targetExtra = planContentSync([text({ text: 'New' })], target)
    expect(sourceExtra.entries.some((entry) => entry.status === 'skipped-no-target')).toBe(true)
    expect(targetExtra.entries.some((entry) => entry.status === 'skipped-no-source')).toBe(true)
    expect(targetExtra.layers).toHaveLength(target.length)
  })

  it('does not descend into a mismatched group subtree and is pure', () => {
    const source = [group([text({ text: 'Incoming child' })])]
    const target = [shape({ id: 'target-parent' })]
    const sourceBefore = structuredClone(source)
    const targetBefore = structuredClone(target)
    const first = planContentSync(source, target)
    const second = planContentSync(source, target)

    expect(first).toEqual(second)
    expect(first.entries).toEqual([expect.objectContaining({ path: [0], status: 'skipped-type-mismatch' })])
    expect(source).toEqual(sourceBefore)
    expect(target).toEqual(targetBefore)
  })
})
