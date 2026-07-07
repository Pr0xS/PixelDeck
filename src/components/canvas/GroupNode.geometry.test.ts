import { describe, it, expect } from 'vitest'
import type { EmojiLayer, GroupLayer, ShapeLayer, TextLayer } from '@/types'
import { DEFAULT_TEXT_WIDTH } from '@/utils/textRendering'
import { estimateGroupBox, estimateLayerBox } from './GroupNode.geometry'

const baseLayer = {
  id: 'layer',
  name: 'Layer',
  x: 0,
  y: 0,
  rotation: 0,
  opacity: 1,
  visible: true,
  locked: false,
}

const makeShape = (partial?: Partial<ShapeLayer>): ShapeLayer => ({
  ...baseLayer,
  id: 'shape',
  name: 'Shape',
  type: 'shape',
  shapeType: 'rect',
  width: 100,
  height: 100,
  fill: '#fff',
  cornerRadius: 0,
  ...partial,
})

const makeGroup = (partial?: Partial<GroupLayer>): GroupLayer => ({
  ...baseLayer,
  id: 'group',
  name: 'Group',
  type: 'group',
  scale: 1,
  children: [],
  ...partial,
})

const makeEmoji = (partial?: Partial<EmojiLayer>): EmojiLayer => ({
  ...baseLayer,
  id: 'emoji',
  name: 'Emoji',
  type: 'emoji',
  emoji: '🚀',
  fontSize: 48,
  ...partial,
})

const makeText = (partial?: Partial<TextLayer>): TextLayer => ({
  ...baseLayer,
  id: 'text',
  name: 'Text',
  type: 'text',
  text: 'Text',
  fontFamily: 'Inter',
  fontSize: 10,
  fontWeight: 400,
  fill: '#fff',
  letterSpacing: 0,
  lineHeight: 1.2,
  align: 'left',
  ...partial,
})

describe('estimateGroupBox', () => {
  it('bounds children and derives the expected pivot center', () => {
    const box = estimateGroupBox(makeGroup({
      x: 0,
      y: 0,
      scale: 1,
      children: [
        makeShape({ x: 0, y: 0, width: 100, height: 100 }),
        makeShape({ x: 200, y: 0, width: 100, height: 100 }),
      ],
    }))

    expect(box).toEqual({ x: 0, y: 0, w: 300, h: 100 })
    expect(box.x + box.w / 2).toBe(150)
    expect(box.y + box.h / 2).toBe(50)
  })

  it('uses a minimal fallback box for empty groups', () => {
    expect(estimateGroupBox(makeGroup({ x: 0, y: 0, scale: 1, children: [] }))).toEqual({
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    })
  })
})

describe('estimateLayerBox', () => {
  it('uses shape dimensions directly', () => {
    expect(estimateLayerBox(makeShape({ x: 10, y: 20, width: 40, height: 60 }))).toEqual({
      x: 10,
      y: 20,
      w: 40,
      h: 60,
    })
  })

  it('uses emoji font size as width and height', () => {
    expect(estimateLayerBox(makeEmoji({ x: 5, y: 5, fontSize: 48 }))).toEqual({
      x: 5,
      y: 5,
      w: 48,
      h: 48,
    })
  })

  it('estimates text size from defaults, font size, line height, and line count', () => {
    const box = estimateLayerBox(makeText({ x: 0, y: 0, text: 'a\nb', fontSize: 10, lineHeight: 1.2 }))

    expect(box.w).toBe(DEFAULT_TEXT_WIDTH)
    expect(box.h).toBe(24)
  })

  it('scales nested group boxes', () => {
    const box = estimateLayerBox(makeGroup({
      x: 100,
      y: 0,
      scale: 2,
      children: [makeShape({ x: 0, y: 0, width: 50, height: 50 })],
    }))

    expect(box.x).toBe(100)
    expect(box.y).toBe(0)
    expect(box.w).toBe(100)
    expect(box.h).toBe(100)
  })
})
