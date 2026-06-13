import type { AiProvider } from '@/ai/providers'

export function getAiApiBaseUrl(provider: AiProvider, baseUrl: string): string {
  if (!import.meta.env.DEV) return baseUrl
  return `/api/ai-proxy/${provider}`
}

export function getAiModelsUrl(provider: AiProvider, modelsUrl: string): string {
  if (!import.meta.env.DEV) return modelsUrl
  return `/api/ai-proxy/${provider}/models`
}
