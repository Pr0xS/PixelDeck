import type { AiProvider } from '@/ai/providers'

export function formatAiNetworkError(provider: AiProvider, action: string, error: unknown): Error {
  const cause = error instanceof Error && error.message ? error.message : 'Network request failed'
  const hint = 'Check your network connection and that the base URL is correct and allows direct browser requests (CORS). If this provider blocks browser CORS, use a different provider or a self-hosted proxy.'
  return new Error(`Could not ${action} for ${provider}. ${hint} (${cause})`)
}
