import { nanoid } from 'nanoid'
import type {
  Layer, SlideGroup, GroupLayer, PhoneLayer,
  Template, Project, ProjectSettings,
  CanvasBackground, BackgroundLayer,
} from '@/types'

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
