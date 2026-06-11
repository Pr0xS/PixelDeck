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
  modelSource: 'remote' | 'curated'
  defaultModel: string
  curatedModels: AiModel[]
}

const openRouterModels: AiModel[] = [
  { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku' },
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini' },
  { id: 'openai/gpt-4o', name: 'GPT-4o' },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct' },
]

const opencodeModels: AiModel[] = [
  { id: 'kimi-k2.6', name: 'Kimi K2.6' },
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro' },
  { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash' },
  { id: 'qwen3.7-coder', name: 'Qwen3.7 Coder' },
  { id: 'glm-5.1', name: 'GLM 5.1' },
]

const openAiModels: AiModel[] = [
  { id: 'gpt-4o-mini', name: 'GPT-4o mini' },
  { id: 'gpt-4o', name: 'GPT-4o' },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini' },
  { id: 'gpt-4.1', name: 'GPT-4.1' },
  { id: 'o4-mini', name: 'o4-mini' },
]

const anthropicModels: AiModel[] = [
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
  { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
  { id: 'claude-sonnet-4-0', name: 'Claude Sonnet 4' },
  { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku' },
  { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet' },
]

const googleModels: AiModel[] = [
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
  { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
]

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
    modelSource: 'remote',
    defaultModel: 'anthropic/claude-3.5-haiku',
    curatedModels: openRouterModels,
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
    modelSource: 'remote',
    defaultModel: 'kimi-k2.6',
    curatedModels: opencodeModels,
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
    modelSource: 'remote',
    defaultModel: 'gpt-4o-mini',
    curatedModels: openAiModels,
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
    modelSource: 'curated',
    defaultModel: 'claude-haiku-4-5',
    curatedModels: anthropicModels,
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
    modelSource: 'curated',
    defaultModel: 'gemini-2.0-flash',
    curatedModels: googleModels,
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

export function getCuratedModels(provider: AiProvider): AiModel[] {
  return getProviderConfig(provider).curatedModels
}
