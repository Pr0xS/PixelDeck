import { getProviderConfig } from '@/ai/providers'
import type { AiModel, AiProvider } from '@/ai/providers'

interface RemoteModel {
  id?: string
  name?: string
  display_name?: string
  displayName?: string
  description?: string
  context_length?: number
  contextLength?: number
  max_input_tokens?: number
  inputTokenLimit?: number
  supportedGenerationMethods?: string[]
}

export async function listModels(provider: AiProvider, apiKey: string): Promise<AiModel[]> {
  const config = getProviderConfig(provider)
  const key = apiKey.trim()
  if (!key) throw new Error('Add an API key before loading models.')
  if (!config.modelsUrl) throw new Error(`${config.label} does not expose a model list endpoint.`)

  const res = await fetch(buildModelsUrl(config.modelsUrl, provider, key), {
    headers: buildModelListHeaders(provider, key),
  })
  if (!res.ok) throw new Error(await readErrorMessage(res))

  const data = await res.json()
  const remoteModels = getRemoteModels(data)
  const models = remoteModels
    .map((model) => normalizeModel(provider, model))
    .filter((model: AiModel | null): model is AiModel => Boolean(model))

  if (!models.length) throw new Error('The provider returned no compatible models.')
  return sortModels(dedupeModels(models))
}

function buildModelsUrl(modelsUrl: string, provider: AiProvider, apiKey: string): string {
  if (provider !== 'google') return modelsUrl
  const url = new URL(modelsUrl)
  url.searchParams.set('key', apiKey)
  return url.toString()
}

function buildModelListHeaders(provider: AiProvider, apiKey: string): HeadersInit {
  if (provider === 'google') return {}
  if (provider === 'anthropic') {
    return {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    }
  }

  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` }
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = typeof window === 'undefined' ? 'https://pixeldeck.local' : window.location.origin
    headers['X-OpenRouter-Title'] = 'PixelDeck'
  }
  return headers
}

async function readErrorMessage(res: Response): Promise<string> {
  const fallback = `Could not load models (${res.status} ${res.statusText}).`
  try {
    const text = await res.text()
    return text.trim() || fallback
  } catch {
    return fallback
  }
}

function getRemoteModels(data: unknown): RemoteModel[] {
  if (!data || typeof data !== 'object') return []
  const record = data as { data?: unknown; models?: unknown }
  if (Array.isArray(record.data)) return record.data as RemoteModel[]
  if (Array.isArray(record.models)) return record.models as RemoteModel[]
  if (Array.isArray(data)) return data as RemoteModel[]
  return []
}

function normalizeModel(provider: AiProvider, model: RemoteModel): AiModel | null {
  if (provider === 'google' && !model.supportedGenerationMethods?.includes('generateContent')) return null

  const rawId = model.id ?? model.name
  if (!rawId) return null
  const id = provider === 'google' ? rawId.replace(/^models\//, '') : rawId
  return {
    id,
    name: model.display_name || model.displayName || model.name || model.id || id,
    description: model.description,
    contextLength: model.context_length ?? model.contextLength ?? model.max_input_tokens ?? model.inputTokenLimit,
  }
}

function dedupeModels(models: AiModel[]): AiModel[] {
  return [...new Map(models.map((model) => [model.id, model])).values()]
}

function sortModels(models: AiModel[]): AiModel[] {
  return models.sort((a, b) => a.name.localeCompare(b.name))
}

export function searchModels(models: AiModel[], query: string): AiModel[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return models
  return models.filter(
    (model) =>
      model.id.toLowerCase().includes(normalized) ||
      model.name.toLowerCase().includes(normalized) ||
      model.description?.toLowerCase().includes(normalized),
  )
}
