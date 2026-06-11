import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getDefaultModel } from '@/ai/providers'
import type { AiProvider } from '@/ai/providers'

export type { AiProvider } from '@/ai/providers'

export interface ApiKeysState {
  provider: AiProvider
  openrouterKey: string
  opencodeKey: string
  anthropicKey: string
  openaiKey: string
  googleKey: string
  selectedModels: Partial<Record<AiProvider, string>>
  setProvider: (p: AiProvider) => void
  setOpenrouterKey: (key: string) => void
  setOpencodeKey: (key: string) => void
  setAnthropicKey: (key: string) => void
  setOpenaiKey: (key: string) => void
  setGoogleKey: (key: string) => void
  setModel: (provider: AiProvider, model: string) => void
  getActiveKey: () => string
  getActiveModel: () => string
}

export const useApiKeysStore = create<ApiKeysState>()(
  persist(
    (set, get) => ({
      provider: 'openrouter',
      openrouterKey: '',
      opencodeKey: '',
      anthropicKey: '',
      openaiKey: '',
      googleKey: '',
      selectedModels: {},
      setProvider: (p) => set({ provider: p }),
      setOpenrouterKey: (key) => set({ openrouterKey: key }),
      setOpencodeKey: (key) => set({ opencodeKey: key }),
      setAnthropicKey: (key) => set({ anthropicKey: key }),
      setOpenaiKey: (key) => set({ openaiKey: key }),
      setGoogleKey: (key) => set({ googleKey: key }),
      setModel: (provider, model) =>
        set((state) => ({ selectedModels: { ...state.selectedModels, [provider]: model } })),
      getActiveKey: () => {
        const s = get()
        if (s.provider === 'openrouter') return s.openrouterKey
        if (s.provider === 'opencode') return s.opencodeKey
        if (s.provider === 'anthropic') return s.anthropicKey
        if (s.provider === 'openai') return s.openaiKey
        return s.googleKey
      },
      getActiveModel: () => {
        const s = get()
        return s.selectedModels[s.provider] || getDefaultModel(s.provider)
      },
    }),
    { name: 'pixeldeck-api-keys' },
  ),
)
