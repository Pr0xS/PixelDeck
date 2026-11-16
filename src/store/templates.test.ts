import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchTemplateBundle, type TemplateManifestEntry } from './templates'

const KEY_OK = 'img_aaaaaaaaaaaaaaaaaaaaaaaa.webp'
const KEY_BAD = 'img_bbbbbbbbbbbbbbbbbbbbbbbb.webp'

const entry: TemplateManifestEntry = {
  slug: 't', name: 'T', description: '', file: '/templates/t.template.json',
}

const template = {
  id: 't', kind: 'template', schemaVersion: 1, name: 'T', description: '', slideGroups: [],
  assetManifest: {
    [KEY_OK]: { name: 'ok.webp', mime: 'image/webp' },
    [KEY_BAD]: { name: 'bad.webp', mime: 'image/webp' },
  },
}

function mockFetch() {
  return vi.fn(async (url: string) => {
    if (url.endsWith('t.template.json')) return { ok: true, status: 200, json: async () => template }
    if (url.endsWith(KEY_OK)) return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }
    return { ok: false, status: 404 }
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('fetchTemplateBundle', () => {
  it('returns the template and every image as a data URL', async () => {
    const f = mockFetch()
    vi.stubGlobal('fetch', f)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { template: tpl, assets } = await fetchTemplateBundle(entry)
    expect(tpl.name).toBe('T')
    const ok = assets.find((a) => a.key === KEY_OK)!
    expect(ok.name).toBe('ok.webp')
    expect(ok.mime).toBe('image/webp')
    expect(ok.dataUrl).toBe('data:image/webp;base64,AQID')
    expect(f).toHaveBeenCalledWith('/templates/assets/' + KEY_OK, expect.anything())
  })

  it('skips an image that 404s without failing the bundle', async () => {
    vi.stubGlobal('fetch', mockFetch())
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { assets } = await fetchTemplateBundle(entry)
    expect(assets.map((a) => a.key)).toEqual([KEY_OK])
    expect(warn).toHaveBeenCalled()
  })

  it('fails when the template JSON itself is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })))
    await expect(fetchTemplateBundle(entry)).rejects.toThrow('HTTP 500')
  })
})
