/**
 * Art pipeline: render HTML (mock app screens, floating cards, logos) to WebP
 * with headless Chromium, store the result content-addressed under
 * public/templates/assets/, and remember it in a per-template lock file so an
 * unchanged source never produces new bytes (and therefore a new key).
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { assetKeyFromBytes } from '../../../cli/projectInput.mjs'

const here = dirname(fileURLToPath(import.meta.url))
export const ROOT = resolve(here, '../../..')
export const TEMPLATES_DIR = join(ROOT, 'public/templates')
export const ASSETS_DIR = join(TEMPLATES_DIR, 'assets')
const KIT_CSS = join(here, '../kit/kit.css')

/** Bump to force every asset to re-render (e.g. after changing the encoder). */
const RENDER_VERSION = 2

/** Logical size of a phone screen. Matches the mockup screen aspect (362:816). */
export const SCREEN = { width: 400, height: 902, scale: 2.5 }

const ICON_FONT = 'family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0..1,0'

export function openBrowser() {
  return chromium.launch({ headless: true })
}

function documentFor(spec, kitCss) {
  const fonts = [ICON_FONT, ...(spec.fonts ?? [])].join('&')
  return `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fonts}&display=block">
<style>${kitCss}
${spec.css ?? ''}</style>
</head><body class="${spec.transparent ? 'art' : 'phone'}">${spec.html}</body></html>`
}

/**
 * Transparent art must not bake a soft drop shadow into its pixels: the shadow
 * is wider than the image and would be cut off in a straight line. Runs in the
 * page: removes blurred box-shadows from the outermost painted elements and
 * returns the largest one so the layer can cast it instead (see art() in dsl.mjs).
 * Hard-edged shadows (blur 0) and shadows of elements nested inside a painted
 * parent are part of the artwork and stay.
 */
function liftSoftShadows() {
  const split = (value) => value.split(/,(?![^(]*\))/).map((part) => part.trim())
  const painted = (el) => {
    const style = getComputedStyle(el)
    const alpha = Number((style.backgroundColor.match(/[\d.]+/g) ?? [])[3] ?? (style.backgroundColor.startsWith('rgb(') ? 1 : 0))
    return alpha > 0.05 || style.backgroundImage !== 'none'
  }
  let lifted = null
  for (const el of document.body.querySelectorAll('*')) {
    const value = getComputedStyle(el).boxShadow
    if (!value || value === 'none') continue
    let nested = false
    for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      if (painted(parent)) { nested = true; break }
    }
    if (nested) continue
    const keep = []
    for (const part of split(value)) {
      const color = (part.match(/rgba?\([^)]*\)/) ?? ['rgb(0, 0, 0)'])[0]
      const [ox = 0, oy = 0, blur = 0] = part.replace(color, '').replace('inset', '').trim().split(/\s+/).map(parseFloat)
      if (/\binset\b/.test(part) || blur === 0) { keep.push(part); continue }
      const rect = el.getBoundingClientRect()
      const [r, g, b, alpha = 1] = color.match(/[\d.]+/g).map(Number)
      const hex = `#${[r, g, b].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')}`
      const candidate = { area: rect.width * rect.height, color: hex, opacity: alpha, blur, offsetX: ox, offsetY: oy }
      if (!lifted || candidate.area > lifted.area) lifted = candidate
    }
    el.style.setProperty('box-shadow', keep.length ? keep.join(', ') : 'none', 'important')
  }
  if (!lifted) return null
  const { area: _area, ...shadow } = lifted
  return shadow
}

async function renderToWebp(browser, spec, kitCss) {
  const width = spec.width ?? SCREEN.width
  const height = spec.height ?? SCREEN.height
  const scale = spec.scale ?? SCREEN.scale
  const crop = Boolean(spec.transparent) && spec.crop !== false
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale })
  try {
    const page = await context.newPage()
    await page.setContent(documentFor(spec, kitCss), { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    const shadow = spec.transparent ? await page.evaluate(liftSoftShadows) : null
    const png = await page.screenshot({
      type: 'png',
      omitBackground: Boolean(spec.transparent),
      clip: { x: 0, y: 0, width, height },
    })
    // Chromium's canvas encoder gives WebP without adding an image dependency.
    // Cropping to the visible pixels keeps the layer box (and its hit area) tight to the card.
    const encoded = await page.evaluate(async ({ source, quality, crop }) => {
      const img = new Image()
      img.src = `data:image/png;base64,${source}`
      await img.decode()
      const full = document.createElement('canvas')
      full.width = img.naturalWidth
      full.height = img.naturalHeight
      const ctx = full.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0)
      let box = { x: 0, y: 0, w: full.width, h: full.height }
      if (crop) {
        const { data } = ctx.getImageData(0, 0, full.width, full.height)
        let minX = full.width, minY = full.height, maxX = -1, maxY = -1
        for (let y = 0; y < full.height; y++) {
          for (let x = 0; x < full.width; x++) {
            if (data[(y * full.width + x) * 4 + 3] > 6) {
              if (x < minX) minX = x
              if (x > maxX) maxX = x
              if (y < minY) minY = y
              if (y > maxY) maxY = y
            }
          }
        }
        if (maxX >= minX && maxY >= minY) box = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
      }
      const out = document.createElement('canvas')
      out.width = box.w
      out.height = box.h
      out.getContext('2d').drawImage(full, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h)
      return { base64: out.toDataURL('image/webp', quality).split(',')[1], box }
    }, { source: png.toString('base64'), quality: spec.quality ?? 0.88, crop })
    const { box } = encoded
    return {
      bytes: Buffer.from(encoded.base64, 'base64'),
      // Logical (CSS px) placement of the cropped image inside the declared art box.
      crop: { dx: box.x / scale, dy: box.y / scale, w: box.w / scale, h: box.h / scale },
      shadow,
    }
  } finally {
    await context.close()
  }
}

/**
 * Render every art entry of a template source, reusing locked results.
 * Returns id → { key, w, h, dx, dy, fw, fh, shadow?, name }. `fw`/`fh` are the
 * declared art box; `w`/`h`/`dx`/`dy` locate the (possibly cropped) image inside it.
 */
export async function ensureArt(browser, sourceDir, artSpecs, { force = false, partial = false } = {}) {
  const lockPath = join(sourceDir, 'assets.lock.json')
  const lock = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, 'utf8')) : {}
  const kitCss = readFileSync(KIT_CSS, 'utf8')
  const themePath = join(sourceDir, 'theme.css')
  const themeCss = existsSync(themePath) ? readFileSync(themePath, 'utf8') : ''
  mkdirSync(ASSETS_DIR, { recursive: true })

  const out = {}
  // `partial` keeps lock entries for art that is not part of this call (see lateArt in build.mjs).
  const nextLock = partial ? { ...lock } : {}
  for (const [id, raw] of Object.entries(artSpecs)) {
    const spec = {
      ...raw,
      html: raw.html ?? readFileSync(join(sourceDir, raw.file), 'utf8'),
      css: `${themeCss}\n${raw.css ?? ''}`,
    }
    const width = spec.width ?? SCREEN.width
    const height = spec.height ?? SCREEN.height
    const hash = createHash('sha256')
      .update(JSON.stringify([RENDER_VERSION, kitCss, spec.css, spec.html, spec.fonts ?? [], width, height, spec.scale ?? SCREEN.scale, Boolean(spec.transparent), spec.quality ?? 0.88, spec.crop !== false]))
      .digest('hex')
      .slice(0, 16)

    let entry = lock[id]
    if (force || !entry || entry.hash !== hash || !entry.crop || !entry.file || !existsSync(join(ASSETS_DIR, entry.file))) {
      const { bytes, crop, shadow } = await renderToWebp(browser, spec, kitCss)
      const key = assetKeyFromBytes(bytes, 'image/webp')
      writeFileSync(join(ASSETS_DIR, key), bytes)
      const round = (n) => Math.round(n * 100) / 100
      entry = {
        hash,
        // Named `file`, not `key`: secret scanners flag `"key": "<high-entropy string>"`.
        file: key,
        bytes: bytes.length,
        crop: { dx: round(crop.dx), dy: round(crop.dy), w: round(crop.w), h: round(crop.h) },
        ...(shadow ? { shadow } : {}),
      }
      console.log(`  art ${id} → ${key} (${Math.round(bytes.length / 1024)} KB)`)
    }
    nextLock[id] = entry
    out[id] = {
      key: entry.file,
      w: entry.crop.w,
      h: entry.crop.h,
      dx: entry.crop.dx,
      dy: entry.crop.dy,
      fw: width,
      fh: height,
      ...(entry.shadow ? { shadow: entry.shadow } : {}),
      name: `${id}.webp`,
    }
  }
  writeFileSync(lockPath, `${JSON.stringify(nextLock, null, 2)}\n`)
  return out
}
