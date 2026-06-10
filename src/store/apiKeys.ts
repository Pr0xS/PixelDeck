import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AiProvider = 'anthropic' | 'openai' | 'google'

export interface ApiKeysState {
  provider: AiProvider
  anthropicKey: string
  openaiKey: string
  googleKey: string
  setProvider: (p: AiProvider) => void
  setAnthropicKey: (key: string) => void
  setOpenaiKey: (key: string) => void
  setGoogleKey: (key: string) => void
  getActiveKey: () => string
}

export const useApiKeysStore = create<ApiKeysState>()(
  persist(
    (set, get) => ({
      provider: 'anthropic',
      anthropicKey: '',
      openaiKey: '',
      googleKey: '',
      setProvider: (p) => set({ provider: p }),
      setAnthropicKey: (key) => set({ anthropicKey: key }),
      setOpenaiKey: (key) => set({ openaiKey: key }),
      setGoogleKey: (key) => set({ googleKey: key }),
      getActiveKey: () => {
        const s = get()
        if (s.provider === 'anthropic') return s.anthropicKey
        if (s.provider === 'openai') return s.openaiKey
        return s.googleKey
      },
    }),
    { name: 'pixeldeck-api-keys' },
  ),
)
