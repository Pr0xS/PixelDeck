import { formatAiNetworkError } from '@/ai/errors'
import { buildOpenAiCompatibleHeaders } from '@/ai/headers'
import { getDefaultModel, getProviderConfig } from '@/ai/providers'
import type { AiProvider } from '@/ai/providers'

/** A multimodal content part: plain text or an image as a data URL. */
export type AiContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; dataUrl: string }

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | AiContentPart[]
}

/** Split a data URL into media type + base64 payload. */
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
 * For chat-based image paths:
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
  baseUrl?: string
  model?: string
  messages: AiChatMessage[]
  maxTokens?: number
  /** Request provider-level JSON mode when it is known to be compatible. */
  forceJsonMode?: boolean
}

export interface AiImageEditOptions {
  provider: AiProvider
  apiKey: string
  baseUrl?: string
  model?: string
  prompt: string
  imageDataUrl: string
}

export async function chat(options: AiChatOptions): Promise<string> {
  const apiKey = options.apiKey.trim()
  if (!apiKey) throw new Error('No API key configured. Open AI Settings in the toolbar.')
  const baseUrl = resolveBaseUrl(options.provider, options.baseUrl)
  if (!baseUrl) throw new Error('No custom API base URL configured. Open AI Settings in the toolbar.')
  const model = options.model?.trim() || getDefaultModel(options.provider)
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
  const baseUrl = resolveBaseUrl(options.provider, options.baseUrl)
  if (!baseUrl) throw new Error('No custom API base URL configured. Open AI Settings in the toolbar.')
  const model = options.model?.trim() || getDefaultModel(options.provider)

  if (options.provider === 'openai') {
    return editImageWithOpenAi(baseUrl, apiKey, model, options.prompt, options.imageDataUrl)
  }
  // Other compatible providers attempt image editing via chat completions.
  // The model itself signals unsupported via the JSON error contract in the prompt.
  return editImageWithOpenAiCompatibleImageChat(options.provider, baseUrl, apiKey, model, options.prompt, options.imageDataUrl)
}

/**
 * Soft hint for the UI: returns true when the selected provider+model is
 * known to support image generation. Used to show/hide warnings — NOT a
 * hard gate. The actual capability is determined at call time.
 */
/** Resolve the effective base URL for a provider, stripping trailing slashes. */
function resolveBaseUrl(provider: AiProvider, baseUrlOverride?: string): string | undefined {
  const raw = provider === 'custom' ? baseUrlOverride?.trim() : getProviderConfig(provider).baseUrl
  return raw ? raw.replace(/\/+$/, '') : undefined
}

export function supportsImageEditing(provider: AiProvider, model: string): boolean {
  if (provider === 'openai') return model.toLowerCase().startsWith('gpt-image')
  if (provider === 'google') return false
  // OpenRouter and custom providers are optimistic; runtime decides.
  return true
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

  // OpenAI, OpenRouter, and Google's OpenAI-compat endpoint all support Chat
  // Completions JSON mode. Do not send this to `custom` endpoints: unknown
  // OpenAI-compatible servers/routed models can reject `response_format`, so
  // those stay prompt-only and rely on the parser/retry machinery.
  // o-series models support json_object mode too.
  if (forceJsonMode && (provider === 'openai' || provider === 'openrouter' || provider === 'google')) {
    body.response_format = { type: 'json_object' }
  }

  // Reasoning models consume their entire token budget on internal chain-of-thought
  // before generating any output, causing finish_reason=length on JSON tasks.
  // Disable reasoning for providers/models where it is known to be the default.
  //
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
  provider: AiProvider,
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  imageDataUrl: string,
): Promise<string> {
  const headers = buildOpenAiCompatibleHeaders(provider, apiKey, { contentType: true })

  const userContent = [
    { type: 'text', text: prompt },
    { type: 'image_url', image_url: { url: imageDataUrl } },
  ]

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
