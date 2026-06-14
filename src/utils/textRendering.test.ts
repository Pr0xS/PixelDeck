import { describe, it, expect } from 'vitest'
import { wrapFragmentLines } from './textRendering'

// Mock measurement: every character is 10px wide
const measure = (text: string) => text.length * 10

interface Frag {
  text: string
  fill: string
}

const frag = (text: string, fill = '#fff'): Frag => ({ text, fill })

const textOf = (lines: Frag[][]) => lines.map((l) => l.map((f) => f.text).join(''))

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
