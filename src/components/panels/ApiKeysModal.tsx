import { useEffect, useMemo, useState } from 'react'
import { AI_PROVIDERS, getDefaultModel } from '@/ai/providers'
import { listModels, searchModels } from '@/ai/models'
import { useApiKeysStore } from '@/store/apiKeys'
import type { AiModel, AiProvider } from '@/ai/providers'

interface ApiKeysModalProps {
  open: boolean
  onClose: () => void
}

const inputCls =
  'bg-[#0f0f13] border border-[rgba(255,255,255,0.1)] rounded px-3 py-2 text-sm text-[#e8e8f0] w-full focus:outline-none focus:border-[rgba(124,110,246,0.5)]'
const monoInputCls = `${inputCls} font-mono`
const labelCls = 'text-[11px] text-[#6b6b7a] mb-1 block uppercase tracking-[0.08em]'

export function ApiKeysModal({ open, onClose }: ApiKeysModalProps) {
  const {
    provider,
    openrouterKey,
    opencodeKey,
    anthropicKey,
    openaiKey,
    googleKey,
    selectedModels,
    setProvider,
    setOpenrouterKey,
    setOpencodeKey,
    setAnthropicKey,
    setOpenaiKey,
    setGoogleKey,
    setModel,
  } = useApiKeysStore()
  const [models, setModels] = useState<AiModel[]>([])
  const [modelSearch, setModelSearch] = useState('')
  const [loadingModels, setLoadingModels] = useState(false)

  const activeProvider = AI_PROVIDERS.find((p) => p.id === provider) ?? AI_PROVIDERS[0]
  const activeKey = keyValue(provider)
  const activeModel = selectedModels[provider] || getDefaultModel(provider)
  const filteredModels = useMemo(() => searchModels(models, modelSearch).slice(0, 80), [models, modelSearch])

  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function loadProviderModels() {
      setLoadingModels(true)
      const nextModels = await listModels(provider, activeKey)
      if (cancelled) return
      setModels(ensureSelectedModel(nextModels, activeModel))
      setLoadingModels(false)
    }

    void loadProviderModels()
    return () => {
      cancelled = true
    }
  }, [activeKey, activeModel, open, provider])

  if (!open) return null

  function keyValue(p: AiProvider) {
    if (p === 'openrouter') return openrouterKey
    if (p === 'opencode') return opencodeKey
    if (p === 'anthropic') return anthropicKey
    if (p === 'openai') return openaiKey
    return googleKey
  }

  function setKey(p: AiProvider, v: string) {
    if (p === 'openrouter') setOpenrouterKey(v)
    else if (p === 'opencode') setOpencodeKey(v)
    else if (p === 'anthropic') setAnthropicKey(v)
    else if (p === 'openai') setOpenaiKey(v)
    else setGoogleKey(v)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl border shadow-2xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto"
        style={{ background: '#18181f', borderColor: 'rgba(255,255,255,0.1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-[#e8e8f0]">AI Settings</h2>
          <button
            onClick={onClose}
            className="text-[#6b6b7a] hover:text-[#e8e8f0] transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        <p className="text-[12px] text-[#6b6b7a] mb-4 leading-relaxed">
          API keys are stored locally in this browser and sent only to the selected provider.
          Consumer subscriptions like ChatGPT Plus or Claude Pro cannot be used as API access.
        </p>

        <div className="mb-4">
          <label className={labelCls}>AI Provider</label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {AI_PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setProvider(p.id)
                  setModelSearch('')
                }}
                className={`rounded-lg border px-2 py-2 text-xs transition-colors text-left ${
                  provider === p.id
                    ? 'border-[#7c6ef6] bg-[rgba(124,110,246,0.18)] text-[#c4b5fd]'
                    : 'border-[rgba(255,255,255,0.1)] text-[#6b6b7a] hover:text-[#e8e8f0] hover:bg-[rgba(255,255,255,0.06)]'
                }`}
              >
                <span className="block font-medium">{p.shortLabel}</span>
                <span className="block mt-1 text-[10px] opacity-70 leading-tight">{p.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className={labelCls}>API Key — {activeProvider.label}</label>
          <input
            type="password"
            value={activeKey}
            onChange={(e) => setKey(provider, e.target.value)}
            placeholder={activeProvider.placeholder}
            className={monoInputCls}
            autoComplete="off"
          />
          <p className="mt-1 text-[11px] text-[#4a4a5a] leading-relaxed">
            Get your key from{' '}
            <a
              href={activeProvider.keyUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[#7c6ef6] hover:underline"
            >
              {activeProvider.keyUrl.replace(/^https?:\/\//, '')}
            </a>
          </p>
        </div>

        <div className="mb-4 rounded-xl border border-[rgba(255,255,255,0.08)] p-3 bg-[rgba(255,255,255,0.02)]">
          <div className="flex items-center justify-between gap-3 mb-2">
            <label className={labelCls + ' !mb-0'}>Model</label>
            <span className="text-[10px] text-[#6b6b7a]">
              {loadingModels ? 'Loading models…' : `${models.length} available`}
            </span>
          </div>
          <input
            type="text"
            value={activeModel}
            onChange={(e) => setModel(provider, e.target.value)}
            placeholder={getDefaultModel(provider)}
            className={`${monoInputCls} mb-2`}
            autoComplete="off"
          />
          <input
            type="search"
            value={modelSearch}
            onChange={(e) => setModelSearch(e.target.value)}
            placeholder="Search models for this provider…"
            className={`${inputCls} mb-2`}
          />
          <div className="max-h-48 overflow-y-auto rounded-lg border border-[rgba(255,255,255,0.08)]">
            {filteredModels.length ? (
              filteredModels.map((model) => (
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
                  {model.description && (
                    <span className="block text-[10px] text-[#4a4a5a] line-clamp-2 mt-0.5">
                      {model.description}
                    </span>
                  )}
                </button>
              ))
            ) : (
              <p className="px-3 py-4 text-xs text-[#6b6b7a] text-center">
                No models match this search. You can still type a model ID manually above.
              </p>
            )}
          </div>
        </div>

        {provider === 'anthropic' && (
          <p className="text-[11px] text-[#a78bfa] leading-relaxed mb-4">
            Anthropic direct BYOK uses the browser access header required by their API. If this becomes
            unreliable in a hosted deployment, prefer OpenRouter or a backend proxy.
          </p>
        )}

        <button
          onClick={onClose}
          className="mt-1 w-full rounded-lg bg-[#7c6ef6] hover:bg-[#6c5ed6] py-2 text-sm font-medium text-white transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  )
}

function ensureSelectedModel(models: AiModel[], selectedModel: string): AiModel[] {
  if (!selectedModel || models.some((model) => model.id === selectedModel)) return models
  return [{ id: selectedModel, name: selectedModel }, ...models]
}
