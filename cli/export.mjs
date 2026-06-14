import { chromium } from '@playwright/test'
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from 'fs'
import { join, resolve, basename } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { createServer } from 'http'
import { readFile } from 'fs/promises'
import { extname } from 'path'
import yaml from 'js-yaml'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distPath = resolve(__dirname, '../dist')

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULTS = {
  port: 4321,
  timeoutMs: 60000,
  viewport: { width: 1400, height: 900 },
}

// ─── Static file server ──────────────────────────────────────────────────────

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.map': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
}

async function startServer(port = DEFAULTS.port) {
  if (!existsSync(distPath)) {
    throw new Error(
      `Build not found at ${distPath}. Run "npm run build" first.`
    )
  }

  const server = createServer(async (req, res) => {
    let urlPath = req.url?.split('?')[0] ?? '/'
    let filePath = join(distPath, urlPath === '/' ? 'index.html' : urlPath)

    // SPA fallback
    if (!existsSync(filePath)) {
      filePath = join(distPath, 'index.html')
    }

    try {
      const content = await readFile(filePath)
      const ext = extname(filePath).toLowerCase()
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream',
        'Cache-Control': 'no-cache',
      })
      res.end(content)
    } catch {
      res.writeHead(404)
      res.end('Not found')
    }
  })

  await new Promise((resolve) => server.listen(port, resolve))
  return server
}

// ─── Load screenshots folder ─────────────────────────────────────────────────

function collectAssetRefsFromProject(project) {
  const refs = new Set()
  const visitLayer = (layer) => {
    if (!layer) return
    if (layer.type === 'phone') {
      if (layer.screenshotPath && !String(layer.screenshotPath).startsWith('data:')) refs.add(layer.screenshotPath)
    }
    if (layer.type === 'image') {
      if (layer.src && !String(layer.src).startsWith('data:')) refs.add(layer.src)
    }
    for (const patch of Object.values(layer.localeOverrides ?? {})) {
      if (patch?.screenshotPath && !String(patch.screenshotPath).startsWith('data:')) refs.add(patch.screenshotPath)
      if (patch?.src && !String(patch.src).startsWith('data:')) refs.add(patch.src)
    }
    if (layer.type === 'group') {
      for (const child of layer.children ?? []) visitLayer(child)
    }
  }
  for (const group of project.slideGroups ?? []) {
    for (const layer of group.layers ?? []) visitLayer(layer)
  }
  return refs
}

async function loadScreenshots(screenshotsDir, projectJson) {
  if (!screenshotsDir) return {}
  
  const absDir = resolve(screenshotsDir)
  if (!existsSync(absDir)) {
    console.warn(`[CLI] Screenshots dir not found: ${absDir}`)
    return {}
  }

  const files = readdirSync(absDir).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
  const assets = {}

  for (const file of files) {
    const data = readFileSync(join(absDir, file))
    const ext = extname(file).slice(1).toLowerCase()
    const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`
    assets[file] = `data:${mimeType};base64,${data.toString('base64')}`
  }

  // Locale uploads created in the GUI are stored with stable synthetic keys like
  // "locale-es-<group>-<layer>-screenshot.png". The screenshots folder usually
  // contains the original basename, so create aliases expected by the project.
  for (const ref of collectAssetRefsFromProject(projectJson)) {
    if (assets[ref]) continue
    const file = files.find((candidate) => ref === candidate || ref.endsWith(`-${candidate}`) || ref.endsWith(`/${candidate}`))
    if (file) assets[ref] = assets[file]
  }

  console.log(`[CLI] Loaded ${files.length} screenshots from ${absDir}`)
  return assets
}

// ─── Single export run ────────────────────────────────────────────────────────

async function runSingle({ project, screenshotsDir, outputDir, locale, port = DEFAULTS.port, timeout = DEFAULTS.timeoutMs }) {
  // Read project JSON
  const projectPath = resolve(project)
  if (!existsSync(projectPath)) {
    throw new Error(`Project file not found: ${projectPath}`)
  }
  const projectJson = JSON.parse(readFileSync(projectPath, 'utf8'))
  
  // Load screenshot assets
  const assets = await loadScreenshots(screenshotsDir, projectJson)

  // Ensure output dir exists
  const absOutput = resolve(outputDir)
  const localeOutput = locale ? join(absOutput, locale) : absOutput
  mkdirSync(localeOutput, { recursive: true })

  // Start static server
  const server = await startServer(port)
  console.log(`[CLI] Serving app at http://localhost:${port}`)

  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({
      viewport: DEFAULTS.viewport,
    })

    // Inject config BEFORE navigation (addInitScript runs before page scripts)
    await page.addInitScript((config) => {
      // @ts-ignore
      window.__EXPORT_CONFIG__ = config
    }, { project: projectJson, assets, locale: locale ?? null })

    // Navigate to the app
    await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' })

    // Wait for ExportApp to finish
    console.log('[CLI] Waiting for export to complete...')
    await page.waitForFunction(() => window.__EXPORT_DONE__ === true, {
      timeout,
      polling: 500,
    })

    // Check for errors
    const exportError = await page.evaluate(() => window.__EXPORT_ERROR__)
    if (exportError) {
      throw new Error(`Export error: ${exportError}`)
    }

    // Read results
    const results = await page.evaluate(() => window.__EXPORT_RESULTS__)

    if (!results || results.length === 0) {
      throw new Error('No slides were exported')
    }

    // Save PNGs
    let saved = 0
    for (const { name, dataUrl } of results) {
      const filename = name.endsWith('.png') ? name : `${name}.png`
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
      writeFileSync(join(localeOutput, filename), Buffer.from(base64, 'base64'))
      console.log(`  ✓ ${filename}`)
      saved++
    }

    console.log(`\n[CLI] Exported ${saved} slides → ${localeOutput}`)
    return { saved, outputDir: localeOutput }

  } finally {
    await browser?.close()
    server.close()
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function runExport(opts) {
  // Batch mode: --config=batch.yaml
  if (opts.config) {
    const configPath = resolve(opts.config)
    const raw = readFileSync(configPath, 'utf8')
    const batch = yaml.load(raw)

    if (!batch.jobs || !Array.isArray(batch.jobs)) {
      throw new Error('Batch config must have a "jobs" array')
    }

    let totalSaved = 0
    for (const [i, job] of batch.jobs.entries()) {
      console.log(`\n[CLI] Job ${i + 1}/${batch.jobs.length}: ${job.project}`)
      const result = await runSingle({
        project: job.project,
        screenshotsDir: job.screenshots,
        outputDir: job.output,
        locale: job.locale ?? null,
        port: opts.port ? Number(opts.port) : DEFAULTS.port + i,  // different port per job to avoid conflict
        timeout: opts.timeout ? Number(opts.timeout) : DEFAULTS.timeoutMs,
      })
      totalSaved += result.saved
    }

    console.log(`\n[CLI] Batch complete: ${totalSaved} total slides exported`)
    return
  }

  // Single mode: --project --screenshots --output
  if (!opts.project) {
    throw new Error('--project is required (or use --config for batch)')
  }
  if (!opts.output) {
    throw new Error('--output directory is required')
  }

  // Single mode — with optional locale
  if (opts['all-locales']) {
    // Export all locales defined in the project
    const projectJson = JSON.parse(readFileSync(resolve(opts.project), 'utf8'))
    const locales = projectJson.settings?.locales ?? [projectJson.settings?.defaultLocale ?? 'en']
    let totalSaved = 0
    for (const locale of locales) {
      console.log(`\n[CLI] Exporting locale: ${locale}`)
      const result = await runSingle({
        project: opts.project,
        screenshotsDir: opts.screenshots,
        outputDir: opts.output,
        locale,
        port: opts.port ? Number(opts.port) : DEFAULTS.port,
        timeout: opts.timeout ? Number(opts.timeout) : DEFAULTS.timeoutMs,
      })
      totalSaved += result.saved
    }
    console.log(`\n[CLI] All locales exported: ${totalSaved} total slides`)
    return
  }

  await runSingle({
    project: opts.project,
    screenshotsDir: opts.screenshots,
    outputDir: opts.output,
    locale: opts.locale ?? null,
    port: opts.port ? Number(opts.port) : DEFAULTS.port,
    timeout: opts.timeout ? Number(opts.timeout) : DEFAULTS.timeoutMs,
  })
}
