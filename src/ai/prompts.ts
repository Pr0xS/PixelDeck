/**
 * ────────────────────────────────────────────────────────────────────────────
 * AI PROMPTS — single source of truth
 *
 * EVERY prompt sent to an AI model lives in this file. If you are adding a
 * new AI feature, define its prompt(s) here and import them from the feature
 * module (`src/ai/features/*`). Do not inline prompt strings elsewhere.
 *
 * Prompt design principles for PixelDeck:
 *  1. Give the model the FULL design context (all slides, all texts, roles,
 *     layout) so it can infer the intent of each message — see
 *     `buildDesignContext()` in `src/ai/context.ts`.
 *  2. Translations must fit the layout: similar visual length to the source.
 *  3. Marketing adaptation over literal translation.
 *  4. Machine-readable outputs (batch) use strict JSON with explicit shape.
 * ────────────────────────────────────────────────────────────────────────────
 */

// ─── Text translation ─────────────────────────────────────────────────────────

/** System prompt shared by single and batch text translation. */
export const TRANSLATION_SYSTEM_PROMPT = [
  'You are an expert App Store / Play Store localization specialist.',
  'You receive the full design context of a screenshot set (every slide, its texts and their visual roles) so you can understand the intent behind each message before translating.',
  'Rules:',
  '- Translate for the target market: adapt idioms and marketing tone naturally, never word-for-word.',
  '- Keep each translation visually similar in length to its source — it must fit the same layout space.',
  '- Preserve emoji, numbers, brand names, product names, and line breaks exactly as in the source.',
  '- Keep terminology consistent across all texts of the set.',
  '- Marketing tone: short, punchy, benefit-driven.',
  '- Some texts wrap words in numbered formatting tags like <m1>…</m1> (styled words: bold, colored, etc.).',
  '  In your translation, keep every tag pair and wrap the word(s) that correspond to the originally tagged word(s).',
  '  Never drop, add, or merge tags; keep each pair balanced. Tags may change position if the word order changes.',
].join('\n')

/**
 * Single text translation. Used by:
 *  - PropertiesPanel "Translate to all locales"
 *  - LocalizationView per-cell "✦ AI" button
 */
export function buildSingleTranslationPrompt(args: {
  text: string
  targetLocale: string
  designContext: string
  /** e.g. "headline on slide 2" — produced by buildDesignContext().roleById */
  roleHint?: string
}): string {
  return [
    '## Design context',
    args.designContext,
    '',
    '## Task',
    `Translate the following text to the locale "${args.targetLocale}".`,
    args.roleHint ? `This text is the ${args.roleHint}.` : '',
    'Return ONLY the translated text — no quotes, no explanation, no extra formatting.',
    '',
    '## Text',
    args.text,
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Batch translation: all texts of a slide group → one locale in a single
 * request. Produces consistent terminology and is cheaper than N calls.
 * Used by LocalizationView bulk translate.
 *
 * Expected model output: a strict JSON object { "<id>": "<translation>", … }.
 * Parse with `parseBatchTranslationResponse()` in features/translateText.ts.
 */
export function buildBatchTranslationPrompt(args: {
  items: Array<{ id: string; text: string; roleHint?: string }>
  targetLocale: string
  designContext: string
}): string {
  const itemsJson = JSON.stringify(
    args.items.map((item) => ({ id: item.id, role: item.roleHint, text: item.text })),
    null,
    2,
  )
  return [
    '## Design context',
    args.designContext,
    '',
    '## Task',
    `Translate ALL of the following texts to the locale "${args.targetLocale}".`,
    'Consider how the texts relate to each other (headline + subheading pairs, narrative across slides) and keep terminology consistent.',
    'Respond with a strict JSON object mapping each "id" to its translated text.',
    'Return ONLY the JSON object — no markdown fences, no commentary.',
    '',
    '## Items',
    itemsJson,
  ].join('\n')
}

// ─── Image localization (vision) ──────────────────────────────────────────────

/** System prompt for analyzing images/screenshots for localization. */
export const IMAGE_LOCALIZATION_SYSTEM_PROMPT = [
  'You are an expert App Store / Play Store localization specialist with vision capabilities.',
  'You analyze screenshot images used inside marketing slides and help the designer localize them.',
  'You receive the design context of the screenshot set so you understand what the app is about.',
].join('\n')

/**
 * Image localization analysis. The model sees the image and the design
 * context, detects any visible text and suggests translations.
 * Used by LocalizationView image cells "✦ AI" button.
 *
 * Output is a short human-readable brief (markdown-ish), shown to the
 * designer as guidance — we do NOT generate images.
 */
export function buildImageLocalizationPrompt(args: {
  targetLocale: string
  designContext: string
  layerName: string
}): string {
  return [
    '## Design context',
    args.designContext,
    '',
    '## Task',
    `Analyze the attached image ("${args.layerName}") which needs to be localized to "${args.targetLocale}".`,
    'List every visible piece of UI or marketing text in the image, and for each one suggest the best translation considering the intent and the design context.',
    'Format your answer as a short list: original → suggested translation.',
    'If text should NOT be translated (brand names, usernames, realistic data), say so.',
    'If the image contains no text at all, reply exactly: "No text detected — this image can be reused as-is."',
    'Be concise: this is a working brief for a designer, not an essay.',
  ].join('\n')
}
