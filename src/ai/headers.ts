import type { AiProvider } from '@/ai/providers'

const APP_TITLE = 'PixelDeck'
const FALLBACK_ORIGIN = 'https://pixeldeck.local'
const ANTHROPIC_VERSION = '2023-06-01'

interface HeaderOptions {
  contentType?: boolean
}

function withJsonContentType(headers: Record<string, string>, options?: HeaderOptions): Record<string, string> {
  return options?.contentType ? { 'Content-Type': 'application/json', ...headers } : headers
}

export function getAiRequestOrigin(): string {
  return typeof window === 'undefined' ? FALLBACK_ORIGIN : window.location.origin
}

export function buildOpenAiCompatibleHeaders(
  provider: AiProvider,
  apiKey: string,
  options?: HeaderOptions,
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  }

  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = getAiRequestOrigin()
    headers['X-OpenRouter-Title'] = APP_TITLE
  }

  return withJsonContentType(headers, options)
}

export function buildAnthropicHeaders(apiKey: string, options?: HeaderOptions): Record<string, string> {
  return withJsonContentType(
    {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    options,
  )
}

export function buildGoogleHeaders(
  apiKey: string,
  options?: HeaderOptions & { includeApiKey?: boolean },
): Record<string, string> {
  return withJsonContentType(
    options?.includeApiKey ? { 'x-goog-api-key': apiKey } : {},
    options,
  )
}
