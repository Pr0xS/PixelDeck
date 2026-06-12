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

export interface AiChatOptions {
  provider: AiProvider
  apiKey: string
  model?: string
  messages: AiChatMessage[]
  maxTokens?: number
}

export async function chat(options: AiChatOptions): Promise<string> {
  const apiKey = options.apiKey.trim()
  if (!apiKey) throw new Error('No API key configured. Open AI Settings in the toolbar.')

  const config = getProviderConfig(options.provider)
  const model = options.model?.trim() || getDefaultModel(options.provider)

  if (config.protocol === 'anthropic') {
    return chatWithAnthropic(config.baseUrl, apiKey, model, options.messages, options.maxTokens)
  }
  if (config.protocol === 'google') {
    return chatWithGoogle(config.baseUrl, apiKey, model, options.messages)
  }
  return chatWithOpenAiCompatible(
    config.baseUrl,
    apiKey,
    model,
    options.messages,
    options.maxTokens,
    options.provider,
  )
}

async function chatWithOpenAiCompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: AiChatMessage[],
  maxTokens: number | undefined,
  provider: AiProvider,
): Promise<string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }

  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = window.location.origin
    headers['X-OpenRouter-Title'] = 'PixelDeck'
  }

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

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: apiMessages,
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
    }),
  })
  if (!res.ok) throw new Error(`${provider} API error ${res.status}: ${await res.text()}`)

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') throw new Error(`${provider} returned an empty response.`)
  return content.trim()
}

async function chatWithAnthropic(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: AiChatMessage[],
  maxTokens = 1024,
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

  const res = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages: anthropicMessages.length ? anthropicMessages : [{ role: 'user', content: '' }],
    }),
  })
  if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`)

  const data = await res.json()
  const textBlock = data?.content?.find?.((part: { type?: string }) => part.type === 'text')
  const content = textBlock?.text ?? data?.content?.[0]?.text
  if (typeof content !== 'string') throw new Error('Anthropic returned an empty response.')
  return content.trim()
}

async function chatWithGoogle(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: AiChatMessage[],
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

  const res = await fetch(`${baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }] }),
  })
  if (!res.ok) throw new Error(`Google AI API error ${res.status}: ${await res.text()}`)

  const data = await res.json()
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof content !== 'string') throw new Error('Google AI returned an empty response.')
  return content.trim()
}
