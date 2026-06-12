import type { ChipsLayer, GroupLayer, Layer, Project, SlideGroup, TextLayer } from '@/types'

/**
 * Design context builder.
 *
 * Produces a human-readable description of a slide group — every text, its
 * visual role (headline / subheading / body), which slide it sits on, and the
 * supporting elements around it (device mockups, feature chips, images).
 *
 * This block is injected into AI prompts (see `src/ai/prompts.ts`) so the
 * model understands the INTENT of each message before translating it,
 * instead of seeing isolated strings.
 */

export interface DesignContext {
  /** Formatted text block ready to inject into a prompt. */
  text: string
  /** Per-layer-id hint like "headline on slide 1" — for single-item prompts. */
  roleById: Record<string, string>
}

interface TextEntry {
  id: string
  text: string
  fontSize: number
  centerX: number
}

interface SlideInventory {
  texts: Array<TextEntry & { role: string }>
  hasPhone: boolean
  hasImage: boolean
  chipLabels: string[]
}

function collectEntries(
  layers: Layer[],
  offsetX: number,
  scale: number,
  texts: TextEntry[],
  extras: { phoneXs: number[]; imageXs: number[]; chips: Array<{ x: number; labels: string[] }> },
): void {
  for (const layer of layers) {
    if (layer.visible === false) continue
    const absX = offsetX + layer.x * scale
    if (layer.type === 'group') {
      const group = layer as GroupLayer
      collectEntries(group.children, absX, scale * (group.scale ?? 1), texts, extras)
      continue
    }
    if (layer.type === 'text') {
      const t = layer as TextLayer
      if (!t.text.trim()) continue
      texts.push({
        id: t.id,
        text: t.text,
        fontSize: t.fontSize * scale,
        centerX: absX + ((t.width ?? 0) * scale) / 2,
      })
    } else if (layer.type === 'phone') {
      extras.phoneXs.push(absX)
    } else if (layer.type === 'image') {
      extras.imageXs.push(absX)
    } else if (layer.type === 'chips') {
      const chips = layer as ChipsLayer
      extras.chips.push({ x: absX, labels: chips.items.map((c) => c.label).filter(Boolean) })
    }
  }
}

function slideIndexFor(x: number, slideWidth: number, numSlides: number): number {
  return Math.max(0, Math.min(numSlides - 1, Math.floor(x / slideWidth)))
}

/** Classify texts within one slide by font size: largest = headline, next = subheading, rest = body. */
function classifyRoles(texts: TextEntry[]): Array<TextEntry & { role: string }> {
  const sorted = [...texts].sort((a, b) => b.fontSize - a.fontSize)
  return sorted.map((entry, i) => ({
    ...entry,
    role: i === 0 ? 'headline' : i === 1 ? 'subheading' : 'body',
  }))
}

/**
 * Build the design context for one slide group.
 * Includes every slide's text inventory with roles, plus supporting visuals.
 */
export function buildDesignContext(project: Project, slideGroup: SlideGroup): DesignContext {
  const texts: TextEntry[] = []
  const extras = { phoneXs: [] as number[], imageXs: [] as number[], chips: [] as Array<{ x: number; labels: string[] }> }
  collectEntries(slideGroup.layers, 0, 1, texts, extras)

  // Group everything by slide
  const slides: SlideInventory[] = Array.from({ length: slideGroup.numSlides }, () => ({
    texts: [],
    hasPhone: false,
    hasImage: false,
    chipLabels: [],
  }))
  const bySlide: TextEntry[][] = Array.from({ length: slideGroup.numSlides }, () => [])
  for (const entry of texts) {
    bySlide[slideIndexFor(entry.centerX, slideGroup.slideWidth, slideGroup.numSlides)].push(entry)
  }
  bySlide.forEach((slideTexts, i) => {
    slides[i].texts = classifyRoles(slideTexts)
  })
  for (const x of extras.phoneXs) slides[slideIndexFor(x, slideGroup.slideWidth, slideGroup.numSlides)].hasPhone = true
  for (const x of extras.imageXs) slides[slideIndexFor(x, slideGroup.slideWidth, slideGroup.numSlides)].hasImage = true
  for (const chip of extras.chips) {
    slides[slideIndexFor(chip.x, slideGroup.slideWidth, slideGroup.numSlides)].chipLabels.push(...chip.labels)
  }

  // Format
  const roleById: Record<string, string> = {}
  const lines: string[] = []
  const appName = project.settings.brandName?.trim()
  lines.push(`App: ${appName || project.name || 'Unknown'}`)
  lines.push(
    `Screenshot set: "${slideGroup.name}" — ${slideGroup.numSlides} slide(s), ${slideGroup.slideWidth}×${slideGroup.slideHeight}px each. These are App Store / Play Store marketing screenshots.`,
  )
  slides.forEach((slide, i) => {
    const slideName = slideGroup.slideNames[i]
    lines.push(`Slide ${i + 1}${slideName ? ` ("${slideName}")` : ''}:`)
    if (slide.texts.length === 0) lines.push('  (no text)')
    for (const t of slide.texts) {
      roleById[t.id] = `${t.role} on slide ${i + 1}`
      lines.push(`  - [${t.role}] "${t.text}"`)
    }
    if (slide.chipLabels.length > 0) lines.push(`  - feature chips: ${slide.chipLabels.map((l) => `"${l}"`).join(', ')}`)
    if (slide.hasPhone) lines.push('  - device mockup with app screenshot')
    if (slide.hasImage) lines.push('  - decorative image')
  })

  return { text: lines.join('\n'), roleById }
}
