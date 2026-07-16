import { useEffect, useMemo, useState } from 'react'
import { listModels, searchModels } from '@/ai/models'
import { AI_PROVIDERS, getDefaultModel } from '@/ai/providers'
import { useApiKeysStore } from '@/store/apiKeys'
import type { AiModel, AiProvider } from '@/ai/providers'

const inputCls =
  'bg-[#0f0f13] border border-[rgba(255,255,255,0.1)] rounded px-3 py-2 text-sm text-[#e8e8f0] w-full focus:outline-none focus:border-[rgba(124,110,246,0.5)]'
const monoInputCls = `${inputCls} font-mono`
const labelCls = 'text-[11px] text-[#6b6b7a] mb-1 block uppercase tracking-[0.08em]'

export function AiProviderSettings() {
  const {
    provider,
    openaiKey,
    openrouterKey,
    googleKey,
    customBaseUrl,
    customApiKey,
    selectedModels,
    setProvider,
    setOpenaiKey,
    setOpenrouterKey,
    setGoogleKey,
    setCustomBaseUrl,
    setCustomApiKey,
    setModel,
  } = useApiKeysStore()
  const [models, setModels] = useState<AiModel[]>([])
  const [modelSearch, setModelSearch] = useState('')
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelError, setModelError] = useState<string | null>(null)
  const [modelResultSignature, setModelResultSignature] = useState('')
  const [modelLoadNonce, setModelLoadNonce] = useState(0)

  function keyValue(p: AiProvider) {
    if (p === 'openai') return openaiKey
    if (p === 'openrouter') return openrouterKey
    if (p === 'google') return googleKey
    return customApiKey
  }

  function setKey(p: AiProvider, value: string) {
    if (p === 'openai') setOpenaiKey(value)
    else if (p === 'openrouter') setOpenrouterKey(value)
    else if (p === 'google') setGoogleKey(value)
    else setCustomApiKey(value)
  }

  const activeProvider = AI_PROVIDERS.find((item) => item.id === provider) ?? AI_PROVIDERS[0]
  const activeKey = keyValue(provider)
  const hasActiveKey = activeKey.trim().length > 0 && (provider !== 'custom' || customBaseUrl.trim().length > 0)
  const modelSignature = `${provider}:${activeKey.trim()}:${provider === 'custom' ? customBaseUrl.trim() : ''}`
  const isCurrentModelResult = hasActiveKey && modelResultSignature === modelSignature
  const visibleModels = useMemo(
    () => (isCurrentModelResult && !modelError ? models : []),
    [isCurrentModelResult, modelError, models],
  )
  const activeModelError = isCurrentModelResult ? modelError : null
  const activeModel = selectedModels[provider] || getDefaultModel(provider)
  const filteredModels = useMemo(
    () => searchModels(visibleModels, modelSearch).slice(0, 80),
    [visibleModels, modelSearch],
  )
  const modelStatus = !hasActiveKey
    ? 'Not connected'
    : loadingModels || !isCurrentModelResult
      ? 'Connecting…'
      : activeModelError
        ? 'Connection failed'
        : `${visibleModels.length} from provider`

  useEffect(() => {
    let cancelled = false
    if (!hasActiveKey) return () => { cancelled = true }

    async function loadProviderModels() {
      setLoadingModels(true)
      setModelError(null)
      try {
        const nextModels = await listModels(provider, activeKey, provider === 'custom' ? customBaseUrl.trim() : undefined)
        if (cancelled) return
        setModels(nextModels)
        setModelResultSignature(modelSignature)
      } catch (error) {
        if (cancelled) return
        setModels([])
        setModelError(error instanceof Error ? error.message : 'Unknown error.')
        setModelResultSignature(modelSignature)
      } finally {
        if (!cancelled) setLoadingModels(false)
      }
    }

    const timeout = window.setTimeout(() => void loadProviderModels(), 500)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [activeKey, customBaseUrl, hasActiveKey, modelLoadNonce, modelSignature, provider])

  return (
    <div>
      <div className="mb-4">
        <label className={labelCls}>AI Provider</label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {AI_PROVIDERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setProvider(item.id)
                setModelSearch('')
              }}
              className={`rounded-lg border px-2 py-2 text-xs transition-colors text-left ${
                provider === item.id
                  ? 'border-[#7c6ef6] bg-[rgba(124,110,246,0.18)] text-[#c4b5fd]'
                  : 'border-[rgba(255,255,255,0.1)] text-[#6b6b7a] hover:text-[#e8e8f0] hover:bg-[rgba(255,255,255,0.06)]'
              }`}
            >
              <span className="block font-medium">{item.shortLabel}</span>
              <span className="block mt-1 text-[10px] opacity-70 leading-tight">{item.description}</span>
            </button>
          ))}
        </div>
      </div>

      {provider === 'custom' && (
        <div className="mb-4">
          <label className={labelCls}>Base URL</label>
          <input
            type="text"
            value={customBaseUrl}
            onChange={(event) => setCustomBaseUrl(event.target.value)}
            placeholder="https://api.example.com/v1"
            className={monoInputCls}
            autoComplete="off"
          />
          <p className="mt-1 text-[11px] text-[#4a4a5a] leading-relaxed">
            Must implement the OpenAI Chat Completions API (`POST {'{baseUrl}'}/chat/completions`).
          </p>
        </div>
      )}

      <div className="mb-4">
        <label className={labelCls}>API Key — {activeProvider.label}</label>
        <input
          type="password"
          value={activeKey}
          onChange={(event) => setKey(provider, event.target.value)}
          placeholder={activeProvider.placeholder}
          className={monoInputCls}
          autoComplete="off"
        />
        {activeProvider.keyUrl && (
          <p className="mt-1 text-[11px] text-[#4a4a5a] leading-relaxed">
            Get your key from{' '}
            <a href={activeProvider.keyUrl} target="_blank" rel="noreferrer" className="text-[#7c6ef6] hover:underline">
              {activeProvider.keyUrl.replace(/^https?:\/\//, '')}
            </a>
          </p>
        )}
      </div>

      <div className="mb-4 rounded-xl border border-[rgba(255,255,255,0.08)] p-3 bg-[rgba(255,255,255,0.02)]">
        <div className="flex items-center justify-between gap-3 mb-2">
          <label className={labelCls + ' !mb-0'}>Model</label>
          <span className="text-[10px] text-[#6b6b7a]">{modelStatus}</span>
        </div>
        {!hasActiveKey ? (
          <p className="rounded-lg border border-[rgba(255,255,255,0.08)] px-3 py-4 text-xs text-[#6b6b7a] text-center">
            Add an API key to connect to {activeProvider.label}. PixelDeck will load the model list from the provider after the connection is available.
          </p>
        ) : (
          <>
            <input
              type="text"
              value={activeModel}
              onChange={(event) => setModel(provider, event.target.value)}
              placeholder={getDefaultModel(provider) || 'e.g. gpt-4o-mini'}
              className={`${monoInputCls} mb-2`}
              autoComplete="off"
            />
            {loadingModels ? (
              <p className="rounded-lg border border-[rgba(255,255,255,0.08)] px-3 py-4 text-xs text-[#6b6b7a] text-center">
                Connecting to {activeProvider.label} and loading models…
              </p>
            ) : activeModelError ? (
              <div className="rounded-lg border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.08)] px-3 py-3">
                <p className="text-xs text-[#fca5a5] leading-relaxed">
                  Could not load models from {activeProvider.label}: {activeModelError}
                </p>
                <p className="mt-1 text-[11px] text-[#9ca3af]">No hardcoded fallback models are shown. Check the key/provider and retry.</p>
                <button
                  type="button"
                  onClick={() => setModelLoadNonce((value) => value + 1)}
                  className="mt-3 rounded-md border border-[rgba(255,255,255,0.12)] px-3 py-1.5 text-xs text-[#e8e8f0] hover:bg-[rgba(255,255,255,0.06)]"
                >
                  Retry connection
                </button>
              </div>
            ) : (
              <>
                <input
                  type="search"
                  value={modelSearch}
                  onChange={(event) => setModelSearch(event.target.value)}
                  placeholder="Search models from this provider…"
                  className={`${inputCls} mb-2`}
                />
                <div className="max-h-48 overflow-y-auto rounded-lg border border-[rgba(255,255,255,0.08)]">
                  {filteredModels.length ? filteredModels.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => setModel(provider, model.id)}
                      className={`block w-full text-left px-3 py-2 border-b border-[rgba(255,255,255,0.06)] last:border-b-0 transition-colors ${
                        activeModel === model.id
                          ? 'bg-[rgba(124,110,246,0.16)] text-[#c4b5fd]'
                          : 'text-[#b8b8c8] hover:bg-[rgba(255,255,255,0.05)]'
                      }`}
                    >
                      <span className="block text-xs font-medium">{model.name}</span>
                      <span className="block text-[11px] font-mono text-[#6b6b7a]">{model.id}</span>
                      {model.description && <span className="block text-[10px] text-[#4a4a5a] line-clamp-2 mt-0.5">{model.description}</span>}
                    </button>
                  )) : (
                    <p className="px-3 py-4 text-xs text-[#6b6b7a] text-center">The provider returned no models matching this search.</p>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
