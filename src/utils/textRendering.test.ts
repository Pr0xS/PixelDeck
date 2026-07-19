import { describe, it, expect } from 'vitest'
import type { TextLayer, TextMark } from '@/types'
import { layerToLines, makeMeasureCache, wrapFragmentLines } from './textRendering'

// Mock measurement: every character is 10px wide
const measure = (text: string) => text.length * 10

interface Frag {
  text: string
  fill: string
}

const frag = (text: string, fill = '#fff'): Frag => ({ text, fill })

const textOf = (lines: Frag[][]) => lines.map((l) => l.map((f) => f.text).join(''))

const textLayer = (text: string, marks?: TextMark[]): TextLayer => ({
  id: 'text',
  name: 'Text',
  type: 'text',
  x: 0,
  y: 0,
  rotation: 0,
  opacity: 1,
  visible: true,
  locked: false,
  text,
  marks,
  fill: '#ffffff',
  fontFamily: 'Inter',
  fontSize: 40,
  fontWeight: 400,
  align: 'left',
  lineHeight: 1.2,
  letterSpacing: 0,
})

describe('layerToLines marks characterization', () => {
  it('preserves segment order and later-wins styles for overlapping, nested, and adjacent marks', () => {
    const marks: TextMark[] = [
      { start: 0, end: 8, fill: '#111111', underline: true },
      { start: 2, end: 6, fill: '#222222', italic: true },
      { start: 3, end: 5, fontWeight: 700 },
      { start: 6, end: 8, strikethrough: true },
      { start: 8, end: 8, fill: '#ignored' },
      { start: 8, end: 10, fill: '#333333' },
    ]

    expect(layerToLines(textLayer('abcdefghijKL', marks))).toEqual([[
      { text: 'ab', fill: '#111111', weight: 400, italic: false, underline: true, strikethrough: false },
      { text: 'c', fill: '#222222', weight: 400, italic: true, underline: true, strikethrough: false },
      { text: 'de', fill: '#222222', weight: 700, italic: true, underline: true, strikethrough: false },
      { text: 'f', fill: '#222222', weight: 400, italic: true, underline: true, strikethrough: false },
      { text: 'gh', fill: '#111111', weight: 400, italic: false, underline: true, strikethrough: true },
      { text: 'ij', fill: '#333333', weight: 400, italic: false, underline: false, strikethrough: false },
      { text: 'KL', fill: '#ffffff', weight: 400, italic: false, underline: false, strikethrough: false },
    ]])
  })

  it('keeps plain input stable when marks are absent', () => {
    expect(layerToLines(textLayer('first\n\nlast'))).toEqual([
      [{ text: 'first', fill: '#ffffff', weight: 400, italic: false, underline: false, strikethrough: false }],
      [],
      [{ text: 'last', fill: '#ffffff', weight: 400, italic: false, underline: false, strikethrough: false }],
    ])
  })

  it('splits at newlines that coincide with exact mark boundaries', () => {
    expect(layerToLines(textLayer('ab\ncd', [
      { start: 0, end: 3, italic: true },
      { start: 3, end: 5, underline: true },
    ]))).toEqual([
      [{ text: 'ab', fill: '#ffffff', weight: 400, italic: true, underline: false, strikethrough: false }],
      [{ text: 'cd', fill: '#ffffff', weight: 400, italic: false, underline: true, strikethrough: false }],
    ])
  })
})

describe('wrapFragmentLines', () => {
  it('keeps short lines untouched', () => {
    const out = wrapFragmentLines([[frag('hello')]], 100, measure)
    expect(textOf(out)).toEqual(['hello'])
  })

  it('wraps at word boundaries', () => {
    // "aaaa bbbb cccc" @10px/char, max 100px (10 chars)
    const out = wrapFragmentLines([[frag('aaaa bbbb cccc')]], 100, measure)
    expect(textOf(out)).toEqual(['aaaa bbbb', 'cccc'])
  })

  it('drops leading whitespace on continuation lines', () => {
    const out = wrapFragmentLines([[frag('aaaaaaa bbbbbbb')]], 80, measure)
    expect(textOf(out)).toEqual(['aaaaaaa', 'bbbbbbb'])
  })

  it('preserves explicit lines as separate inputs', () => {
    const out = wrapFragmentLines([[frag('aaa')], [frag('bbb')]], 100, measure)
    expect(textOf(out)).toEqual(['aaa', 'bbb'])
  })

  it('hard-breaks words longer than the max width', () => {
    const out = wrapFragmentLines([[frag('abcdefghijklmno')]], 50, measure)
    // 5 chars per line at 10px/char
    expect(textOf(out)).toEqual(['abcde', 'fghij', 'klmno'])
  })

  it('wraps across fragments with different styles', () => {
    // "redred" + " bluebluebl" — wrap at 80px (8 chars)
    const out = wrapFragmentLines([[frag('redred', '#f00'), frag(' blueblue', '#00f')]], 80, measure)
    expect(textOf(out)).toEqual(['redred', 'blueblue'])
    // First line keeps the red style, second the blue
    expect(out[0][0].fill).toBe('#f00')
    expect(out[1][0].fill).toBe('#00f')
  })

  it('merges adjacent pieces of the same style after wrapping', () => {
    const out = wrapFragmentLines([[frag('aa bb cc')]], 1000, measure)
    expect(out[0]).toHaveLength(1)
    expect(out[0][0].text).toBe('aa bb cc')
  })

  it('keeps a styled split intact when no wrap is needed', () => {
    const out = wrapFragmentLines([[frag('ab', '#f00'), frag('cd', '#00f')]], 1000, measure)
    expect(out[0]).toHaveLength(2)
  })

  it('handles empty lines', () => {
    const out = wrapFragmentLines([[], [frag('x')]], 100, measure)
    expect(textOf(out)).toEqual(['', 'x'])
  })

  it('trims trailing whitespace before a break (alignment-safe)', () => {
    const out = wrapFragmentLines([[frag('aaaa      bbbb')]], 60, measure)
    expect(textOf(out)[0]).toBe('aaaa')
  })
})

describe('makeMeasureCache', () => {
  it('caches measurements independently by font and text', () => {
    let calls = 0
    const cachedMeasure = makeMeasureCache((font, text) => {
      calls++
      return font.length + text.length
    })

    expect(cachedMeasure('12px Inter', 'hello')).toBe(15)
    expect(cachedMeasure('12px Inter', 'hello')).toBe(15)
    expect(cachedMeasure('bold 12px Inter', 'hello')).toBe(20)
    expect(cachedMeasure('12px Inter', 'world')).toBe(15)
    expect(calls).toBe(3)
  })

  it('evicts the least recently used entry at the configured limit', () => {
    const calls: string[] = []
    const cachedMeasure = makeMeasureCache((font, text) => {
      calls.push(`${font}:${text}`)
      return text.length
    }, 2)

    cachedMeasure('font', 'a')
    cachedMeasure('font', 'b')
    cachedMeasure('font', 'a') // refresh a; b is now least recently used
    cachedMeasure('font', 'c')
    cachedMeasure('font', 'b')

    expect(calls).toEqual(['font:a', 'font:b', 'font:c', 'font:b'])
  })
})
