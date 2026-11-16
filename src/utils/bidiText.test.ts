import { describe, it, expect } from 'vitest'
import { visualTextRuns, visualWrappedTextLines } from './bidiText'

describe('styled bidirectional text', () => {
  it('orders Hebrew styles visually while preserving logical text inside runs', () => {
    const runs = visualTextRuns([{ text: 'גם ', color: 'white' }, { text: 'הפז״ם', color: 'gold' }, { text: ' עובר ביחד', color: 'white' }])
    expect(runs.map((r) => r.text)).toEqual([' עובר ביחד', 'הפז״ם', 'גם '])
    expect(runs.every((r) => r.rtl)).toBe(true)
    expect(runs[1].color).toBe('gold')
  })
  it('retains LTR numbers and English inside a Hebrew paragraph', () => {
    const runs = visualTextRuns([{ text: 'עד מתי! — DemoApp 2026 (75%)' }])
    expect(runs.some((r) => !r.rtl && r.text.includes('DemoApp 2026'))).toBe(true)
    expect(runs.some((r) => r.rtl && r.text.includes('עד מתי'))).toBe(true)
  })
  it('keeps a question mark at the visual left of a Hebrew question', () => {
    expect(visualTextRuns([{ text: 'כמה נשאר לשחרור?' }])).toEqual([{ text: 'כמה נשאר לשחרור?', rtl: true }])
  })
})


describe('explicit paragraph direction', () => {
  it('uses automatic direction when omitted or set to auto', () => {
    const text = [{ text: 'Hello שלום!' }]
    expect(visualTextRuns(text)).toEqual(visualTextRuns(text, 'auto'))
  })
  it('changes punctuation ordering without reversing English or numbers', () => {
    const text = [{ text: 'Hello 123!' }]
    expect(visualTextRuns(text, 'ltr')).toEqual([{ text: 'Hello 123!', rtl: false }])
    const rtl = visualTextRuns(text, 'rtl')
    expect(rtl[0]).toEqual({ text: '!', rtl: true })
    expect(rtl[1]).toEqual({ text: 'Hello 123', rtl: false })
  })
})


describe('Hebrew graphemes and wrapped paragraph context', () => {
  it.each(['שָׁלוֹם', '👨‍👩‍👧‍👦', '👍🏽', '🇮🇱'])('keeps the grapheme sequence %s intact inside a styled RTL sentence', (text) => {
    const runs = visualTextRuns([{ text: 'שלום ', color: 'white' }, { text, color: 'gold' }, { text: ' שוב', color: 'white' }])
    expect(runs.filter((run) => run.color === 'gold').map((run) => run.text).join('')).toBe(text)
    expect(runs.flatMap((run) => Array.from(run.text)).sort()).toEqual(Array.from('שלום ' + text + ' שוב').sort())
  })
  it('keeps an English continuation in the RTL paragraph instead of detecting each line afresh', () => {
    const wrap = () => [[{ text: 'שלום' }], [{ text: 'Hello 123!' }]]
    const lines = visualWrappedTextLines([[{ text: 'שלום Hello 123!' }]], wrap)
    expect(lines[1]).toEqual([{ text: '!', rtl: true }, { text: 'Hello 123', rtl: false }])
  })
  it('preserves LTR paragraph context on a Hebrew continuation', () => {
    const wrap = () => [[{ text: 'Hello' }], [{ text: 'שלום!' }]]
    const lines = visualWrappedTextLines([[{ text: 'Hello שלום!' }]], wrap)
    expect(lines[1]).toEqual([{ text: 'שלום', rtl: true }, { text: '!', rtl: false }])
  })
  it('resolves explicit new paragraphs independently and keeps blank lines', () => {
    const lines = visualWrappedTextLines([[{ text: 'שלום!' }], [], [{ text: 'Hello!' }]], (line) => [line])
    expect(lines).toEqual([[{ text: 'שלום!', rtl: true }], [], [{ text: 'Hello!', rtl: false }]])
  })
  it('honors an explicit RTL base for every wrapped line', () => {
    const lines = visualWrappedTextLines([[{ text: 'Hello 123!' }]], (line) => [line], 'rtl')
    expect(lines[0]).toEqual([{ text: '!', rtl: true }, { text: 'Hello 123', rtl: false }])
  })
})
