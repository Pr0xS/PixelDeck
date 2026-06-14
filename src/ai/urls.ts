import type { AiProvider } from '@/ai/providers'

const LOCAL_AI_PROXY_BASE = '/api/ai-proxy'

function getConfiguredAiProxyBaseUrl(): string | null {
  const value = import.meta.env.VITE_AI_PROXY_BASE_URL?.trim()
  return value ? value.replace(/\/+$/, '') : null
}

export function usesAiProxy(): boolean {
  return import.meta.env.DEV || Boolean(getConfiguredAiProxyBaseUrl())
}

export function isAiProviderBlockedInStaticBrowser(provider: AiProvider): boolean {
  return provider === 'opencode' && !usesAiProxy()
}

function getAiProxyProviderBaseUrl(provider: AiProvider): string | null {
  if (import.meta.env.DEV) return `${LOCAL_AI_PROXY_BASE}/${provider}`
  const proxyBaseUrl = getConfiguredAiProxyBaseUrl()
  return proxyBaseUrl ? `${proxyBaseUrl}/${provider}` : null
}

export function getAiApiBaseUrl(provider: AiProvider, baseUrl: string): string {
  return getAiProxyProviderBaseUrl(provider) ?? baseUrl
}

export function getAiModelsUrl(provider: AiProvider, modelsUrl: string): string {
  const proxyBaseUrl = getAiProxyProviderBaseUrl(provider)
  return proxyBaseUrl ? `${proxyBaseUrl}/models` : modelsUrl
}
