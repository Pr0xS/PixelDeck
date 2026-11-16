#!/usr/bin/env node
/**
 * Build the bundled templates (and the first-run Welcome project) from
 * scripts/templates/sources/<slug>/template.mjs.
 *
 *   node scripts/templates/build.mjs [slug ...] [options]
 *
 *   --preview             Render every slide through the real app and write PNGs
 *                         plus a contact sheet per format/locale (needs `npm run build`)
 *   --formats=a,b         Formats to preview (default: base,iphone-69,android-phone)
 *   --locales=en,es       Locales to preview (default: every locale of the template)
 *   --thumbs              Also write the gallery thumbnail (implies a preview render)
 *   --force               Re-render art even when its source is unchanged
 *   --gc                  Delete asset files no template references any more
 *   --strict              Exit non-zero when the layout lint reports warnings
 *   --sheet-height=640    Slide height in the contact sheet
 *   --out=output/templates  Preview output directory (git-ignored)
 *
 * Outputs: public/templates/<slug>.template.json, public/templates/assets/*,
 * public/templates/thumbs/<slug>.webp and public/templates/index.json.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { collectRefs, finalizeSlideGroups, W, H, DEFAULT_LOCALE } from './lib/dsl.mjs'
import { ASSETS_DIR, ROOT, TEMPLATES_DIR, ensureArt, openBrowser } from './lib/render.mjs'
import { galleryThumb, previewTemplate, serveDist } from './lib/preview.mjs'
import { lintTemplate } from './lib/lint.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const SOURCES = join(here, 'sources')
const THUMBS_DIR = join(TEMPLATES_DIR, 'thumbs')

function parseArgs(argv) {
  const slugs = []
  const opts = {}
  for (const arg of argv) {
    if (!arg.startsWith('--')) slugs.push(arg)
    else {
      const [key, value] = arg.slice(2).split('=')
      opts[key] = value ?? true
    }
  }
  return { slugs, opts }
}

function listSources() {
  return readdirSync(SOURCES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(SOURCES, entry.name, 'template.mjs')))
    .map((entry) => entry.name)
}

async function loadSource(slug) {
  const file = join(SOURCES, slug, 'template.mjs')
  if (!existsSync(file)) throw new Error(`Unknown template source "${slug}" (expected ${file})`)
  const source = (await import(`${pathToFileURL(file).href}?t=${Date.now()}`)).default
  if (source.slug !== slug) throw new Error(`${file}: slug "${source.slug}" must match its folder name "${slug}"`)
  return source
}

async function buildTemplate(browser, source, { force }) {
  const dir = join(SOURCES, source.slug)
  let art = await ensureArt(browser, dir, source.art ?? {}, { force, partial: Boolean(source.lateArt) })
  let groups = source.build({ a: art, W, H })
  if (source.lateArt) {
    // Art that depends on the finished set (e.g. a diagram quoting the slide count):
    // build once to measure, render it, then build again with it available as `late`.
    const screenshots = groups.reduce((sum, g) => sum + g.numSlides, 0)
    const lateSpecs = source.lateArt({ screenshots })
    art = await ensureArt(browser, dir, { ...source.art, ...lateSpecs }, { force })
    const late = { screenshots }
    for (const id of Object.keys(lateSpecs)) late[id] = art[id]
    groups = source.build({ a: art, late, W, H })
  }
  const slideGroups = finalizeSlideGroups(groups)

  const byKey = new Map(Object.values(art).map((entry) => [entry.key, entry]))
  const assetManifest = {}
  for (const key of [...collectRefs(slideGroups)].sort()) {
    const entry = byKey.get(key)
    if (!entry) throw new Error(`${source.slug}: layer references ${key}, which is not one of this template's art entries`)
    assetManifest[key] = { name: entry.name, mime: 'image/webp' }
  }

  return {
    id: `tpl-${source.slug}`,
    kind: 'template',
    schemaVersion: 1,
    name: source.name,
    description: source.description,
    category: source.category,
    author: 'PixelDeck',
    settings: {
      defaultSlideWidth: W,
      defaultSlideHeight: H,
      defaultLocale: DEFAULT_LOCALE,
      ...source.settings,
    },
    ...(Object.keys(assetManifest).length ? { assetManifest } : {}),
    slideGroups,
  }
}

function templatePath(slug) {
  return join(TEMPLATES_DIR, `${slug}.template.json`)
}

/** Rewrite index.json from every source whose template file exists. */
async function writeIndex() {
  const entries = []
  for (const slug of listSources()) {
    if (!existsSync(templatePath(slug))) continue
    const source = await loadSource(slug)
    const template = JSON.parse(readFileSync(templatePath(slug), 'utf8'))
    const first = template.slideGroups[0]
    entries.push({
      order: source.order ?? 100,
      entry: {
        slug,
        name: source.name,
        description: source.description,
        category: source.category,
        ...(source.tour ? { tour: true } : {}),
        file: `/templates/${slug}.template.json`,
        ...(existsSync(join(THUMBS_DIR, `${slug}.webp`)) ? { thumbnail: `/templates/thumbs/${slug}.webp` } : {}),
        slides: template.slideGroups.reduce((sum, g) => sum + g.numSlides, 0),
        previewSize: `${first.slideWidth}×${first.slideHeight}`,
      },
    })
  }
  entries.sort((a, b) => a.order - b.order || a.entry.slug.localeCompare(b.entry.slug))
  const index = { schemaVersion: 1, templates: entries.map((item) => item.entry) }
  writeFileSync(join(TEMPLATES_DIR, 'index.json'), `${JSON.stringify(index, null, 2)}\n`)
}

/** Remove asset files that no template on disk references. */
function collectGarbage() {
  const used = new Set()
  for (const file of readdirSync(TEMPLATES_DIR)) {
    if (!file.endsWith('.template.json')) continue
    const template = JSON.parse(readFileSync(join(TEMPLATES_DIR, file), 'utf8'))
    for (const key of collectRefs(template.slideGroups)) used.add(key)
  }
  if (!existsSync(ASSETS_DIR)) return
  for (const file of readdirSync(ASSETS_DIR)) {
    if (!used.has(file)) {
      rmSync(join(ASSETS_DIR, file))
      console.log(`  gc removed ${file}`)
    }
  }
}

async function main() {
  const { slugs: requested, opts } = parseArgs(process.argv.slice(2))
  const slugs = requested.length ? requested : listSources()
  const wantPreview = Boolean(opts.preview || opts.thumbs)
  const outRoot = resolve(ROOT, typeof opts.out === 'string' ? opts.out : 'output/templates')

  const browser = await openBrowser()
  const server = wantPreview ? await serveDist() : null
  try {
    for (const slug of slugs) {
      console.log(`\n■ ${slug}`)
      const source = await loadSource(slug)
      const template = await buildTemplate(browser, source, { force: Boolean(opts.force) })
      writeFileSync(templatePath(slug), `${JSON.stringify(template, null, 2)}\n`)
      const slides = template.slideGroups.reduce((sum, g) => sum + g.numSlides, 0)
      console.log(`  wrote ${slug}.template.json (${template.slideGroups.length} groups, ${slides} slides)`)

      const warnings = await lintTemplate(browser, template)
      for (const warning of warnings) console.log(`  ⚠ ${warning}`)
      console.log(warnings.length ? `  lint: ${warnings.length} warning(s)` : '  lint: clean')
      if (warnings.length && opts.strict) process.exitCode = 1

      if (!wantPreview) continue
      const formats = typeof opts.formats === 'string' ? opts.formats.split(',') : ['base', 'iphone-69', 'android-phone']
      const locales = typeof opts.locales === 'string'
        ? opts.locales.split(',')
        : template.settings.locales ?? [template.settings.defaultLocale]
      const written = await previewTemplate(browser, server.url, template, join(outRoot, slug), {
        formats,
        locales,
        sheetHeight: Number(opts['sheet-height'] ?? 640),
      })
      if (opts.thumbs) {
        const source69 = written[`iphone-69-${template.settings.defaultLocale}`] ?? Object.values(written)[0]
        mkdirSync(THUMBS_DIR, { recursive: true })
        await galleryThumb(browser, source69.files, join(THUMBS_DIR, `${slug}.webp`), { background: source.thumbBackground })
        console.log(`  thumb → public/templates/thumbs/${slug}.webp`)
      }
    }
  } finally {
    await browser.close()
    server?.close()
  }

  if (opts.gc) collectGarbage()
  await writeIndex()
}

main().catch((error) => {
  console.error(`[templates] ${error instanceof Error ? error.stack ?? error.message : error}`)
  process.exitCode = 1
})
