#!/usr/bin/env node
/**
 * Marketing images for the README and link previews, composed from real
 * renders so they always show what the app actually produces.
 *
 *   npm run build
 *   node scripts/templates/build.mjs --preview      # writes output/templates/<slug>/…
 *   node scripts/templates/showcase.mjs
 *
 * Outputs:
 *   docs/media/hero.webp                  one row mixing the five templates
 *   docs/media/template-<slug>.webp       all screenshots of one template
 *   docs/media/tour.webp                  slides of the Welcome tour
 *   docs/media/formats-locales.webp       one slide in two languages and two store sizes
 *   docs/media/editor.webp                the editor itself (first run, Welcome tour open)
 *   docs/media/social-preview.jpg         1280×640, for the repository's social preview setting
 *   docs/media/logo-light.svg             public/logo.svg recoloured for GitHub's light theme
 *   public/og.jpg                         1200×630, link preview of the hosted app
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ROOT, openBrowser } from './lib/render.mjs'
import { serveDist } from './lib/preview.mjs'

const RENDERS = join(ROOT, 'output/templates')
const MEDIA = join(ROOT, 'docs/media')
const FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700&family=Sora:wght@700;800&display=block">'

const TEMPLATES = [
  { slug: 'pulse-fitness', slides: 7, pano: [2, 3] },
  { slug: 'ledger-finance', slides: 7, pano: [2, 3] },
  { slug: 'flow-productivity', slides: 7, pano: [2, 3] },
  { slug: 'bright-education', slides: 7, pano: [2, 3] },
  { slug: 'basket-shopping', slides: 7, pano: [2, 3] },
]

function slide(slug, no, view = 'iphone-69-en') {
  const file = join(RENDERS, slug, view, `${String(no).padStart(2, '0')}.png`)
  if (!existsSync(file)) {
    throw new Error(`Missing render ${file}. Run "node scripts/templates/build.mjs --preview" first.`)
  }
  return pathToFileURL(file).href
}

/** A run of screenshots; slides listed in one inner array are a pano and touch. */
function row(groups, { height, gap, radius, shadow = '' }) {
  return `<div style="display:flex;gap:${gap}px;align-items:center;flex:none">${groups.map((group) => {
    const items = Array.isArray(group) ? group : [group]
    return `<div style="display:flex;border-radius:${radius}px;overflow:hidden;flex:none;${shadow}">${items
      .map((src) => `<img src="${src}" style="display:block;height:${height}px;width:auto">`).join('')}</div>`
  }).join('')}</div>`
}

const page = (body, css = '') => `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{background:transparent}
  body{font-family:Inter,system-ui,sans-serif;overflow:hidden}
  ${css}</style></head><body>${body}</body></html>`

const BACKDROP = 'background:radial-gradient(900px 620px at 82% 0%,rgba(124,92,246,.42),transparent 62%),radial-gradient(820px 600px at 8% 100%,rgba(236,72,153,.26),transparent 62%),linear-gradient(160deg,#12101e,#1c1929 55%,#0f0e1a)'
const SHADOW = 'box-shadow:0 30px 70px rgba(0,0,0,.5)'

async function shoot(browser, html, out, { width, height, scale = 1, type = 'webp', quality = 0.9, transparent = false, fit = false }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale })
  try {
    const tab = await context.newPage()
    const tmp = `${out}.html`
    writeFileSync(tmp, html) // a file URL so local renders can be loaded as images
    await tab.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' })
    await tab.evaluate(() => document.fonts.ready)
    const target = fit ? tab.locator('#fit') : tab
    const png = await target.screenshot({ type: 'png', omitBackground: transparent })
    await encode(tab, png, out, type, quality)
    rmSync(tmp, { force: true })
  } finally {
    await context.close()
  }
}

async function encode(tab, png, out, type, quality, maxWidth) {
  const base64 = await tab.evaluate(async ({ source, mime, quality, maxWidth }) => {
    const img = new Image()
    img.src = `data:image/png;base64,${source}`
    await img.decode()
    const k = maxWidth && img.naturalWidth > maxWidth ? maxWidth / img.naturalWidth : 1
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * k)
    canvas.height = Math.round(img.naturalHeight * k)
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL(mime, quality).split(',')[1]
  }, { source: png.toString('base64'), mime: type === 'jpg' ? 'image/jpeg' : 'image/webp', quality, maxWidth })
  const bytes = Buffer.from(base64, 'base64')
  writeFileSync(out, bytes)
  console.log(`  ${out.replace(`${ROOT}/`, '')} (${Math.round(bytes.length / 1024)} KB)`)
}

/** The mixed row used by the hero and the link-preview cards. */
const mixedRow = (height, gap, radius) => row([
  slide('pulse-fitness', 1),
  [slide('ledger-finance', 2), slide('ledger-finance', 3)],
  slide('flow-productivity', 1),
  slide('bright-education', 1),
  [slide('basket-shopping', 2), slide('basket-shopping', 3)],
], { height, gap, radius, shadow: SHADOW })

async function hero(browser) {
  // Sized so all seven screenshots fit: a slide cut to a sliver reads as a mistake.
  const html = page(`<div style="width:2000px;height:700px;${BACKDROP};display:flex;align-items:center;justify-content:center;border-radius:36px;overflow:hidden">${mixedRow(566, 22, 26)}</div>`)
  await shoot(browser, html, join(MEDIA, 'hero.webp'), { width: 2000, height: 700, transparent: true })
}

async function card(browser, out, width, height) {
  const logo = readFileSync(join(ROOT, 'public/logo.svg'), 'utf8').replace('<svg ', '<svg height="58" ')
  const html = page(`<div style="width:${width}px;height:${height}px;${BACKDROP};position:relative;overflow:hidden">
    <div style="position:absolute;left:64px;top:52px">${logo}</div>
    <div style="position:absolute;left:64px;top:132px;font:800 54px/1.06 Sora,sans-serif;letter-spacing:-.03em;color:#fff;width:${width - 128}px">App Store &amp; Play Store screenshots,<br><span style="background:linear-gradient(90deg,#b49eff,#ec4899);-webkit-background-clip:text;color:transparent">designed in your browser</span></div>
    <div style="position:absolute;left:64px;top:262px;font:500 25px/1.3 Inter,sans-serif;color:#c9c9d8">Free and open source · Templates · Every size and language · CLI export</div>
    <div style="position:absolute;left:64px;top:336px">${mixedRow(440, 16, 20)}</div>
  </div>`)
  await shoot(browser, html, out, { width, height, type: 'jpg', quality: 0.9 })
}

async function templateStrips(browser) {
  for (const { slug, slides, pano } of TEMPLATES) {
    const groups = []
    for (let no = 1; no <= slides; no++) {
      if (no === pano[0]) groups.push(pano.map((n) => slide(slug, n)))
      else if (!pano.includes(no)) groups.push(slide(slug, no))
    }
    const html = page(`<div id="fit" style="display:inline-block;padding:4px">${row(groups, { height: 560, gap: 14, radius: 22 })}</div>`)
    await shoot(browser, html, join(MEDIA, `template-${slug}.webp`), { width: 2100, height: 600, transparent: true, fit: true, quality: 0.88 })
  }
}

async function tour(browser) {
  const groups = [slide('welcome', 1), [slide('welcome', 2), slide('welcome', 3)], slide('welcome', 6), slide('welcome', 8), slide('welcome', 10), slide('welcome', 12)]
  const html = page(`<div id="fit" style="display:inline-block;padding:4px">${row(groups, { height: 560, gap: 14, radius: 22 })}</div>`)
  await shoot(browser, html, join(MEDIA, 'tour.webp'), { width: 2100, height: 600, transparent: true, fit: true, quality: 0.88 })
}

/** The same slide in two languages and two store sizes. */
async function formatsLocales(browser) {
  const cell = (src, label, height) => `<figure style="display:flex;flex-direction:column;align-items:center;gap:14px">
    <img src="${src}" style="display:block;height:${height}px;width:auto;border-radius:22px">
    <figcaption style="font:600 22px Inter,sans-serif;color:#fff;background:#2a2740;padding:8px 16px;border-radius:999px">${label}</figcaption></figure>`
  const html = page(`<div id="fit" style="display:inline-flex;gap:26px;align-items:flex-end;padding:4px">
    ${cell(slide('welcome', 8, 'iphone-69-en'), 'English · iPhone 1320 × 2868', 620)}
    ${cell(slide('welcome', 8, 'iphone-69-es'), 'Español · iPhone 1320 × 2868', 620)}
    ${cell(slide('welcome', 8, 'android-phone-en'), 'English · Android 1080 × 1920', 540)}
    ${cell(slide('welcome', 8, 'android-phone-es'), 'Español · Android 1080 × 1920', 540)}
  </div>`)
  await shoot(browser, html, join(MEDIA, 'formats-locales.webp'), { width: 1600, height: 760, transparent: true, fit: true, quality: 0.88 })
}

/** The real editor on a clean profile: first run opens the Welcome tour. */
async function editor(browser) {
  const server = await serveDist()
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 })
  try {
    const tab = await context.newPage()
    await tab.goto(server.url, { waitUntil: 'networkidle' })
    await tab.waitForSelector('[title="Click to rename project"]')
    const name = await tab.locator('[title="Click to rename project"]').first().innerText()
    if (!/Welcome/.test(name)) throw new Error(`Expected the Welcome tour on first run, got "${name}". Is dist/ up to date?`)
    await tab.waitForTimeout(3000) // thumbnails
    // Select the phone so the screenshot shows the properties panel and transform handles.
    await tab.locator('text=Phone').first().click().catch(() => {})
    await tab.waitForTimeout(600)
    const png = await tab.screenshot({ type: 'png' })
    await encode(tab, png, join(MEDIA, 'editor.webp'), 'webp', 0.9, 2000)
  } finally {
    await context.close()
    server.close()
  }
}

/** The wordmark in public/logo.svg is near-white: unreadable on GitHub's light theme. */
function lightLogo() {
  const dark = readFileSync(join(ROOT, 'public/logo.svg'), 'utf8')
  const swaps = [
    ['fill="#e8e8f0">Pixel', 'fill="#1f2328">Pixel'],
    ['<stop offset="0%" stop-color="#a78bfa"/>', '<stop offset="0%" stop-color="#7c3aed"/>'],
    ['<stop offset="100%" stop-color="#c084fc"/>', '<stop offset="100%" stop-color="#a855f7"/>'],
  ]
  let light = dark
  for (const [from, to] of swaps) {
    if (!light.includes(from)) throw new Error(`public/logo.svg changed: "${from}" not found, update lightLogo()`)
    light = light.replace(from, to)
  }
  writeFileSync(join(MEDIA, 'logo-light.svg'), light)
  console.log('  docs/media/logo-light.svg')
}

async function main() {
  mkdirSync(MEDIA, { recursive: true })
  lightLogo()
  const browser = await openBrowser()
  try {
    await hero(browser)
    await templateStrips(browser)
    await tour(browser)
    await formatsLocales(browser)
    await card(browser, join(MEDIA, 'social-preview.jpg'), 1280, 640)
    await card(browser, join(ROOT, 'public/og.jpg'), 1200, 630)
    await editor(browser)
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(`[showcase] ${error instanceof Error ? error.stack ?? error.message : error}`)
  process.exitCode = 1
})
