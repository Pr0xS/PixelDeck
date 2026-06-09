import type { TextLayer, FillValue } from '@/types'
import { createCanvasGradient } from '@/utils/gradients'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ResolvedFragment {
  text: string
  fill: FillValue
  weight: number
  italic: boolean
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
 * Measure the rendered pixel-width of `text` including letterSpacing.
 * Assumes ctx.font is already set correctly.
 */
function measureWidth(ctx: CanvasRenderingContext2D, text: string, letterSpacing: number): number {
  if (!text) return 0
  if (letterSpacing === 0) return ctx.measureText(text).width
  let w = 0
  for (const char of text) {
    w += ctx.measureText(char).width + letterSpacing
  }
  // Remove trailing letterSpacing after the last character
  w -= letterSpacing
  return Math.max(0, w)
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Renders a TextLayer's spans to an off-screen HTMLCanvasElement.
 * The canvas is sized to (layer.width ?? 1000) × computed-height.
 *
 * Rules:
 *  - span.fill overrides layer.fill; span.fontWeight overrides layer.fontWeight
 *  - span.italic overrides layer.italic
 *  - '\n' inside span.text creates explicit line breaks
 *  - layer.align controls horizontal alignment per line
 *  - layer.letterSpacing is a global pixel offset (applied between chars)
 */
export function renderSpansToCanvas(layer: TextLayer): HTMLCanvasElement {
  const spans = layer.spans ?? []
  const { fontSize, fontFamily, fontWeight, letterSpacing, lineHeight, align } = layer
  const layerItalic = layer.italic ?? false
  const canvasWidth = Math.max(1, layer.width ?? 1000)
  const lineHeightPx = fontSize * lineHeight

  // ── 1. Resolve all spans into fragments, splitting on \n ──────────────────
  const lines: ResolvedFragment[][] = [[]]

  for (const span of spans) {
    const fill = span.fill ?? layer.fill
    const weight = span.fontWeight ?? fontWeight
    const italic = span.italic ?? layerItalic
    const parts = span.text.split('\n')

    for (let i = 0; i < parts.length; i++) {
      if (i > 0) lines.push([])   // new line
      const text = parts[i]
      if (text.length > 0) {
        lines[lines.length - 1].push({ text, fill, weight, italic })
      }
    }
  }

  // ── 2. Measure each fragment and compute per-line layout ──────────────────
  const measureCanvas = document.createElement('canvas')
  const mc = measureCanvas.getContext('2d')!

  const layoutLines: LayoutLine[] = lines.map((lineFragments) => {
    let x = 0
    const fragments: PositionedFragment[] = lineFragments.map((frag) => {
      mc.font = buildFontString(frag.weight, frag.italic, fontSize, fontFamily)
      const w = measureWidth(mc, frag.text, letterSpacing)
      const positioned: PositionedFragment = { ...frag, x, width: w }
      x += w
      return positioned
    })
    return { fragments, totalWidth: x }
  })

  // ── 3. Size the render canvas ─────────────────────────────────────────────
  const totalHeight = Math.ceil(lineHeightPx * layoutLines.length + fontSize * 0.25)

  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = Math.max(1, totalHeight)
  const ctx = canvas.getContext('2d')!
  ctx.textBaseline = 'alphabetic'

  // ── 4. Render each line ───────────────────────────────────────────────────
  layoutLines.forEach((line, lineIndex) => {
    // Baseline position (distance from top of line box to text baseline ≈ fontSize)
    const baseline = lineIndex * lineHeightPx + fontSize * 0.9

    // Alignment offset
    let lineStartX = 0
    if (align === 'center') lineStartX = (canvasWidth - line.totalWidth) / 2
    else if (align === 'right') lineStartX = canvasWidth - line.totalWidth

    line.fragments.forEach((frag) => {
      const fragX = lineStartX + frag.x
      const fragY = lineIndex * lineHeightPx

      ctx.font = buildFontString(frag.weight, frag.italic, fontSize, fontFamily)

      // Resolve fill → canvas fillStyle
      const gradient = createCanvasGradient(ctx, frag.fill, fragX, fragY, frag.width, lineHeightPx)
      ctx.fillStyle = typeof gradient === 'string' ? gradient : gradient

      // Draw text — char by char when letterSpacing != 0
      if (letterSpacing === 0) {
        ctx.fillText(frag.text, fragX, baseline)
      } else {
        let xPos = fragX
        for (const char of frag.text) {
          ctx.fillText(char, xPos, baseline)
          xPos += ctx.measureText(char).width + letterSpacing
        }
      }
    })
  })

  return canvas
}

/**
 * Returns a stable cache key string for a TextLayer's span rendering.
 * Change in any rendering-relevant property yields a different key.
 */
export function spansRenderKey(layer: TextLayer): string {
  if (!layer.spans?.length) return ''
  const spansStr = layer.spans
    .map((s) => `${s.text}|${JSON.stringify(s.fill ?? '')}|${s.fontWeight ?? ''}|${s.italic ?? ''}`)
    .join('§')
  return [
    spansStr,
    layer.fontSize,
    layer.fontFamily,
    layer.fontWeight,
    JSON.stringify(layer.fill),
    layer.lineHeight,
    layer.letterSpacing,
    layer.width ?? 1000,
    layer.align,
    layer.italic ?? false,
  ].join('|')
}
