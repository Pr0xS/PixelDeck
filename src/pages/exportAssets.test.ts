import { describe, expect, it } from 'vitest'
import { useAssetStore } from '@/store/assets'
import { injectExportAssets } from './exportAssets'

describe('injectExportAssets', () => {
  it('preserves keys and leaves the store hydrated', async () => {
    useAssetStore.getState().setAssetsHydrated(false)
    const url = 'data:image/png;base64,cG5n'
    await injectExportAssets('export-proj', { 'img_abc.png': url })
    const s = useAssetStore.getState()
    expect(s.hydrated).toBe(true)
    expect(s.resolveAsset('img_abc.png')).toBe(url)
    expect(s.activeProjectId).toBe('export-proj')
  })

  it('is hydrated even when the project scope is already active', async () => {
    await injectExportAssets('export-proj', {})
    useAssetStore.getState().setAssetsHydrated(false)
    await injectExportAssets('export-proj', { 'k.png': 'data:image/png;base64,cG5n' })
    expect(useAssetStore.getState().hydrated).toBe(true)
  })
})
