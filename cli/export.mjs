import { chromium } from '@playwright/test'
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync, statSync } from 'fs'
import { join, resolve, basename, dirname, relative } from 'path'
import { fileURLToPath } from 'url'
import { createServer } from 'http'
import { readFile } from 'fs/promises'
import { extname } from 'path'
import yaml from 'js-yaml'
import {
  parseProjectInput,
  collectProjectRefs,
  resolveAssetAliases,
  resolveJobAssets,
  describeMissing,
} from './projectInput.mjs'
import { normalizeFormatIds, getExportFilePath } from './formatOptions.mjs'

export { resolveAssetAliases }

const __dirname = dirname(fileURLToPath(import.meta.url))
const distPath = resolve(__dirname, '../dist')

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULTS = {
  port: 4321,
  timeoutMs: 60000,
  viewport: { width: 1400, height: 900 },
}

function requireNonEmptyString(value, field, context = 'Export job') {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${context}: "${field}" must be a non-empty string.`)
  }
}

function parsePositiveInteger(value, field, fallback) {
  if (value === undefined) return fallback
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Export option "${field}" must be a positive integer.`)
  }
  return parsed
}

function validateBuild() {
  const indexPath = join(distPath, 'index.html')
  if (!existsSync(indexPath) || !statSync(indexPath).isFile()) {
    throw new Error(`Build not found at ${indexPath}. Run "npm run build" first.`)
  }
}

async function validateJob(job, context = 'Export job') {
  if (!job || typeof job !== 'object' || Array.isArray(job)) {
    throw new Error(`${context} must be an object.`)
  }
  requireNonEmptyString(job.project, 'project', context)
  requireNonEmptyString(job.outputDir, 'output', context)
  if (job.screenshotsDir !== undefined) requireNonEmptyString(job.screenshotsDir, 'screenshots', context)
  if (job.locale !== undefined && job.locale !== null) requireNonEmptyString(job.locale, 'locale', context)

  const projectPath = resolve(job.project)
  if (!existsSync(projectPath) || !statSync(projectPath).isFile()) {
    throw new Error(`${context}: project file not found: ${projectPath}`)
  }

  // Accepts raw project JSON, project-export bundles (v1/v2) and .zip exports.
  const { project: projectJson, embedded } = await parseProjectInput(
    readFileSync(projectPath),
    `${context}: ${projectPath}`,
  )
  return { projectPath, projectJson, embedded }
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

export function collectAssetRefsFromProject(project) {
  return collectProjectRefs(project)
}

/** Read image files (name + bytes) from the screenshots folder. */
function readScreenshotFolder(screenshotsDir) {
  if (!screenshotsDir) return []
  const absDir = resolve(screenshotsDir)
  if (!existsSync(absDir)) {
    console.warn(`[CLI] Screenshots dir not found: ${absDir}`)
    return []
  }
  const names = readdirSync(absDir).filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
  console.log(`[CLI] Loaded ${names.length} screenshots from ${absDir}`)
  return names.map((name) => ({ name, bytes: readFileSync(join(absDir, name)) }))
}

/** Locales that will actually be rendered for this job. */
function localesForJob(projectJson, locale) {
  return [locale ?? projectJson.settings?.defaultLocale ?? 'en']
}

function isTruthyFlag(v) {
  return v === true || (v !== undefined && v !== null && v !== false && String(v).toLowerCase() !== 'false')
}

// ─── Single export run ────────────────────────────────────────────────────────

async function runSingle({ project, screenshotsDir, outputDir, locale, formatIds, port = DEFAULTS.port, timeout = DEFAULTS.timeoutMs, allowMissing = false }) {
  validateBuild()
  const { projectJson: rawProject, embedded } = await validateJob({ project, screenshotsDir, outputDir, locale })

  // Resolve every referenced image: folder > embedded (bundle/zip) > legacy aliases
  const { project: projectJson, assets, missing, warnings } = resolveJobAssets({
    project: rawProject,
    embedded,
    folderFiles: readScreenshotFolder(screenshotsDir),
    locales: localesForJob(rawProject, locale),
  })
  for (const w of warnings) console.warn(`[CLI] Warning: ${w}`)
  if (missing.length > 0) {
    const list = describeMissing(projectJson, missing).map((m) => `  - ${m}`).join('\n')
    if (!allowMissing) {
      throw new Error(
        `${missing.length} referenced image(s) could not be found:\n${list}\n` +
        'Add them to the --screenshots folder (matched by original file name), use a project bundle/zip that embeds them, ' +
        'or pass --allow-missing to export with placeholders.',
      )
    }
    console.warn(`[CLI] Warning: ${missing.length} image(s) missing, continuing (--allow-missing):\n${list}`)
  }

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
    }, { project: projectJson, assets, locale: locale ?? null, formatIds, allowMissing })

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
    const useFormatDirectories = new Set(results.map((result) => result.formatId)).size > 1
    for (const result of results) {
      const { name, dataUrl } = result
      const targetPath = getExportFilePath(localeOutput, result, useFormatDirectories)
      mkdirSync(dirname(targetPath), { recursive: true })
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
      writeFileSync(targetPath, Buffer.from(base64, 'base64'))
      console.log(`  ✓ ${relative(localeOutput, targetPath)}`)
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
  if (!opts || typeof opts !== 'object' || Array.isArray(opts)) {
    throw new Error('Export options must be an object.')
  }
  const port = parsePositiveInteger(opts.port, 'port', DEFAULTS.port)
  const timeout = parsePositiveInteger(opts.timeout, 'timeout', DEFAULTS.timeoutMs)
  const allowMissing = isTruthyFlag(opts['allow-missing'])
  const formatIds = normalizeFormatIds(opts.format)

  // Batch mode: --config=batch.yaml
  if (opts.config) {
    requireNonEmptyString(opts.config, 'config', 'Export options')
    const configPath = resolve(opts.config)
    if (!existsSync(configPath) || !statSync(configPath).isFile()) {
      throw new Error(`Batch config file not found: ${configPath}`)
    }
    const raw = readFileSync(configPath, 'utf8')
    let batch
    try {
      batch = yaml.load(raw)
    } catch (error) {
      throw new Error(`Batch config is not valid YAML: ${configPath} (${error instanceof Error ? error.message : error})`)
    }

    if (!batch || typeof batch !== 'object' || !Array.isArray(batch.jobs) || batch.jobs.length === 0) {
      throw new Error('Batch config must have a "jobs" array')
    }

    validateBuild()
    const jobs = batch.jobs.map((job, i) => {
      if (!job || typeof job !== 'object' || Array.isArray(job)) {
        throw new Error(`Batch job ${i + 1} must be an object.`)
      }
      const normalized = {
        project: job.project,
        screenshotsDir: job.screenshots,
        outputDir: job.output,
        locale: job.locale ?? null,
      }
      return normalized
    })
    for (const [i, job] of jobs.entries()) await validateJob(job, `Batch job ${i + 1}`)

    let totalSaved = 0
    for (const [i, job] of jobs.entries()) {
      console.log(`\n[CLI] Job ${i + 1}/${batch.jobs.length}: ${job.project}`)
      const result = await runSingle({
        project: job.project,
        screenshotsDir: job.screenshotsDir,
        outputDir: job.outputDir,
        locale: job.locale,
        formatIds,
        port: opts.port ? port : DEFAULTS.port + i,  // different port per job to avoid conflict
        timeout,
        allowMissing,
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
  validateBuild()
  const { projectJson: singleProject } = await validateJob({
    project: opts.project,
    screenshotsDir: opts.screenshots,
    outputDir: opts.output,
    locale: opts.locale ?? null,
  })

  // Single mode — with optional locale
  if (opts['all-locales']) {
    // Export all locales defined in the project
    const projectJson = singleProject
    const locales = projectJson.settings?.locales ?? [projectJson.settings?.defaultLocale ?? 'en']
    let totalSaved = 0
    for (const locale of locales) {
      console.log(`\n[CLI] Exporting locale: ${locale}`)
      const result = await runSingle({
        project: opts.project,
        screenshotsDir: opts.screenshots,
        outputDir: opts.output,
        locale,
        formatIds,
        port,
        timeout,
        allowMissing,
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
    formatIds,
    port,
    timeout,
    allowMissing,
  })
}
