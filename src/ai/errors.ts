import type { AiProvider } from '@/ai/providers'

export function formatAiNetworkError(provider: AiProvider, action: string, error: unknown): Error {
  const cause = error instanceof Error && error.message ? error.message : 'Network request failed'
  const hint = import.meta.env.DEV
    ? 'Restart the dev server if the Vite proxy config changed.'
    : 'If this is a static deploy such as GitHub Pages, configure VITE_AI_PROXY_BASE_URL for a backend/serverless proxy or use a provider that allows direct browser access.'
  return new Error(`Could not ${action} for ${provider}. ${hint} (${cause})`)
}
