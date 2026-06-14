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
 *  4. Machine-readable outputs use strict JSON with explicit shape.
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
  '- Do not explain your reasoning. Do not include analysis, notes, markdown, or the prompt in your answer.',
  '- Always answer with valid JSON only, in the exact machine-readable shape requested by the user message.',
  '- Never return placeholders, examples, markdown code fences, or text outside the JSON object.',
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
  const payload = JSON.stringify(
    {
      targetLocale: args.targetLocale,
      role: args.roleHint || undefined,
      text: args.text,
    },
    null,
    2,
  )
  return [
    '## Design context',
    args.designContext,
    '',
    '## Task',
    'Translate the payload.text into payload.targetLocale.',
    'Output contract: return EXACTLY one valid JSON object and nothing else.',
    'JSON shape: {"translation":"<translated text>"}',
    'Do not copy the placeholder text from the shape; the value must be the real translation.',
    'Do not include markdown fences, commentary, analysis, notes, or prompt recap.',
    'The translation value must preserve line breaks, emoji, brand names, numbers, and any <mN>…</mN> formatting tags from payload.text.',
    '',
    '## Payload',
    payload,
  ]
    .filter(Boolean)
    .join('\n')
}

/** Retry prompt used when a provider ignores the JSON-only contract. */
export function buildSingleTranslationRetryPrompt(): string {
  return [
    'Your previous answer did not satisfy the required output contract.',
    'Re-run the original translation task and answer again.',
    'Return EXACTLY one valid JSON object and nothing else.',
    'JSON shape: {"translation":"<translated text>"}',
    'Do not include markdown fences, commentary, analysis, notes, or prompt recap.',
  ].join('\n')
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
    'Output contract: return EXACTLY one valid JSON object and nothing else.',
    'JSON shape: {"<id>":"translated text"}. Include every input id exactly once as a top-level key; do not add extra keys.',
    'Each value must preserve line breaks, emoji, brand names, numbers, and any <mN>…</mN> formatting tags from that item.text.',
    'Do not include markdown fences, commentary, analysis, notes, or prompt recap.',
    '',
    '## Items',
    itemsJson,
  ].join('\n')
}

/** Retry prompt used when a batch response is partial or not valid JSON. */
export function buildBatchTranslationRetryPrompt(expectedIds: string[]): string {
  return [
    'Your previous answer did not satisfy the required output contract.',
    'Re-run the original batch translation task and answer again.',
    'Return EXACTLY one valid JSON object and nothing else.',
    'JSON shape: {"<id>":"translated text"}. Include every input id exactly once as a top-level key; do not add extra keys.',
    expectedIds.length ? `Required ids: ${expectedIds.map((id) => JSON.stringify(id)).join(', ')}` : '',
    'Do not include markdown fences, commentary, analysis, notes, or prompt recap.',
  ]
    .filter(Boolean)
    .join('\n')
}

// ─── Image localization/generation ────────────────────────────────────────────

/** System prompt for editing screenshots/images for localization. */
export const IMAGE_LOCALIZATION_SYSTEM_PROMPT = [
  'You are an expert App Store / Play Store screenshot localization image editor.',
  'You edit screenshots/images used inside marketing slides while preserving their original design quality.',
  'You receive the design context of the screenshot set so you understand what the app is about.',
].join('\n')

/**
 * Image localization edit. The model sees the source image and the design
 * context, then returns a localized replacement image.
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
    `Edit the attached image ("${args.layerName}") for locale "${args.targetLocale}".`,
    'Return a new image, not a text explanation.',
    'Preserve the same UI layout, colors, typography style, spacing, icons, device frame, image dimensions, and visual quality.',
    'Translate only visible user-facing text naturally for the target locale.',
    'Do not translate brand names, usernames, numbers, dates, prices, or realistic sample data unless localization clearly requires it.',
    'Do not add new UI elements, remove UI elements, redesign the screen, crop the image, or change the app content beyond text localization.',
    'If the image has no translatable text, return an image visually identical to the input.',
    '',
    '## Output contract (chat-based models)',
    'If you can generate or edit images: return the image directly via your API image output channel.',
    'If you cannot generate or edit images: return ONLY this JSON object and nothing else:',
    '{"error":"<one sentence explaining why image generation is not supported>"}',
    'Do not return markdown, explanations, or any text outside the JSON when you cannot generate an image.',
  ].join('\n')
}
