import { getDefaultModel, getProviderConfig } from '@/ai/providers'
import type { AiProvider } from '@/ai/providers'

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
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

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages,
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
    .map((m) => m.content)
    .join('\n\n')
  const anthropicMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }))

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
  const prompt = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')
  const res = await fetch(`${baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  })
  if (!res.ok) throw new Error(`Google AI API error ${res.status}: ${await res.text()}`)

  const data = await res.json()
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof content !== 'string') throw new Error('Google AI returned an empty response.')
  return content.trim()
}
