import { getProviderConfig } from '@/ai/providers'
import { formatAiNetworkError } from '@/ai/errors'
import { buildAnthropicHeaders, buildGoogleHeaders, buildOpenAiCompatibleHeaders } from '@/ai/headers'
import { getAiModelsUrl } from '@/ai/urls'
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

  let res: Response
  try {
    res = await fetch(buildModelsUrl(config.modelsUrl, provider, key), {
      headers: buildModelListHeaders(provider, key),
    })
  } catch (error) {
    throw formatAiNetworkError(provider, 'load models', error)
  }
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
  const urlWithProxy = getAiModelsUrl(provider, modelsUrl)
  if (import.meta.env.DEV) return urlWithProxy
  if (provider !== 'google') return modelsUrl
  const url = new URL(urlWithProxy)
  url.searchParams.set('key', apiKey)
  return url.toString()
}

function buildModelListHeaders(provider: AiProvider, apiKey: string): HeadersInit {
  if (provider === 'google') return buildGoogleHeaders(apiKey, { includeApiKey: import.meta.env.DEV })
  if (provider === 'opencode') return {}
  if (provider === 'anthropic') return buildAnthropicHeaders(apiKey)
  return buildOpenAiCompatibleHeaders(provider, apiKey)
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
  if (provider === 'opencode' && !isOpenCodeChatCompletionsModel(id)) return null
  return {
    id,
    name: model.display_name || model.displayName || model.name || model.id || id,
    description: model.description,
    contextLength: model.context_length ?? model.contextLength ?? model.max_input_tokens ?? model.inputTokenLimit,
  }
}

/**
 * Returns true when the model is compatible with the OpenAI Chat Completions
 * schema served by OpenCode Go's /zen/go/v1 endpoint.
 *
 * Known-incompatible models are excluded here:
 *   - 'minimax-*'   — MiniMax proprietary API, not OAI-compatible
 *   - 'qwen*'       — Alibaba Qwen models use a non-standard response schema
 *                     via OpenCode's proxy; exclude until confirmed compatible.
 *                     TODO: revisit when OpenCode adds Qwen compatibility.
 *   - 'hy3-preview' — Hunyuan preview model, custom endpoint schema
 */
function isOpenCodeChatCompletionsModel(id: string): boolean {
  return !id.startsWith('minimax-') && !id.startsWith('qwen') && id !== 'hy3-preview'
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
