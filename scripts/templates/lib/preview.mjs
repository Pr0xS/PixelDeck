/**
 * Render a template through the real app: the same headless ExportApp the CLI
 * uses (window.__EXPORT_CONFIG__ contract), so previews match user exports
 * pixel for pixel. Produces ordered PNGs plus a contact sheet per format/locale.
 */
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ASSETS_DIR, ROOT } from './render.mjs'
import { collectRefs } from './dsl.mjs'

// PIXELDECK_DIST lets a preview run against a frozen build while src/ is being edited.
const DIST = process.env.PIXELDECK_DIST ? resolve(process.env.PIXELDECK_DIST) : join(ROOT, 'dist')
const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
}

/** Serve dist/ on a free port. Run `npm run build` first. */
export async function serveDist() {
  if (!existsSync(join(DIST, 'index.html'))) throw new Error('dist/ not found. Run "npm run build" first.')
  const server = createServer(async (req, res) => {
    const urlPath = (req.url ?? '/').split('?')[0]
    let file = join(DIST, urlPath === '/' ? 'index.html' : urlPath)
    if (!file.startsWith(DIST) || !existsSync(file)) file = join(DIST, 'index.html')
    try {
      res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' })
      res.end(await readFile(file))
    } catch {
      res.writeHead(404)
      res.end('Not found')
    }
  })
  await new Promise((done) => server.listen(0, '127.0.0.1', done))
  return { url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() }
}

/** Turn a template into a throwaway project + asset map for the headless renderer. */
export function templateToPreviewProject(template) {
  const now = '2026-01-01T00:00:00.000Z'
  const project = {
    id: `preview-${template.id}`,
    name: template.name,
    createdAt: now,
    updatedAt: now,
    settings: {
      defaultSlideWidth: 1290,
      defaultSlideHeight: 2796,
      defaultLocale: 'en',
      brandName: 'My App',
      baseCanvasFormat: 'base',
      activeFormats: ['iphone-69', 'android-phone'],
      customFormats: [],
      pano: { gapPx: 24, compensate: false },
      ...(template.settings ?? {}),
    },
    slideGroups: template.slideGroups.map((g, i) => ({ id: `g${i}`, ...g })),
    assetManifest: template.assetManifest ?? {},
  }
  const assets = {}
  for (const key of collectRefs(template.slideGroups)) {
    const file = join(ASSETS_DIR, key)
    if (!existsSync(file)) throw new Error(`Template "${template.name}" references missing asset ${key}`)
    const mime = MIME[extname(key).toLowerCase()] ?? 'application/octet-stream'
    assets[key] = `data:${mime};base64,${readFileSync(file).toString('base64')}`
  }
  return { project, assets }
}

/**
 * Render one locale across several formats in a single page load.
 * Returns formatId → [{ name, png }] in export-plan order.
 */
export async function renderProject(browser, baseUrl, { project, assets }, { formats, locale, timeout = 90000 }) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  const errors = []
  page.on('pageerror', (err) => errors.push(String(err)))
  try {
    await page.addInitScript((config) => { window.__EXPORT_CONFIG__ = config }, {
      project, assets, locale: locale ?? null, formatIds: formats, allowMissing: false,
    })
    await page.goto(baseUrl, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => window.__EXPORT_DONE__ === true, { timeout, polling: 250 })
    const exportError = await page.evaluate(() => window.__EXPORT_ERROR__)
    if (exportError) throw new Error(`Export error: ${exportError}`)
    if (errors.length) throw new Error(`Page errors during render: ${errors.join(' | ')}`)
    const results = await page.evaluate(() => window.__EXPORT_RESULTS__)
    const byFormat = {}
    for (const result of results ?? []) {
      const png = Buffer.from(result.dataUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64')
      ;(byFormat[result.formatId] ??= []).push({ name: result.name, png })
    }
    return byFormat
  } finally {
    await page.close()
  }
}

/**
 * Lay rendered slides out in a row and screenshot them. Slides of one pano
 * group touch each other so the seam can be judged; other groups are spaced.
 */
export async function contactSheet(browser, files, groupSizes, outPath, { height = 640, label = '' } = {}) {
  let index = 0
  const groups = groupSizes.map((size) => files.slice(index, (index += size)))
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;background:#26262e;font:600 15px/1 system-ui,sans-serif;color:#c9c9d6;display:inline-block;padding:14px 16px 16px}
    .title{margin:0 0 12px;letter-spacing:.02em}
    .row{display:flex;gap:16px;align-items:flex-start}
    .group{display:flex;gap:0}
    .cell{position:relative}
    img{display:block;height:${height}px;width:auto}
    .n{position:absolute;left:6px;bottom:6px;background:rgba(0,0,0,.6);color:#fff;padding:3px 6px;border-radius:4px;font-size:12px}
  </style></head><body><p class="title">${label}</p><div class="row">${groups.map((group) =>
    `<div class="group">${group.map((file) => `<div class="cell"><img src="${pathToFileURL(file.path).href}"><span class="n">${file.no}</span></div>`).join('')}</div>`).join('')}</div></body></html>`
  const htmlPath = outPath.replace(/\.png$/, '.html')
  writeFileSync(htmlPath, html)
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
  try {
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' })
    await page.locator('body').screenshot({ path: outPath, type: 'png' })
  } finally {
    await page.close()
    rmSync(htmlPath, { force: true })
  }
}

/** Gallery thumbnail: the first slides side by side on a 16:9 card. */
export async function galleryThumb(browser, files, outPath, { count = 4, background = '#17171d' } = {}) {
  const picked = files.slice(0, count)
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;width:960px;height:540px;background:${background};display:flex;gap:18px;align-items:flex-start;justify-content:center;padding-top:36px;box-sizing:border-box;overflow:hidden}
    img{display:block;width:${Math.floor((960 - 72 - 18 * (picked.length - 1)) / picked.length)}px;height:auto;border-radius:14px;box-shadow:0 18px 40px rgba(0,0,0,.45)}
  </style></head><body>${picked.map((file) => `<img src="${pathToFileURL(file.path).href}">`).join('')}</body></html>`
  const htmlPath = `${outPath}.html`
  writeFileSync(htmlPath, html)
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 })
  try {
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' })
    const png = await page.screenshot({ type: 'png' })
    const base64 = await page.evaluate(async (source) => {
      const img = new Image()
      img.src = `data:image/png;base64,${source}`
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      return canvas.toDataURL('image/webp', 0.82).split(',')[1]
    }, png.toString('base64'))
    writeFileSync(outPath, Buffer.from(base64, 'base64'))
  } finally {
    await page.close()
    rmSync(htmlPath, { force: true })
  }
}

/** Render a template for every requested format × locale and write PNGs + sheets. */
export async function previewTemplate(browser, baseUrl, template, outDir, { formats, locales, sheetHeight }) {
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })
  const preview = templateToPreviewProject(template)
  const groupSizes = template.slideGroups.map((g) => g.numSlides)
  const written = {}
  for (const locale of locales) {
    const byFormat = await renderProject(browser, baseUrl, preview, { formats, locale })
    for (const format of formats) {
      const results = byFormat[format] ?? []
      const dir = join(outDir, `${format}-${locale}`)
      mkdirSync(dir, { recursive: true })
      const files = results.map((result, i) => {
        const no = String(i + 1).padStart(2, '0')
        const path = join(dir, `${no}.png`)
        writeFileSync(path, result.png)
        return { path, no }
      })
      const sheet = join(outDir, `sheet-${format}-${locale}.png`)
      await contactSheet(browser, files, groupSizes, sheet, {
        height: sheetHeight,
        label: `${template.name} · ${format} · ${locale} · ${files.length} slides`,
      })
      written[`${format}-${locale}`] = { files, sheet }
      console.log(`  preview ${format}/${locale}: ${files.length} slides → ${sheet}`)
    }
  }
  return written
}
