import { afterEach, describe, expect, it, vi } from 'vitest'

describe('AI model listing', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('uses known OpenCode models directly in no-proxy production', async () => {
    vi.stubEnv('DEV', false)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { listModels } = await import('./models')

    const models = await listModels('opencode', 'sk-test')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(models.map((model) => model.id)).toContain('kimi-k2.6')
    expect(models.map((model) => model.id)).toContain('deepseek-v4-pro')
  })

  it('falls back to known OpenCode models when the browser request is blocked', async () => {
    vi.stubEnv('DEV', true)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const { listModels } = await import('./models')

    const models = await listModels('opencode', 'sk-test')

    expect(models.map((model) => model.id)).toContain('kimi-k2.6')
    expect(models.map((model) => model.id)).toContain('deepseek-v4-pro')
  })

  it('still surfaces non-network provider errors instead of falling back', async () => {
    vi.stubEnv('DEV', false)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: () => Promise.resolve('Invalid API key'),
    }))
    const { listModels } = await import('./models')

    await expect(listModels('openai', 'sk-test')).rejects.toThrow('Invalid API key')
  })
})
