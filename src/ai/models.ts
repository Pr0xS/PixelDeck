import { getProviderConfig } from '@/ai/providers'
import { formatAiNetworkError } from '@/ai/errors'
import { buildOpenAiCompatibleHeaders } from '@/ai/headers'
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
}

export async function listModels(provider: AiProvider, apiKey: string, baseUrlOverride?: string): Promise<AiModel[]> {
  const config = getProviderConfig(provider)
  const key = apiKey.trim()
  if (!key) throw new Error('Add an API key before loading models.')
  const customBaseUrl = baseUrlOverride?.trim()
  if (provider === 'custom' && !customBaseUrl) throw new Error('No custom API base URL configured.')
  const modelsUrl = provider === 'custom' ? `${customBaseUrl!.replace(/\/+$/, '')}/models` : config.modelsUrl
  if (!modelsUrl) throw new Error(`${config.label} does not expose a model list endpoint.`)

  let res: Response
  try {
    res = await fetch(modelsUrl, {
      headers: buildOpenAiCompatibleHeaders(provider, key),
    })
  } catch (error) {
    const fallbackModels = getFallbackModels(provider)
    if (fallbackModels.length) return fallbackModels
    throw formatAiNetworkError(provider, 'load models', error)
  }
  if (!res.ok) throw new Error(await readErrorMessage(res))

  const data = await res.json()
  const remoteModels = getRemoteModels(data)
  const models = remoteModels
    .map((model) => normalizeModel(model))
    .filter((model: AiModel | null): model is AiModel => Boolean(model))

  if (!models.length) throw new Error('The provider returned no compatible models.')
  return sortModels(dedupeModels(models))
}

function getFallbackModels(provider: AiProvider): AiModel[] {
  const models = FALLBACK_MODELS[provider] ?? []
  return sortModels(dedupeModels(models))
}

const FALLBACK_MODELS: Partial<Record<AiProvider, AiModel[]>> = {
  openai: [
    { id: 'gpt-4o-mini', name: 'gpt-4o-mini' },
    { id: 'gpt-4o', name: 'gpt-4o' },
    { id: 'gpt-image-1', name: 'gpt-image-1' },
  ],
  google: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image' },
  ],
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

function normalizeModel(model: RemoteModel): AiModel | null {
  const rawId = model.id ?? model.name
  if (!rawId) return null
  const id = rawId.replace(/^models\//, '')
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
