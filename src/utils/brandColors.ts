import type { BrandColor, FillValue } from '@/types'

const TOKEN_RE = /^\{brand:([^}]+)\}$/

export function isBrandToken(value: string): boolean {
  return TOKEN_RE.test(value)
}

export function toBrandToken(id: string): string {
  return `{brand:${id}}`
}

export function parseBrandToken(value: string): string | null {
  const m = value.match(TOKEN_RE)
  return m ? m[1] : null
}

/** Resolve a color value: if it's a brand token, return the palette color. Otherwise return as-is. */
export function resolveBrandColor(value: string, brandColors: BrandColor[]): string {
  const id = parseBrandToken(value)
  if (!id) return value
  return brandColors.find((c) => c.id === id)?.value ?? value
}

/** Resolve a FillValue: resolves brand tokens in solid fills and in every gradient stop. */
export function resolveFill(fill: FillValue, brandColors: BrandColor[]): FillValue {
  if (typeof fill === 'string') return resolveBrandColor(fill, brandColors)
  return {
    ...fill,
    stops: fill.stops.map((s) => ({ ...s, color: resolveBrandColor(s.color, brandColors) })),
  }
}
