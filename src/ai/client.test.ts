import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chat, editImage, supportsImageEditing } from './client'

function makeOpenAiFetchMock(content = '{"translation":"Hola"}') {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ choices: [{ message: { content } }] }),
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

function capturedBody(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  return JSON.parse(fetchMock.mock.calls[0][1].body as string)
}

beforeEach(() => {
  vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('chat', () => {
  it.each(['openai', 'openrouter'] as const)('adds JSON response format for %s', async (provider) => {
    const fetchMock = makeOpenAiFetchMock()
    vi.stubGlobal('fetch', fetchMock)
    await chat({
      provider,
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'translate this' }],
      forceJsonMode: true,
    })
    expect(capturedBody(fetchMock).response_format).toEqual({ type: 'json_object' })
  })

  it('omits JSON response format when disabled', async () => {
    const fetchMock = makeOpenAiFetchMock('Hello')
    vi.stubGlobal('fetch', fetchMock)
    await chat({ provider: 'openai', apiKey: 'sk-test', messages: [{ role: 'user', content: 'hello' }] })
    expect(capturedBody(fetchMock).response_format).toBeUndefined()
  })

  it('sends a basic request with max tokens', async () => {
    const fetchMock = makeOpenAiFetchMock()
    vi.stubGlobal('fetch', fetchMock)
    await chat({
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-4o',
      maxTokens: 512,
      messages: [{ role: 'system', content: 'Translate.' }, { role: 'user', content: 'hello' }],
    })
    expect(capturedBody(fetchMock)).toMatchObject({ model: 'gpt-4o', max_tokens: 512 })
    expect(capturedBody(fetchMock).messages).toHaveLength(2)
  })

  it('adds OpenRouter attribution headers', async () => {
    const fetchMock = makeOpenAiFetchMock()
    vi.stubGlobal('fetch', fetchMock)
    await chat({ provider: 'openrouter', apiKey: 'sk-or-test', messages: [{ role: 'user', content: 'hi' }] })
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>
    expect(headers['HTTP-Referer']).toBe('http://localhost:5173')
    expect(headers['X-OpenRouter-Title']).toBe('PixelDeck')
  })

  it('posts custom requests to the provided base URL with only standard headers', async () => {
    const fetchMock = makeOpenAiFetchMock()
    vi.stubGlobal('fetch', fetchMock)
    await chat({
      provider: 'custom',
      apiKey: 'sk-custom',
      baseUrl: 'https://custom.example.com/v1',
      model: 'my-model',
      messages: [{ role: 'user', content: 'hi' }],
    })
    expect(fetchMock).toHaveBeenCalledWith('https://custom.example.com/v1/chat/completions', expect.objectContaining({ method: 'POST' }))
    expect(fetchMock.mock.calls[0][1].headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer sk-custom',
    })
  })

  it('uses the Google OpenAI-compatible chat endpoint', async () => {
    const fetchMock = makeOpenAiFetchMock()
    vi.stubGlobal('fetch', fetchMock)
    await chat({ provider: 'google', apiKey: 'AIza-test', messages: [{ role: 'user', content: 'hi' }] })
    expect(fetchMock.mock.calls[0][0]).toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions')
  })

  it('requires an API key and a custom base URL', async () => {
    await expect(chat({ provider: 'openai', apiKey: ' ', messages: [] })).rejects.toThrow(/no api key/i)
    await expect(chat({ provider: 'custom', apiKey: 'sk-test', messages: [] })).rejects.toThrow(/no custom api base url/i)
  })
})

describe('image editing support detection', () => {
  it('uses provider-specific support rules', () => {
    expect(supportsImageEditing('openai', 'gpt-image-1')).toBe(true)
    expect(supportsImageEditing('openai', 'gpt-4o-mini')).toBe(false)
    expect(supportsImageEditing('openrouter', 'some-text-model')).toBe(true)
    expect(supportsImageEditing('google', 'gemini-2.5-flash-image')).toBe(false)
    expect(supportsImageEditing('custom', 'anything')).toBe(true)
  })
})

describe('editImage', () => {
  const sourceImage = 'data:image/png;base64,ZmFrZS1pbWFnZQ=='

  it('keeps OpenRouter modalities', async () => {
    const generated = 'data:image/png;base64,Z2VuZXJhdGVk'
    const fetchMock = makeJsonFetchMock({ choices: [{ message: { images: [{ image_url: { url: generated } }] } }] })
    vi.stubGlobal('fetch', fetchMock)
    expect(await editImage({
      provider: 'openrouter', apiKey: 'sk-or-test', model: 'flux', prompt: 'localize', imageDataUrl: sourceImage,
    })).toBe(generated)
    expect(capturedBody(fetchMock).modalities).toEqual(['image', 'text'])
  })

  it('uses standard image_url content without modalities for custom providers', async () => {
    const generated = 'data:image/png;base64,Z2VuZXJhdGVk'
    const fetchMock = makeJsonFetchMock({ choices: [{ message: { images: [{ image_url: { url: generated } }] } }] })
    vi.stubGlobal('fetch', fetchMock)
    await editImage({
      provider: 'custom', apiKey: 'sk-test', baseUrl: 'https://custom.example.com/v1', model: 'image-model',
      prompt: 'localize', imageDataUrl: sourceImage,
    })
    const body = capturedBody(fetchMock)
    expect(body.modalities).toBeUndefined()
    expect(body.messages).toEqual([{ role: 'user', content: [
      { type: 'text', text: 'localize' },
      { type: 'image_url', image_url: { url: sourceImage } },
    ] }])
  })

  it('surfaces model-reported image errors', async () => {
    vi.stubGlobal('fetch', makeJsonFetchMock({ choices: [{ message: { content: '{"error":"Cannot generate images."}' } }] }))
    await expect(editImage({
      provider: 'custom', apiKey: 'sk-test', baseUrl: 'https://custom.example.com/v1', model: 'text-model',
      prompt: 'localize', imageDataUrl: sourceImage,
    })).rejects.toThrow('Cannot generate images.')
  })
})
