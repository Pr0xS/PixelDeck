import { create } from 'zustand'
import type { Template } from '@/types'
import { bytesToDataUrl, type ImportAsset } from '@/utils/projectZip'

export interface TemplateManifestEntry {
  /** Marks the Welcome tour project created on first run. */
  tour?: boolean
  slug: string
  name: string
  description: string
  category?: string
  thumbnail?: string   // path relative to BASE_URL e.g. /templates/thumbs/slug.png
  file: string         // path relative to BASE_URL e.g. /templates/slug.template.json
  slides?: number      // total slide count across all slide groups
  previewSize?: string // e.g. "1290×2796" — first slide group dimensions
}

interface TemplatesState {
  manifest: TemplateManifestEntry[]
  loading: boolean
  error: string | null
  loadManifest: () => Promise<void>
  fetchTemplate: (entry: TemplateManifestEntry) => Promise<Template>
  fetchTemplateBundle: (entry: TemplateManifestEntry, signal?: AbortSignal) => Promise<TemplateBundle>
}

export function toAbsolute(path: string): string {
  const base = (import.meta.env.BASE_URL ?? '/') as string
  const b = base.endsWith('/') ? base : `${base}/`
  const p = path.startsWith('/') ? path.slice(1) : path
  return `${b}${p}`
}

export interface TemplateBundle {
  template: Template
  assets: ImportAsset[]
}

async function fetchTemplateJson(entry: TemplateManifestEntry, signal?: AbortSignal): Promise<Template> {
  const res = await fetch(toAbsolute(entry.file), { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as Template
}

/**
 * Fetch a template plus the images listed in its `assetManifest`
 * (`templates/assets/<key>`). A single failed image is skipped with a warning.
 */
export async function fetchTemplateBundle(
  entry: TemplateManifestEntry,
  signal?: AbortSignal,
): Promise<TemplateBundle> {
  const template = await fetchTemplateJson(entry, signal)
  const manifest = template.assetManifest ?? {}
  const results = await Promise.all(Object.entries(manifest).map(async ([key, meta]): Promise<ImportAsset | null> => {
    try {
      const res = await fetch(toAbsolute(`templates/assets/${key}`), { signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const bytes = new Uint8Array(await res.arrayBuffer())
      return { key, name: meta.name, mime: meta.mime, dataUrl: bytesToDataUrl(bytes, meta.mime) }
    } catch (err) {
      // An aborted bundle is a failed bundle, not a partial one.
      if (signal?.aborted) throw err
      console.warn(`[PixelDeck] Template image ${key} could not be loaded; skipping`, err)
      return null
    }
  }))
  return { template, assets: results.filter((a): a is ImportAsset => a !== null) }
}

export const useTemplatesStore = create<TemplatesState>((set, get) => ({
  manifest: [],
  loading: false,
  error: null,

  loadManifest: async () => {
    if (get().manifest.length > 0 || get().loading) return
    set({ loading: true, error: null })
    try {
      const res = await fetch(toAbsolute('templates/index.json'))
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { templates?: TemplateManifestEntry[] }
      set({ manifest: data.templates ?? [], loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  fetchTemplate: (entry) => fetchTemplateJson(entry),

  fetchTemplateBundle: (entry, signal) => fetchTemplateBundle(entry, signal),
}))
