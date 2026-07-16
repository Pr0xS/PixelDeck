import { nanoid } from 'nanoid'
import type {
  Layer, SlideGroup, GroupLayer, PhoneLayer,
  Template, Project, ProjectSettings,
  CanvasBackground, BackgroundLayer,
} from '@/types'
import { migrateLayerSpans } from '@/store/helpers'

// ─── ID helpers ──────────────────────────────────────────────────────────────

function cloneLayerWithNewId(layer: Layer): Layer {
  const clone = JSON.parse(JSON.stringify(layer)) as Layer
  clone.id = nanoid(10)
  if (clone.type === 'group') {
    ;(clone as GroupLayer).children = (clone as GroupLayer).children.map(cloneLayerWithNewId)
  }
  return clone
}

/** Deep-clone a layer array assigning fresh nanoid() IDs to every layer (and group children). */
export function cloneLayersWithNewIds(layers: Layer[]): Layer[] {
  return layers.map(cloneLayerWithNewId)
}

/** Rewrite all layer ids to deterministic l0, l1, … for clean diffs in committed template files. */
export function deterministicIds(layers: Layer[]): Layer[] {
  let counter = 0
  function walk(layer: Layer): Layer {
    const next = { ...layer, id: `l${counter++}` } as Layer
    if (next.type === 'group') {
      ;(next as GroupLayer).children = (next as GroupLayer).children.map(walk)
    }
    return next
  }
  return layers.map(walk)
}

// ─── Asset scrubbing ─────────────────────────────────────────────────────────

/**
 * Strip screenshotPath (asset-store keys) from PhoneLayers and locale overrides.
 * screenshotDataUrl (inline base64) is kept — callers may include stock images there.
 */
function stripFromLayer(layer: Layer): Layer {
  let next = { ...layer } as Layer

  // Strip screenshotPath from phone layers (it's a store reference, useless elsewhere)
  if (next.type === 'phone') {
    const phone = next as PhoneLayer
    if (phone.screenshotPath !== undefined) {
      const { screenshotPath: _drop, ...rest } = phone
      void _drop
      next = rest as Layer
    }
  }

  // Strip screenshotPath from locale overrides (any layer type)
  if (next.localeOverrides) {
    const lo: NonNullable<typeof next.localeOverrides> = {}
    for (const [locale, patch] of Object.entries(next.localeOverrides)) {
      if (patch.screenshotPath !== undefined) {
        const { screenshotPath: _drop, ...restPatch } = patch
        void _drop
        lo[locale] = restPatch
      } else {
        lo[locale] = patch
      }
    }
    next = { ...next, localeOverrides: lo }
  }

  if (next.type === 'group') {
    next = { ...next, children: (next as GroupLayer).children.map(stripFromLayer) } as Layer
  }

  return next
}

export function stripScreenshotPaths(layers: Layer[]): Layer[] {
  return layers.map(stripFromLayer)
}

export interface ExtractedScreenshotsResult {
  slideGroups: SlideGroup[]
  assets: Array<{ filename: string; dataUrl: string }>
}

/**
 * Walk cloned template groups (including group children and locale overrides),
 * replacing inline phone screenshots with deduplicated asset-store keys.
 * BackgroundLayer.imageDataUrl and ImageLayer.src are intentionally untouched.
 * Pure: callers must register every returned asset with the asset store.
 */
export function extractInlineScreenshots(
  templateName: string,
  slideGroups: SlideGroup[],
): ExtractedScreenshotsResult {
  const cloned = JSON.parse(JSON.stringify(slideGroups)) as SlideGroup[]
  const slug = templateName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
  const filenamesByDataUrl = new Map<string, string>()
  const assets: Array<{ filename: string; dataUrl: string }> = []

  const filenameFor = (dataUrl: string): string => {
    const existing = filenamesByDataUrl.get(dataUrl)
    if (existing) return existing

    const mime = dataUrl.match(/^data:image\/([^;,]+)/i)?.[1]?.toLowerCase()
    const ext = mime === 'jpeg' || mime === 'jpg'
      ? 'jpg'
      : mime === 'webp'
        ? 'webp'
        : 'png'
    const filename = `template-${slug}-${assets.length + 1}.${ext}`
    filenamesByDataUrl.set(dataUrl, filename)
    assets.push({ filename, dataUrl })
    return filename
  }

  const walk = (layer: Layer): void => {
    if (layer.type === 'phone' && layer.screenshotDataUrl) {
      if (layer.screenshotPath) {
        if (!filenamesByDataUrl.has(layer.screenshotDataUrl)) {
          filenamesByDataUrl.set(layer.screenshotDataUrl, layer.screenshotPath)
        }
      } else {
        layer.screenshotPath = filenameFor(layer.screenshotDataUrl)
      }
      delete layer.screenshotDataUrl
    }

    if (layer.localeOverrides) {
      for (const patch of Object.values(layer.localeOverrides)) {
        if (!patch.screenshotDataUrl) continue
        if (patch.screenshotPath) {
          if (!filenamesByDataUrl.has(patch.screenshotDataUrl)) {
            filenamesByDataUrl.set(patch.screenshotDataUrl, patch.screenshotPath)
          }
        } else {
          patch.screenshotPath = filenameFor(patch.screenshotDataUrl)
        }
        delete patch.screenshotDataUrl
      }
    }

    if (layer.type === 'group') layer.children.forEach(walk)
  }

  for (const group of cloned) group.layers.forEach(walk)
  return { slideGroups: cloned, assets }
}

// ─── Export: Project → Template ──────────────────────────────────────────────

export interface ExportTemplateOpts {
  name: string
  description?: string
  category?: string
  /** Export only these slide group ids. Default: all groups. */
  slideGroupIds?: string[]
}

export function projectToTemplate(project: Project, opts: ExportTemplateOpts): Template {
  const groups = opts.slideGroupIds
    ? project.slideGroups.filter((g) => opts.slideGroupIds!.includes(g.id))
    : project.slideGroups

  const slideGroups: Omit<SlideGroup, 'id'>[] = groups.map((g) => {
    const { id: _id, ...rest } = g
    void _id
    const layers = deterministicIds(stripScreenshotPaths(g.layers))
    return { ...rest, layers }
  })

  // Sanitize settings: never include outputPath or brandLogoDataUrl in templates.
  // brandColors ARE included — layers may reference them via {brand:id} tokens,
  // and without the palette those tokens would dangle after import.
  const settings: Partial<ProjectSettings> = {
    defaultSlideWidth: project.settings.defaultSlideWidth,
    defaultSlideHeight: project.settings.defaultSlideHeight,
    defaultLocale: project.settings.defaultLocale,
    ...(project.settings.locales ? { locales: project.settings.locales } : {}),
    brandName: project.settings.brandName,
    ...(project.settings.brandColors?.length
      ? { brandColors: project.settings.brandColors.map((c) => ({ ...c })) }
      : {}),
  }

  return {
    id: nanoid(10),
    kind: 'template',
    schemaVersion: 1,
    name: opts.name,
    description: opts.description ?? '',
    ...(opts.category ? { category: opts.category } : {}),
    slideGroups,
    settings,
    createdAt: new Date().toISOString(),
  }
}

// ─── Import: Template → SlideGroups ──────────────────────────────────────────

function bgFromLegacy(bg: CanvasBackground): BackgroundLayer {
  return {
    id: nanoid(10),
    name: 'Background',
    type: 'background',
    x: 0,
    y: 0,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: true,
    fill: bg.fill,
    accents: (bg.accents ?? []).map((a) => ({ ...a })),
  }
}

export interface AppliedTemplate {
  slideGroups: SlideGroup[]
  settings?: Partial<ProjectSettings>
}

/**
 * Produce fresh SlideGroups from a template.
 * Every layer gets a new random ID. Background migration runs if needed.
 */
export function applyTemplate(tpl: Template): AppliedTemplate {
  const slideGroups: SlideGroup[] = tpl.slideGroups.map((g) => {
    let layers = cloneLayersWithNewIds(g.layers)

    // Migrate legacy TextLayer.spans → marks on every layer
    layers = layers.map(migrateLayerSpans)

    // Migrate legacy `background` field → BackgroundLayer if none exists
    if (!layers.some((l) => l.type === 'background')) {
      const legacyBg = (g as typeof g & { background?: CanvasBackground }).background
      const bg = legacyBg ? bgFromLegacy(legacyBg) : null
      if (bg) layers = [bg, ...layers]
    }

    // Drop legacy background field from the resulting group
    const { background: _legacy, ...rest } = g as typeof g & { background?: unknown }
    void _legacy

    return {
      ...rest,
      id: nanoid(10),
      layers,
    } as SlideGroup
  })

  return { slideGroups, settings: tpl.settings }
}

// ─── File sniffing ────────────────────────────────────────────────────────────

/** Strict check — file has kind:'template' + schemaVersion:1 */
export function isTemplate(obj: unknown): obj is Template {
  return (
    !!obj &&
    typeof obj === 'object' &&
    (obj as Template).kind === 'template' &&
    (obj as Template).schemaVersion === 1
  )
}

/**
 * Lenient check — also accepts legacy template files that predate kind/schemaVersion.
 * Legacy pattern: has slideGroups where groups lack id, has description, no createdAt/updatedAt.
 */
export function looksLikeTemplate(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false
  const t = obj as Record<string, unknown>
  if (t.kind === 'template') return true
  // Legacy template: has slideGroups without id fields, no Project timestamps
  if (
    Array.isArray(t.slideGroups) &&
    !t.createdAt &&
    !t.updatedAt &&
    t.slideGroups.length > 0 &&
    !(t.slideGroups[0] as Record<string, unknown>).id
  ) return true
  return false
}
