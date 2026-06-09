import type { FillValue, LinearGradient, RadialGradient, GradientStop } from '@/types'

/**
 * Convert angle in degrees to [startPoint, endPoint] for Konva linearGradient.
 * Konva expects points relative to the shape's local coordinate space.
 */
export function angleToPoints(
  angleDeg: number,
  width: number,
  height: number,
): { startPoint: { x: number; y: number }; endPoint: { x: number; y: number } } {
  // Use CSS-standard formula: direction = (sin A, -cos A)
  // Gradient line length = |W·sin A| + |H·cos A| — ensures 0% and 100% fall
  // exactly at the farthest corners of the bounding box (matches CSS behavior).
  const rad = angleDeg * (Math.PI / 180)
  const cx = width / 2
  const cy = height / 2
  const dx = Math.sin(rad)
  const dy = -Math.cos(rad)
  const scale = (Math.abs(dx * width) + Math.abs(dy * height)) / 2

  return {
    startPoint: { x: cx - dx * scale, y: cy - dy * scale },
    endPoint: { x: cx + dx * scale, y: cy + dy * scale },
  }
}

/** Convert GradientStop[] to Konva colorStops (flat array: [offset, color, ...]) */
export function toKonvaColorStops(stops: GradientStop[]): (number | string)[] {
  return stops.flatMap((s) => [s.offset, s.color])
}

/**
 * Convert a FillValue to Konva shape props.
 * For plain strings: { fill }
 * For gradients: { fillLinearGradient* } or { fillRadialGradient* }
 */
export function fillToKonvaProps(
  fill: FillValue,
  width: number,
  height: number,
): Record<string, unknown> {
  if (typeof fill === 'string') {
    return { fill }
  }

  if (fill.type === 'linear') {
    const lg = fill as LinearGradient
    const { startPoint, endPoint } = angleToPoints(lg.angle, width, height)
    return {
      fillLinearGradientStartPoint: startPoint,
      fillLinearGradientEndPoint: endPoint,
      fillLinearGradientColorStops: toKonvaColorStops(lg.stops),
    }
  }

  if (fill.type === 'radial') {
    const rg = fill as RadialGradient
    // rg.radius is a 0–2 ratio (0%–200%); Konva expects pixels
    const endRadius = rg.radius * Math.max(width, height)
    return {
      fillRadialGradientStartPoint: { x: rg.cx * width, y: rg.cy * height },
      fillRadialGradientEndPoint: { x: rg.cx * width, y: rg.cy * height },
      fillRadialGradientStartRadius: 0,
      fillRadialGradientEndRadius: endRadius,
      fillRadialGradientColorStops: toKonvaColorStops(rg.stops),
    }
  }

  return { fill: '#ffffff' }
}

/**
 * Render a FillValue as a CSS background string (for HTML/DOM elements).
 */
export function fillToCss(fill: FillValue): string {
  if (typeof fill === 'string') return fill
  if (fill.type === 'linear') {
    const stops = fill.stops.map((s) => `${s.color} ${s.offset * 100}%`).join(', ')
    return `linear-gradient(${fill.angle}deg, ${stops})`
  }
  if (fill.type === 'radial') {
    const stops = fill.stops.map((s) => `${s.color} ${s.offset * 100}%`).join(', ')
    return `radial-gradient(circle at ${fill.cx * 100}% ${fill.cy * 100}%, ${stops})`
  }
  return '#ffffff'
}

/** Convert a FillValue to a flat CSS canvas gradient for Konva text (via canvas 2D API) */
export function createCanvasGradient(
  ctx: CanvasRenderingContext2D,
  fill: FillValue,
  x: number,
  y: number,
  width: number,
  height: number,
): CanvasGradient | string {
  if (typeof fill === 'string') return fill

  if (fill.type === 'linear') {
    const { startPoint, endPoint } = angleToPoints(fill.angle, width, height)
    const grad = ctx.createLinearGradient(
      x + startPoint.x, y + startPoint.y,
      x + endPoint.x, y + endPoint.y,
    )
    fill.stops.forEach((s) => grad.addColorStop(s.offset, s.color))
    return grad
  }

  if (fill.type === 'radial') {
    const cx = x + fill.cx * width
    const cy = y + fill.cy * height
    // fill.radius is a 0–2 ratio; canvas API expects pixels
    const endRadius = fill.radius * Math.max(width, height)
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, endRadius)
    fill.stops.forEach((s) => grad.addColorStop(s.offset, s.color))
    return grad
  }

  return '#ffffff'
}
