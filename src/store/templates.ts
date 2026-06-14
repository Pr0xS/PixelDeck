import { create } from 'zustand'
import type { Template } from '@/types'

export interface TemplateManifestEntry {
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
}

export function toAbsolute(path: string): string {
  const base = (import.meta.env.BASE_URL ?? '/') as string
  const b = base.endsWith('/') ? base : `${base}/`
  const p = path.startsWith('/') ? path.slice(1) : path
  return `${b}${p}`
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

  fetchTemplate: async (entry) => {
    const res = await fetch(toAbsolute(entry.file))
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as Template
  },
}))
