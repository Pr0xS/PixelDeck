import { useApiKeysStore } from '@/store/apiKeys'
import type { AiProvider } from '@/store/apiKeys'

interface ApiKeysModalProps {
  open: boolean
  onClose: () => void
}

const inputCls =
  'bg-[#0f0f13] border border-[rgba(255,255,255,0.1)] rounded px-3 py-2 text-sm text-[#e8e8f0] w-full focus:outline-none focus:border-[rgba(124,110,246,0.5)] font-mono'
const labelCls = 'text-[11px] text-[#6b6b7a] mb-1 block uppercase tracking-[0.08em]'

const PROVIDERS: { id: AiProvider; label: string; placeholder: string }[] = [
  { id: 'anthropic', label: 'Claude (Anthropic)', placeholder: 'sk-ant-…' },
  { id: 'openai', label: 'OpenAI', placeholder: 'sk-…' },
  { id: 'google', label: 'Google AI', placeholder: 'AIza…' },
]

export function ApiKeysModal({ open, onClose }: ApiKeysModalProps) {
  const {
    provider,
    anthropicKey,
    openaiKey,
    googleKey,
    setProvider,
    setAnthropicKey,
    setOpenaiKey,
    setGoogleKey,
  } = useApiKeysStore()

  if (!open) return null

  const keyValue = (p: AiProvider) => {
    if (p === 'anthropic') return anthropicKey
    if (p === 'openai') return openaiKey
    return googleKey
  }

  const setKey = (p: AiProvider, v: string) => {
    if (p === 'anthropic') setAnthropicKey(v)
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
        className="rounded-2xl border shadow-2xl w-full max-w-md mx-4 p-6"
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
          Your API key is stored locally in your browser and sent only to the respective AI provider.
          It is never shared with PixelDeck servers.
        </p>

        {/* Provider selector */}
        <div className="mb-4">
          <label className={labelCls}>AI Provider</label>
          <div className="grid grid-cols-3 gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProvider(p.id)}
                className={`rounded-lg border px-2 py-2 text-xs transition-colors ${
                  provider === p.id
                    ? 'border-[#7c6ef6] bg-[rgba(124,110,246,0.18)] text-[#c4b5fd]'
                    : 'border-[rgba(255,255,255,0.1)] text-[#6b6b7a] hover:text-[#e8e8f0] hover:bg-[rgba(255,255,255,0.06)]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Active provider key input */}
        {PROVIDERS.map((p) => (
          <div key={p.id} className={p.id === provider ? 'mb-4' : 'hidden'}>
            <label className={labelCls}>API Key — {p.label}</label>
            <input
              type="password"
              value={keyValue(p.id)}
              onChange={(e) => setKey(p.id, e.target.value)}
              placeholder={p.placeholder}
              className={inputCls}
              autoComplete="off"
            />
          </div>
        ))}

        <p className="text-[11px] text-[#4a4a5a] leading-relaxed">
          Get your key from{' '}
          {provider === 'anthropic' && (
            <a
              href="https://console.anthropic.com"
              target="_blank"
              rel="noreferrer"
              className="text-[#7c6ef6] hover:underline"
            >
              console.anthropic.com
            </a>
          )}
          {provider === 'openai' && (
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noreferrer"
              className="text-[#7c6ef6] hover:underline"
            >
              platform.openai.com
            </a>
          )}
          {provider === 'google' && (
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-[#7c6ef6] hover:underline"
            >
              aistudio.google.com
            </a>
          )}
        </p>

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-lg bg-[#7c6ef6] hover:bg-[#6c5ed6] py-2 text-sm font-medium text-white transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  )
}
