import type { TextMark } from '@/types'

/**
 * Rich-text ↔ tag serialization for AI translation.
 *
 * Marks (styled char ranges) can't survive translation by offsets — word
 * positions change. Instead we wrap each marked range in numbered tags the
 * model must preserve around the corresponding translated words:
 *
 *   "Track your <m1>habits</m1> daily" → "Controla tus <m1>hábitos</m1> a diario"
 *
 * `parseMarkedText` then recomputes offsets for the translated string. If the
 * model mangles the tags, callers fall back to `stripMarkTags` (plain text)
 * and flag the cell so the user can re-apply formatting manually.
 *
 * The tag rules the model follows live in `src/ai/prompts.ts`.
 */

export interface SerializedMarkedText {
  /** Text with <mN>…</mN> tags (or the original text when not taggable). */
  tagged: string
  /** Clamped, sorted marks matching the tag numbering (m1 = index 0). */
  marks: TextMark[]
  /** False when there are no marks or ranges overlap (we translate plain). */
  taggable: boolean
}

/** Wrap each mark range in numbered tags. Overlapping ranges → not taggable. */
export function serializeMarkedText(text: string, marks: TextMark[] | undefined): SerializedMarkedText {
  if (!text || !marks?.length) return { tagged: text, marks: [], taggable: false }

  const clamped = marks
    .map((m) => ({
      ...m,
      start: Math.max(0, Math.min(m.start, text.length)),
      end: Math.max(0, Math.min(m.end, text.length)),
    }))
    .filter((m) => m.start < m.end)
    .sort((a, b) => a.start - b.start)
  if (clamped.length === 0) return { tagged: text, marks: [], taggable: false }

  for (let i = 1; i < clamped.length; i++) {
    if (clamped[i].start < clamped[i - 1].end) return { tagged: text, marks: [], taggable: false }
  }

  let tagged = ''
  let cursor = 0
  clamped.forEach((mark, i) => {
    tagged += text.slice(cursor, mark.start) + `<m${i + 1}>` + text.slice(mark.start, mark.end) + `</m${i + 1}>`
    cursor = mark.end
  })
  tagged += text.slice(cursor)

  return { tagged, marks: clamped, taggable: true }
}

/**
 * Parse a translated tagged string back into text + marks with recomputed
 * offsets. Style properties are copied from `sourceMarks` (same numbering as
 * `serializeMarkedText`). Returns null when tags are missing, duplicated,
 * unknown, or unbalanced — callers should fall back to plain text.
 */
export function parseMarkedText(
  tagged: string,
  sourceMarks: TextMark[],
): { text: string; marks: TextMark[] } | null {
  const tagRe = /<(\/?)m(\d+)>/g
  let plain = ''
  let lastIndex = 0
  const openAt = new Map<number, number>()
  const ranges = new Map<number, { start: number; end: number }>()

  for (let match = tagRe.exec(tagged); match !== null; match = tagRe.exec(tagged)) {
    plain += tagged.slice(lastIndex, match.index)
    lastIndex = match.index + match[0].length

    const num = Number(match[2])
    if (num < 1 || num > sourceMarks.length) return null // unknown tag
    if (match[1] === '/') {
      const start = openAt.get(num)
      if (start === undefined) return null // close before open
      ranges.set(num, { start, end: plain.length })
      openAt.delete(num)
    } else {
      if (openAt.has(num) || ranges.has(num)) return null // duplicate open
      openAt.set(num, plain.length)
    }
  }
  plain += tagged.slice(lastIndex)

  if (openAt.size > 0) return null // unclosed tag
  if (ranges.size !== sourceMarks.length) return null // missing tag pair

  const marks: TextMark[] = []
  sourceMarks.forEach((src, i) => {
    const range = ranges.get(i + 1)
    if (!range || range.start >= range.end) return // empty range → drop mark
    marks.push({
      start: range.start,
      end: range.end,
      fill: src.fill,
      fontWeight: src.fontWeight,
      italic: src.italic,
      underline: src.underline,
      strikethrough: src.strikethrough,
    })
  })
  return { text: plain, marks }
}

/** Remove any <mN> tags the model left behind (plain-text fallback). */
export function stripMarkTags(tagged: string): string {
  return tagged.replace(/<\/?m\d+>/g, '')
}
