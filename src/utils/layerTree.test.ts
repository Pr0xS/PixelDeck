import { describe, expect, it } from 'vitest'
import type { GroupLayer, Layer, TextLayer } from '@/types'
import { findLayerInTree, mapLayerTree, updateLayerInTree } from './layerTree'

const text = (id: string, value: string): TextLayer => ({
  id,
  name: value,
  type: 'text',
  x: 0,
  y: 0,
  rotation: 0,
  opacity: 1,
  visible: true,
  locked: false,
  text: value,
  fontFamily: 'Inter',
  fontSize: 20,
  fontWeight: 400,
  fill: '#fff',
  letterSpacing: 0,
  lineHeight: 1,
  align: 'left',
})

const tree = (): Layer[] => [{
  id: 'group',
  name: 'Group',
  type: 'group',
  x: 0,
  y: 0,
  rotation: 0,
  opacity: 1,
  visible: true,
  locked: false,
  children: [text('child', 'Nested')],
} satisfies GroupLayer, text('top', 'Top')]

describe('layerTree helpers', () => {
  it('maps every layer in a nested tree', () => {
    const mapped = mapLayerTree(tree(), (layer) => ({ ...layer, name: `mapped-${layer.name}` } as Layer))

    expect(mapped[0].name).toBe('mapped-Group')
    expect((mapped[0] as GroupLayer).children[0].name).toBe('mapped-Nested')
    expect(mapped[1].name).toBe('mapped-Top')
  })

  it('updates a child inside a group', () => {
    const updated = updateLayerInTree(tree(), 'child', { x: 42 })

    expect((updated[0] as GroupLayer).children[0].x).toBe(42)
    expect(findLayerInTree(updated, 'child')?.id).toBe('child')
  })

  it('does not mutate the input tree', () => {
    const input = tree()
    const child = (input[0] as GroupLayer).children[0]
    const updated = updateLayerInTree(input, 'child', (layer) => ({ ...layer, name: 'Changed' } as Layer))

    expect(child.name).toBe('Nested')
    expect((input[0] as GroupLayer).children[0]).toBe(child)
    expect((updated[0] as GroupLayer).children[0]).not.toBe(child)
  })

  it('returns the same tree when the layer is not found', () => {
    const input = tree()

    expect(updateLayerInTree(input, 'missing', { x: 10 })).toBe(input)
  })
})
