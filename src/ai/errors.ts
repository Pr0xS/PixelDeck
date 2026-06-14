import type { AiProvider } from '@/ai/providers'

export function formatAiNetworkError(provider: AiProvider, action: string, error: unknown): Error {
  const cause = error instanceof Error && error.message ? error.message : 'Network request failed'
  const hint = import.meta.env.DEV
    ? 'Restart the dev server if the Vite proxy config changed.'
    : 'This provider may require a backend or serverless proxy in static production builds because browsers enforce CORS.'
  return new Error(`Could not ${action} for ${provider}. ${hint} (${cause})`)
}
