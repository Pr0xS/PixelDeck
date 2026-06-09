// ─── Curated Google Fonts for PixelDeck ──────────────────────────────────────

export interface FontEntry {
  family: string
  label: string
  category: 'sans-serif' | 'serif' | 'display' | 'monospace'
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

  // ── Sans-serif clásicas
  { family: 'Poppins',          label: 'Poppins',          category: 'sans-serif', weights: [400, 500, 600, 700, 800] },
  { family: 'Montserrat',       label: 'Montserrat',       category: 'sans-serif', weights: [400, 500, 600, 700, 800, 900] },
  { family: 'Raleway',          label: 'Raleway',          category: 'sans-serif', weights: [400, 500, 600, 700, 800] },

  // ── Display / Bold
  { family: 'Oswald',           label: 'Oswald',           category: 'display',    weights: [400, 500, 600, 700] },
  { family: 'Barlow',           label: 'Barlow',           category: 'sans-serif', weights: [400, 500, 600, 700, 800] },
  { family: 'Exo 2',            label: 'Exo 2',            category: 'display',    weights: [400, 500, 600, 700, 800] },
  { family: 'Unbounded',        label: 'Unbounded',        category: 'display',    weights: [400, 600, 700, 800] },
  { family: 'Righteous',        label: 'Righteous',        category: 'display',    weights: [400] },

  // ── Serif
  { family: 'Playfair Display', label: 'Playfair Display', category: 'serif',      weights: [400, 600, 700] },
  { family: 'Lora',             label: 'Lora',             category: 'serif',      weights: [400, 600, 700] },

  // ── Fun / Script
  { family: 'Pacifico',         label: 'Pacifico',         category: 'display',    weights: [400] },
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
    'Playfair Display', 'Lora',
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
