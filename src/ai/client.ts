import { formatAiNetworkError } from '@/ai/errors'
import { buildAnthropicHeaders, buildGoogleHeaders, buildOpenAiCompatibleHeaders } from '@/ai/headers'
import { getDefaultModel, getProviderConfig } from '@/ai/providers'
import { getAiApiBaseUrl, isAiProviderBlockedInStaticBrowser, usesAiProxy } from '@/ai/urls'
import type { AiProvider } from '@/ai/providers'

/** A multimodal content part: plain text or an image as a data URL. */
export type AiContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; dataUrl: string }

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | AiContentPart[]
}

/** Flatten message content to plain text (drops images). */
function contentToText(content: string | AiContentPart[]): string {
  if (typeof content === 'string') return content
  return content
    .filter((p): p is Extract<AiContentPart, { type: 'text' }> => p.type === 'text')
    .map((p) => p.text)
    .join('\n')
}

/** Split a data URL into media type + base64 payload (for Anthropic/Google). */
function splitDataUrl(dataUrl: string): { mediaType: string; data: string } {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl)
  if (!match) throw new Error('Image must be a base64 data URL (data:image/…;base64,…).')
  return { mediaType: match[1], data: match[2] }
}

function asDataUrl(value: unknown, fallbackMediaType = 'image/png'): string | null {
  if (typeof value !== 'string' || !value) return null
  if (value.startsWith('data:image/')) return value
  // Accept raw base64 only when it comes from a known structured field
  // (inline_data.data, b64_json) — callers pass fallbackMediaType in that case.
  // Never treat arbitrary strings as images.
  if (fallbackMediaType !== 'image/png' && /^[A-Za-z0-9+/=\r\n]+$/.test(value) && value.length > 100) {
    return `data:${fallbackMediaType};base64,${value.replace(/\s/g, '')}`
  }
  return null
}

function extractGeneratedImageDataUrl(data: unknown): string {
  const direct = findImageDataUrl(data)
  if (direct) return direct
  throw new Error('The selected model did not return an image. Choose an image-generation model or try another provider.')
}

/**
 * For chat-based image paths (OpenRouter, OpenCode Go):
 * 1. Try to find an image in the response.
 * 2. If no image, check whether the model returned a JSON {error} object.
 * 3. Otherwise throw a generic error.
 */
function extractImageOrThrowModelError(data: unknown): string {
  const imageUrl = findImageDataUrl(data)
  if (imageUrl) return imageUrl

  // Try to surface a model-reported error from the JSON contract
  const text = extractTextFromChatResponse(data)
  if (text) {
    const trimmed = text.trim()
    // Strip optional markdown fences
    const jsonStr = trimmed.startsWith('```') ? trimmed.replace(/^```[^\n]*\n?/, '').replace(/```$/, '').trim() : trimmed
    try {
      const parsed = JSON.parse(jsonStr) as Record<string, unknown>
      if (typeof parsed.error === 'string' && parsed.error) {
        throw new Error(parsed.error.slice(0, 300))
      }
    } catch (e) {
      if (e instanceof SyntaxError) {
        // Not JSON — fall through to generic error
      } else {
        throw e
      }
    }
  }

  throw new Error('The selected model did not return an image. Try an image-generation model (e.g. gpt-image-1, flux, Imagen).')
}

/** Extract the first text string from an OpenAI-compatible chat completion response. */
function extractTextFromChatResponse(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  const choices = record.choices
  if (!Array.isArray(choices) || choices.length === 0) return null
  const msg = (choices[0] as Record<string, unknown>)?.message
  if (!msg || typeof msg !== 'object') return null
  const content = (msg as Record<string, unknown>).content
  return typeof content === 'string' ? content : null
}

function findImageDataUrl(value: unknown): string | null {
  const direct = asDataUrl(value)
  if (direct) return direct
  if (!value || typeof value !== 'object') return null

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findImageDataUrl(item)
      if (found) return found
    }
    return null
  }

  const record = value as Record<string, unknown>
  const url = asDataUrl(record.url) ?? asDataUrl(record.b64_json, 'image/png') ?? asDataUrl(record.data, 'image/png')
  if (url) return url

  const inlineData = record.inlineData ?? record.inline_data
  if (inlineData && typeof inlineData === 'object') {
    const inline = inlineData as Record<string, unknown>
    const mediaType = typeof inline.mimeType === 'string'
      ? inline.mimeType
      : typeof inline.mime_type === 'string' ? inline.mime_type : 'image/png'
    const dataUrl = asDataUrl(inline.data, mediaType)
    if (dataUrl) return dataUrl
  }

  const imageUrl = record.image_url
  if (imageUrl && typeof imageUrl === 'object') {
    const dataUrl = asDataUrl((imageUrl as Record<string, unknown>).url)
    if (dataUrl) return dataUrl
  }

  for (const nested of Object.values(record)) {
    const found = findImageDataUrl(nested)
    if (found) return found
  }
  return null
}

export interface AiChatOptions {
  provider: AiProvider
  apiKey: string
  model?: string
  messages: AiChatMessage[]
  maxTokens?: number
  /** Request provider-level JSON mode when it is known to be compatible. */
  forceJsonMode?: boolean
}

export interface AiImageEditOptions {
  provider: AiProvider
  apiKey: string
  model?: string
  prompt: string
  imageDataUrl: string
}

export async function chat(options: AiChatOptions): Promise<string> {
  const apiKey = options.apiKey.trim()
  if (!apiKey) throw new Error('No API key configured. Open AI Settings in the toolbar.')
  assertProviderAvailableInBrowser(options.provider)

  const config = getProviderConfig(options.provider)
  const baseUrl = getAiApiBaseUrl(options.provider, config.baseUrl)
  const model = options.model?.trim() || getDefaultModel(options.provider)

  if (config.protocol === 'anthropic') {
    return chatWithAnthropic(baseUrl, apiKey, model, options.messages, options.maxTokens)
  }
  if (config.protocol === 'google') {
    return chatWithGoogle(baseUrl, apiKey, model, options.messages, options.maxTokens, options.forceJsonMode)
  }
  return chatWithOpenAiCompatible(
    baseUrl,
    apiKey,
    model,
    options.messages,
    options.maxTokens,
    options.provider,
    options.forceJsonMode,
  )
}

export async function editImage(options: AiImageEditOptions): Promise<string> {
  const apiKey = options.apiKey.trim()
  if (!apiKey) throw new Error('No API key configured. Open AI Settings in the toolbar.')
  assertProviderAvailableInBrowser(options.provider)

  const config = getProviderConfig(options.provider)
  const baseUrl = getAiApiBaseUrl(options.provider, config.baseUrl)
  const model = options.model?.trim() || getDefaultModel(options.provider)

  // Anthropic has no image generation endpoint in PixelDeck
  if (options.provider === 'anthropic') {
    throw new Error('Claude (Anthropic) does not support image generation in PixelDeck. Use OpenAI, Google, or OpenRouter with an image-capable model.')
  }

  if (options.provider === 'openai') {
    return editImageWithOpenAi(baseUrl, apiKey, model, options.prompt, options.imageDataUrl)
  }
  if (options.provider === 'google') {
    return editImageWithGoogle(baseUrl, apiKey, model, options.prompt, options.imageDataUrl)
  }
  // OpenRouter and OpenCode Go: attempt via chat completions with image modality.
  // The model itself signals unsupported via the JSON error contract in the prompt.
  return editImageWithOpenAiCompatibleImageChat(options.provider, baseUrl, apiKey, model, options.prompt, options.imageDataUrl)
}

/**
 * Soft hint for the UI: returns true when the selected provider+model is
 * known to support image generation. Used to show/hide warnings — NOT a
 * hard gate. The actual capability is determined at call time.
 */
export function supportsImageEditing(provider: AiProvider, model: string): boolean {
  if (isAiProviderBlockedInStaticBrowser(provider)) return false
  if (provider === 'anthropic') return false
  if (provider === 'openai') return model.toLowerCase().startsWith('gpt-image')
  if (provider === 'google') {
    const id = model.toLowerCase()
    return id.includes('image') || id.includes('imagen') || id.includes('nano-banana')
  }
  // OpenRouter and OpenCode Go: optimistically true — the model decides at runtime
  return true
}

function assertProviderAvailableInBrowser(provider: AiProvider): void {
  if (!isAiProviderBlockedInStaticBrowser(provider)) return
  throw new Error(
    'OpenCode Go does not allow direct browser requests from GitHub Pages. Use OpenRouter, OpenAI, Anthropic, or Google AI for the static web app.',
  )
}

async function chatWithOpenAiCompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: AiChatMessage[],
  maxTokens: number | undefined,
  provider: AiProvider,
  forceJsonMode = false,
): Promise<string> {
  const headers = buildOpenAiCompatibleHeaders(provider, apiKey, { contentType: true })

  // Map multimodal parts to the OpenAI content schema; strings pass through.
  const apiMessages = messages.map((m) => ({
    role: m.role,
    content:
      typeof m.content === 'string'
        ? m.content
        : m.content.map((part) =>
            part.type === 'text'
              ? { type: 'text' as const, text: part.text }
              : { type: 'image_url' as const, image_url: { url: part.dataUrl } },
          ),
  }))

  // OpenAI o-series reasoning models (o1, o3, o4-mini, …) require
  // `max_completion_tokens` instead of `max_tokens` — sending `max_tokens`
  // causes a 400 error. All other OpenAI-compatible models use `max_tokens`.
  const isOpenAiOModel = provider === 'openai' && /^o\d/i.test(model)
  const body: Record<string, unknown> = {
    model,
    messages: apiMessages,
    ...(maxTokens
      ? isOpenAiOModel
        ? { max_completion_tokens: maxTokens }
        : { max_tokens: maxTokens }
      : {}),
  }

  // OpenAI and OpenRouter support Chat Completions JSON mode. Do not send this
  // to every OpenAI-compatible endpoint: OpenCode Go and some routed models can
  // reject `response_format`, so those stay prompt-only and rely on parsers.
  // o-series models support json_object mode too.
  if (forceJsonMode && (provider === 'openai' || provider === 'openrouter')) {
    body.response_format = { type: 'json_object' }
  }

  // Reasoning models consume their entire token budget on internal chain-of-thought
  // before generating any output, causing finish_reason=length on JSON tasks.
  // Disable reasoning for providers/models where it is known to be the default.
  //
  // OpenCode Go — DeepSeek (deepseek-*) and other known reasoning models (qwq-*, *-r1, *-thinking)
  if (provider === 'opencode') {
    const m = model.toLowerCase()
    if (m.includes('deepseek') || m.includes('qwq') || m.includes('-r1') || m.includes('thinking')) {
      body.thinking = { type: 'disabled' }
    }
  }
  // OpenRouter — DeepSeek R1 variants use a different disable key
  if (provider === 'openrouter') {
    const m = model.toLowerCase()
    if (m.includes('deepseek') && (m.includes('r1') || m.includes('reasoner'))) {
      body.reasoning = { enabled: false }
    }
  }

  let res: Response
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
  } catch (error) {
    throw formatAiNetworkError(provider, 'call chat completions', error)
  }
  if (!res.ok) throw new Error(`${provider} API error ${res.status}: ${await res.text()}`)

  const data = await res.json()
  const choice = data?.choices?.[0]
  const content = choice?.message?.content
  const finishReason = choice?.finish_reason
  if (typeof content !== 'string') throw new Error(`${provider} returned an empty response.`)
  if (!content.trim()) {
    console.error(`[PixelDeck] ${provider} returned empty content. finish_reason=${finishReason}`, data)
    throw new Error(`${provider} returned empty content (finish_reason: ${finishReason ?? 'unknown'}).`)
  }
  return content.trim()
}

async function editImageWithOpenAi(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  imageDataUrl: string,
): Promise<string> {
  const { mediaType, data } = splitDataUrl(imageDataUrl)
  const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0))
  const extension = mediaType.split('/')[1] || 'png'
  const form = new FormData()
  form.set('model', model)
  form.set('prompt', prompt)
  form.set('image', new Blob([bytes], { type: mediaType }), `source.${extension}`)

  let res: Response
  try {
    res = await fetch(`${baseUrl}/images/edits`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })
  } catch (error) {
    throw formatAiNetworkError('openai', 'edit image', error)
  }
  if (!res.ok) throw new Error(`OpenAI image API error ${res.status}: ${await res.text()}`)

  const dataJson = await res.json()
  return extractGeneratedImageDataUrl(dataJson)
}

async function editImageWithOpenAiCompatibleImageChat(
  provider: Extract<AiProvider, 'openrouter' | 'opencode'>,
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  imageDataUrl: string,
): Promise<string> {
  const headers = buildOpenAiCompatibleHeaders(provider, apiKey, { contentType: true })

  // OpenRouter supports the multimodal image_url content part and the modalities field.
  // OpenCode Go routes to various backends (DeepSeek, Kimi, …) that may reject image_url
  // with a 400 before the model sees the prompt. For OpenCode we send the image as a
  // base64 data URL embedded in the text part so the router never sees image_url.
  const userContent = provider === 'openrouter'
    ? [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: imageDataUrl } },
      ]
    : [{ type: 'text', text: `${prompt}\n\n[Source image attached as base64]\n${imageDataUrl}` }]

  let res: Response
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        // modalities is an OpenRouter extension; other OpenAI-compatible endpoints reject it.
        ...(provider === 'openrouter' ? { modalities: ['image', 'text'] } : {}),
        messages: [{ role: 'user', content: userContent }],
      }),
    })
  } catch (error) {
    throw formatAiNetworkError(provider, 'generate image', error)
  }
  if (!res.ok) throw new Error(`${getProviderConfig(provider).shortLabel} image API error ${res.status}: ${await res.text()}`)

  const dataJson = await res.json()
  return extractImageOrThrowModelError(dataJson)
}

async function editImageWithGoogle(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  imageDataUrl: string,
): Promise<string> {
  const { mediaType, data } = splitDataUrl(imageDataUrl)
  const googleUrl = usesAiProxy()
    ? `${baseUrl}/models/${model}:generateContent`
    : `${baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`

  let res: Response
  try {
    res = await fetch(googleUrl, {
      method: 'POST',
      headers: buildGoogleHeaders(apiKey, { contentType: true, includeApiKey: usesAiProxy() }),
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mediaType, data } },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      }),
    })
  } catch (error) {
    throw formatAiNetworkError('google', 'generate image', error)
  }
  if (!res.ok) throw new Error(`Google AI image API error ${res.status}: ${await res.text()}`)

  const dataJson = await res.json()
  return extractGeneratedImageDataUrl(dataJson)
}

async function chatWithAnthropic(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: AiChatMessage[],
  maxTokens = 4096,
): Promise<string> {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => contentToText(m.content))
    .join('\n\n')
  const anthropicMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role,
      content:
        typeof m.content === 'string'
          ? m.content
          : m.content.map((part) => {
              if (part.type === 'text') return { type: 'text' as const, text: part.text }
              const { mediaType, data } = splitDataUrl(part.dataUrl)
              return { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType, data } }
            }),
    }))

  let res: Response
  try {
    res = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: buildAnthropicHeaders(apiKey, { contentType: true }),
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        ...(system ? { system } : {}),
        messages: anthropicMessages.length ? anthropicMessages : [{ role: 'user', content: '' }],
      }),
    })
  } catch (error) {
    throw formatAiNetworkError('anthropic', 'call messages', error)
  }
  if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`)

  const data = await res.json()
  const textBlock = data?.content?.find?.((part: { type?: string }) => part.type === 'text')
  const content = textBlock?.text ?? data?.content?.[0]?.text
  const stopReason = data?.stop_reason
  if (typeof content !== 'string' || !content.trim()) {
    console.error(`[PixelDeck] Anthropic returned empty content. stop_reason=${stopReason}`, data)
    throw new Error(`Anthropic returned an empty response (stop_reason: ${stopReason ?? 'unknown'}).`)
  }
  return content.trim()
}

async function chatWithGoogle(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: AiChatMessage[],
  maxTokens?: number,
  forceJsonMode = false,
): Promise<string> {
  // Google expects a parts array; text messages are flattened with role
  // prefixes, image parts become inline_data blocks.
  const parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }> = []
  for (const m of messages) {
    if (typeof m.content === 'string') {
      parts.push({ text: `${m.role.toUpperCase()}: ${m.content}` })
      continue
    }
    for (const part of m.content) {
      if (part.type === 'text') {
        parts.push({ text: `${m.role.toUpperCase()}: ${part.text}` })
      } else {
        const { mediaType, data } = splitDataUrl(part.dataUrl)
        parts.push({ inline_data: { mime_type: mediaType, data } })
      }
    }
  }

  const googleUrl = usesAiProxy()
    ? `${baseUrl}/models/${model}:generateContent`
    : `${baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`

  let res: Response
  try {
    res = await fetch(googleUrl, {
      method: 'POST',
      headers: buildGoogleHeaders(apiKey, { contentType: true, includeApiKey: usesAiProxy() }),
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          ...(maxTokens ? { maxOutputTokens: maxTokens } : {}),
          ...(forceJsonMode ? { responseMimeType: 'application/json' } : {}),
        },
      }),
    })
  } catch (error) {
    throw formatAiNetworkError('google', 'generate content', error)
  }
  if (!res.ok) throw new Error(`Google AI API error ${res.status}: ${await res.text()}`)

  const data = await res.json()
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text
  const finishReason = data?.candidates?.[0]?.finishReason
  if (typeof content !== 'string' || !content.trim()) {
    console.error(`[PixelDeck] Google AI returned empty content. finishReason=${finishReason}`, data)
    throw new Error(`Google AI returned an empty response (finishReason: ${finishReason ?? 'unknown'}).`)
  }
  return content.trim()
}
