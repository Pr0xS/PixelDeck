import type { AssetManifestEntry, Layer, Project } from '@/types'
import { mapLayerTree } from '@/utils/layerTree'
import { assetKeyFromDataUrl, isDataUrl, isHashedAssetKey, mimeForKey } from '@/utils/assetKey'
import { extractInlineAssets, type ExtractedAsset } from '@/utils/assetMigration'

/** Every field that holds an asset reference on a layer / locale patch / format patch. */
const REF_FIELDS = ['screenshotPath', 'src', 'imageRef', 'logoRef'] as const

/** A real asset reference: non-empty, not inline data, not a remote/blob URL. */
export const isAssetRef = (value: unknown): value is string =>
  typeof value === 'string'
  && value.length > 0
  && !isDataUrl(value)
  && !/^(https?|blob):/i.test(value)

function mapRefsInRecord<T extends object>(input: T, fn: (ref: string) => string): T {
  let out: Record<string, unknown> | null = null
  const rec = input as Record<string, unknown>
  for (const field of REF_FIELDS) {
    const value = rec[field]
    if (!isAssetRef(value)) continue
    const next = fn(value)
    if (next !== value) {
      out ??= { ...rec }
      out[field] = next
    }
  }
  return (out ?? input) as T
}

function mapLayerRefs(layer: Layer, fn: (ref: string) => string): Layer {
  let next = mapRefsInRecord(layer, fn)
  if (next.localeContent) {
    let changed = false
    const lc: Record<string, unknown> = {}
    for (const [locale, content] of Object.entries(next.localeContent)) {
      const mapped = mapRefsInRecord(content, fn)
      if (mapped !== content) changed = true
      lc[locale] = mapped
    }
    if (changed) next = { ...next, localeContent: lc } as Layer
  }
  if (next.formatOverrides) {
    let changed = false
    const fo: Record<string, unknown> = {}
    for (const [format, patch] of Object.entries(next.formatOverrides)) {
      const mapped = patch ? mapRefsInRecord(patch, fn) : patch
      if (mapped !== patch) changed = true
      fo[format] = mapped
    }
    if (changed) next = { ...next, formatOverrides: fo } as Layer
  }
  return next
}

/**
 * Rewrite (or just visit, if `fn` is the identity) every asset reference in a
 * project: phone screenshotPath, ImageLayer.src, BackgroundLayer.imageRef,
 * BrandLayer.logoRef, localeContent[*], formatOverrides[*], group children and
 * settings.brandLogoRef. Pure: never mutates the input.
 */
export function mapProjectRefs(project: Project, fn: (ref: string) => string): Project {
  const slideGroups = project.slideGroups.map((g) => ({
    ...g,
    layers: mapLayerTree(g.layers, (l) => mapLayerRefs(l, fn)),
  }))
  const brandRef = project.settings.brandLogoRef
  const nextSettings = isAssetRef(brandRef)
    ? { ...project.settings, brandLogoRef: fn(brandRef) }
    : project.settings
  return { ...project, settings: nextSettings, slideGroups }
}

export function collectAssetKeys(project: Project): Set<string> {
  const out = new Set<string>()
  mapProjectRefs(project, (ref) => {
    out.add(ref)
    return ref
  })
  return out
}

const mimeOf = (dataUrl: string, key: string): string =>
  /^data:([^;,]+)/i.exec(dataUrl)?.[1]?.toLowerCase() ?? mimeForKey(key)

/**
 * Step B: rewrite legacy filename-keyed refs to content-hash keys when their
 * bytes are available via `resolve`. The old filename becomes the manifest
 * display name. Refs whose bytes are unavailable are kept as-is, with a
 * manifest entry named after the ref (so a CLI can match them by filename).
 * Idempotent and pure.
 */
export function rekeyLegacyAssets(
  project: Project,
  resolve: (ref: string) => string | undefined,
): { project: Project; assets: ExtractedAsset[]; missing: string[] } {
  const assets = new Map<string, ExtractedAsset>()
  const missing = new Set<string>()
  const cache = new Map<string, string>()
  const manifest: Record<string, AssetManifestEntry> = { ...(project.assetManifest ?? {}) }
  let manifestChanged = false

  const rekey = (ref: string): string => {
    const hashed: boolean = isHashedAssetKey(ref)
    if (hashed) return ref
    const cached = cache.get(ref)
    if (cached) return cached
    const dataUrl = resolve(ref)
    let result = ref
    if (dataUrl && isDataUrl(dataUrl)) {
      const key = assetKeyFromDataUrl(dataUrl)
      const mime = mimeOf(dataUrl, key)
      if (!assets.has(key)) assets.set(key, { key, name: ref, dataUrl, mime })
      if (!manifest[key]) {
        manifest[key] = { name: ref, mime }
        manifestChanged = true
      }
      result = key
    } else {
      missing.add(ref)
      if (!manifest[ref]) {
        manifest[ref] = { name: ref, mime: mimeForKey(ref) }
        manifestChanged = true
      }
    }
    cache.set(ref, result)
    return result
  }

  const next = mapProjectRefs(project, rekey)
  const out: Project = manifestChanged ? { ...next, assetManifest: manifest } : next
  return { project: out, assets: [...assets.values()], missing: [...missing] }
}

// ─── Bundle formats ───────────────────────────────────────────────────────────

export interface BundleAsset {
  name: string
  mime: string
  dataUrl: string
}

/** v1: assets keyed by (legacy) filename, value is the data URL. */
export interface ProjectExportBundleV1 {
  kind: 'project-export'
  schemaVersion: 1
  project: Project
  assets: Record<string, string>
}

/** v2: assets keyed by content-hash key; `project` contains no `data:` URLs. */
export interface ProjectExportBundleV2 {
  kind: 'project-export'
  schemaVersion: 2
  project: Project
  assets: Record<string, BundleAsset>
}

export type ProjectExportBundle = ProjectExportBundleV2
export type AnyProjectExportBundle = ProjectExportBundleV1 | ProjectExportBundleV2

export interface PreparedExport {
  /** Project with refs only (no `data:`), hash-keyed where bytes were available. */
  project: Project
  assets: Record<string, BundleAsset>
  /** Referenced keys whose bytes could not be resolved. */
  missing: string[]
}

/**
 * Normalize a project for export: convert any inline data to refs, re-key
 * legacy filename refs to hash keys, and collect each referenced image exactly
 * once. Pure (never mutates `project`).
 */
export function prepareProjectForExport(
  project: Project,
  resolve: (key: string) => string | undefined,
  /** Display-name lookup (asset store entry name). Preferred over the manifest name. */
  nameOf?: (key: string) => string | undefined,
): PreparedExport {
  const inline = extractInlineAssets(project)
  const inlineMap = new Map(inline.assets.map((a) => [a.key, a.dataUrl]))
  const composed = (ref: string) => inlineMap.get(ref) ?? resolve(ref)
  const rekeyed = rekeyLegacyAssets(inline.project, composed)
  const finalProject = rekeyed.project
  for (const a of rekeyed.assets) inlineMap.set(a.key, a.dataUrl)

  const assets: Record<string, BundleAsset> = {}
  const missing: string[] = []
  const referenced = collectAssetKeys(finalProject)
  const manifest = finalProject.assetManifest ?? {}
  // Name priority: asset store entry name -> existing manifest name -> key.
  const pickName = (key: string): string => {
    for (const candidate of [nameOf?.(key), manifest[key]?.name]) {
      if (candidate && candidate !== key) return candidate
    }
    return key
  }
  for (const key of referenced) {
    const dataUrl = inlineMap.get(key) ?? resolve(key)
    if (dataUrl && isDataUrl(dataUrl)) {
      assets[key] = {
        name: pickName(key),
        mime: manifest[key]?.mime ?? mimeOf(dataUrl, key),
        dataUrl,
      }
    } else {
      missing.push(key)
    }
  }

  const prunedManifest: Record<string, AssetManifestEntry> = {}
  for (const key of referenced) {
    // Record the resolved name in the exported manifest.
    const entry = assets[key]
      ? { ...(manifest[key] ?? {}), name: assets[key].name, mime: assets[key].mime }
      : manifest[key]
    if (entry) prunedManifest[key] = entry
  }
  const out: Project = { ...finalProject }
  if (Object.keys(prunedManifest).length) out.assetManifest = prunedManifest
  else delete out.assetManifest
  return { project: out, assets, missing }
}

export function buildProjectExportBundle(
  project: Project,
  resolve: (key: string) => string | undefined,
  nameOf?: (key: string) => string | undefined,
): { bundle: ProjectExportBundleV2; missing: string[] } {
  const prepared = prepareProjectForExport(project, resolve, nameOf)
  return {
    bundle: { kind: 'project-export', schemaVersion: 2, project: prepared.project, assets: prepared.assets },
    missing: prepared.missing,
  }
}

export function isProjectExportBundle(value: unknown): value is AnyProjectExportBundle {
  if (!value || typeof value !== 'object') return false
  const b = value as AnyProjectExportBundle
  return (
    b.kind === 'project-export'
    && (b.schemaVersion === 1 || b.schemaVersion === 2)
    && typeof b.project === 'object' && b.project !== null
    && typeof b.assets === 'object' && b.assets !== null
  )
}

/** Flatten a v1 or v2 bundle's assets into uniform records (v1 keys are legacy filenames). */
export function bundleAssetRecords(bundle: AnyProjectExportBundle): Array<{ key: string; name: string; mime: string; dataUrl: string }> {
  const out: Array<{ key: string; name: string; mime: string; dataUrl: string }> = []
  for (const [key, value] of Object.entries(bundle.assets)) {
    if (typeof value === 'string') {
      if (isDataUrl(value)) out.push({ key, name: key, mime: mimeOf(value, key), dataUrl: value })
    } else if (value && typeof value.dataUrl === 'string' && isDataUrl(value.dataUrl)) {
      out.push({ key, name: value.name ?? key, mime: value.mime ?? mimeOf(value.dataUrl, key), dataUrl: value.dataUrl })
    }
  }
  return out
}
