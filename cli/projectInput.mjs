/**
 * Pure (browser-free) helpers for the CLI: project input sniffing/normalization
 * and asset resolution. Kept separate from export.mjs so they can be unit tested
 * without Playwright.
 *
 * Accepted --project inputs:
 *   - raw Project JSON (`{ slideGroups, settings, ... }`)
 *   - JSON bundle v1  `{ kind:'project-export', schemaVersion:1, project, assets:{key:dataUrl} }`
 *   - JSON bundle v2  `{ kind:'project-export', schemaVersion:2, project, assets:{key:{name,mime,dataUrl}} }`
 *   - ZIP export      `project.json` + `assets/<key>` binary files
 *   - legacy projects with inline `data:` URLs (migrated in the page by ExportApp)
 */
import { createHash } from 'node:crypto'
import JSZip from 'jszip'

// ─── Asset keys (must match src/utils/assetKey.ts) ───────────────────────────

const MIME_TO_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
}

const EXT_TO_MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
}

export function extForMime(mime) {
  return MIME_TO_EXT[String(mime).toLowerCase()] ?? 'bin'
}

export function mimeForName(name) {
  const dot = name.lastIndexOf('.')
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
  return EXT_TO_MIME[ext] ?? 'application/octet-stream'
}

/** `img_<first 24 hex of SHA-256 of the raw bytes>.<ext>` — same as assetKeyFromBytes(). */
export function assetKeyFromBytes(bytes, mime) {
  const hex = createHash('sha256').update(bytes).digest('hex').slice(0, 24)
  return `img_${hex}.${extForMime(mime)}`
}

export function toDataUrl(bytes, mime) {
  return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`
}

const isRemote = (v) => typeof v === 'string' && /^(https?|blob):/i.test(v)
/** Mirrors src/utils/projectAssets.ts isAssetRef: non-empty, not data:, not http(s)/blob: */
const isRef = (v) => typeof v === 'string' && v.length > 0 && !v.startsWith('data:') && !isRemote(v)

/** Ref field → legacy inline-data sibling field (see src/utils/assetMigration.ts). */
const LEGACY_INLINE = {
  screenshotPath: 'screenshotDataUrl',
  imageRef: 'imageDataUrl',
  logoRef: 'logoDataUrl',
  brandLogoRef: 'brandLogoDataUrl',
}
const hasInline = (rec, field) => {
  const legacy = LEGACY_INLINE[field]
  return !!legacy && typeof rec[legacy] === 'string' && rec[legacy].startsWith('data:')
}

// ─── Ref walking ──────────────────────────────────────────────────────────────

const REF_FIELDS = ['screenshotPath', 'src', 'imageRef', 'logoRef']

function mapFields(rec, fields, fn, opts = {}) {
  let out = rec
  for (const f of fields) {
    const v = rec[f]
    if (isRemote(v) && f === 'src') opts.onRemote?.(v)
    if (isRef(v)) {
      if (opts.skipInlineBacked && hasInline(rec, f)) continue
      const next = fn(v)
      if (next !== v) {
        if (out === rec) out = { ...rec }
        out[f] = next
        // The ref now points at a different (folder/embedded) source: stale
        // inline data must not override it, so drop it from the payload.
        const legacy = LEGACY_INLINE[f]
        if (legacy && legacy in out) delete out[legacy]
      }
    }
  }
  return out
}

function mapPatchMap(map, fn, localeFilter, opts) {
  if (!map || typeof map !== 'object') return map
  let out = map
  for (const [k, patch] of Object.entries(map)) {
    if (!patch || typeof patch !== 'object') continue
    if (localeFilter && !localeFilter.has(k)) continue
    const next = mapFields(patch, REF_FIELDS, fn, opts)
    if (next !== patch) {
      if (out === map) out = { ...map }
      out[k] = next
    }
  }
  return out
}

function mapLayer(layer, fn, opts) {
  if (!layer || typeof layer !== 'object') return layer
  let out = mapFields(layer, REF_FIELDS, fn, opts)
  const lc = mapPatchMap(out.localeContent, fn, opts.locales, opts)
  if (lc !== out.localeContent) out = { ...out, localeContent: lc }
  const lo = mapPatchMap(out.localeOverrides, fn, opts.locales, opts)
  if (lo !== out.localeOverrides) out = { ...out, localeOverrides: lo }
  // Format overrides are keyed by canvas format, not locale: never locale-filtered.
  const fo = mapPatchMap(out.formatOverrides, fn, undefined, opts)
  if (fo !== out.formatOverrides) out = { ...out, formatOverrides: fo }
  if (Array.isArray(out.children)) {
    const children = out.children.map((c) => mapLayer(c, fn, opts))
    if (children.some((c, i) => c !== out.children[i])) out = { ...out, children }
  }
  return out
}

/** Non-mutating: returns a project with every asset ref passed through `fn`. */
export function mapProjectRefs(project, fn, opts = {}) {
  const slideGroups = (project.slideGroups ?? []).map((g) => {
    const layers = (g.layers ?? []).map((l) => mapLayer(l, fn, opts))
    return layers.some((l, i) => l !== g.layers[i]) ? { ...g, layers } : g
  })
  let settings = project.settings
  if (settings && typeof settings === 'object') settings = mapFields(settings, ['brandLogoRef'], fn, opts)
  return { ...project, settings, slideGroups }
}

/**
 * Collect non-data asset refs. `opts.locales` (Set) restricts locale patches to
 * the locales that will actually be rendered; omit for "everything".
 */
export function collectProjectRefs(project, opts = {}) {
  const refs = new Set()
  mapProjectRefs(project, (r) => { refs.add(r); return r }, opts)
  return refs
}

/** Remote/blob URLs used as image `src` — these are never resolvable asset refs. */
export function findRemoteImageUrls(project) {
  const urls = new Set()
  mapProjectRefs(project, (r) => r, { onRemote: (u) => urls.add(u) })
  return [...urls]
}

// ─── Input sniffing ───────────────────────────────────────────────────────────

function isProjectLike(v) {
  return !!v && typeof v === 'object' && Array.isArray(v.slideGroups)
}

/**
 * Normalize an already-parsed JSON document into `{ project, embedded }`.
 * `embedded` maps asset key → `{ name?, mime?, dataUrl }`.
 */
export function normalizeProjectJson(json, context = 'project file') {
  if (json && typeof json === 'object' && json.kind === 'project-export') {
    const project = json.project
    if (!isProjectLike(project)) {
      throw new Error(`${context}: bundle has no valid "project" (expected an object with a "slideGroups" array).`)
    }
    const embedded = {}
    const assets = json.assets && typeof json.assets === 'object' ? json.assets : {}
    for (const [key, value] of Object.entries(assets)) {
      if (typeof value === 'string') {
        embedded[key] = { dataUrl: value } // v1
      } else if (value && typeof value === 'object' && typeof value.dataUrl === 'string') {
        embedded[key] = { name: value.name, mime: value.mime, dataUrl: value.dataUrl } // v2
      }
    }
    return { project: withManifestFromEmbedded(project, embedded), embedded }
  }
  if (isProjectLike(json)) return { project: json, embedded: {} }
  throw new Error(
    `${context}: expected a project JSON object with a "slideGroups" array, a project-export bundle, or a .zip project export.`,
  )
}

function withManifestFromEmbedded(project, embedded) {
  const manifest = { ...(project.assetManifest ?? {}) }
  let changed = false
  for (const [key, e] of Object.entries(embedded)) {
    if (!manifest[key] && e.name) {
      manifest[key] = { name: e.name, mime: e.mime ?? mimeForName(key) }
      changed = true
    }
  }
  return changed ? { ...project, assetManifest: manifest } : project
}

/** Must match isZipBytes in src/utils/projectZip.ts: local-file-header magic `PK\\x03\\x04` only. */
export function isZipBuffer(buf) {
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 && buf[3] === 0x04)
}

async function readZip(buf, context) {
  let zip
  try {
    zip = await JSZip.loadAsync(buf)
  } catch (error) {
    throw new Error(`${context}: not a valid zip archive (${error instanceof Error ? error.message : error})`)
  }
  const projectEntry = zip.file('project.json')
  if (!projectEntry) throw new Error(`${context}: zip does not contain project.json at its root.`)
  let json
  try {
    json = JSON.parse(await projectEntry.async('string'))
  } catch (error) {
    throw new Error(`${context}: project.json inside the zip is not valid JSON (${error instanceof Error ? error.message : error})`)
  }
  const { project, embedded: fromJson } = normalizeProjectJson(json, `${context} (project.json)`)
  const manifest = project.assetManifest ?? {}
  const embedded = { ...fromJson }
  const entries = zip.file(/^assets\/[^/]+$/)
  for (const entry of entries) {
    const key = entry.name.slice('assets/'.length)
    if (!key) continue
    const bytes = await entry.async('nodebuffer')
    const mime = manifest[key]?.mime ?? mimeForName(key)
    embedded[key] = { name: manifest[key]?.name, mime, dataUrl: toDataUrl(bytes, mime) }
  }
  return { project, embedded }
}

/** Parse a project input from raw bytes (zip is sniffed by magic number). */
export async function parseProjectInput(buf, context = 'project file') {
  if (isZipBuffer(buf)) return readZip(buf, context)
  let json
  try {
    json = JSON.parse(buf.toString('utf8'))
  } catch (error) {
    throw new Error(`${context}: not valid JSON (${error instanceof Error ? error.message : error})`)
  }
  return normalizeProjectJson(json, context)
}

// ─── Asset resolution ─────────────────────────────────────────────────────────

export function resolveAssetAliases(refs, files) {
  const aliases = {}
  for (const ref of refs) {
    const file = files.find((candidate) =>
      ref === candidate || ref.endsWith(`-${candidate}`) || ref.endsWith(`/${candidate}`))
    if (file) aliases[ref] = file
  }
  return aliases
}

/**
 * Build the page's asset map.
 *
 * Priority (highest first):
 *  1. screenshots-folder files: matched by display name against
 *     `assetManifest[*].name`, or by exact legacy filename key. They OVERRIDE
 *     embedded images; the project's refs are rewritten to the file's
 *     content-hash key (identical to what the GUI would compute).
 *  2. bundle / zip embedded assets (keys preserved).
 *  3. legacy suffix aliases (`<prefix>-x.png`, `dir/x.png`) against folder files.
 *
 * @param {object} args
 * @param {object} args.project
 * @param {Record<string,{name?:string,mime?:string,dataUrl:string}>} [args.embedded]
 * @param {Array<{name:string, bytes:Buffer}>} [args.folderFiles]
 * @param {Iterable<string>} [args.locales] locales that will be rendered (restricts missing check)
 * @returns {{ project: object, assets: Record<string,string>, missing: string[] }}
 */
export function resolveJobAssets({ project, embedded = {}, folderFiles = [], locales }) {
  const localeSet = locales ? new Set(locales) : undefined
  const assets = {}
  const files = folderFiles.map((f) => {
    const mime = mimeForName(f.name)
    return { name: f.name, mime, key: assetKeyFromBytes(f.bytes, mime), dataUrl: toDataUrl(f.bytes, mime) }
  })
  const fileByName = new Map(files.map((f) => [f.name, f]))

  const allRefs = collectProjectRefs(project)
  const manifest = project.assetManifest ?? {}

  // 1. Folder overrides → rewrite refs to the file's content key.
  const remap = new Map()
  const warnings = []
  const refsByFile = new Map()
  for (const ref of allRefs) {
    const entryName = manifest[ref]?.name
    const file = (entryName && fileByName.get(entryName)) || fileByName.get(ref)
    if (!file) continue
    assets[file.key] = file.dataUrl
    if (file.key !== ref) remap.set(ref, file.key)
    if (!refsByFile.has(file.name)) refsByFile.set(file.name, new Set())
    refsByFile.get(file.name).add(ref)
  }
  for (const [name, refs] of refsByFile) {
    if (refs.size > 1) {
      warnings.push(`screenshots file "${name}" matches ${refs.size} different images; all of them will use this file: ${[...refs].join(', ')}`)
    }
  }
  for (const url of findRemoteImageUrls(project)) {
    warnings.push(`image src "${url}" is a remote/blob URL, not a project asset; it will not be resolved by the headless export.`)
  }
  let out = project
  if (remap.size > 0) {
    out = mapProjectRefs(project, (r) => remap.get(r) ?? r)
    const nextManifest = { ...manifest }
    for (const [from, to] of remap) {
      const prev = manifest[from]
      nextManifest[to] = { ...(prev ?? {}), name: prev?.name ?? fileByName.get(from)?.name ?? to, mime: mimeForName(to) }
    }
    out = { ...out, assetManifest: nextManifest }
  }

  // 2. Embedded assets fill any ref the folder did not cover.
  const refsNow = collectProjectRefs(out)
  for (const ref of refsNow) {
    if (assets[ref] === undefined && embedded[ref]) assets[ref] = embedded[ref].dataUrl
  }

  // 3. Legacy suffix aliases for whatever is still unresolved.
  const unresolved = [...refsNow].filter((r) => assets[r] === undefined)
  if (unresolved.length > 0 && files.length > 0) {
    const aliases = resolveAssetAliases(unresolved, files.map((f) => f.name))
    for (const [ref, name] of Object.entries(aliases)) assets[ref] = fileByName.get(name).dataUrl
  }

  // Missing check, restricted to the locales that will be rendered.
  // Refs backed by legacy inline data are not missing (ExportApp extracts the
  // inline bytes) unless a folder/embedded source already supplies them.
  const relevant = collectProjectRefs(out, { ...(localeSet ? { locales: localeSet } : {}), skipInlineBacked: true })
  const missing = [...relevant].filter((r) => assets[r] === undefined).sort()
  return { project: out, assets, missing, warnings }
}

/** Human-readable label for a missing ref (display name when known). */
export function describeMissing(project, refs) {
  const manifest = project.assetManifest ?? {}
  return refs.map((r) => (manifest[r]?.name && manifest[r].name !== r ? `${manifest[r].name} (${r})` : r))
}
