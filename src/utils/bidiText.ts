import bidiFactory from 'bidi-js'
import type { TextDirection } from '@/types'

const bidi = bidiFactory()

export function hasRtlText(text: string): boolean {
  return /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufefc]/u.test(text)
}

/** Resolve embedding levels for the complete paragraph, then reorder each wrapped line. */
export function visualWrappedTextLines<T extends { text: string }>(
  paragraphs: T[][],
  wrap: (paragraph: T[]) => T[][],
  direction: TextDirection = 'auto',
): (T & { rtl: boolean })[][] {
  return paragraphs.flatMap((paragraph) => {
    const text = paragraph.map((fragment) => fragment.text).join('')
    const embedding = bidi.getEmbeddingLevels(text, direction === 'rtl' || direction === 'ltr' ? direction : undefined)
    let cursor = 0
    return wrap(paragraph).map((line) => {
      const lineText = line.map((fragment) => fragment.text).join('')
      const start = text.indexOf(lineText, cursor)
      if (start < 0) throw new Error('Wrapped bidi line must preserve its logical paragraph text')
      cursor = start + lineText.length
      return visualRuns(line, text, embedding, start)
    })
  })
}

export function visualTextRuns<T extends { text: string }>(fragments: T[], direction: TextDirection = 'auto'): (T & { rtl: boolean })[] {
  return visualWrappedTextLines([fragments], (line) => [line], direction)[0]
}

function visualRuns<T extends { text: string }>(
  fragments: T[], text: string, embedding: ReturnType<typeof bidi.getEmbeddingLevels>, start: number,
): (T & { rtl: boolean })[] {
  const length = fragments.reduce((sum, fragment) => sum + fragment.text.length, 0)
  if (length === 0) return []
  const indices = Array.from({ length }, (_, i) => i)
  for (const [from, to] of bidi.getReorderSegments(text, embedding, start, start + length - 1)) {
    const localStart = from - start
    const localEnd = to - start
    indices.splice(localStart, localEnd - localStart + 1, ...indices.slice(localStart, localEnd + 1).reverse())
  }
  const owners = fragments.flatMap((f, owner) => Array(f.text.length).fill(owner) as number[])
  const runs: (T & { rtl: boolean })[] = []
  for (let i = 0; i < indices.length;) {
    const first = indices[i]
    const owner = owners[first]
    const level = embedding.levels[start + first]
    const rtl = (level & 1) === 1
    let last = first
    let j = i + 1
    while (j < indices.length && owners[indices[j]] === owner
      && embedding.levels[start + indices[j]] === level && indices[j] === last + (rtl ? -1 : 1)) {
      last = indices[j++]
    }
    runs.push({ ...fragments[owner], text: text.slice(start + Math.min(first, last), start + Math.max(first, last) + 1), rtl })
    i = j
  }
  return runs
}
