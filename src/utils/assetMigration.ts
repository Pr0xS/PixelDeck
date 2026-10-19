import type {
  AssetManifestEntry, Layer, LegacyInlineImageFields, Project, SlideGroup,
} from '@/types'
import { assetKeyFromDataUrl, extForMime, isDataUrl, isHashedAssetKey, parseDataUrl } from '@/utils/assetKey'
import { mapLayerTree } from '@/utils/layerTree'

/**
 * Read the legacy inline-image fields off a RAW (pre-migration) layer, patch
 * or settings object. They no longer exist on the public types; this is the
 * single greppable escape hatch (mirrors `getLegacyLocaleLayoutFields`).
 */
export function getLegacyInlineImageFields(raw: object): LegacyInlineImageFields {
  return raw as unknown as LegacyInlineImageFields
}

export interface ExtractedAsset {
  key: string
  name: string
  dataUrl: string
  mime: string
}

export interface ExtractAssetsOptions {
  /** Optional generator for display names of assets that had no prior filename. */
  nameFor?: (kind: string, ext: string, index: number) => string
  /**
   * Resolve an existing asset ref to its bytes (asset store, bundle assets, …).
   * When a layer's current ref resolves, the stored asset WINS and any legacy
   * inline data is dropped (matches the old renderer: stored asset first,
   * inline only as a fallback). When it does not resolve, inline data is
   * extracted and wins.
   */
  resolve?: (ref: string) => string | undefined
}

interface Ctx {
  assets: Map<string, ExtractedAsset>
  opts: ExtractAssetsOptions
  warnings: string[]
}

function warnOnce(ctx: Ctx): void {
  if (ctx.warnings.length === 0) return
  console.warn(
    `[assetMigration] ${ctx.warnings.length} malformed inline image value(s) left untouched: ${ctx.warnings.slice(0, 5).join('; ')}`,
  )
}

function register(ctx: Ctx, dataUrl: string, preferredName: string | undefined, kind: string): string {
  const key = assetKeyFromDataUrl(dataUrl)
  const existing = ctx.assets.get(key)
  if (existing) return key
  const { mime } = parseDataUrl(dataUrl)
  const ext = extForMime(mime)
  const useName = preferredName && !isDataUrl(preferredName) && !isHashedAssetKey(preferredName)
  const name = useName
    ? preferredName
    : ctx.opts.nameFor
      ? ctx.opts.nameFor(kind, ext, ctx.assets.size + 1)
      : `${kind}.${ext}`
  ctx.assets.set(key, { key, name, dataUrl, mime })
  return key
}

/**
 * Convert inline fields on a layer / localeContent entry / format-override
 * patch into asset refs. Returns a shallow copy only if something changed.
 */
function processRecord<T extends object>(ctx: Ctx, input: T): T {
  const rec = { ...(input as Record<string, unknown>) }
  const legacy = getLegacyInlineImageFields(rec)
  let changed = false

  const fold = (refField: string, legacyField: keyof LegacyInlineImageFields, kind: string) => {
    const legacyVal = legacy[legacyField]
    const current = rec[refField]
    const hasLegacy = legacyField in rec
    const currentIsRef = typeof current === 'string' && current.length > 0 && !isDataUrl(current)
    // A resolvable stored asset wins over stale inline data.
    if (currentIsRef && ctx.opts.resolve?.(current)) {
      if (hasLegacy) {
        delete rec[legacyField]
        changed = true
      }
      return
    }
    const inline = isDataUrl(current) ? current : isDataUrl(legacyVal) ? legacyVal : undefined
    if (inline) {
      try {
        rec[refField] = register(ctx, inline, currentIsRef ? current : undefined, kind)
      } catch {
        ctx.warnings.push(`${kind}: ${String(inline).slice(0, 24)}…`)
        return // keep raw value (and legacy field) untouched
      }
      if (hasLegacy) delete rec[legacyField]
      changed = true
    } else if (hasLegacy) {
      delete rec[legacyField]
      changed = true
    }
  }

  fold('screenshotPath', 'screenshotDataUrl', 'screenshot')
  fold('imageRef', 'imageDataUrl', 'background')
  fold('logoRef', 'logoDataUrl', 'logo')

  // ImageLayer.src / LocaleContent.src: only a data: value needs conversion.
  const srcVal = rec.src
  if (isDataUrl(srcVal)) {
    try {
      rec.src = register(ctx, srcVal, undefined, 'image')
      changed = true
    } catch {
      ctx.warnings.push(`image: ${srcVal.slice(0, 24)}…`)
    }
  }
  return changed ? (rec as T) : input
}

function processLayer(ctx: Ctx, layer: Layer): Layer {
  let next = processRecord(ctx, layer)
  if (next.localeContent) {
    let lcChanged = false
    const lc: Record<string, typeof next.localeContent[string]> = {}
    for (const [locale, content] of Object.entries(next.localeContent)) {
      const p = processRecord(ctx, content)
      if (p !== content) lcChanged = true
      lc[locale] = p
    }
    if (lcChanged) next = { ...next, localeContent: lc } as Layer
  }
  if (next.formatOverrides) {
    let foChanged = false
    const fo: Record<string, unknown> = {}
    for (const [format, patch] of Object.entries(next.formatOverrides)) {
      const p = patch ? processRecord(ctx, patch) : patch
      if (p !== patch) foChanged = true
      fo[format] = p
    }
    if (foChanged) next = { ...next, formatOverrides: fo } as Layer
  }
  return next
}

function processGroups(ctx: Ctx, groups: SlideGroup[]): SlideGroup[] {
  return groups.map((g) => ({
    ...g,
    layers: mapLayerTree(g.layers, (l) => processLayer(ctx, l)),
  }))
}

function manifestFrom(ctx: Ctx, existing: Project['assetManifest']): Project['assetManifest'] {
  if (ctx.assets.size === 0) return existing
  const manifest: Record<string, AssetManifestEntry> = { ...(existing ?? {}) }
  for (const a of ctx.assets.values()) {
    if (!manifest[a.key]) manifest[a.key] = { name: a.name, mime: a.mime }
  }
  return manifest
}

/**
 * Pure, idempotent, non-mutating migration of inline `data:` images to
 * content-hash asset refs. See assetKey.ts for the key format.
 */
export function extractInlineAssets(project: Project, opts: ExtractAssetsOptions = {}): {
  project: Project
  assets: ExtractedAsset[]
} {
  const ctx: Ctx = { assets: new Map(), opts, warnings: [] }
  const slideGroups = processGroups(ctx, project.slideGroups)

  const settings = processRecord(ctx, project.settings) as Project['settings'] & LegacyInlineImageFields
  let nextSettings: Project['settings'] = settings
  const legacySettings = getLegacyInlineImageFields(project.settings)
  if ('brandLogoDataUrl' in legacySettings) {
    const { brandLogoDataUrl: inline, ...rest } = { ...settings } as Project['settings'] & LegacyInlineImageFields
    const existingRef = (settings as Project['settings']).brandLogoRef
    if (existingRef && !isDataUrl(existingRef) && opts.resolve?.(existingRef)) {
      nextSettings = rest // stored logo wins
    } else if (isDataUrl(inline)) {
      try {
        nextSettings = { ...rest, brandLogoRef: register(ctx, inline, 'brand-logo', 'brand-logo') }
      } catch {
        ctx.warnings.push(`brand-logo: ${inline.slice(0, 24)}…`)
      }
    } else {
      nextSettings = rest
    }
  }
  warnOnce(ctx)

  if (ctx.assets.size === 0 && slideGroups.every((g, i) => g.layers.every((l, j) => l === project.slideGroups[i].layers[j])) && nextSettings === project.settings) {
    return { project, assets: [] }
  }
  const next: Project = {
    ...project,
    settings: nextSettings,
    slideGroups,
  }
  const manifest = manifestFrom(ctx, project.assetManifest)
  if (manifest) next.assetManifest = manifest
  return { project: next, assets: [...ctx.assets.values()] }
}

/**
 * Template/slide-group variant: same extraction applied to bare slide groups
 * (no project settings). Used by template import.
 */
export function extractInlineAssetsFromGroups(
  slideGroups: SlideGroup[],
  opts: ExtractAssetsOptions = {},
): { slideGroups: SlideGroup[]; assets: ExtractedAsset[]; manifest: Record<string, AssetManifestEntry> } {
  const ctx: Ctx = { assets: new Map(), opts, warnings: [] }
  const out = processGroups(ctx, slideGroups)
  warnOnce(ctx)
  const manifest: Record<string, AssetManifestEntry> = {}
  for (const a of ctx.assets.values()) manifest[a.key] = { name: a.name, mime: a.mime }
  return { slideGroups: out, assets: [...ctx.assets.values()], manifest }
}
