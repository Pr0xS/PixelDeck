import { chat } from '@/ai/client'
import { buildDesignContext } from '@/ai/context'
import { parseMarkedText, serializeMarkedText, stripMarkTags } from '@/ai/markedText'
import {
  buildBatchTranslationPrompt,
  buildBatchTranslationRetryPrompt,
  buildSingleTranslationPrompt,
  buildSingleTranslationRetryPrompt,
  TRANSLATION_SYSTEM_PROMPT,
} from '@/ai/prompts'
import type { AiProvider } from '@/ai/providers'
import type { Project, SlideGroup, TextMark } from '@/types'

/** Provider credentials + model, as held by useApiKeysStore. */
export interface AiAuth {
  provider: AiProvider
  apiKey: string
  model?: string
  baseUrl?: string
}

export interface TranslationResult {
  text: string
  /** Marks with offsets recomputed for the translated text (when preserved). */
  marks?: TextMark[]
  /** True when the source had formatting but it could not be carried over. */
  formattingLost?: boolean
}

const REPAIR_RESPONSE_MAX_CHARS = 4000

/** Convert a translated string (possibly tagged) into a TranslationResult. */
function resolveTranslation(translation: string, serialized: ReturnType<typeof serializeMarkedText>, sourceHadMarks: boolean): TranslationResult {
  if (!serialized.taggable) {
    return { text: stripMarkTags(translation).trim(), formattingLost: sourceHadMarks || undefined }
  }
  const parsed = parseMarkedText(translation, serialized.marks)
  if (parsed) {
    return { text: parsed.text.trim(), marks: parsed.marks.length ? parsed.marks : undefined }
  }
  return { text: stripMarkTags(translation).trim(), formattingLost: true }
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
  const messages = [
    { role: 'system' as const, content: TRANSLATION_SYSTEM_PROMPT },
    {
      role: 'user' as const,
      content: buildSingleTranslationPrompt({
        text: serialized.taggable ? serialized.tagged : args.text,
        targetLocale: args.targetLocale,
        designContext: context.text,
        roleHint: context.roleById[args.layerId],
      }),
    },
  ]
  const raw = await chat({
    ...args.auth,
    forceJsonMode: true,
    maxTokens: 4096,
    messages,
  })
  const translation = await parseSingleTranslationWithRetry(raw, {
    auth: args.auth,
    messages,
    targetLocale: args.targetLocale,
  })
  return resolveTranslation(translation, serialized, (args.marks?.length ?? 0) > 0)
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
  const expectedIds = args.items.map((i) => i.id)
  const messages = [
    { role: 'system' as const, content: TRANSLATION_SYSTEM_PROMPT },
    {
      role: 'user' as const,
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
  ]
  const raw = await chat({
    ...args.auth,
    forceJsonMode: true,
    maxTokens: 8192,
    messages,
  })
  const translations = await parseBatchTranslationWithRetry(raw, expectedIds, {
    auth: args.auth,
    messages,
  })

  const results: Record<string, TranslationResult> = {}
  for (const item of args.items) {
    const value = translations[item.id]
    if (value === undefined) continue
    const serialized = serializedById.get(item.id)!
    results[item.id] = resolveTranslation(value, serialized, (item.marks?.length ?? 0) > 0)
  }
  return results
}

async function parseSingleTranslationWithRetry(
  raw: string,
  args: { auth: AiAuth; messages: Parameters<typeof chat>[0]['messages']; targetLocale?: string },
): Promise<string> {
  try {
    return parseSingleTranslationResponse(raw, args.targetLocale)
  } catch (firstError) {
    const repaired = await retryJsonResponse({
      auth: args.auth,
      messages: args.messages,
      raw,
      maxTokens: 4096,
      retryPrompt: buildSingleTranslationRetryPrompt(),
    })
    try {
      return parseSingleTranslationResponse(repaired, args.targetLocale)
    } catch {
      // Log full raw responses to the browser console for diagnosis.
      console.error('[PixelDeck] Translation JSON parse failed.\nFirst response:', raw, '\nRetry response:', repaired)
      const preview = (s: string) => s.slice(0, 200).replace(/\n/g, '↵')
      throw new Error(
        `AI returned invalid translation JSON after retry. ${String(firstError)}\n` +
        `First response: ${preview(raw)}\n` +
        `Retry response: ${preview(repaired)}`,
      )
    }
  }
}

async function parseBatchTranslationWithRetry(
  raw: string,
  expectedIds: string[],
  args: { auth: AiAuth; messages: Parameters<typeof chat>[0]['messages'] },
): Promise<Record<string, string>> {
  try {
    return parseBatchTranslationResponse(raw, expectedIds)
  } catch (firstError) {
    const repaired = await retryJsonResponse({
      auth: args.auth,
      messages: args.messages,
      raw,
      maxTokens: 8192,
      retryPrompt: buildBatchTranslationRetryPrompt(expectedIds),
    })
    try {
      return parseBatchTranslationResponse(repaired, expectedIds)
    } catch {
      throw firstError
    }
  }
}

async function retryJsonResponse(args: {
  auth: AiAuth
  messages: Parameters<typeof chat>[0]['messages']
  raw: string
  maxTokens: number
  retryPrompt: string
}): Promise<string> {
  return chat({
    ...args.auth,
    forceJsonMode: true,
    maxTokens: args.maxTokens,
    messages: [
      ...args.messages,
      { role: 'assistant', content: args.raw.slice(0, REPAIR_RESPONSE_MAX_CHARS) },
      { role: 'user', content: args.retryPrompt },
    ],
  })
}

/** Sentinel values that indicate the model echoed a placeholder instead of translating. */
const TRANSLATION_SENTINELS = new Set(['<translated text>', '...', '…', '<translation>', '[translation]'])

/**
 * Extract a non-empty, non-sentinel string from a parsed JSON candidate.
 * Tolerates common model schema deviations:
 *   - Canonical:  { "translation": "text" }
 *   - Plural key: { "translations": "text" }
 *   - Locale key: { "fr": "text" }  (single-key object whose value is a string)
 *   - Array:      { "translation": ["text"] }  → join with newline
 *   - Nested:     { "translation": { "fr": "text" } }  → first string value
 */
function extractTranslationString(candidate: unknown, targetLocale?: string): string | null {
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) return null
  const rec = candidate as Record<string, unknown>

  // Try canonical and common key variants first
  const keysToTry = ['translation', 'translations', 'translated']
  if (targetLocale) keysToTry.push(targetLocale)

  for (const key of keysToTry) {
    const value = rec[key]
    if (value === undefined) continue

    // Direct string
    if (typeof value === 'string') {
      const t = value.trim()
      if (t && !TRANSLATION_SENTINELS.has(t)) return t
    }

    // Array of strings → join
    if (Array.isArray(value)) {
      const joined = value.filter((v): v is string => typeof v === 'string').join('\n').trim()
      if (joined && !TRANSLATION_SENTINELS.has(joined)) return joined
    }

    // Nested object → first non-empty string value
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      for (const v of Object.values(value as Record<string, unknown>)) {
        if (typeof v === 'string') {
          const t = v.trim()
          if (t && !TRANSLATION_SENTINELS.has(t)) return t
        }
      }
    }
  }

  // Last resort: single-key object whose only value is a non-empty string
  const entries = Object.entries(rec)
  if (entries.length === 1) {
    const [, v] = entries[0]
    if (typeof v === 'string') {
      const t = v.trim()
      if (t && !TRANSLATION_SENTINELS.has(t)) return t
    }
  }

  return null
}

/**
 * Parse the JSON object returned by the single translation prompt.
 * Expected shape: { "translation": "..." }.
 *
 * We tolerate markdown fences or accidental surrounding prose, but never accept
 * plain prose as a translation. This prevents model reasoning/prompt recaps from
 * being pasted into the design when a provider ignores instructions.
 */
export function parseSingleTranslationResponse(raw: string, targetLocale?: string): string {
  for (const candidate of parseJsonObjectCandidates(raw)) {
    const result = extractTranslationString(candidate, targetLocale)
    if (result !== null) return result
  }
  throw new Error('Single translation response must be JSON: { "translation": "..." }.')
}

/**
 * Parse the JSON object returned by the batch translation prompt.
 * Tolerates markdown fences and surrounding prose; validates that every
 * expected id is present so callers can fall back to per-item translation on
 * partial/malformed batch responses. Exported for unit testing.
 */
export function parseBatchTranslationResponse(
  raw: string,
  expectedIds: string[],
): Record<string, string> {
  for (const candidate of parseJsonObjectCandidates(raw)) {
    if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) continue

    const result: Record<string, string> = {}
    const record = candidate as Record<string, unknown>
    for (const id of expectedIds) {
      const value = record[id]
      if (typeof value === 'string' && value.trim()) result[id] = value.trim()
    }
    if (expectedIds.every((id) => result[id] !== undefined)) return result
  }
  throw new Error('Batch translation response must be JSON with a non-empty string for every requested id.')
}

/**
 * Repair unescaped control characters (U+0000–U+001F) that appear inside JSON
 * string literals. The JSON spec forbids bare newlines, carriage returns, tabs,
 * and other control chars inside string values — they must be escaped as \n,
 * \r, \t, or \uXXXX. Models that don't use forceJsonMode frequently return
 * multiline marketing copy with literal newlines
 * inside the JSON string, causing JSON.parse to throw.
 *
 * The function walks the slice character-by-character, tracking
 * inString/escaped state (same logic as findJsonObjectEnd), and rewrites any
 * offending control character in a string region to its canonical JSON escape.
 */
function repairJsonControlChars(slice: string): string {
  let result = ''
  let inString = false
  let escaped = false

  for (let i = 0; i < slice.length; i++) {
    const char = slice[i]
    const code = slice.charCodeAt(i)

    if (inString) {
      if (escaped) {
        escaped = false
        result += char
      } else if (char === '\\') {
        escaped = true
        result += char
      } else if (char === '"') {
        inString = false
        result += char
      } else if (code <= 0x1f) {
        // Literal control character inside a string — must be escaped
        if (char === '\n') result += '\\n'
        else if (char === '\r') result += '\\r'
        else if (char === '\t') result += '\\t'
        else result += `\\u${code.toString(16).padStart(4, '0')}`
      } else {
        result += char
      }
    } else {
      if (char === '"') inString = true
      result += char
    }
  }

  return result
}

function parseJsonObjectCandidates(raw: string): unknown[] {
  const cleaned = raw.replace(/```(?:json)?/gi, '').trim()
  const candidates: unknown[] = []

  for (let start = cleaned.indexOf('{'); start !== -1; start = cleaned.indexOf('{', start + 1)) {
    const end = findJsonObjectEnd(cleaned, start)
    if (end === -1) continue
    try {
      const slice = repairJsonControlChars(cleaned.slice(start, end + 1))
      candidates.push(JSON.parse(slice))
    } catch {
      // Keep scanning: models sometimes include prose or partial JSON before
      // the object we actually asked for.
    }
  }

  return candidates
}

function findJsonObjectEnd(text: string, start: number): number {
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < text.length; i++) {
    const char = text[i]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') inString = true
    else if (char === '{') depth++
    else if (char === '}') {
      depth--
      if (depth === 0) return i
    }
  }

  return -1
}
