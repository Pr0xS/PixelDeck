import type { Project } from '@/types'
import { forEachLayerTree } from '@/utils/layerTree'
import { getPhoneSpec } from '@/assets/mockups/specs'

// ─── Curated Google Fonts for PixelDeck ──────────────────────────────────────

export interface FontEntry {
  family: string
  label: string
  category: 'sans-serif' | 'serif' | 'display' | 'monospace' | 'handwriting'
  weights: number[]
}

/** Web-safe fonts — available without network, work in headless export.
 *  `family` is the exact CSS font-family name passed to Konva and stored in the data model.
 *  These are single names (no fallback stacks) so they round-trip cleanly through the picker. */
export const WEB_SAFE_FONTS: FontEntry[] = [
  { family: 'Arial',           label: 'Arial',           category: 'sans-serif', weights: [400, 700] },
  { family: 'Helvetica',       label: 'Helvetica',       category: 'sans-serif', weights: [400, 700] },
  { family: 'Verdana',         label: 'Verdana',         category: 'sans-serif', weights: [400, 700] },
  { family: 'Trebuchet MS',    label: 'Trebuchet MS',    category: 'sans-serif', weights: [400, 700] },
  { family: 'Tahoma',          label: 'Tahoma',          category: 'sans-serif', weights: [400, 700] },
  { family: 'Georgia',         label: 'Georgia',         category: 'serif',      weights: [400, 700] },
  { family: 'Times New Roman', label: 'Times New Roman', category: 'serif',      weights: [400, 700] },
  { family: 'Courier New',     label: 'Courier New',     category: 'monospace',  weights: [400, 700] },
  { family: 'Impact',          label: 'Impact',          category: 'display',    weights: [400] },
  { family: 'system-ui',       label: 'System UI',       category: 'sans-serif', weights: [400, 700] },
]

export const FONT_LIST: FontEntry[] = [
  // ── Sans-serif modernas
  { family: 'Inter',            label: 'Inter',            category: 'sans-serif', weights: [400, 500, 600, 700, 800, 900] },
  { family: 'Sora',             label: 'Sora',             category: 'sans-serif', weights: [400, 600, 700, 800] },
  { family: 'Plus Jakarta Sans',label: 'Plus Jakarta Sans',category: 'sans-serif', weights: [400, 500, 600, 700, 800] },
  { family: 'DM Sans',          label: 'DM Sans',          category: 'sans-serif', weights: [400, 500, 600, 700] },
  { family: 'Manrope',          label: 'Manrope',          category: 'sans-serif', weights: [400, 500, 600, 700, 800] },
  { family: 'Space Grotesk',    label: 'Space Grotesk',    category: 'sans-serif', weights: [400, 500, 600, 700] },
  { family: 'Figtree',          label: 'Figtree',          category: 'sans-serif', weights: [400, 500, 600, 700, 800] },
  { family: 'Outfit',           label: 'Outfit',           category: 'sans-serif', weights: [400, 500, 600, 700, 800] },
  { family: 'Lexend',           label: 'Lexend',           category: 'sans-serif', weights: [400, 500, 600, 700, 800] },
  { family: 'Jost',             label: 'Jost',             category: 'sans-serif', weights: [400, 500, 600, 700] },
  { family: 'Nunito',           label: 'Nunito',           category: 'sans-serif', weights: [400, 600, 700, 800] },
  { family: 'Nunito Sans',      label: 'Nunito Sans',      category: 'sans-serif', weights: [400, 600, 700, 800] },
  { family: 'Roboto',           label: 'Roboto',           category: 'sans-serif', weights: [300, 400, 500, 700, 900] },
  { family: 'Open Sans',        label: 'Open Sans',        category: 'sans-serif', weights: [300, 400, 600, 700, 800] },
  { family: 'Lato',             label: 'Lato',             category: 'sans-serif', weights: [300, 400, 700, 900] },
  { family: 'Source Sans 3',    label: 'Source Sans 3',    category: 'sans-serif', weights: [300, 400, 600, 700, 900] },
  { family: 'Work Sans',        label: 'Work Sans',        category: 'sans-serif', weights: [300, 400, 500, 600, 700] },
  { family: 'Karla',            label: 'Karla',            category: 'sans-serif', weights: [400, 500, 600, 700, 800] },
  { family: 'IBM Plex Sans',    label: 'IBM Plex Sans',    category: 'sans-serif', weights: [300, 400, 500, 600, 700] },
  { family: 'Mulish',           label: 'Mulish',           category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: 'Urbanist',         label: 'Urbanist',         category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: 'Rubik',            label: 'Rubik',            category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: 'Quicksand',        label: 'Quicksand',        category: 'sans-serif', weights: [300, 400, 500, 600, 700] },
  { family: 'Cabin',            label: 'Cabin',            category: 'sans-serif', weights: [400, 500, 600, 700] },
  { family: 'Noto Sans',        label: 'Noto Sans',        category: 'sans-serif', weights: [300, 400, 500, 600, 700] },
  { family: 'Albert Sans',      label: 'Albert Sans',      category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: 'Bricolage Grotesque', label: 'Bricolage Grotesque', category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Geist',            label: 'Geist',            category: 'sans-serif', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: 'Onest',            label: 'Onest',            category: 'sans-serif', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: 'Instrument Sans',  label: 'Instrument Sans',  category: 'sans-serif', weights: [400, 500, 600, 700] },
  { family: 'Be Vietnam Pro',   label: 'Be Vietnam Pro',   category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800] },

  // ── Sans-serif clásicas
  { family: 'Poppins',          label: 'Poppins',          category: 'sans-serif', weights: [400, 500, 600, 700, 800] },
  { family: 'Montserrat',       label: 'Montserrat',       category: 'sans-serif', weights: [400, 500, 600, 700, 800, 900] },
  { family: 'Raleway',          label: 'Raleway',          category: 'sans-serif', weights: [400, 500, 600, 700, 800] },
  { family: 'Hind',             label: 'Hind',             category: 'sans-serif', weights: [300, 400, 500, 600, 700] },
  { family: 'Muli',             label: 'Muli',             category: 'sans-serif', weights: [300, 400, 600, 700] },
  { family: 'Barlow Condensed', label: 'Barlow Condensed', category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800] },

  // ── Display / Bold
  { family: 'Oswald',           label: 'Oswald',           category: 'display',    weights: [400, 500, 600, 700] },
  { family: 'Barlow',           label: 'Barlow',           category: 'sans-serif', weights: [400, 500, 600, 700, 800] },
  { family: 'Exo 2',            label: 'Exo 2',            category: 'display',    weights: [400, 500, 600, 700, 800] },
  { family: 'Unbounded',        label: 'Unbounded',        category: 'display',    weights: [400, 600, 700, 800] },
  { family: 'Righteous',        label: 'Righteous',        category: 'display',    weights: [400] },
  { family: 'Bebas Neue',       label: 'Bebas Neue',       category: 'display',    weights: [400] },
  { family: 'Anton',            label: 'Anton',            category: 'display',    weights: [400] },
  { family: 'Fjalla One',       label: 'Fjalla One',       category: 'display',    weights: [400] },
  { family: 'Teko',             label: 'Teko',             category: 'display',    weights: [300, 400, 500, 600, 700] },
  { family: 'Permanent Marker', label: 'Permanent Marker', category: 'display',    weights: [400] },
  { family: 'Alfa Slab One',    label: 'Alfa Slab One',    category: 'display',    weights: [400] },
  { family: 'Black Han Sans',   label: 'Black Han Sans',   category: 'display',    weights: [400] },
  { family: 'Boogaloo',         label: 'Boogaloo',         category: 'display',    weights: [400] },
  { family: 'Lilita One',       label: 'Lilita One',       category: 'display',    weights: [400] },
  { family: 'Russo One',        label: 'Russo One',        category: 'display',    weights: [400] },

  // ── Serif
  { family: 'Playfair Display', label: 'Playfair Display', category: 'serif',      weights: [400, 600, 700] },
  { family: 'Lora',             label: 'Lora',             category: 'serif',      weights: [400, 600, 700] },
  { family: 'Merriweather',     label: 'Merriweather',     category: 'serif',      weights: [300, 400, 700, 900] },
  { family: 'EB Garamond',      label: 'EB Garamond',      category: 'serif',      weights: [400, 500, 600, 700, 800] },
  { family: 'Cormorant Garamond', label: 'Cormorant Garamond', category: 'serif',  weights: [300, 400, 500, 600, 700] },
  { family: 'Libre Baskerville', label: 'Libre Baskerville', category: 'serif',    weights: [400, 700] },
  { family: 'Source Serif 4',   label: 'Source Serif 4',   category: 'serif',      weights: [300, 400, 600, 700] },
  { family: 'Crimson Text',     label: 'Crimson Text',     category: 'serif',      weights: [400, 600, 700] },
  { family: 'DM Serif Display', label: 'DM Serif Display', category: 'serif',      weights: [400] },
  { family: 'Fraunces',         label: 'Fraunces',         category: 'serif',      weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: 'Instrument Serif', label: 'Instrument Serif', category: 'serif',      weights: [400] },

  // ── Fun / Script
  { family: 'Pacifico',         label: 'Pacifico',         category: 'display',    weights: [400] },

  // ── Handwriting / Script
  { family: 'Dancing Script',   label: 'Dancing Script',   category: 'handwriting', weights: [400, 500, 600, 700] },
  { family: 'Caveat',           label: 'Caveat',           category: 'handwriting', weights: [400, 500, 600, 700] },
  { family: 'Sacramento',       label: 'Sacramento',       category: 'handwriting', weights: [400] },
  { family: 'Great Vibes',      label: 'Great Vibes',      category: 'handwriting', weights: [400] },
  { family: 'Kaushan Script',   label: 'Kaushan Script',   category: 'handwriting', weights: [400] },
  { family: 'Satisfy',          label: 'Satisfy',          category: 'handwriting', weights: [400] },
  { family: 'Parisienne',       label: 'Parisienne',       category: 'handwriting', weights: [400] },

  // ── Monospace
  { family: 'JetBrains Mono',   label: 'JetBrains Mono',   category: 'monospace',  weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Fira Code',        label: 'Fira Code',        category: 'monospace',  weights: [300, 400, 500, 600, 700] },
  { family: 'Source Code Pro',  label: 'Source Code Pro',  category: 'monospace',  weights: [300, 400, 500, 600, 700, 900] },
  { family: 'Space Mono',       label: 'Space Mono',       category: 'monospace',  weights: [400, 700] },
  { family: 'Geist Mono',       label: 'Geist Mono',       category: 'monospace',  weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
]

/** Returns the available weights for a given font family */
export function getFontWeights(family: string): number[] {
  return (
    FONT_LIST.find((f) => f.family === family)?.weights ??
    WEB_SAFE_FONTS.find((f) => f.family === family)?.weights ??
    [400, 700]
  )
}

/**
 * Ensure a font family is available in document.fonts so Konva can render it.
 * For Google Fonts: injects a lazy <link> if not already loaded.
 * For web-safe fonts: calls document.fonts.load() to force the browser to
 * register the face in the FontFaceSet (needed for Konva to pick it up).
 * Returns a promise that resolves when the font is ready (or fails gracefully).
 */
export async function ensureFontReady(family: string, weight: number = 400): Promise<void> {
  const isWebSafe = WEB_SAFE_FONTS.some((f) => f.family === family)
  if (isWebSafe) {
    try {
      // Force the browser to load the system font into document.fonts
      await document.fonts.load(`${weight} 16px "${family}"`)
    } catch {
      // Fail gracefully — font may still render via CSS fallback
    }
    return
  }
  // Google Font — use the lazy loader
  const entry = FONT_LIST.find((f) => f.family === family)
  if (entry) {
    await loadFont(family, entry.weights)
  }
}

let _googleFontsReady: Promise<void> | null = null

/**
 * Injects the Google Fonts stylesheet into the document <head>.
 * Call once on app startup. The returned promise settles once the stylesheet
 * has been applied (or failed): only then are its faces known to
 * document.fonts, which is what `ensureFontsLoaded` relies on.
 */
export function loadGoogleFonts(): Promise<void> {
  if (_googleFontsReady) return _googleFontsReady
  if (document.getElementById('gf-pixeldeck')) return Promise.resolve()

  // Build families param — include italic axis where available
  const italicFamilies = new Set([
    'Inter', 'Sora', 'Plus Jakarta Sans', 'DM Sans', 'Manrope', 'Figtree',
    'Outfit', 'Lexend', 'Jost', 'Nunito', 'Nunito Sans', 'Poppins',
    'Montserrat', 'Raleway', 'Barlow', 'Exo 2', 'Space Grotesk',
    'Playfair Display', 'Lora', 'Roboto', 'Open Sans', 'Lato',
    'Source Sans 3', 'Work Sans', 'Karla', 'IBM Plex Sans', 'Mulish',
    'Urbanist', 'Rubik', 'Quicksand', 'Cabin', 'Noto Sans', 'Albert Sans',
    'Bricolage Grotesque', 'Merriweather', 'EB Garamond', 'Cormorant Garamond',
    'Libre Baskerville', 'Source Serif 4', 'Crimson Text', 'Dancing Script',
    'Caveat', 'JetBrains Mono', 'Fira Code', 'Source Code Pro',
    'Geist', 'Onest', 'Instrument Sans', 'Be Vietnam Pro', 'Barlow Condensed',
    'Fraunces', 'Instrument Serif',
  ])

  const params = FONT_LIST.map((f) => {
    const encoded = f.family.replace(/ /g, '+')
    if (italicFamilies.has(f.family) && f.weights.length > 1) {
      // ital axis: 0 = normal, 1 = italic
      return `family=${encoded}:ital,wght@${f.weights.map((w) => `0,${w}`).join(';')};${f.weights.map((w) => `1,${w}`).join(';')}`
    }
    return `family=${encoded}:wght@${f.weights.join(';')}`
  }).join('&')

  const link = document.createElement('link')
  link.id = 'gf-pixeldeck'
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?${params}&display=swap`
  _googleFontsReady = new Promise<void>((resolve) => {
    link.onload = () => resolve()
    link.onerror = () => resolve() // fail gracefully: text falls back to system fonts
    setTimeout(resolve, 10000) // a stalled request must never block a capture
    document.head.appendChild(link)
  })
  return _googleFontsReady
}

// ─── Capture-time font readiness ──────────────────────────────────────────────

export interface FontUse {
  family: string
  weight: number
  italic: boolean
  /** Characters drawn with this face; selects the right unicode-range subsets. */
  text: string
}

/** Every font face a project's layers draw with, across locales and rich-text marks. */
export function collectProjectFontUses(project: Pick<Project, 'slideGroups'>): FontUse[] {
  const uses = new Map<string, FontUse>()
  const add = (family: string, weight: number, italic: boolean, text: string) => {
    if (!family) return
    const key = `${family}|${weight}|${italic ? 1 : 0}`
    const existing = uses.get(key)
    if (existing) existing.text += text
    else uses.set(key, { family, weight, italic, text })
  }
  for (const group of project.slideGroups) {
    forEachLayerTree(group.layers, (layer) => {
      if (layer.type === 'brand') {
        add(layer.nameFontFamily, layer.nameFontWeight, false, layer.appName)
        return
      }
      if (layer.type === 'phone') {
        // The Android status bar clock is drawn in 'Google Sans, Roboto' bold; Google Sans is
        // not a web font, so Roboto 700 is what actually renders. iOS uses system fonts only.
        if (layer.showStatusBar !== false) {
          const bar = getPhoneSpec(layer.model).statusBar
          if (bar.height > 0 && bar.platform === 'android') add('Roboto', 700, false, '9:41')
        }
        return
      }
      if (layer.type !== 'text') return
      const italic = Boolean(layer.italic)
      const variants = [{ text: layer.text, marks: layer.marks }, ...Object.values(layer.localeContent ?? {})]
      for (const variant of variants) {
        const text = variant.text ?? layer.text
        add(layer.fontFamily, layer.fontWeight, italic, text)
        for (const mark of variant.marks ?? []) {
          add(layer.fontFamily, mark.fontWeight ?? layer.fontWeight, mark.italic ?? italic, text.slice(mark.start, mark.end))
        }
      }
    })
  }
  return [...uses.values()].map((use) => ({ ...use, text: [...new Set(use.text)].join('') }))
}

/**
 * Wait until the given faces are usable by canvas text. Konva draws with a
 * fallback font while a web font is still loading and nothing redraws it
 * afterwards, so every capture path must await this before its first draw.
 * Never rejects and never waits longer than `timeoutMs`.
 */
export async function ensureFontsLoaded(uses: FontUse[], timeoutMs = 8000): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.load || uses.length === 0) return
  const loads = Promise.all(uses.map((use) =>
    document.fonts
      .load(`${use.italic ? 'italic ' : ''}${use.weight} 16px "${use.family}"`, use.text || ' ')
      .catch(() => []),
  ))
  let timer: ReturnType<typeof setTimeout> | undefined
  await Promise.race([
    loads,
    new Promise<void>((resolve) => { timer = setTimeout(resolve, timeoutMs) }),
  ])
  if (timer) clearTimeout(timer)
}

/** Load every font a project draws with. Safe to call outside a browser (no-op). */
export async function ensureProjectFontsLoaded(
  project: Pick<Project, 'slideGroups'>,
  timeoutMs = 8000,
): Promise<void> {
  if (typeof document === 'undefined') return
  // Faces only exist in document.fonts once the stylesheet has been applied.
  if (_googleFontsReady) await _googleFontsReady
  await ensureFontsLoaded(collectProjectFontUses(project), timeoutMs)
}

// ─── Per-font lazy loader ─────────────────────────────────────────────────────

/** In-flight load promises — prevents duplicate requests for the same family */
const _loadingFonts = new Map<string, Promise<void>>()

/**
 * Lazily load a single Google Font family on demand.
 * Injects a <link> for just that family and waits for it to be ready.
 * Safe to call multiple times — deduplicates in-flight requests.
 */
export function loadFont(family: string, weights: number[] = [400, 700]): Promise<void> {
  const key = `gf-lazy-${family}`
  if (document.getElementById(key)) return Promise.resolve()
  if (_loadingFonts.has(family)) return _loadingFonts.get(family)!

  const encoded = family.replace(/ /g, '+')
  const wghts = weights.join(';')
  const href = `https://fonts.googleapis.com/css2?family=${encoded}:wght@${wghts}&display=swap`

  const promise = new Promise<void>((resolve) => {
    const link = document.createElement('link')
    link.id = key
    link.rel = 'stylesheet'
    link.href = href
    link.onload = () => {
      _loadingFonts.delete(family)
      // Wait for the font to actually be parsed and available
      document.fonts.ready.then(() => resolve()).catch(() => resolve())
    }
    link.onerror = () => {
      _loadingFonts.delete(family)
      resolve() // fail gracefully
    }
    document.head.appendChild(link)
  })

  _loadingFonts.set(family, promise)
  return promise
}

/**
 * Fire-and-forget font preload — call on hover for perceived performance.
 * Does not return a promise; errors are silently ignored.
 */
export function preloadFont(family: string, weights?: number[]): void {
  void loadFont(family, weights)
}

// ─── Custom font loader (user-uploaded) ──────────────────────────────────────

/** Tracks which custom CSS family names have been registered in document.fonts */
const _registeredCustomFonts = new Set<string>()

/**
 * Load a user-uploaded font from a dataUrl into document.fonts.
 * Uses the opaque CSS family name from CustomFontRef.
 * Safe to call multiple times — skips if already registered.
 */
export async function loadCustomFont(cssFamily: string, dataUrl: string, format: string = 'truetype'): Promise<void> {
  if (_registeredCustomFonts.has(cssFamily)) return

  const mimeMap: Record<string, string> = {
    ttf: 'truetype',
    otf: 'opentype',
    woff: 'woff',
    woff2: 'woff2',
  }
  const fontFormat = mimeMap[format] ?? 'truetype'

  try {
    const face = new FontFace(cssFamily, `url(${dataUrl}) format('${fontFormat}')`)
    await face.load()
    document.fonts.add(face)
    _registeredCustomFonts.add(cssFamily)
  } catch (err) {
    console.warn(`[fonts] Failed to load custom font "${cssFamily}":`, err)
  }
}

/**
 * Register all custom fonts from a project's customFonts registry.
 * Looks up each font's dataUrl from the fontStore.
 * Call this on project load (editor) and before render (export).
 */
export async function registerCustomFonts(
  customFonts: import('@/types').CustomFontRef[],
  getFontDataUrl: (filename: string) => string | undefined,
): Promise<void> {
  await Promise.all(
    customFonts.map((ref) => {
      const dataUrl = getFontDataUrl(ref.filename)
      if (!dataUrl) {
        console.warn(`[fonts] Custom font "${ref.label}" not found in store (filename: ${ref.filename})`)
        return Promise.resolve()
      }
      return loadCustomFont(ref.family, dataUrl, ref.format)
    }),
  )
}

/**
 * Generate a collision-safe opaque CSS family name for a user-uploaded font.
 * Format: pf_{stem}_{4-char-hash}
 * Guaranteed not to collide with FONT_LIST or WEB_SAFE_FONTS entries.
 */
export function generateCustomFontFamily(filename: string): string {
  const stem = filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20)
  const hash = Math.random().toString(36).slice(2, 6)
  return `pf_${stem}_${hash}`
}

/**
 * Unregister a custom font from document.fonts by its CSS family name.
 * Call when the user removes a custom font from the project.
 */
export function unregisterCustomFont(cssFamily: string): void {
  if (!_registeredCustomFonts.has(cssFamily)) return
  // Remove all FontFace objects with this family from document.fonts
  const toDelete: FontFace[] = []
  document.fonts.forEach((face) => {
    if (face.family === cssFamily || face.family === `"${cssFamily}"`) {
      toDelete.push(face)
    }
  })
  toDelete.forEach((face) => document.fonts.delete(face))
  _registeredCustomFonts.delete(cssFamily)
}
