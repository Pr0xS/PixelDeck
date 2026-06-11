import type { TextMark, FillValue } from '@/types'
import { fillToCss } from '@/utils/gradients'

// ─────────────────────────────────────────────────────────────────────────────
// Rich text mark utilities.
//
// Pure functions (segmentMarks / normalizeMarks / applyMarkStyle / getRangeStyle)
// operate on TextMark[] and are unit-testable in a node environment.
//
// DOM functions (marksToHtml / readEditorDom / parseEditorDom / selection
// helpers) power the WYSIWYG editor in the properties panel and require a
// browser environment.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Style model ──────────────────────────────────────────────────────────────

export interface MarkStyle {
  fill?: FillValue
  fontWeight?: number
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
}

/** Patch applied to a range: a value sets the override, `null` removes it. */
export type StylePatch = { [K in keyof MarkStyle]?: MarkStyle[K] | null }

const STYLE_KEYS = ['fill', 'fontWeight', 'italic', 'underline', 'strikethrough'] as const

function styleOf(mark: TextMark): MarkStyle {
  const s: MarkStyle = {}
  for (const k of STYLE_KEYS) {
    if (mark[k] !== undefined) (s as Record<string, unknown>)[k] = mark[k]
  }
  return s
}

export function isEmptyStyle(s: MarkStyle): boolean {
  return STYLE_KEYS.every((k) => s[k] === undefined)
}

function sameStyle(a: MarkStyle, b: MarkStyle): boolean {
  return STYLE_KEYS.every((k) => JSON.stringify(a[k] ?? null) === JSON.stringify(b[k] ?? null))
}

// ─── Segmentation ─────────────────────────────────────────────────────────────

export interface StyledSegment {
  start: number
  end: number
  style: MarkStyle
}

/**
 * Flatten (possibly overlapping) marks into ordered, non-overlapping segments
 * covering [0, textLength). Later marks override earlier ones per property —
 * same resolution rule as the canvas renderer (marksToLines).
 * Unstyled gaps are included as segments with an empty style.
 */
export function segmentMarks(
  marks: TextMark[],
  textLength: number,
  extraBoundaries: number[] = [],
): StyledSegment[] {
  if (textLength <= 0) return []

  const bounds = new Set<number>([0, textLength])
  for (const m of marks) {
    const s = Math.max(0, Math.min(m.start, textLength))
    const e = Math.max(0, Math.min(m.end, textLength))
    if (s < e) {
      bounds.add(s)
      bounds.add(e)
    }
  }
  for (const b of extraBoundaries) {
    if (b > 0 && b < textLength) bounds.add(b)
  }
  const sorted = [...bounds].sort((a, b) => a - b)

  const segments: StyledSegment[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i]
    const end = sorted[i + 1]
    const covering = marks.filter((m) => m.start <= start && m.end >= end)
    const style: MarkStyle = {}
    for (const k of STYLE_KEYS) {
      const v = covering.reduce<MarkStyle[typeof k]>(
        (acc, m) => (m[k] !== undefined ? (m[k] as never) : acc),
        undefined,
      )
      if (v !== undefined) (style as Record<string, unknown>)[k] = v
    }
    segments.push({ start, end, style })
  }
  return segments
}

/** Merge adjacent segments with identical styles and drop unstyled ones → canonical marks. */
function segmentsToMarks(segments: StyledSegment[]): TextMark[] {
  const marks: TextMark[] = []
  for (const seg of segments) {
    if (isEmptyStyle(seg.style)) continue
    const prev = marks[marks.length - 1]
    if (prev && prev.end === seg.start && sameStyle(styleOf(prev), seg.style)) {
      prev.end = seg.end
    } else {
      marks.push({ start: seg.start, end: seg.end, ...seg.style })
    }
  }
  return marks
}

/**
 * Canonicalize marks: clamp to text length, resolve overlaps (later wins),
 * drop empty ranges/styles, merge adjacent equal styles, sort ascending.
 */
export function normalizeMarks(marks: TextMark[], textLength: number): TextMark[] {
  return segmentsToMarks(segmentMarks(marks, textLength))
}

// ─── Range styling operations ─────────────────────────────────────────────────

/**
 * Apply a style patch to [start, end). Patch values set overrides; `null`
 * removes the override (range falls back to the layer default).
 * Returns canonical (normalized) marks.
 */
export function applyMarkStyle(
  marks: TextMark[],
  textLength: number,
  start: number,
  end: number,
  patch: StylePatch,
): TextMark[] {
  const s = Math.max(0, Math.min(start, textLength))
  const e = Math.max(0, Math.min(end, textLength))
  if (s >= e) return normalizeMarks(marks, textLength)

  const segments = segmentMarks(marks, textLength, [s, e])
  for (const seg of segments) {
    if (seg.start >= s && seg.end <= e) {
      for (const k of STYLE_KEYS) {
        const v = patch[k]
        if (v === undefined) continue
        if (v === null) delete seg.style[k]
        else (seg.style as Record<string, unknown>)[k] = v
      }
    }
  }
  return segmentsToMarks(segments)
}

/** Remove ALL style overrides in [start, end). */
export function clearMarkStyle(
  marks: TextMark[],
  textLength: number,
  start: number,
  end: number,
): TextMark[] {
  return applyMarkStyle(marks, textLength, start, end, {
    fill: null,
    fontWeight: null,
    italic: null,
    underline: null,
    strikethrough: null,
  })
}

/** Resolved style of a range — per property: the uniform value, or 'mixed'. */
export interface RangeStyle {
  fill: FillValue | 'mixed'
  fontWeight: number | 'mixed'
  italic: boolean | 'mixed'
  underline: boolean | 'mixed'
  strikethrough: boolean | 'mixed'
}

/**
 * Compute the effective style of [start, end) resolved against the layer
 * defaults. For a collapsed range (caret) the style at `start` is returned.
 */
export function getRangeStyle(
  marks: TextMark[],
  textLength: number,
  start: number,
  end: number,
  defaults: Required<Pick<MarkStyle, 'fill' | 'fontWeight'>> &
    Pick<MarkStyle, 'italic' | 'underline' | 'strikethrough'>,
): RangeStyle {
  const s = Math.max(0, Math.min(start, textLength))
  const e = Math.max(s, Math.min(end, textLength))
  const probeEnd = e === s ? Math.min(s + 1, textLength) : e

  const base: RangeStyle = {
    fill: defaults.fill,
    fontWeight: defaults.fontWeight,
    italic: defaults.italic ?? false,
    underline: defaults.underline ?? false,
    strikethrough: defaults.strikethrough ?? false,
  }
  if (textLength === 0 || probeEnd <= s) return base

  const segments = segmentMarks(marks, textLength, [s, probeEnd]).filter(
    (seg) => seg.start < probeEnd && seg.end > s,
  )

  const result = { ...base }
  let first = true
  for (const seg of segments) {
    const effective: RangeStyle = {
      fill: seg.style.fill ?? defaults.fill,
      fontWeight: seg.style.fontWeight ?? defaults.fontWeight,
      italic: seg.style.italic ?? defaults.italic ?? false,
      underline: seg.style.underline ?? defaults.underline ?? false,
      strikethrough: seg.style.strikethrough ?? defaults.strikethrough ?? false,
    }
    if (first) {
      Object.assign(result, effective)
      first = false
      continue
    }
    for (const k of STYLE_KEYS) {
      if (JSON.stringify(result[k]) !== JSON.stringify(effective[k])) {
        ;(result as Record<string, unknown>)[k] = 'mixed'
      }
    }
  }
  return result
}

// ─── Color helpers ────────────────────────────────────────────────────────────

/** Convert a CSS color (rgb()/rgba()/#hex) to #rrggbb. Returns null when unparseable. */
export function cssColorToHex(value: string): string | null {
  const v = value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toLowerCase()
  }
  const m = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (!m) return null
  const to2 = (n: string) => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, '0')
  return `#${to2(m[1])}${to2(m[2])}${to2(m[3])}`
}

// ─── DOM: serialization ───────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function styleToCss(style: MarkStyle): string {
  const css: string[] = []
  if (style.fill !== undefined) {
    if (typeof style.fill === 'string') {
      css.push(`color: ${style.fill}`)
    } else {
      // Gradient preview: paint the gradient through the glyphs.
      css.push(`background-image: ${fillToCss(style.fill)}`)
      css.push('-webkit-background-clip: text')
      css.push('background-clip: text')
      css.push('color: transparent')
      css.push('-webkit-text-fill-color: transparent')
    }
  }
  if (style.fontWeight !== undefined) css.push(`font-weight: ${style.fontWeight}`)
  if (style.italic !== undefined) css.push(`font-style: ${style.italic ? 'italic' : 'normal'}`)
  if (style.underline !== undefined || style.strikethrough !== undefined) {
    const parts = [style.underline ? 'underline' : '', style.strikethrough ? 'line-through' : '']
      .filter(Boolean)
      .join(' ')
    css.push(`text-decoration: ${parts || 'none'}`)
  }
  return css.join('; ')
}

/**
 * Serialize text + marks to editor HTML.
 * Model: '\n' → <br>; if the text ends with '\n' an extra placeholder <br> is
 * appended so the trailing empty line is visible/caret-able in contentEditable.
 * Styled runs become <span> with presentational CSS plus a data-mark attribute
 * carrying the exact style JSON for lossless round-trips.
 */
export function marksToHtml(text: string, marks: TextMark[]): string {
  if (!text) return ''
  const segments = segmentMarks(normalizeMarks(marks, text.length), text.length)
  let html = ''
  for (const seg of segments) {
    const inner = escapeHtml(text.slice(seg.start, seg.end)).replaceAll('\n', '<br>')
    if (isEmptyStyle(seg.style)) {
      html += inner
    } else {
      const dataMark = escapeHtml(JSON.stringify(seg.style))
      html += `<span style="${escapeHtml(styleToCss(seg.style))}" data-mark="${dataMark}">${inner}</span>`
    }
  }
  if (text.endsWith('\n')) html += '<br>'
  return html
}

// ─── DOM: parsing ─────────────────────────────────────────────────────────────

const BLOCK_TAGS = new Set(['DIV', 'P', 'LI', 'UL', 'OL', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'])

function styleFromElement(el: HTMLElement, inherited: MarkStyle): MarkStyle {
  // Exact style from our own serializer
  const dataMark = el.getAttribute('data-mark')
  if (dataMark) {
    try {
      return { ...inherited, ...(JSON.parse(dataMark) as MarkStyle) }
    } catch {
      /* fall through to heuristic parsing */
    }
  }

  const style: MarkStyle = { ...inherited }
  const tag = el.tagName
  if (tag === 'B' || tag === 'STRONG') style.fontWeight = 700
  if (tag === 'I' || tag === 'EM') style.italic = true
  if (tag === 'U') style.underline = true
  if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') style.strikethrough = true

  const inline = el.style
  if (inline) {
    if (inline.color) {
      const hex = cssColorToHex(inline.color)
      if (hex) style.fill = hex
    }
    if (inline.fontWeight) {
      const w = inline.fontWeight === 'bold' ? 700 : inline.fontWeight === 'normal' ? 400 : Number(inline.fontWeight)
      if (!Number.isNaN(w)) style.fontWeight = w
    }
    if (inline.fontStyle === 'italic') style.italic = true
    else if (inline.fontStyle === 'normal') style.italic = false
    const deco = inline.textDecoration || inline.textDecorationLine
    if (deco) {
      if (deco.includes('underline')) style.underline = true
      if (deco.includes('line-through')) style.strikethrough = true
      if (deco.includes('none')) {
        style.underline = false
        style.strikethrough = false
      }
    }
  }
  return style
}

interface EditorItem {
  node: Node
  start: number
  len: number
}

export interface EditorModel {
  text: string
  marks: TextMark[]
  items: EditorItem[]
}

/**
 * Read the editor DOM into the text model. Single source of truth for the
 * text-offset mapping used by parsing AND selection computation.
 */
export function readEditorDom(root: HTMLElement): EditorModel {
  let text = ''
  const marks: TextMark[] = []
  const items: EditorItem[] = []

  const visit = (node: Node, style: MarkStyle) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const data = (node as Text).data
      items.push({ node, start: text.length, len: data.length })
      if (data.length > 0 && !isEmptyStyle(style)) {
        marks.push({ start: text.length, end: text.length + data.length, ...style })
      }
      text += data
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as HTMLElement

    if (el.tagName === 'BR') {
      // A <br> that is the only content of a block (or of the root) is a
      // placeholder for an empty line, not a newline character.
      const parent = el.parentNode
      const isLonePlaceholder =
        parent != null &&
        (parent === root || BLOCK_TAGS.has((parent as HTMLElement).tagName)) &&
        parent.childNodes.length === 1
      if (isLonePlaceholder) {
        items.push({ node: el, start: text.length, len: 0 })
        return
      }
      items.push({ node: el, start: text.length, len: 1 })
      text += '\n'
      return
    }

    if (BLOCK_TAGS.has(el.tagName) && text.length > 0) {
      text += '\n'
    }
    const childStyle = styleFromElement(el, style)
    for (const child of [...el.childNodes]) visit(child, childStyle)
  }

  for (const child of [...root.childNodes]) visit(child, {})

  // Trailing placeholder <br>: when the text already ends with '\n', the final
  // <br> only makes that empty line visible — it is not an extra newline.
  const last = items[items.length - 1]
  if (
    last &&
    last.len === 1 &&
    (last.node as HTMLElement).tagName === 'BR' &&
    text.endsWith('\n\n')
  ) {
    text = text.slice(0, -1)
    last.len = 0
  }

  return { text, marks: normalizeMarks(marks, text.length), items }
}

/** Parse editor DOM → canonical { text, marks }. */
export function parseEditorDom(root: HTMLElement): { text: string; marks: TextMark[] } {
  const { text, marks } = readEditorDom(root)
  return { text, marks }
}

// ─── DOM: selection mapping ───────────────────────────────────────────────────

function pointToOffset(root: HTMLElement, model: EditorModel, container: Node, offset: number): number {
  if (!root.contains(container)) return model.text.length
  const probe = document.createRange()
  for (const item of model.items) {
    if (item.node === container) return item.start + Math.min(offset, item.len)
    if (item.node.nodeType === Node.TEXT_NODE) probe.selectNodeContents(item.node)
    else probe.selectNode(item.node)
    // Point earlier in document order than this item → resolves to item start.
    try {
      if (probe.comparePoint(container, offset) <= 0) return item.start
    } catch {
      /* comparePoint can throw on detached nodes — skip */
    }
  }
  return model.text.length
}

/** Current DOM selection → text offsets within the editor, or null when outside. */
export function domSelectionToOffsets(root: HTMLElement): { start: number; end: number } | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null
  const model = readEditorDom(root)
  const start = pointToOffset(root, model, range.startContainer, range.startOffset)
  const end = pointToOffset(root, model, range.endContainer, range.endOffset)
  return { start: Math.min(start, end), end: Math.max(start, end) }
}

function offsetToPoint(root: HTMLElement, model: EditorModel, offset: number): { node: Node; offset: number } {
  for (const item of model.items) {
    if (offset <= item.start + item.len && item.len > 0) {
      if (item.node.nodeType === Node.TEXT_NODE) {
        return { node: item.node, offset: Math.max(0, offset - item.start) }
      }
      // <br>: position the caret in the parent, before/after the element
      const parent = item.node.parentNode!
      const idx = [...parent.childNodes].indexOf(item.node as ChildNode)
      return { node: parent, offset: offset > item.start ? idx + 1 : idx }
    }
  }
  return { node: root, offset: root.childNodes.length }
}

/** Restore a text-offset selection in the editor DOM (used after re-rendering HTML). */
export function setDomSelection(root: HTMLElement, start: number, end: number): void {
  const model = readEditorDom(root)
  const s = offsetToPoint(root, model, Math.max(0, Math.min(start, model.text.length)))
  const e = offsetToPoint(root, model, Math.max(0, Math.min(end, model.text.length)))
  const sel = window.getSelection()
  if (!sel) return
  const range = document.createRange()
  range.setStart(s.node, s.offset)
  range.setEnd(e.node, e.offset)
  sel.removeAllRanges()
  sel.addRange(range)
}
