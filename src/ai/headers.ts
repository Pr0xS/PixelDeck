import type { AiProvider } from '@/ai/providers'

const APP_TITLE = 'PixelDeck'
const FALLBACK_ORIGIN = 'https://pixeldeck.local'

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
