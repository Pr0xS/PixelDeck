import { afterEach, describe, expect, it, vi } from 'vitest'
import { listModels } from './models'

describe('AI model listing', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('requires a custom API base URL', async () => {
    await expect(listModels('custom', 'sk-test')).rejects.toThrow(/no custom api base url/i)
  })

  it('loads custom models from the provided base URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ id: 'custom-model' }] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(listModels('custom', 'sk-test', 'https://my-proxy.example.com/v1')).resolves.toEqual([
      { id: 'custom-model', name: 'custom-model', description: undefined, contextLength: undefined },
    ])
    expect(fetchMock.mock.calls[0][0]).toBe('https://my-proxy.example.com/v1/models')
  })

  it('surfaces non-network provider errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: () => Promise.resolve('Invalid API key'),
    }))
    await expect(listModels('openai', 'sk-test')).rejects.toThrow('Invalid API key')
  })
})
