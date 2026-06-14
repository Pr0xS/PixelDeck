import { describe, expect, it } from 'vitest'
import { parseMarkedText, serializeMarkedText, stripMarkTags } from './markedText'
import type { TextMark } from '@/types'

const bold: Pick<TextMark, 'fontWeight'> = { fontWeight: 700 }

describe('serializeMarkedText', () => {
  it('wraps mark ranges in numbered tags', () => {
    const text = 'Track your habits daily'
    const marks: TextMark[] = [{ start: 11, end: 17, ...bold }]
    const result = serializeMarkedText(text, marks)
    expect(result.taggable).toBe(true)
    expect(result.tagged).toBe('Track your <m1>habits</m1> daily')
  })

  it('numbers multiple marks in position order', () => {
    const text = 'One two three'
    const marks: TextMark[] = [
      { start: 8, end: 13, italic: true },
      { start: 0, end: 3, ...bold },
    ]
    const result = serializeMarkedText(text, marks)
    expect(result.tagged).toBe('<m1>One</m1> two <m2>three</m2>')
    // marks re-sorted to match numbering
    expect(result.marks[0].fontWeight).toBe(700)
    expect(result.marks[1].italic).toBe(true)
  })

  it('is not taggable without marks or with empty text', () => {
    expect(serializeMarkedText('Hello', undefined).taggable).toBe(false)
    expect(serializeMarkedText('Hello', []).taggable).toBe(false)
    expect(serializeMarkedText('', [{ start: 0, end: 1 }]).taggable).toBe(false)
  })

  it('falls back to plain on overlapping marks', () => {
    const marks: TextMark[] = [
      { start: 0, end: 5, ...bold },
      { start: 3, end: 8, italic: true },
    ]
    expect(serializeMarkedText('Overlapping', marks).taggable).toBe(false)
  })

  it('clamps out-of-range marks and drops empty ones', () => {
    const text = 'Short'
    const marks: TextMark[] = [
      { start: 2, end: 99, ...bold },
      { start: 50, end: 60, italic: true },
    ]
    const result = serializeMarkedText(text, marks)
    expect(result.taggable).toBe(true)
    expect(result.tagged).toBe('Sh<m1>ort</m1>')
    expect(result.marks).toHaveLength(1)
  })
})

describe('parseMarkedText', () => {
  const source: TextMark[] = [{ start: 11, end: 17, ...bold }]

  it('recomputes offsets for the translated text', () => {
    const parsed = parseMarkedText('Controla tus <m1>hábitos</m1> a diario', source)
    expect(parsed).not.toBeNull()
    expect(parsed!.text).toBe('Controla tus hábitos a diario')
    expect(parsed!.marks).toEqual([{ start: 13, end: 20, fontWeight: 700, fill: undefined, italic: undefined, underline: undefined, strikethrough: undefined }])
  })

  it('handles reordered tags (word order changes)', () => {
    const marks: TextMark[] = [
      { start: 0, end: 3, ...bold },
      { start: 8, end: 13, italic: true },
    ]
    const parsed = parseMarkedText('<m2>Drei</m2> zwei <m1>eins</m1>', marks)
    expect(parsed).not.toBeNull()
    expect(parsed!.text).toBe('Drei zwei eins')
    const boldMark = parsed!.marks.find((m) => m.fontWeight === 700)
    const italicMark = parsed!.marks.find((m) => m.italic)
    expect(parsed!.text.slice(boldMark!.start, boldMark!.end)).toBe('eins')
    expect(parsed!.text.slice(italicMark!.start, italicMark!.end)).toBe('Drei')
  })

  it('returns null when a tag pair is missing', () => {
    expect(parseMarkedText('No tags here', source)).toBeNull()
  })

  it('returns null on unclosed tags', () => {
    expect(parseMarkedText('Hola <m1>mundo', source)).toBeNull()
  })

  it('returns null on unknown tag numbers', () => {
    expect(parseMarkedText('Hola <m7>mundo</m7>', source)).toBeNull()
  })

  it('returns null on duplicated tags', () => {
    expect(parseMarkedText('<m1>a</m1> <m1>b</m1>', source)).toBeNull()
  })

  it('drops marks whose translated range is empty', () => {
    const parsed = parseMarkedText('Hola <m1></m1>mundo', source)
    expect(parsed).not.toBeNull()
    expect(parsed!.marks).toHaveLength(0)
  })

  it('round-trips through serialize → parse', () => {
    const text = 'Make it pop with bold and style'
    const marks: TextMark[] = [
      { start: 17, end: 21, ...bold },
      { start: 26, end: 31, italic: true, fill: '#ff0000' },
    ]
    const { tagged, marks: sorted } = serializeMarkedText(text, marks)
    const parsed = parseMarkedText(tagged, sorted)
    expect(parsed!.text).toBe(text)
    expect(parsed!.text.slice(parsed!.marks[0].start, parsed!.marks[0].end)).toBe('bold')
    expect(parsed!.text.slice(parsed!.marks[1].start, parsed!.marks[1].end)).toBe('style')
    expect(parsed!.marks[1].fill).toBe('#ff0000')
  })
})

describe('stripMarkTags', () => {
  it('removes all mark tags', () => {
    expect(stripMarkTags('Hola <m1>mundo</m1> y <m2>más</m2>')).toBe('Hola mundo y más')
  })
  it('leaves other content intact', () => {
    expect(stripMarkTags('No tags <b>here</b>')).toBe('No tags <b>here</b>')
  })
})
