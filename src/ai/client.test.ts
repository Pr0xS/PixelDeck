/**
 * Tests for src/ai/client.ts
 *
 * Focus: verifying that `forceJsonMode` correctly adds (or omits)
 * `response_format: { type: 'json_object' }` in the fetch body for each
 * OpenAI-compatible provider.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chat, editImage, supportsImageEditing } from './client'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal fetch mock that returns a successful OpenAI-shaped response. */
function makeOpenAiFetchMock(content = '{"translation":"Hola"}') {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({ choices: [{ message: { content } }] }),
    text: () => Promise.resolve(content),
  })
}

function makeJsonFetchMock(data: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  })
}

/** Extract the parsed request body from the first fetch call. */
function capturedBody(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  return JSON.parse(fetchMock.mock.calls[0][1].body as string)
}

// ─── Setup ────────────────────────────────────────────────────────────────────

// `window.location.origin` is read by chatWithOpenAiCompatible for openrouter
// headers. Stub window so the test doesn't throw in the Node environment.
beforeEach(() => {
  vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

// ─── forceJsonMode: providers that DO get response_format ─────────────────────

describe('chat – forceJsonMode with response_format-compatible providers', () => {
  it('adds response_format:{type:"json_object"} for openai + forceJsonMode:true', async () => {
    const fetchMock = makeOpenAiFetchMock()
    vi.stubGlobal('fetch', fetchMock)

    await chat({
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'translate this' }],
      forceJsonMode: true,
    })

    expect(capturedBody(fetchMock).response_format).toEqual({ type: 'json_object' })
  })

  it('adds response_format:{type:"json_object"} for openrouter + forceJsonMode:true', async () => {
    const fetchMock = makeOpenAiFetchMock()
    vi.stubGlobal('fetch', fetchMock)

    await chat({
      provider: 'openrouter',
      apiKey: 'sk-or-test',
      model: 'anthropic/claude-3.5-haiku',
      messages: [{ role: 'user', content: 'translate this' }],
      forceJsonMode: true,
    })

    expect(capturedBody(fetchMock).response_format).toEqual({ type: 'json_object' })
  })
})

// ─── forceJsonMode: providers that must NOT get response_format ───────────────

describe('chat – forceJsonMode with providers that reject response_format', () => {
  it('does NOT add response_format for opencode + forceJsonMode:true', async () => {
    const fetchMock = makeOpenAiFetchMock()
    vi.stubGlobal('fetch', fetchMock)

    await chat({
      provider: 'opencode',
      apiKey: 'sk-test',
      model: 'kimi-k2.6',
      messages: [{ role: 'user', content: 'translate this' }],
      forceJsonMode: true,
    })

    expect(capturedBody(fetchMock).response_format).toBeUndefined()
  })

  it('blocks opencode in no-proxy production before fetch', async () => {
    vi.stubEnv('DEV', false)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      chat({
        provider: 'opencode',
        apiKey: 'sk-test',
        model: 'kimi-k2.6',
        messages: [{ role: 'user', content: 'translate this' }],
      }),
    ).rejects.toThrow(/does not allow direct browser requests from GitHub Pages/i)

    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// ─── forceJsonMode disabled / omitted ─────────────────────────────────────────

describe('chat – response_format absent when forceJsonMode is off', () => {
  it('does NOT add response_format for openai when forceJsonMode:false', async () => {
    const fetchMock = makeOpenAiFetchMock('Hello World')
    vi.stubGlobal('fetch', fetchMock)

    await chat({
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'say hello' }],
      forceJsonMode: false,
    })

    expect(capturedBody(fetchMock).response_format).toBeUndefined()
  })

  it('does NOT add response_format for openai when forceJsonMode is omitted', async () => {
    const fetchMock = makeOpenAiFetchMock('Hello World')
    vi.stubGlobal('fetch', fetchMock)

    await chat({
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'say hello' }],
    })

    expect(capturedBody(fetchMock).response_format).toBeUndefined()
  })

  it('does NOT add response_format for opencode even when forceJsonMode is omitted', async () => {
    const fetchMock = makeOpenAiFetchMock('Hello World')
    vi.stubGlobal('fetch', fetchMock)

    await chat({
      provider: 'opencode',
      apiKey: 'sk-test',
      model: 'kimi-k2.6',
      messages: [{ role: 'user', content: 'say hello' }],
    })

    expect(capturedBody(fetchMock).response_format).toBeUndefined()
  })
})

// ─── Basic request sanity ─────────────────────────────────────────────────────

describe('chat – basic request structure', () => {
  it('includes the model and messages in the request body', async () => {
    const fetchMock = makeOpenAiFetchMock()
    vi.stubGlobal('fetch', fetchMock)

    await chat({
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a translator.' },
        { role: 'user', content: 'Translate: hello' },
      ],
      forceJsonMode: true,
    })

    const body = capturedBody(fetchMock)
    expect(body.model).toBe('gpt-4o')
    expect(Array.isArray(body.messages)).toBe(true)
    expect((body.messages as unknown[]).length).toBe(2)
  })

  it('includes max_tokens when provided', async () => {
    const fetchMock = makeOpenAiFetchMock()
    vi.stubGlobal('fetch', fetchMock)

    await chat({
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'hello' }],
      maxTokens: 512,
    })

    expect(capturedBody(fetchMock).max_tokens).toBe(512)
  })

  it('omits max_tokens from the body when not provided', async () => {
    const fetchMock = makeOpenAiFetchMock()
    vi.stubGlobal('fetch', fetchMock)

    await chat({
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'hello' }],
    })

    expect(capturedBody(fetchMock).max_tokens).toBeUndefined()
  })

  it('adds HTTP-Referer and X-OpenRouter-Title headers for openrouter', async () => {
    const fetchMock = makeOpenAiFetchMock()
    vi.stubGlobal('fetch', fetchMock)

    await chat({
      provider: 'openrouter',
      apiKey: 'sk-or-test',
      model: 'openai/gpt-4o',
      messages: [{ role: 'user', content: 'hi' }],
    })

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>
    expect(headers['HTTP-Referer']).toBe('http://localhost:5173')
    expect(headers['X-OpenRouter-Title']).toBe('PixelDeck')
  })

  it('throws when the API key is empty', async () => {
    await expect(
      chat({
        provider: 'openai',
        apiKey: '   ',
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    ).rejects.toThrow(/no api key/i)
  })
})

describe('image editing support detection', () => {
  it('returns false only for anthropic', () => {
    expect(supportsImageEditing('anthropic', 'claude-haiku-4-5')).toBe(false)
  })

  it('returns true for known image-generation models', () => {
    expect(supportsImageEditing('openai', 'gpt-image-1')).toBe(true)
    expect(supportsImageEditing('google', 'gemini-2.5-flash-image')).toBe(true)
    expect(supportsImageEditing('openrouter', 'black-forest-labs/flux-kontext-pro')).toBe(true)
  })

  it('returns true for opencode and openrouter regardless of model name (runtime decides)', () => {
    expect(supportsImageEditing('opencode', 'kimi-k2.6')).toBe(true)
    expect(supportsImageEditing('openrouter', 'some-text-model')).toBe(true)
  })

  it('returns false for openai text-only models', () => {
    expect(supportsImageEditing('openai', 'gpt-4o-mini')).toBe(false)
  })
})

describe('editImage', () => {
  const sourceImage = 'data:image/png;base64,ZmFrZS1pbWFnZQ=='

  it('throws a clear error for anthropic (hard block)', async () => {
    await expect(
      editImage({
        provider: 'anthropic',
        apiKey: 'sk-ant-test',
        model: 'claude-haiku-4-5',
        prompt: 'localize image',
        imageDataUrl: sourceImage,
      }),
    ).rejects.toThrow(/does not support image generation/i)
  })

  it('extracts image data URLs from OpenRouter image responses', async () => {
    const generated = 'data:image/png;base64,Z2VuZXJhdGVk'
    const fetchMock = makeJsonFetchMock({
      choices: [{ message: { images: [{ image_url: { url: generated } }] } }],
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await editImage({
      provider: 'openrouter',
      apiKey: 'sk-or-test',
      model: 'black-forest-labs/flux-kontext-pro',
      prompt: 'localize image',
      imageDataUrl: sourceImage,
    })

    expect(result).toBe(generated)
    expect(capturedBody(fetchMock).modalities).toEqual(['image', 'text'])
  })

  it('surfaces model-reported JSON error from chat response', async () => {
    vi.stubEnv('DEV', true)
    const fetchMock = makeJsonFetchMock({
      choices: [{ message: { content: '{"error":"This model cannot generate images."}' } }],
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      editImage({
        provider: 'opencode',
        apiKey: 'sk-test',
        model: 'kimi-k2.6',
        prompt: 'localize image',
        imageDataUrl: sourceImage,
      }),
    ).rejects.toThrow('This model cannot generate images.')
  })

  it('blocks opencode image edits in no-proxy production before fetch', async () => {
    vi.stubEnv('DEV', false)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      editImage({
        provider: 'opencode',
        apiKey: 'sk-test',
        model: 'kimi-k2.6',
        prompt: 'localize image',
        imageDataUrl: sourceImage,
      }),
    ).rejects.toThrow(/does not allow direct browser requests from GitHub Pages/i)

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
