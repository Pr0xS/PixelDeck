import { afterEach, describe, expect, it, vi } from 'vitest'

describe('AI model listing', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('blocks OpenCode model loading in no-proxy production before fetch', async () => {
    vi.stubEnv('DEV', false)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { listModels } = await import('./models')

    await expect(listModels('opencode', 'sk-test')).rejects.toThrow(/does not allow direct browser requests from GitHub Pages/i)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('surfaces OpenCode network errors instead of using hardcoded fallbacks', async () => {
    vi.stubEnv('DEV', true)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const { listModels } = await import('./models')

    await expect(listModels('opencode', 'sk-test')).rejects.toThrow(/Could not load models for opencode/i)
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
