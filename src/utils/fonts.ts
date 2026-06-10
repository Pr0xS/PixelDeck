// ─── Curated Google Fonts for PixelDeck ──────────────────────────────────────

export interface FontEntry {
  family: string
  label: string
  category: 'sans-serif' | 'serif' | 'display' | 'monospace' | 'handwriting'
  weights: number[]
}

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

  // ── Sans-serif clásicas
  { family: 'Poppins',          label: 'Poppins',          category: 'sans-serif', weights: [400, 500, 600, 700, 800] },
  { family: 'Montserrat',       label: 'Montserrat',       category: 'sans-serif', weights: [400, 500, 600, 700, 800, 900] },
  { family: 'Raleway',          label: 'Raleway',          category: 'sans-serif', weights: [400, 500, 600, 700, 800] },
  { family: 'Hind',             label: 'Hind',             category: 'sans-serif', weights: [300, 400, 500, 600, 700] },
  { family: 'Muli',             label: 'Muli',             category: 'sans-serif', weights: [300, 400, 600, 700] },

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

  // ── Serif
  { family: 'Playfair Display', label: 'Playfair Display', category: 'serif',      weights: [400, 600, 700] },
  { family: 'Lora',             label: 'Lora',             category: 'serif',      weights: [400, 600, 700] },
  { family: 'Merriweather',     label: 'Merriweather',     category: 'serif',      weights: [300, 400, 700, 900] },
  { family: 'EB Garamond',      label: 'EB Garamond',      category: 'serif',      weights: [400, 500, 600, 700, 800] },
  { family: 'Cormorant Garamond', label: 'Cormorant Garamond', category: 'serif',  weights: [300, 400, 500, 600, 700] },
  { family: 'Libre Baskerville', label: 'Libre Baskerville', category: 'serif',    weights: [400, 700] },
  { family: 'Source Serif 4',   label: 'Source Serif 4',   category: 'serif',      weights: [300, 400, 600, 700] },
  { family: 'Crimson Text',     label: 'Crimson Text',     category: 'serif',      weights: [400, 600, 700] },

  // ── Fun / Script
  { family: 'Pacifico',         label: 'Pacifico',         category: 'display',    weights: [400] },

  // ── Handwriting / Script
  { family: 'Dancing Script',   label: 'Dancing Script',   category: 'handwriting', weights: [400, 500, 600, 700] },
  { family: 'Caveat',           label: 'Caveat',           category: 'handwriting', weights: [400, 500, 600, 700] },
  { family: 'Sacramento',       label: 'Sacramento',       category: 'handwriting', weights: [400] },
  { family: 'Great Vibes',      label: 'Great Vibes',      category: 'handwriting', weights: [400] },
  { family: 'Kaushan Script',   label: 'Kaushan Script',   category: 'handwriting', weights: [400] },

  // ── Monospace
  { family: 'JetBrains Mono',   label: 'JetBrains Mono',   category: 'monospace',  weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Fira Code',        label: 'Fira Code',        category: 'monospace',  weights: [300, 400, 500, 600, 700] },
  { family: 'Source Code Pro',  label: 'Source Code Pro',  category: 'monospace',  weights: [300, 400, 500, 600, 700, 900] },
  { family: 'Space Mono',       label: 'Space Mono',       category: 'monospace',  weights: [400, 700] },
]

export const FONT_FAMILIES = FONT_LIST.map((f) => f.family)

/** Returns the available weights for a given font family */
export function getFontWeights(family: string): number[] {
  return FONT_LIST.find((f) => f.family === family)?.weights ?? [400, 700]
}

/**
 * Injects the Google Fonts stylesheet into the document <head>.
 * Call once on app startup.
 */
export function loadGoogleFonts(): void {
  if (document.getElementById('gf-pixeldeck')) return

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
  document.head.appendChild(link)
}
