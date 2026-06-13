import { describe, expect, it } from 'vitest'
import { parseBatchTranslationResponse, parseSingleTranslationResponse } from './translateText'
import { buildDesignContext } from '@/ai/context'
import {
  buildBatchTranslationPrompt,
  buildSingleTranslationPrompt,
  TRANSLATION_SYSTEM_PROMPT,
} from '@/ai/prompts'
import type { Project, SlideGroup, TextLayer, PhoneLayer } from '@/types'

// ─── parseSingleTranslationResponse ──────────────────────────────────────────
//
// Expected JSON shape returned by the model:
//   { "translation": "<translated text>" }

describe('parseSingleTranslationResponse', () => {
  it('parses a clean JSON object', () => {
    expect(parseSingleTranslationResponse('{"translation": "Hola Mundo"}')).toBe('Hola Mundo')
  })

  it('strips markdown code fences', () => {
    const raw = '```json\n{"translation": "Hola"}\n```'
    expect(parseSingleTranslationResponse(raw)).toBe('Hola')
  })

  it('strips plain (non-language-tagged) code fences', () => {
    const raw = '```\n{"translation": "Hola"}\n```'
    expect(parseSingleTranslationResponse(raw)).toBe('Hola')
  })

  it('tolerates leading prose before the JSON object', () => {
    const raw = 'Here is the translation:\n{"translation": "Hola"}'
    expect(parseSingleTranslationResponse(raw)).toBe('Hola')
  })

  it('tolerates trailing prose after the JSON object', () => {
    const raw = '{"translation": "Hola"}\nLet me know if you need anything else.'
    expect(parseSingleTranslationResponse(raw)).toBe('Hola')
  })

  it('tolerates both leading and trailing prose (full model monologue)', () => {
    const raw =
      'Sure! Here is my translation:\n{"translation": "Hola"}\nHope this helps!'
    expect(parseSingleTranslationResponse(raw)).toBe('Hola')
  })

  it('trims whitespace from the translation value', () => {
    expect(parseSingleTranslationResponse('{"translation": "  Hola Mundo  "}')).toBe('Hola Mundo')
  })

  it('extracts translation even when extra keys are present (e.g. reasoning key)', () => {
    // Models may emit chain-of-thought keys alongside the translation.
    const raw = '{"reasoning": "The word means greeting.", "translation": "Hola"}'
    expect(parseSingleTranslationResponse(raw)).toBe('Hola')
  })

  it('recovers a valid translation object nested inside a wrapper object', () => {
    const raw = '{"data":{"translation":"Hola"}}'
    expect(parseSingleTranslationResponse(raw)).toBe('Hola')
  })

  it('throws when the response contains no JSON object at all', () => {
    expect(() => parseSingleTranslationResponse('Sorry, I cannot translate that.')).toThrow()
  })

  it('throws when the response is pure prose reasoning with no JSON', () => {
    const raw =
      'I think the best translation here would be Hola because the context is a greeting.'
    expect(() => parseSingleTranslationResponse(raw)).toThrow()
  })

  it('throws on malformed / invalid JSON', () => {
    expect(() => parseSingleTranslationResponse('{"translation": "Hola",}')).toThrow()
  })

  it('throws when the "translation" key is absent from the JSON object', () => {
    expect(() => parseSingleTranslationResponse('{"result": "Hola"}')).toThrow()
  })

  it('throws when the "translation" value is an empty string', () => {
    expect(() => parseSingleTranslationResponse('{"translation": ""}')).toThrow()
  })

  it('throws when the "translation" value is only whitespace', () => {
    expect(() => parseSingleTranslationResponse('{"translation": "   "}')).toThrow()
  })

  it('throws when the response is a JSON array instead of an object', () => {
    expect(() => parseSingleTranslationResponse('["Hola", "Mundo"]')).toThrow()
  })

  it('throws when the "translation" value is a non-string type', () => {
    expect(() => parseSingleTranslationResponse('{"translation": 42}')).toThrow()
  })

  it('throws when the model echoes the placeholder instead of translating', () => {
    expect(() => parseSingleTranslationResponse('{"translation": "<translated text>"}')).toThrow()
  })

  it('handles a literal newline inside the translation value (multiline model output)', () => {
    // A real \n character (not the escape sequence) inside the JSON string —
    // this is invalid JSON per spec but common in Anthropic/Google/OpenCode responses.
    const raw = '{"translation": "line1\nline2"}'
    const result = parseSingleTranslationResponse(raw)
    expect(result).toBe('line1\nline2')
  })

  it('handles a literal carriage-return + newline inside the translation value', () => {
    const raw = '{"translation": "line1\r\nline2"}'
    const result = parseSingleTranslationResponse(raw)
    expect(result).toBe('line1\r\nline2')
  })
})

// ─── parseBatchTranslationResponse ────────────────────────────────────────────
//
// New semantic (strict): ALL expectedIds must be present in the response.
// A partial response (any id missing or with an invalid/empty value) causes
// a throw so the caller can fall back to per-item translation.

describe('parseBatchTranslationResponse', () => {
  const ids = ['a', 'b', 'c']

  it('parses a clean JSON object with all ids', () => {
    const raw = '{"a": "Hola", "b": "Mundo", "c": "Adiós"}'
    expect(parseBatchTranslationResponse(raw, ids)).toEqual({ a: 'Hola', b: 'Mundo', c: 'Adiós' })
  })

  it('strips markdown fences when all ids are present', () => {
    const raw = '```json\n{"a": "Hola", "b": "Mundo", "c": "Adiós"}\n```'
    expect(parseBatchTranslationResponse(raw, ids)).toEqual({ a: 'Hola', b: 'Mundo', c: 'Adiós' })
  })

  it('tolerates surrounding prose when all ids are present', () => {
    const raw =
      'Here are the translations:\n{"a": "Hola", "b": "Mundo", "c": "Adiós"}\nLet me know if you need more.'
    expect(parseBatchTranslationResponse(raw, ids)).toEqual({ a: 'Hola', b: 'Mundo', c: 'Adiós' })
  })

  it('trims whitespace in all values when all ids are present', () => {
    const raw = '{"a": "  Hola  ", "b": "  Mundo  ", "c": "  Adiós  "}'
    expect(parseBatchTranslationResponse(raw, ids)).toEqual({ a: 'Hola', b: 'Mundo', c: 'Adiós' })
  })

  it('ignores extra (unexpected) ids that are not in the expectedIds list', () => {
    const raw = '{"a": "Hola", "b": "Mundo", "c": "Adiós", "zz": "extra"}'
    expect(parseBatchTranslationResponse(raw, ids)).toEqual({ a: 'Hola', b: 'Mundo', c: 'Adiós' })
  })

  it('recovers a valid id map nested inside a wrapper object', () => {
    const raw = '{"translations":{"a":"Hola","b":"Mundo","c":"Adiós"}}'
    expect(parseBatchTranslationResponse(raw, ids)).toEqual({ a: 'Hola', b: 'Mundo', c: 'Adiós' })
  })

  it('throws on a partial response — missing one id', () => {
    // Only a and b present; c is missing → must throw so caller can fall back.
    const raw = '{"a": "Hola", "b": "Mundo"}'
    expect(() => parseBatchTranslationResponse(raw, ids)).toThrow()
  })

  it('throws when some ids have non-string values', () => {
    // b is a number, not a string → batch is unusable → must throw.
    const raw = '{"a": "Hola", "b": 42, "c": "Adiós"}'
    expect(() => parseBatchTranslationResponse(raw, ids)).toThrow()
  })

  it('throws when some ids have empty or whitespace-only values', () => {
    // b is whitespace — treated as missing → must throw.
    const raw = '{"a": "Hola", "b": "   ", "c": "Adiós"}'
    expect(() => parseBatchTranslationResponse(raw, ids)).toThrow()
  })

  it('throws when there is no JSON object', () => {
    expect(() => parseBatchTranslationResponse('Sorry, I cannot do that.', ids)).toThrow()
  })

  it('throws on invalid JSON', () => {
    expect(() => parseBatchTranslationResponse('{"a": "Hola",}', ids)).toThrow()
  })

  it('throws when no expected ids are present', () => {
    expect(() => parseBatchTranslationResponse('{"x": "Hola"}', ids)).toThrow()
  })

  it('throws on JSON arrays', () => {
    expect(() => parseBatchTranslationResponse('["Hola", "Mundo"]', ids)).toThrow()
  })

  it('succeeds with a single-item expected list', () => {
    const raw = '{"a": "Hola"}'
    expect(parseBatchTranslationResponse(raw, ['a'])).toEqual({ a: 'Hola' })
  })

  it('succeeds with an empty expectedIds list', () => {
    // Edge case: nothing expected → trivially satisfied.
    expect(parseBatchTranslationResponse('{}', [])).toEqual({})
  })

  it('handles literal newlines inside batch translation values (multiline model output)', () => {
    // Real \n characters inside JSON strings — invalid per spec but common from
    // Anthropic/Google/OpenCode models that skip forceJsonMode.
    const raw = '{"a": "line1\nline2", "b": "Mundo", "c": "Adiós"}'
    const result = parseBatchTranslationResponse(raw, ids)
    expect(result).toEqual({ a: 'line1\nline2', b: 'Mundo', c: 'Adiós' })
  })
})

// ─── Prompt JSON contract assertions ──────────────────────────────────────────

describe('TRANSLATION_SYSTEM_PROMPT – JSON enforcement', () => {
  it('instructs model to reply with valid JSON only', () => {
    expect(TRANSLATION_SYSTEM_PROMPT).toContain('valid JSON')
  })

  it('forbids analysis, notes, markdown, and prompt recap', () => {
    expect(TRANSLATION_SYSTEM_PROMPT).toMatch(/do not.*explain|do not.*reasoning|analysis|notes/i)
  })

  it('forbids markdown code fences in the output', () => {
    expect(TRANSLATION_SYSTEM_PROMPT).toMatch(/markdown/i)
  })
})

describe('buildSingleTranslationPrompt – JSON contract hints', () => {
  const baseArgs = {
    text: 'Hello World',
    targetLocale: 'es',
    designContext: 'App: TestApp\n[headline] "Hello World"',
  }

  it('specifies the exact JSON shape the model must return', () => {
    const prompt = buildSingleTranslationPrompt(baseArgs)
    expect(prompt).toContain('{"translation"')
  })

  it('instructs model to return exactly one valid JSON object', () => {
    const prompt = buildSingleTranslationPrompt(baseArgs)
    expect(prompt).toMatch(/return EXACTLY one valid JSON/i)
  })

  it('forbids markdown fences, commentary and prompt recap', () => {
    const prompt = buildSingleTranslationPrompt(baseArgs)
    expect(prompt).toMatch(/markdown fences/i)
    expect(prompt).toMatch(/prompt recap/i)
  })

  it('includes the target locale in the payload', () => {
    const prompt = buildSingleTranslationPrompt({ ...baseArgs, targetLocale: 'fr' })
    expect(prompt).toContain('"targetLocale": "fr"')
  })

  it('includes the source text in the payload', () => {
    const prompt = buildSingleTranslationPrompt(baseArgs)
    expect(prompt).toContain('"text": "Hello World"')
  })

  it('includes an optional roleHint in the payload when provided', () => {
    const prompt = buildSingleTranslationPrompt({ ...baseArgs, roleHint: 'headline on slide 1' })
    expect(prompt).toContain('"role": "headline on slide 1"')
  })

  it('embeds the design context', () => {
    const prompt = buildSingleTranslationPrompt(baseArgs)
    expect(prompt).toContain('App: TestApp')
  })
})

describe('buildBatchTranslationPrompt – JSON contract hints', () => {
  const baseArgs = {
    items: [
      { id: 'a', text: 'Hello', roleHint: 'headline on slide 1' },
      { id: 'b', text: 'World' },
    ],
    targetLocale: 'es',
    designContext: 'App: TestApp\n[headline] "Hello"',
  }

  it('specifies the JSON shape with <id> placeholder', () => {
    const prompt = buildBatchTranslationPrompt(baseArgs)
    expect(prompt).toContain('"<id>"')
  })

  it('instructs model to return exactly one valid JSON object', () => {
    const prompt = buildBatchTranslationPrompt(baseArgs)
    expect(prompt).toMatch(/return EXACTLY one valid JSON/i)
  })

  it('requires every input id to appear exactly once', () => {
    const prompt = buildBatchTranslationPrompt(baseArgs)
    expect(prompt).toMatch(/every input id/i)
  })

  it('forbids markdown fences and prompt recap', () => {
    const prompt = buildBatchTranslationPrompt(baseArgs)
    expect(prompt).toMatch(/markdown fences/i)
    expect(prompt).toMatch(/prompt recap/i)
  })

  it('includes the target locale in the task description', () => {
    const prompt = buildBatchTranslationPrompt({ ...baseArgs, targetLocale: 'ja' })
    expect(prompt).toContain('"ja"')
  })

  it('serializes all items into the prompt', () => {
    const prompt = buildBatchTranslationPrompt(baseArgs)
    expect(prompt).toContain('"id": "a"')
    expect(prompt).toContain('"id": "b"')
    expect(prompt).toContain('"text": "Hello"')
  })

  it('embeds the design context', () => {
    const prompt = buildBatchTranslationPrompt(baseArgs)
    expect(prompt).toContain('App: TestApp')
  })
})

// ─── buildDesignContext ───────────────────────────────────────────────────────

function makeTextLayer(partial: Partial<TextLayer>): TextLayer {
  return {
    id: 'txt',
    name: 'Text',
    type: 'text',
    x: 0,
    y: 0,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    text: 'Hello',
    fontFamily: 'Inter',
    fontSize: 24,
    fontWeight: 400,
    fill: '#fff',
    letterSpacing: 0,
    lineHeight: 1.2,
    align: 'left',
    ...partial,
  }
}

function makeProject(group: SlideGroup): Project {
  return {
    id: 'p1',
    name: 'My App',
    settings: {
      defaultSlideWidth: 1290,
      defaultSlideHeight: 2796,
      defaultLocale: 'en',
      brandName: 'HabitFlow',
    },
    slideGroups: [group],
  } as Project
}

describe('buildDesignContext', () => {
  it('classifies roles by font size and assigns slides by x position', () => {
    const group: SlideGroup = {
      id: 'g1',
      name: 'Main set',
      numSlides: 2,
      slideWidth: 1000,
      slideHeight: 2000,
      slideNames: ['slide-1', 'slide-2'],
      layers: [
        makeTextLayer({ id: 'h1', text: 'Track your habits', fontSize: 96, x: 100 }),
        makeTextLayer({ id: 'b1', text: 'Stay motivated daily', fontSize: 32, x: 100 }),
        makeTextLayer({ id: 'h2', text: 'Beautiful stats', fontSize: 90, x: 1200 }),
      ],
    }
    const ctx = buildDesignContext(makeProject(group), group)

    expect(ctx.roleById['h1']).toBe('headline on slide 1')
    expect(ctx.roleById['b1']).toBe('subheading on slide 1')
    expect(ctx.roleById['h2']).toBe('headline on slide 2')
    expect(ctx.text).toContain('App: HabitFlow')
    expect(ctx.text).toContain('[headline] "Track your habits"')
    expect(ctx.text).toContain('Slide 2')
  })

  it('walks group layers with offset and skips hidden/empty texts', () => {
    const child = makeTextLayer({ id: 'inner', text: 'Inside group', fontSize: 48, x: 50 })
    const hidden = makeTextLayer({ id: 'ghost', text: 'Invisible', visible: false })
    const empty = makeTextLayer({ id: 'empty', text: '   ' })
    const group: SlideGroup = {
      id: 'g1',
      name: 'Set',
      numSlides: 1,
      slideWidth: 1000,
      slideHeight: 2000,
      slideNames: ['s'],
      layers: [
        {
          id: 'grp',
          name: 'Group',
          type: 'group',
          x: 200,
          y: 0,
          rotation: 0,
          opacity: 1,
          visible: true,
          locked: false,
          children: [child, hidden, empty],
        },
      ],
    }
    const ctx = buildDesignContext(makeProject(group), group)

    expect(ctx.roleById['inner']).toBe('headline on slide 1')
    expect(ctx.roleById['ghost']).toBeUndefined()
    expect(ctx.roleById['empty']).toBeUndefined()
  })

  it('mentions device mockups in the inventory', () => {
    const phone: PhoneLayer = {
      id: 'ph1',
      name: 'Phone',
      type: 'phone',
      x: 300,
      y: 100,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      model: 'iphone-16-pro',
      scale: 1,
      screenshotFit: 'cover',
    } as PhoneLayer
    const group: SlideGroup = {
      id: 'g1',
      name: 'Set',
      numSlides: 1,
      slideWidth: 1000,
      slideHeight: 2000,
      slideNames: ['s'],
      layers: [phone],
    }
    const ctx = buildDesignContext(makeProject(group), group)
    expect(ctx.text).toContain('device mockup')
  })
})
