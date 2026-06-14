import { useEffect, useMemo, useState } from 'react'
import { AI_PROVIDERS, getDefaultModel } from '@/ai/providers'
import { listModels, searchModels } from '@/ai/models'
import { useApiKeysStore } from '@/store/apiKeys'
import { useEditorStore } from '@/store'
import { BrandColorList } from '@/components/common/BrandColorList'
import type { AiModel, AiProvider } from '@/ai/providers'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

// ─── Shared style tokens ────────────────────────────────────────────────────

const inputCls =
  'bg-[#0f0f13] border border-[rgba(255,255,255,0.1)] rounded px-3 py-2 text-sm text-[#e8e8f0] w-full focus:outline-none focus:border-[rgba(124,110,246,0.5)]'
const monoInputCls = `${inputCls} font-mono`
const labelCls = 'text-[11px] text-[#6b6b7a] mb-1 block uppercase tracking-[0.08em]'

// ─── Tab definitions ─────────────────────────────────────────────────────────

type Tab = 'ai' | 'brand' | 'pano'

interface TabMeta {
  id: Tab
  label: string
  icon: string
  section: 'GLOBAL' | 'PROJECT'
}

const TABS: TabMeta[] = [
  { id: 'ai', label: 'AI', icon: '🤖', section: 'GLOBAL' },
  { id: 'brand', label: 'Brand', icon: '🎨', section: 'PROJECT' },
  { id: 'pano', label: 'Pano', icon: '🖼', section: 'PROJECT' },
]

// ─── AI tab content ───────────────────────────────────────────────────────────

function AiSettingsContent() {
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
  const [modelError, setModelError] = useState<string | null>(null)
  const [modelResultSignature, setModelResultSignature] = useState('')
  const [modelLoadNonce, setModelLoadNonce] = useState(0)

  const activeProvider = AI_PROVIDERS.find((p) => p.id === provider) ?? AI_PROVIDERS[0]

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

  const activeKey = keyValue(provider)
  const hasActiveKey = activeKey.trim().length > 0
  const modelSignature = `${provider}:${activeKey.trim()}`
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
        const nextModels = await listModels(provider, activeKey)
        if (cancelled) return
        setModels(nextModels)
        setModelResultSignature(modelSignature)
      } catch (error) {
        if (cancelled) return
        setModels([])
        setModelError(getModelErrorMessage(error))
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
  }, [activeKey, hasActiveKey, modelLoadNonce, modelSignature, provider])

  return (
    <div>
      <h3 className="text-sm font-semibold text-[#e8e8f0] mb-1">AI Settings</h3>
      <p className="text-[12px] text-[#6b6b7a] mb-5 leading-relaxed">
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
          <span className="text-[10px] text-[#6b6b7a]">{modelStatus}</span>
        </div>
        {!hasActiveKey ? (
          <p className="rounded-lg border border-[rgba(255,255,255,0.08)] px-3 py-4 text-xs text-[#6b6b7a] text-center">
            Add an API key to connect to {activeProvider.label}. PixelDeck will load the model list
            from the provider after the connection is available.
          </p>
        ) : (
          <>
            <input
              type="text"
              value={activeModel}
              onChange={(e) => setModel(provider, e.target.value)}
              placeholder={getDefaultModel(provider)}
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
                <p className="mt-1 text-[11px] text-[#9ca3af]">
                  No hardcoded fallback models are shown. Check the key/provider and retry.
                </p>
                <button
                  type="button"
                  onClick={() => setModelLoadNonce((v) => v + 1)}
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
                  onChange={(e) => setModelSearch(e.target.value)}
                  placeholder="Search models from this provider…"
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
                      The provider returned no models matching this search.
                    </p>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {provider === 'anthropic' && (
        <p className="text-[11px] text-[#a78bfa] leading-relaxed">
          Anthropic direct BYOK uses the browser access header required by their API. If this
          becomes unreliable in a hosted deployment, prefer OpenRouter or a backend proxy.
        </p>
      )}
    </div>
  )
}

// ─── Brand tab content ────────────────────────────────────────────────────────

function BrandSettingsContent() {
  const brandColors = useEditorStore((s) => s.project.settings.brandColors) ?? []

  return (
    <div>
      <h3 className="text-sm font-semibold text-[#e8e8f0] mb-1">Brand Colors</h3>
      <p className="text-[12px] text-[#6b6b7a] mb-5 leading-relaxed">
        Reusable colors for this project. Apply them in any color field — edit one here and every
        layer updates automatically.
      </p>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] text-[#4a4a5a] uppercase tracking-[0.1em]">
          {brandColors.length} {brandColors.length === 1 ? 'color' : 'colors'}
        </span>
      </div>
      <BrandColorList />
    </div>
  )
}

// ─── Pano tab content ─────────────────────────────────────────────────────────

function PanoSettingsContent() {
  const panoSettings = useEditorStore(
    (s) => s.project.settings.pano ?? { gapPx: 24, compensate: false },
  )
  const updatePanoSettings = useEditorStore((s) => s.updatePanoSettings)

  return (
    <div>
      <h3 className="text-sm font-semibold text-[#e8e8f0] mb-1">Panorama Settings</h3>
      <p className="text-[12px] text-[#6b6b7a] mb-5 leading-relaxed">
        Configure how multi-slide panoramic groups are displayed and exported.
      </p>

      <div className="space-y-5">
        {/* Gap input */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.08)] p-4 bg-[rgba(255,255,255,0.02)]">
          <label className={labelCls}>Store Preview Gap</label>
          <p className="text-[11px] text-[#4a4a5a] mb-3 leading-relaxed">
            Gap used when compensation is enabled. Simulates the bezel gap shown in app stores.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              max={300}
              value={panoSettings.gapPx ?? 24}
              onChange={(e) =>
                updatePanoSettings({ gapPx: Math.max(0, Math.min(300, Number(e.target.value))) })
              }
              className="bg-[#0f0f13] border border-[rgba(255,255,255,0.1)] rounded px-3 py-2 text-sm text-[#e8e8f0] w-24 focus:outline-none focus:border-[rgba(124,110,246,0.5)]"
            />
            <span className="text-xs text-[#6b6b7a]">px</span>
            <input
              type="range"
              min={0}
              max={300}
              value={panoSettings.gapPx ?? 24}
              onChange={(e) => updatePanoSettings({ gapPx: Number(e.target.value) })}
              className="flex-1 accent-[#7c6ef6]"
            />
          </div>
        </div>

        {/* Compensate checkbox */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.08)] p-4 bg-[rgba(255,255,255,0.02)]">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="pano-compensate"
              checked={panoSettings.compensate ?? false}
              onChange={(e) => updatePanoSettings({ compensate: e.target.checked })}
              className="mt-0.5 accent-[#7c6ef6] w-4 h-4 shrink-0 cursor-pointer"
            />
            <div>
              <label
                htmlFor="pano-compensate"
                className="text-xs font-medium text-[#e8e8f0] cursor-pointer"
              >
                Compensate on Export
              </label>
              <p className="text-[11px] text-[#4a4a5a] mt-1 leading-relaxed">
                When enabled, the gap becomes visible in the canvas/preview and is skipped during export.
                When disabled, pano slides remain continuous with no gap compensation.
              </p>
            </div>
          </div>
        </div>

        {/* Status summary */}
        <div className="rounded-lg border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.01)] px-4 py-3">
          <p className="text-[11px] text-[#6b6b7a] leading-relaxed">
            <span className="text-[#c4b5fd]">Current:</span>{' '}
            {panoSettings.gapPx ?? 24}px gap{' '}
            {panoSettings.compensate
              ? '— compensation active, gap visible and skipped on export'
              : '— compensation inactive, continuous pano with no visual gap'}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [tab, setTab] = useState<Tab>('ai')

  // Escape key closes
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const sections = ['GLOBAL', 'PROJECT'] as const
  const tabsBySection = (section: (typeof sections)[number]) =>
    TABS.filter((t) => t.section === section)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={onClose}
    >
      <div
        className="relative rounded-2xl border shadow-2xl w-full max-w-5xl mx-4 h-[85vh] flex flex-col overflow-hidden"
        style={{ background: '#18181f', borderColor: 'rgba(255,255,255,0.1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-[#6b6b7a] hover:text-[#e8e8f0] transition-colors text-lg w-7 h-7 flex items-center justify-center rounded hover:bg-[rgba(255,255,255,0.06)]"
          aria-label="Close settings"
        >
          ✕
        </button>

        {/* Modal header */}
        <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)] shrink-0">
          <h2 className="text-base font-semibold text-[#e8e8f0]">Settings</h2>
        </div>

        {/* Body: sidebar + content */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <nav
            className="w-44 shrink-0 border-r border-[rgba(255,255,255,0.06)] p-3 overflow-y-auto"
            style={{ background: 'rgba(0,0,0,0.15)' }}
          >
            {sections.map((section) => (
              <div key={section}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#4a4a5a] mb-1 mt-3 first:mt-0 px-2">
                  {section}
                </p>
                {tabsBySection(section).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors flex items-center gap-2 ${
                      tab === t.id
                        ? 'bg-[rgba(124,110,246,0.18)] text-[#c4b5fd]'
                        : 'text-[#6b6b7a] hover:text-[#e8e8f0] hover:bg-[rgba(255,255,255,0.05)]'
                    }`}
                  >
                    <span>{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto p-6">
            {tab === 'ai' && <AiSettingsContent />}
            {tab === 'brand' && <BrandSettingsContent />}
            {tab === 'pano' && <PanoSettingsContent />}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getModelErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Unknown error.'
}
