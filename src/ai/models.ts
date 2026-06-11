import { getProviderConfig } from '@/ai/providers'
import type { AiModel, AiProvider } from '@/ai/providers'

interface RemoteModel {
  id?: string
  name?: string
  description?: string
  context_length?: number
  contextLength?: number
}

export async function listModels(provider: AiProvider, apiKey: string): Promise<AiModel[]> {
  const config = getProviderConfig(provider)
  if (!config.modelsUrl) return config.curatedModels

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`
    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = window.location.origin
      headers['X-OpenRouter-Title'] = 'PixelDeck'
    }

    const res = await fetch(config.modelsUrl, { headers })
    if (!res.ok) throw new Error(await res.text())

    const data = await res.json()
    const remoteModels = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []
    const models = remoteModels.map(normalizeModel).filter((m: AiModel | null): m is AiModel => Boolean(m))
    return mergeModels(models, config.curatedModels)
  } catch {
    return config.curatedModels
  }
}

function normalizeModel(model: RemoteModel): AiModel | null {
  if (!model.id) return null
  return {
    id: model.id,
    name: model.name || model.id,
    description: model.description,
    contextLength: model.context_length ?? model.contextLength,
  }
}

function mergeModels(remote: AiModel[], curated: AiModel[]): AiModel[] {
  const byId = new Map<string, AiModel>()
  for (const model of curated) byId.set(model.id, model)
  for (const model of remote) byId.set(model.id, { ...byId.get(model.id), ...model })
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
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
