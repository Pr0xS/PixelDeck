import type { TextLayer, TextMark, FillValue } from '@/types'
import { createCanvasGradient } from '@/utils/gradients'
import { segmentMarks } from '@/utils/richText'

/** Default text box width (px) when a TextLayer has no explicit `width`. */
export const DEFAULT_TEXT_WIDTH = 1000

// ─── Internal types ───────────────────────────────────────────────────────────

interface ResolvedFragment {
  text: string
  fill: FillValue
  weight: number
  italic: boolean
  underline: boolean
  strikethrough: boolean
}

interface PositionedFragment extends ResolvedFragment {
  x: number
  width: number
}

interface LayoutLine {
  fragments: PositionedFragment[]
  totalWidth: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildFontString(weight: number, italic: boolean, fontSize: number, fontFamily: string): string {
  return `${italic ? 'italic ' : ''}${weight} ${fontSize}px "${fontFamily}"`
}

/**
 * Measure rendered pixel-width of `text` including letterSpacing.
 * Assumes ctx.font is already set.
 */
export function makeMeasureCache(
  measure: (font: string, text: string) => number,
  limit = 2000,
): (font: string, text: string) => number {
  const cache = new Map<string, number>()
  const maxSize = Math.max(1, limit)

  return (font, text) => {
    const key = `${font.length}:${font}${text}`
    const cached = cache.get(key)
    if (cached !== undefined) {
      cache.delete(key)
      cache.set(key, cached)
      return cached
    }

    const width = measure(font, text)
    cache.set(key, width)
    if (cache.size > maxSize) cache.delete(cache.keys().next().value!)
    return width
  }
}

function measureWidth(
  font: string,
  text: string,
  letterSpacing: number,
  measure: (font: string, text: string) => number,
): number {
  if (!text) return 0
  if (letterSpacing === 0) return measure(font, text)
  let w = 0
  for (const char of text) {
    w += measure(font, char) + letterSpacing
  }
  return Math.max(0, w - letterSpacing)
}

// ─── Marks → Fragments ────────────────────────────────────────────────────────

/**
 * Convert a TextLayer's `marks` (or legacy `spans`) into an ordered list of
 * ResolvedFragments split on \n. Returns an array-of-arrays where each inner
 * array is one visual line.
 */
export function layerToLines(layer: TextLayer): ResolvedFragment[][] {
  const {
    text,
    fill: layerFill,
    fontWeight: layerWeight,
    italic: layerItalic = false,
    underline: layerUnderline = false,
    strikethrough: layerStrikethrough = false,
  } = layer

  // ── Build flat fragment list from marks (preferred) ───────────────────────
  if ((layer.marks?.length ?? 0) > 0) {
    return marksToLines(text, layer.marks!, {
      fill: layerFill,
      weight: layerWeight,
      italic: layerItalic,
      underline: layerUnderline,
      strikethrough: layerStrikethrough,
    })
  }

  // ── Legacy spans fallback ─────────────────────────────────────────────────
  if ((layer.spans?.length ?? 0) > 0) {
    const lines: ResolvedFragment[][] = [[]]
    for (const span of layer.spans!) {
      const fill = span.fill ?? layerFill
      const weight = span.fontWeight ?? layerWeight
      const italic = span.italic ?? layerItalic
      const underline = span.underline ?? layerUnderline
      const strikethrough = span.strikethrough ?? layerStrikethrough
      const parts = span.text.split('\n')
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) lines.push([])
        const t = parts[i]
        if (t.length > 0) {
          lines[lines.length - 1].push({ text: t, fill, weight, italic, underline, strikethrough })
        }
      }
    }
    return lines
  }

  // ── Plain text fallback (no marks, no spans) ──────────────────────────────
  const lines: ResolvedFragment[][] = [[]]
  const parts = text.split('\n')
  for (let i = 0; i < parts.length; i++) {
    if (i > 0) lines.push([])
    if (parts[i].length > 0) {
      lines[lines.length - 1].push({
        text: parts[i],
        fill: layerFill,
        weight: layerWeight,
        italic: layerItalic,
        underline: layerUnderline,
        strikethrough: layerStrikethrough,
      })
    }
  }
  return lines
}

interface LayerDefaults {
  fill: FillValue
  weight: number
  italic: boolean
  underline: boolean
  strikethrough: boolean
}

function marksToLines(
  text: string,
  marks: TextMark[],
  defaults: LayerDefaults,
): ResolvedFragment[][] {
  if (!text) return [[]]

  const lines: ResolvedFragment[][] = [[]]
  for (const segment of segmentMarks(marks, text.length)) {
    const segText = text.slice(segment.start, segment.end)
    if (!segText) continue

    const fill = segment.style.fill ?? defaults.fill
    const weight = segment.style.fontWeight ?? defaults.weight
    const italic = segment.style.italic ?? defaults.italic
    const underline = segment.style.underline ?? defaults.underline
    const strikethrough = segment.style.strikethrough ?? defaults.strikethrough

    // Split on \n within the segment
    const parts = segText.split('\n')
    for (let j = 0; j < parts.length; j++) {
      if (j > 0) lines.push([])
      if (parts[j].length > 0) {
        lines[lines.length - 1].push({ text: parts[j], fill, weight, italic, underline, strikethrough })
      }
    }
  }

  return lines
}

// ─── Word wrapping ────────────────────────────────────────────────────────────

function isWhitespace(s: string): boolean {
  return /^\s+$/.test(s)
}

function sameFragStyle(a: { text: string }, b: { text: string }): boolean {
  const ka = { ...a, text: '' }
  const kb = { ...b, text: '' }
  return JSON.stringify(ka) === JSON.stringify(kb)
}

/**
 * Word-wrap styled fragment lines to fit maxWidth.
 * Pure: measurement is injected, so this is unit-testable without a DOM.
 * - Breaks at whitespace; words longer than maxWidth are hard-broken by character.
 * - Leading whitespace on wrapped lines and trailing whitespace before a break
 *   are dropped (keeps center/right alignment correct).
 * - Adjacent pieces with the same style are merged back together.
 */
export function wrapFragmentLines<T extends { text: string }>(
  lines: T[][],
  maxWidth: number,
  measure: (text: string, frag: T) => number,
): T[][] {
  const out: T[][] = []

  for (const line of lines) {
    let current: T[] = []
    let currentW = 0
    let wrapped = false // true when `current` is a continuation line

    const append = (frag: T, text: string) => {
      const last = current[current.length - 1]
      if (last && sameFragStyle(last, frag)) last.text += text
      else current.push({ ...frag, text })
    }

    const pushLine = () => {
      // Trim trailing whitespace pieces
      while (current.length > 0) {
        const last = current[current.length - 1]
        const trimmed = last.text.replace(/\s+$/, '')
        if (trimmed === last.text) break
        if (trimmed.length === 0) current.pop()
        else { last.text = trimmed; break }
      }
      out.push(current)
      current = []
      currentW = 0
      wrapped = true
    }

    for (const frag of line) {
      const tokens = frag.text.match(/\S+|\s+/g) ?? []
      for (const token of tokens) {
        if (isWhitespace(token)) {
          // Skip leading whitespace on continuation lines
          if (wrapped && current.length === 0) continue
          append(frag, token)
          currentW += measure(token, frag)
          continue
        }

        const w = measure(token, frag)
        if (currentW + w > maxWidth && current.length > 0) pushLine()

        if (w > maxWidth) {
          // Hard-break an overlong word character by character
          let rest = token
          while (rest.length > 1 && measure(rest, frag) > maxWidth) {
            let n = rest.length - 1
            while (n > 1 && measure(rest.slice(0, n), frag) > maxWidth) n--
            append(frag, rest.slice(0, n))
            pushLine()
            rest = rest.slice(n)
          }
          append(frag, rest)
          currentW = measure(rest, frag)
          continue
        }

        append(frag, token)
        currentW += w
      }
    }
    out.push(current)
  }

  return out
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Renders a TextLayer's rich text to an off-screen HTMLCanvasElement.
 * Uses `marks` when present, falls back to legacy `spans`, then plain `text`.
 * The canvas is sized to (layer.width ?? DEFAULT_TEXT_WIDTH) × computed-height.
 */
export function renderSpansToCanvas(layer: TextLayer): HTMLCanvasElement {
  const { fontSize, fontFamily, letterSpacing, lineHeight, align } = layer
  const canvasWidth = Math.max(1, layer.width ?? DEFAULT_TEXT_WIDTH)
  const lineHeightPx = fontSize * lineHeight

  // ── Measure setup ─────────────────────────────────────────────────────────
  const measureCanvas = document.createElement('canvas')
  const mc = measureCanvas.getContext('2d')!
  const measureText = makeMeasureCache((font, text) => {
    mc.font = font
    return mc.measureText(text).width
  })
  const measureFrag = (text: string, frag: ResolvedFragment) => {
    const font = buildFontString(frag.weight, frag.italic, fontSize, fontFamily)
    return measureWidth(font, text, letterSpacing, measureText)
  }

  // ── Resolve lines and word-wrap them to the box width ─────────────────────
  const lines = wrapFragmentLines(layerToLines(layer), canvasWidth, measureFrag)

  const layoutLines: LayoutLine[] = lines.map((lineFragments) => {
    let x = 0
    const fragments: PositionedFragment[] = lineFragments.map((frag) => {
      const font = buildFontString(frag.weight, frag.italic, fontSize, fontFamily)
      const w = measureWidth(font, frag.text, letterSpacing, measureText)
      const positioned: PositionedFragment = { ...frag, x, width: w }
      x += w
      return positioned
    })
    return { fragments, totalWidth: x }
  })

  // ── Size render canvas ────────────────────────────────────────────────────
  const contentHeight = Math.ceil(lineHeightPx * layoutLines.length + fontSize * 0.25)
  const totalHeight = Math.round(layer.height ?? contentHeight)
  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = Math.max(1, totalHeight)
  const ctx = canvas.getContext('2d')!
  ctx.textBaseline = 'alphabetic'

  // Vertical alignment inside an explicit-height box (top = no offset).
  // When content is taller than the box it stays top-anchored and clips.
  let yOffset = 0
  if (layer.height != null) {
    const va = layer.verticalAlign ?? 'top'
    if (va === 'middle') yOffset = Math.max(0, (totalHeight - contentHeight) / 2)
    else if (va === 'bottom') yOffset = Math.max(0, totalHeight - contentHeight)
  }

  // ── Render each line ──────────────────────────────────────────────────────
  layoutLines.forEach((line, lineIndex) => {
    const baseline = yOffset + lineIndex * lineHeightPx + fontSize * 0.9

    let lineStartX = 0
    if (align === 'center') lineStartX = (canvasWidth - line.totalWidth) / 2
    else if (align === 'right') lineStartX = canvasWidth - line.totalWidth

    line.fragments.forEach((frag) => {
      const fragX = lineStartX + frag.x
      const fragY = yOffset + lineIndex * lineHeightPx

      ctx.font = buildFontString(frag.weight, frag.italic, fontSize, fontFamily)

      ctx.fillStyle = createCanvasGradient(ctx, frag.fill, fragX, fragY, frag.width, lineHeightPx)

      if (letterSpacing === 0) {
        ctx.fillText(frag.text, fragX, baseline)
      } else {
        let xPos = fragX
        for (const char of frag.text) {
          ctx.fillText(char, xPos, baseline)
          xPos += measureText(ctx.font, char) + letterSpacing
        }
      }

      if (frag.underline || frag.strikethrough) {
        const solidColor =
          typeof frag.fill === 'string' ? frag.fill : (frag.fill.stops[0]?.color ?? '#ffffff')
        ctx.save()
        ctx.strokeStyle = solidColor
        ctx.lineWidth = Math.max(1, Math.round(fontSize / 18))
        ctx.lineCap = 'round'
        if (frag.underline) {
          const lineY = baseline + Math.round(fontSize * 0.12)
          ctx.beginPath()
          ctx.moveTo(fragX, lineY)
          ctx.lineTo(fragX + frag.width, lineY)
          ctx.stroke()
        }
        if (frag.strikethrough) {
          const lineY = baseline - Math.round(fontSize * 0.33)
          ctx.beginPath()
          ctx.moveTo(fragX, lineY)
          ctx.lineTo(fragX + frag.width, lineY)
          ctx.stroke()
        }
        ctx.restore()
      }
    })
  })

  return canvas
}

/**
 * Stable cache key for a TextLayer's rich-text rendering.
 * Any change to a rendering-relevant property yields a different key.
 */
export function spansRenderKey(layer: TextLayer): string {
  const hasRich = (layer.marks?.length ?? 0) > 0 || (layer.spans?.length ?? 0) > 0
  if (!hasRich) return ''

  const marksStr = (layer.marks ?? [])
    .map(
      (m) =>
        `${m.start}-${m.end}|${JSON.stringify(m.fill ?? '')}|${m.fontWeight ?? ''}|${m.italic ?? ''}|${m.underline ?? ''}|${m.strikethrough ?? ''}`,
    )
    .join('§')

  const spansStr = (layer.spans ?? [])
    .map(
      (s) =>
        `${s.text}|${JSON.stringify(s.fill ?? '')}|${s.fontWeight ?? ''}|${s.italic ?? ''}|${s.underline ?? ''}|${s.strikethrough ?? ''}`,
    )
    .join('§')

  return [
    layer.text,
    marksStr,
    spansStr,
    layer.fontSize,
    layer.fontFamily,
    layer.fontWeight,
    JSON.stringify(layer.fill),
    layer.lineHeight,
    layer.letterSpacing,
    layer.width ?? DEFAULT_TEXT_WIDTH,
    layer.height ?? 'auto',
    layer.verticalAlign ?? 'top',
    layer.align,
    layer.italic ?? false,
    layer.underline ?? false,
    layer.strikethrough ?? false,
  ].join('|')
}

// ─── Migration helper ─────────────────────────────────────────────────────────

/**
 * Convert legacy TextSpan[] to TextMark[] using the concatenated span texts
 * as the source-of-truth string. Returns null when no migration is needed.
 */
export function spansToMarks(
  spans: NonNullable<TextLayer['spans']>,
): { text: string; marks: TextMark[] } {
  let offset = 0
  const marks: TextMark[] = []
  const textParts: string[] = []

  for (const span of spans) {
    textParts.push(span.text)
    const end = offset + span.text.length
    const hasStyle =
      span.fill !== undefined ||
      span.fontWeight !== undefined ||
      span.italic !== undefined ||
      span.underline !== undefined ||
      span.strikethrough !== undefined
    if (hasStyle) {
      marks.push({
        start: offset,
        end,
        fill: span.fill,
        fontWeight: span.fontWeight,
        italic: span.italic,
        underline: span.underline,
        strikethrough: span.strikethrough,
      })
    }
    offset = end
  }

  return { text: textParts.join(''), marks }
}
