import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getDefaultModel, getProviderConfig } from '@/ai/providers'
import type { AiProvider } from '@/ai/providers'

export type { AiProvider } from '@/ai/providers'

export interface ApiKeysState {
  provider: AiProvider
  openaiKey: string
  openrouterKey: string
  googleKey: string
  customBaseUrl: string
  customApiKey: string
  selectedModels: Partial<Record<AiProvider, string>>
  setProvider: (p: AiProvider) => void
  setOpenaiKey: (key: string) => void
  setOpenrouterKey: (key: string) => void
  setGoogleKey: (key: string) => void
  setCustomBaseUrl: (url: string) => void
  setCustomApiKey: (key: string) => void
  setModel: (provider: AiProvider, model: string) => void
  getActiveKey: () => string
  getActiveModel: () => string
  getActiveBaseUrl: () => string
}

export const useApiKeysStore = create<ApiKeysState>()(
  persist(
    (set, get) => ({
      provider: 'openai',
      openaiKey: '',
      openrouterKey: '',
      googleKey: '',
      customBaseUrl: '',
      customApiKey: '',
      selectedModels: {},
      setProvider: (p) => set({ provider: p }),
      setOpenaiKey: (key) => set({ openaiKey: key }),
      setOpenrouterKey: (key) => set({ openrouterKey: key }),
      setGoogleKey: (key) => set({ googleKey: key }),
      setCustomBaseUrl: (url) => set({ customBaseUrl: url }),
      setCustomApiKey: (key) => set({ customApiKey: key }),
      setModel: (provider, model) =>
        set((state) => ({ selectedModels: { ...state.selectedModels, [provider]: model } })),
      getActiveKey: () => {
        const s = get()
        if (s.provider === 'openai') return s.openaiKey
        if (s.provider === 'openrouter') return s.openrouterKey
        if (s.provider === 'google') return s.googleKey
        return s.customApiKey
      },
      getActiveModel: () => {
        const s = get()
        return s.selectedModels[s.provider] || getDefaultModel(s.provider)
      },
      getActiveBaseUrl: () => {
        const s = get()
        if (s.provider === 'custom') return s.customBaseUrl.trim().replace(/\/+$/, '')
        return getProviderConfig(s.provider).baseUrl
      },
    }),
    {
      name: 'pixeldeck-api-keys',
      version: 2,
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Record<string, unknown>
        // Providers removed when the AI system was simplified to OpenAI-compatible-only.
        const removedProviderIds = ['anthropic', 'opencode']
        const rest = { ...state }
        for (const id of removedProviderIds) delete rest[`${id}Key`]
        const provider =
          !state.provider || removedProviderIds.includes(String(state.provider)) ? 'openai' : state.provider
        return { ...rest, provider } as Partial<ApiKeysState>
      },
    },
  ),
)
