import { AiProviderSettings } from '@/components/ai/AiProviderSettings'
import { ModalShell } from '@/components/ui/ModalShell'

interface ApiKeysModalProps {
  open: boolean
  onClose: () => void
}

export function ApiKeysModal({ open, onClose }: ApiKeysModalProps) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      maxWidth="max-w-2xl"
      backdropStyle={{ background: 'rgba(0,0,0,0.6)' }}
      panelClassName="rounded-2xl border shadow-2xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto"
      showCloseButton={false}
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
    </ModalShell>
  )
}
