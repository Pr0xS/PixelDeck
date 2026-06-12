import { chat } from '@/ai/client'
import { buildDesignContext } from '@/ai/context'
import { parseMarkedText, serializeMarkedText, stripMarkTags } from '@/ai/markedText'
import {
  buildBatchTranslationPrompt,
  buildSingleTranslationPrompt,
  TRANSLATION_SYSTEM_PROMPT,
} from '@/ai/prompts'
import type { AiProvider } from '@/ai/providers'
import type { Project, SlideGroup, TextMark } from '@/types'

/** Provider credentials + model, as held by useApiKeysStore. */
export interface AiAuth {
  provider: AiProvider
  apiKey: string
  model?: string
}

export interface TranslationResult {
  text: string
  /** Marks with offsets recomputed for the translated text (when preserved). */
  marks?: TextMark[]
  /** True when the source had formatting but it could not be carried over. */
  formattingLost?: boolean
}

/** Convert a raw (possibly tagged) model response into a TranslationResult. */
function resolveTranslation(raw: string, serialized: ReturnType<typeof serializeMarkedText>, sourceHadMarks: boolean): TranslationResult {
  if (!serialized.taggable) {
    return { text: stripMarkTags(raw).trim(), formattingLost: sourceHadMarks || undefined }
  }
  const parsed = parseMarkedText(raw, serialized.marks)
  if (parsed) {
    return { text: parsed.text.trim(), marks: parsed.marks.length ? parsed.marks : undefined }
  }
  return { text: stripMarkTags(raw).trim(), formattingLost: true }
}

/**
 * Translate ONE text layer with full design context (all slides, all texts,
 * roles) so the model understands the intent of the message. Rich-text marks
 * are carried through the translation via numbered tags when possible.
 */
export async function translateLayerText(args: {
  auth: AiAuth
  project: Project
  slideGroup: SlideGroup
  layerId: string
  text: string
  marks?: TextMark[]
  targetLocale: string
}): Promise<TranslationResult> {
  const context = buildDesignContext(args.project, args.slideGroup)
  const serialized = serializeMarkedText(args.text, args.marks)
  const raw = await chat({
    ...args.auth,
    maxTokens: 1024,
    messages: [
      { role: 'system', content: TRANSLATION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: buildSingleTranslationPrompt({
          text: serialized.taggable ? serialized.tagged : args.text,
          targetLocale: args.targetLocale,
          designContext: context.text,
          roleHint: context.roleById[args.layerId],
        }),
      },
    ],
  })
  return resolveTranslation(raw, serialized, (args.marks?.length ?? 0) > 0)
}

export interface BatchTranslationItem {
  id: string
  text: string
  marks?: TextMark[]
}

/**
 * Translate ALL texts of a slide group to one locale in a single request.
 * Better terminology consistency and far fewer API calls than per-item.
 * Rich-text marks travel as numbered tags per item.
 * Returns a map id → TranslationResult. Throws if the response can't be
 * parsed (callers should fall back to per-item translation).
 */
export async function translateGroupTexts(args: {
  auth: AiAuth
  project: Project
  slideGroup: SlideGroup
  items: BatchTranslationItem[]
  targetLocale: string
}): Promise<Record<string, TranslationResult>> {
  const context = buildDesignContext(args.project, args.slideGroup)
  const serializedById = new Map(
    args.items.map((item) => [item.id, serializeMarkedText(item.text, item.marks)]),
  )
  const raw = await chat({
    ...args.auth,
    maxTokens: 4096,
    messages: [
      { role: 'system', content: TRANSLATION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: buildBatchTranslationPrompt({
          items: args.items.map((item) => {
            const serialized = serializedById.get(item.id)!
            return {
              id: item.id,
              text: serialized.taggable ? serialized.tagged : item.text,
              roleHint: context.roleById[item.id],
            }
          }),
          targetLocale: args.targetLocale,
          designContext: context.text,
        }),
      },
    ],
  })
  const translations = parseBatchTranslationResponse(raw, args.items.map((i) => i.id))

  const results: Record<string, TranslationResult> = {}
  for (const item of args.items) {
    const value = translations[item.id]
    if (value === undefined) continue
    const serialized = serializedById.get(item.id)!
    results[item.id] = resolveTranslation(value, serialized, (item.marks?.length ?? 0) > 0)
  }
  return results
}

/**
 * Parse the JSON object returned by the batch translation prompt.
 * Tolerates markdown fences and surrounding prose; validates that at least
 * one expected id is present. Exported for unit testing.
 */
export function parseBatchTranslationResponse(
  raw: string,
  expectedIds: string[],
): Record<string, string> {
  // Strip markdown fences and find the outermost JSON object
  const cleaned = raw.replace(/```(?:json)?/gi, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end <= start) {
    throw new Error('Batch translation response contains no JSON object.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    throw new Error('Batch translation response is not valid JSON.')
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Batch translation response is not a JSON object.')
  }

  const result: Record<string, string> = {}
  const record = parsed as Record<string, unknown>
  for (const id of expectedIds) {
    const value = record[id]
    if (typeof value === 'string' && value.trim()) result[id] = value.trim()
  }
  if (Object.keys(result).length === 0) {
    throw new Error('Batch translation response did not include any expected ids.')
  }
  return result
}
