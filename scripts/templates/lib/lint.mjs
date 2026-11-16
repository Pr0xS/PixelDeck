/**
 * Layout lint for generated templates. Measures every text layer with the
 * real web font and reports problems that are easy to miss by eye:
 * unintended wraps, text running off the slide or across a pano seam, and
 * text colliding with other text or with a device frame.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEVICES } from './dsl.mjs'
import { ROOT } from './render.mjs'

/** Families/weights the editor can load (parsed from src/utils/fonts.ts). */
function knownFonts() {
  const source = readFileSync(join(ROOT, 'src/utils/fonts.ts'), 'utf8')
  const fonts = new Map()
  for (const match of source.matchAll(/family: '([^']+)',[^\n]*?weights: \[([^\]]+)\]/g)) {
    fonts.set(match[1], match[2].split(',').map((w) => Number(w.trim())))
  }
  return fonts
}

function flatten(layers, out = []) {
  for (const layer of layers) {
    // Group children use group-relative coordinates; they are skipped rather than mis-measured.
    if (layer.type !== 'group') out.push(layer)
  }
  return out
}

function corners(x, y, w, h, rotation) {
  const cx = x + w / 2
  const cy = y + h / 2
  const rad = (rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]
    .map(([dx, dy]) => [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos])
}

/** Separating-axis test for two convex quads. */
function overlaps(a, b) {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i]
      const [x2, y2] = poly[(i + 1) % poly.length]
      const axis = [y2 - y1, x1 - x2]
      const project = (pts) => pts.map(([px, py]) => px * axis[0] + py * axis[1])
      const pa = project(a)
      const pb = project(b)
      if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false
    }
  }
  return true
}

const visibleIn = (layer, view) =>
  (layer.ownerFormat === undefined || layer.ownerFormat === view) && layer.formatVisibility?.[view] !== false

/**
 * Layers scoped to different formats never render together, so they cannot
 * collide. Geometry is still compared in Base coordinates: a layer moved by a
 * format override is only checked where it sits on Base.
 */
function coexist(a, b, views) {
  return views.some((view) => visibleIn(a, view) && visibleIn(b, view))
}

function localized(layer, locale, defaultLocale) {
  if (locale === defaultLocale) return layer
  const content = layer.localeContent?.[locale] ?? {}
  const delta = layer.localeAdjust?.[locale]?.base ?? {}
  const next = { ...layer, ...content }
  if (delta.dx) next.x += delta.dx
  if (delta.dy) next.y += delta.dy
  if (delta.mFontSize && next.fontSize) next.fontSize *= delta.mFontSize
  if (delta.mWidth && next.width) next.width *= delta.mWidth
  if (delta.mScale && next.scale) next.scale *= delta.mScale
  return next
}

export async function lintTemplate(browser, template) {
  const warnings = []
  const fonts = knownFonts()
  const defaultLocale = template.settings.defaultLocale ?? 'en'
  const locales = template.settings.locales ?? [defaultLocale]
  const views = ['base', ...(template.settings.activeFormats ?? ['iphone-69', 'android-phone'])]

  // Font availability + one stylesheet request per family (a bad family must not break the rest).
  const wanted = new Map()
  for (const group of template.slideGroups) {
    for (const layer of flatten(group.layers)) {
      if (layer.type === 'brand') {
        const brandWeights = fonts.get(layer.nameFontFamily)
        if (!brandWeights) warnings.push(`${group.name}/${layer.name}: font "${layer.nameFontFamily}" is not in the editor font list`)
        else if (!brandWeights.includes(layer.nameFontWeight)) warnings.push(`${group.name}/${layer.name}: weight ${layer.nameFontWeight} is not loaded for "${layer.nameFontFamily}" (available: ${brandWeights.join(', ')})`)
      }
      if (layer.type !== 'text') continue
      const weights = fonts.get(layer.fontFamily)
      if (!weights) warnings.push(`${group.name}/${layer.name}: font "${layer.fontFamily}" is not in the editor font list`)
      else if (!weights.includes(layer.fontWeight)) warnings.push(`${group.name}/${layer.name}: weight ${layer.fontWeight} is not loaded for "${layer.fontFamily}" (available: ${weights.join(', ')})`)
      const entry = wanted.get(layer.fontFamily) ?? { normal: new Set(), italic: new Set() }
      entry[layer.italic ? 'italic' : 'normal'].add(layer.fontWeight)
      wanted.set(layer.fontFamily, entry)
    }
  }
  const links = [...wanted].map(([family, use]) => {
    const name = family.replace(/ /g, '+')
    const tuples = [
      ...[...use.normal].sort().map((w) => `0,${w}`),
      ...[...use.italic].sort().map((w) => `1,${w}`),
    ]
    const axis = use.italic.size ? `ital,wght@${tuples.join(';')}` : `wght@${[...use.normal].sort().join(';')}`
    return `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${name}:${axis}&display=block">`
  })

  const page = await browser.newPage()
  try {
    await page.setContent(`<!doctype html><html><head>${links.join('')}</head><body></body></html>`, { waitUntil: 'networkidle' })
    const measure = (jobs) => page.evaluate(async (items) => {
      const ctx = document.createElement('canvas').getContext('2d')
      const out = []
      for (const item of items) {
        const font = `${item.italic ? 'italic ' : ''}${item.weight} ${item.size}px "${item.family}"`
        await document.fonts.load(font, item.text)
        ctx.font = font
        out.push(item.text.split('\n').map((line) => ctx.measureText(line).width + item.spacing * line.length))
      }
      return out
    }, jobs)

    for (const locale of locales) {
      for (const group of template.slideGroups) {
        const canvasW = group.slideWidth * group.numSlides
        const layers = flatten(group.layers).filter((l) => l.visible !== false).map((l) => localized(l, locale, defaultLocale))
        const texts = layers.filter((l) => l.type === 'text')
        const lineWidths = await measure(texts.map((l) => ({
          text: l.text, family: l.fontFamily, weight: l.fontWeight, size: l.fontSize, italic: Boolean(l.italic), spacing: l.letterSpacing ?? 0,
        })))
        const where = (layer) => `[${locale}] ${group.name}/${layer.name} "${layer.text.split('\n')[0].slice(0, 28)}"`

        const boxes = texts.map((layer, i) => {
          const widest = Math.max(...lineWidths[i])
          const lines = lineWidths[i].length
          if (layer.width !== undefined && widest > layer.width + 1) {
            warnings.push(`${where(layer)}: line is ${Math.round(widest)}px but the box is ${Math.round(layer.width)}px wide → it wraps`)
          }
          const boxW = layer.width ?? widest
          const inkW = Math.min(widest, boxW)
          const inkX = layer.align === 'center' ? layer.x + (boxW - inkW) / 2 : layer.align === 'right' ? layer.x + boxW - inkW : layer.x
          const inkH = layer.height ?? lines * layer.fontSize * (layer.lineHeight ?? 1)
          if (inkX < 40 || inkX + inkW > canvasW - 40) warnings.push(`${where(layer)}: text is closer than 40px to the canvas edge`)
          for (let seam = group.slideWidth; seam < canvasW; seam += group.slideWidth) {
            if (inkX < seam - 1 && inkX + inkW > seam + 1) warnings.push(`${where(layer)}: text crosses the pano seam at x=${seam}`)
          }
          return { layer, quad: corners(inkX, layer.y, inkW, inkH, layer.rotation ?? 0) }
        })

        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            if (!coexist(boxes[i].layer, boxes[j].layer, views)) continue
            if (overlaps(boxes[i].quad, boxes[j].quad)) warnings.push(`${where(boxes[i].layer)} overlaps text ${boxes[j].layer.name}`)
          }
        }
        for (const device of layers.filter((l) => l.type === 'phone')) {
          const frame = DEVICES[device.model] ?? DEVICES['iphone-16-pro']
          const quad = corners(device.x, device.y, frame.w * device.scale, frame.h * device.scale, device.rotation ?? 0)
          for (const box of boxes) {
            if (!coexist(box.layer, device, views)) continue
            // Text deliberately placed above the device in the stack (labels on top) is still flagged: review it by eye.
            if (overlaps(box.quad, quad)) warnings.push(`${where(box.layer)} overlaps device "${device.name}"`)
          }
        }
      }
    }
  } finally {
    await page.close()
  }
  return [...new Set(warnings)]
}
