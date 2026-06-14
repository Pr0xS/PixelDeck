import { afterEach, describe, expect, it, vi } from 'vitest'

describe('AI URL routing', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('uses direct provider URLs in production without a configured proxy', async () => {
    vi.stubEnv('DEV', false)
    const { getAiApiBaseUrl, getAiModelsUrl, usesAiProxy } = await import('./urls')

    expect(usesAiProxy()).toBe(false)
    expect(getAiApiBaseUrl('opencode', 'https://opencode.ai/zen/go/v1')).toBe('https://opencode.ai/zen/go/v1')
    expect(getAiModelsUrl('opencode', 'https://opencode.ai/zen/go/v1/models')).toBe('https://opencode.ai/zen/go/v1/models')
  })

  it('marks OpenCode as blocked only in no-proxy production', async () => {
    vi.stubEnv('DEV', false)
    const { isAiProviderBlockedInStaticBrowser } = await import('./urls')

    expect(isAiProviderBlockedInStaticBrowser('opencode')).toBe(true)
    expect(isAiProviderBlockedInStaticBrowser('openrouter')).toBe(false)
    expect(isAiProviderBlockedInStaticBrowser('openai')).toBe(false)
    expect(isAiProviderBlockedInStaticBrowser('anthropic')).toBe(false)
    expect(isAiProviderBlockedInStaticBrowser('google')).toBe(false)
  })

  it('uses VITE_AI_PROXY_BASE_URL in production when configured', async () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_AI_PROXY_BASE_URL', 'https://pixeldeck-proxy.example.com/')
    const { getAiApiBaseUrl, getAiModelsUrl, isAiProviderBlockedInStaticBrowser, usesAiProxy } = await import('./urls')

    expect(usesAiProxy()).toBe(true)
    expect(isAiProviderBlockedInStaticBrowser('opencode')).toBe(false)
    expect(getAiApiBaseUrl('opencode', 'https://opencode.ai/zen/go/v1')).toBe('https://pixeldeck-proxy.example.com/opencode')
    expect(getAiModelsUrl('opencode', 'https://opencode.ai/zen/go/v1/models')).toBe('https://pixeldeck-proxy.example.com/opencode/models')
  })
})
