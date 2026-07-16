import { AiProviderSettings } from '@/components/ai/AiProviderSettings'

interface ApiKeysModalProps {
  open: boolean
  onClose: () => void
}

export function ApiKeysModal({ open, onClose }: ApiKeysModalProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl border shadow-2xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto"
        style={{ background: '#18181f', borderColor: 'rgba(255,255,255,0.1)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-[#e8e8f0]">AI Settings</h2>
          <button onClick={onClose} className="text-[#6b6b7a] hover:text-[#e8e8f0] transition-colors text-lg">✕</button>
        </div>

        <p className="text-[12px] text-[#6b6b7a] mb-4 leading-relaxed">
          API keys are stored locally in this browser and sent only to the selected provider.
          Consumer subscriptions like ChatGPT Plus or Claude Pro cannot be used as API access.
        </p>

        <AiProviderSettings />

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
