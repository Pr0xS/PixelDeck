export type AiProvider = 'openrouter' | 'opencode' | 'openai' | 'anthropic' | 'google'

export type AiProtocol = 'openai' | 'anthropic' | 'google'

export interface AiModel {
  id: string
  name: string
  description?: string
  contextLength?: number
}

export interface AiProviderConfig {
  id: AiProvider
  label: string
  shortLabel: string
  description: string
  placeholder: string
  keyUrl: string
  protocol: AiProtocol
  baseUrl: string
  modelsUrl?: string
  defaultModel: string
}

export const AI_PROVIDERS: AiProviderConfig[] = [
  {
    id: 'openrouter',
    label: 'OpenRouter',
    shortLabel: 'OpenRouter',
    description: 'One key for Claude, GPT, Gemini and open models.',
    placeholder: 'sk-or-…',
    keyUrl: 'https://openrouter.ai/keys',
    protocol: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    modelsUrl: 'https://openrouter.ai/api/v1/models',
    defaultModel: 'anthropic/claude-3.5-haiku',
  },
  {
    id: 'opencode',
    label: 'OpenCode Go',
    shortLabel: 'OpenCode Go',
    description: 'Subscription access to selected open models.',
    placeholder: 'sk-…',
    keyUrl: 'https://opencode.ai',
    protocol: 'openai',
    baseUrl: 'https://opencode.ai/zen/go/v1',
    modelsUrl: 'https://opencode.ai/zen/go/v1/models',
    defaultModel: 'kimi-k2.6',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    shortLabel: 'OpenAI',
    description: 'Direct BYOK for OpenAI platform keys.',
    placeholder: 'sk-…',
    keyUrl: 'https://platform.openai.com/api-keys',
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    modelsUrl: 'https://api.openai.com/v1/models',
    defaultModel: 'gpt-4o-mini',
  },
  {
    id: 'anthropic',
    label: 'Claude (Anthropic)',
    shortLabel: 'Claude',
    description: 'Direct BYOK for Anthropic API keys.',
    placeholder: 'sk-ant-…',
    keyUrl: 'https://console.anthropic.com',
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    modelsUrl: 'https://api.anthropic.com/v1/models',
    defaultModel: 'claude-haiku-4-5',
  },
  {
    id: 'google',
    label: 'Google AI',
    shortLabel: 'Google',
    description: 'Direct BYOK for Gemini API keys.',
    placeholder: 'AIza…',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    protocol: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    modelsUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    defaultModel: 'gemini-2.0-flash',
  },
]

export function getProviderConfig(provider: AiProvider): AiProviderConfig {
  const config = AI_PROVIDERS.find((p) => p.id === provider)
  if (!config) throw new Error(`Unknown AI provider: ${provider}`)
  return config
}

export function getDefaultModel(provider: AiProvider): string {
  return getProviderConfig(provider).defaultModel
}
