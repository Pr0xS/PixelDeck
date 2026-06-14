import { describe, it, expect } from 'vitest'
import type { TextMark } from '@/types'
import {
  segmentMarks,
  normalizeMarks,
  applyMarkStyle,
  clearMarkStyle,
  getRangeStyle,
  cssColorToHex,
  marksToHtml,
  isEmptyStyle,
} from './richText'

const LEN = 20 // "0123456789abcdefghij"

describe('segmentMarks', () => {
  it('returns a single unstyled segment when no marks', () => {
    const segs = segmentMarks([], LEN)
    expect(segs).toHaveLength(1)
    expect(segs[0]).toMatchObject({ start: 0, end: LEN })
    expect(isEmptyStyle(segs[0].style)).toBe(true)
  })

  it('splits around a mark and resolves overlaps with later-wins', () => {
    const marks: TextMark[] = [
      { start: 0, end: 10, fill: '#ff0000' },
      { start: 5, end: 15, fill: '#00ff00', italic: true },
    ]
    const segs = segmentMarks(marks, LEN)
    expect(segs.map((s) => [s.start, s.end])).toEqual([[0, 5], [5, 10], [10, 15], [15, 20]])
    expect(segs[0].style).toEqual({ fill: '#ff0000' })
    // overlap: later mark wins fill, italic merges in
    expect(segs[1].style).toEqual({ fill: '#00ff00', italic: true })
    expect(segs[2].style).toEqual({ fill: '#00ff00', italic: true })
    expect(isEmptyStyle(segs[3].style)).toBe(true)
  })

  it('clamps out-of-range marks', () => {
    const segs = segmentMarks([{ start: 10, end: 99, fontWeight: 700 }], LEN)
    expect(segs.map((s) => [s.start, s.end])).toEqual([[0, 10], [10, 20]])
    expect(segs[1].style).toEqual({ fontWeight: 700 })
  })

  it('returns empty for empty text', () => {
    expect(segmentMarks([{ start: 0, end: 5, italic: true }], 0)).toEqual([])
  })
})

describe('normalizeMarks', () => {
  it('merges adjacent marks with identical styles', () => {
    const marks: TextMark[] = [
      { start: 0, end: 5, fill: '#fff' },
      { start: 5, end: 10, fill: '#fff' },
    ]
    expect(normalizeMarks(marks, LEN)).toEqual([{ start: 0, end: 10, fill: '#fff' }])
  })

  it('drops zero-width and style-less marks', () => {
    const marks: TextMark[] = [
      { start: 3, end: 3, fill: '#fff' },
      { start: 5, end: 8 },
    ]
    expect(normalizeMarks(marks, LEN)).toEqual([])
  })

  it('does not merge marks with different styles', () => {
    const marks: TextMark[] = [
      { start: 0, end: 5, fill: '#fff' },
      { start: 5, end: 10, fill: '#000' },
    ]
    expect(normalizeMarks(marks, LEN)).toHaveLength(2)
  })

  it('handles gradient fills in style comparison', () => {
    const grad = { type: 'linear' as const, angle: 90, stops: [{ offset: 0, color: '#f00' }, { offset: 1, color: '#00f' }] }
    const marks: TextMark[] = [
      { start: 0, end: 5, fill: grad },
      { start: 5, end: 10, fill: { ...grad } },
    ]
    expect(normalizeMarks(marks, LEN)).toEqual([{ start: 0, end: 10, fill: grad }])
  })
})

describe('applyMarkStyle', () => {
  it('creates a mark on plain text', () => {
    expect(applyMarkStyle([], LEN, 2, 6, { italic: true })).toEqual([{ start: 2, end: 6, italic: true }])
  })

  it('splits an existing mark when styling a sub-range', () => {
    const marks: TextMark[] = [{ start: 0, end: 10, fill: '#fff' }]
    const out = applyMarkStyle(marks, LEN, 4, 6, { fontWeight: 700 })
    expect(out).toEqual([
      { start: 0, end: 4, fill: '#fff' },
      { start: 4, end: 6, fill: '#fff', fontWeight: 700 },
      { start: 6, end: 10, fill: '#fff' },
    ])
  })

  it('removes an override with null and merges back', () => {
    const marks: TextMark[] = [
      { start: 0, end: 4, fill: '#fff' },
      { start: 4, end: 6, fill: '#fff', fontWeight: 700 },
      { start: 6, end: 10, fill: '#fff' },
    ]
    const out = applyMarkStyle(marks, LEN, 4, 6, { fontWeight: null })
    expect(out).toEqual([{ start: 0, end: 10, fill: '#fff' }])
  })

  it('ignores empty ranges', () => {
    const marks: TextMark[] = [{ start: 0, end: 5, italic: true }]
    expect(applyMarkStyle(marks, LEN, 7, 7, { italic: true })).toEqual(marks)
  })

  it('clamps the range to text length', () => {
    const out = applyMarkStyle([], 5, 2, 99, { underline: true })
    expect(out).toEqual([{ start: 2, end: 5, underline: true }])
  })
})

describe('clearMarkStyle', () => {
  it('removes all overrides in the range only', () => {
    const marks: TextMark[] = [{ start: 0, end: 10, fill: '#fff', italic: true }]
    const out = clearMarkStyle(marks, LEN, 5, 10)
    expect(out).toEqual([{ start: 0, end: 5, fill: '#fff', italic: true }])
  })
})

describe('getRangeStyle', () => {
  const defaults = { fill: '#ffffff' as const, fontWeight: 800, italic: false, underline: false, strikethrough: false }

  it('returns layer defaults when no marks', () => {
    const s = getRangeStyle([], LEN, 0, LEN, defaults)
    expect(s).toEqual({ fill: '#ffffff', fontWeight: 800, italic: false, underline: false, strikethrough: false })
  })

  it('resolves a uniform override', () => {
    const s = getRangeStyle([{ start: 0, end: LEN, fill: '#ff0000' }], LEN, 3, 8, defaults)
    expect(s.fill).toBe('#ff0000')
    expect(s.fontWeight).toBe(800)
  })

  it('reports mixed when range crosses different styles', () => {
    const s = getRangeStyle([{ start: 0, end: 5, fill: '#ff0000' }], LEN, 3, 8, defaults)
    expect(s.fill).toBe('mixed')
  })

  it('probes the style at the caret for a collapsed range', () => {
    const s = getRangeStyle([{ start: 0, end: 5, italic: true }], LEN, 2, 2, defaults)
    expect(s.italic).toBe(true)
  })

  it('handles empty text', () => {
    const s = getRangeStyle([], 0, 0, 0, defaults)
    expect(s.fontWeight).toBe(800)
  })
})

describe('cssColorToHex', () => {
  it('parses rgb()', () => expect(cssColorToHex('rgb(255, 0, 128)')).toBe('#ff0080'))
  it('parses rgba()', () => expect(cssColorToHex('rgba(0, 64, 255, 0.5)')).toBe('#0040ff'))
  it('passes through 6-digit hex', () => expect(cssColorToHex('#AbCdEf')).toBe('#abcdef'))
  it('expands 3-digit hex', () => expect(cssColorToHex('#f0c')).toBe('#ff00cc'))
  it('returns null for unparseable values', () => expect(cssColorToHex('hotpink')).toBeNull())
})

describe('marksToHtml', () => {
  it('serializes plain text with escaped entities', () => {
    expect(marksToHtml('a<b>&c', [])).toBe('a&lt;b&gt;&amp;c')
  })

  it('wraps styled ranges in spans with data-mark', () => {
    const html = marksToHtml('hello world', [{ start: 0, end: 5, fill: '#ff0000' }])
    expect(html).toContain('<span style="color: #ff0000"')
    expect(html).toContain('data-mark=')
    expect(html).toContain('>hello</span> world')
  })

  it('converts newlines to <br> and appends a trailing placeholder', () => {
    expect(marksToHtml('a\nb', [])).toBe('a<br>b')
    expect(marksToHtml('a\n', [])).toBe('a<br><br>')
  })

  it('renders boolean overrides explicitly (false → normal/none)', () => {
    const html = marksToHtml('xy', [{ start: 0, end: 2, italic: false, underline: false }])
    expect(html).toContain('font-style: normal')
    expect(html).toContain('text-decoration: none')
  })

  it('returns empty string for empty text', () => {
    expect(marksToHtml('', [])).toBe('')
  })
})
