import { beforeEach, describe, expect, it } from 'vitest'
import { idbStorage } from './idb-storage'
import { useAssetStore, type AssetEntry } from './assets'

let sequence = 0
const projectId = (label: string) => `${label}-${++sequence}`
const dataUrl = (value: string) => `data:image/png;base64,${value}`

beforeEach(async () => {
  await useAssetStore.getState().setActiveProject(null)
  useAssetStore.setState({ activeProjectId: null, assets: {} })
  await idbStorage.removeItem('pixeldeck-assets')
})

describe('project-scoped asset store', () => {
  it('isolates project scopes and restores their assets', async () => {
    const a = projectId('A')
    const b = projectId('B')
    await useAssetStore.getState().setActiveProject(a)
    useAssetStore.getState().addAsset('shot.png', dataUrl('A'))

    await useAssetStore.getState().setActiveProject(b)
    expect(useAssetStore.getState().assets).toEqual({})

    await useAssetStore.getState().setActiveProject(a)
    expect(useAssetStore.getState().getAsset('shot.png')).toBe(dataUrl('A'))
  })

  it('keeps different data for the same filename in different projects', async () => {
    const a = projectId('A')
    const b = projectId('B')
    await useAssetStore.getState().setActiveProject(a)
    useAssetStore.getState().addAsset('shot.png', dataUrl('A'))
    await useAssetStore.getState().setActiveProject(b)
    useAssetStore.getState().addAsset('shot.png', dataUrl('B'))

    await useAssetStore.getState().setActiveProject(a)
    expect(useAssetStore.getState().getAsset('shot.png')).toBe(dataUrl('A'))
    await useAssetStore.getState().setActiveProject(b)
    expect(useAssetStore.getState().getAsset('shot.png')).toBe(dataUrl('B'))
  })

  it('migrates the legacy asset bundle into the first project scope', async () => {
    const id = projectId('legacy')
    const legacy: Record<string, AssetEntry> = {
      'shot.png': { filename: 'shot.png', dataUrl: dataUrl('legacy'), sizeBytes: 10 },
    }
    await idbStorage.setItem('pixeldeck-assets', JSON.stringify(legacy))

    await useAssetStore.getState().setActiveProject(id)

    expect(useAssetStore.getState().assets).toEqual(legacy)
    expect(await idbStorage.getItem('pixeldeck-assets')).toBeNull()
    expect(await idbStorage.getItem(`pixeldeck-assets:${id}`)).toBe(JSON.stringify(legacy))
  })

  it('unwraps the legacy Zustand persist envelope during migration', async () => {
    const id = projectId('legacy-envelope')
    const legacy: Record<string, AssetEntry> = {
      'shot.png': { filename: 'shot.png', dataUrl: dataUrl('legacy'), sizeBytes: 10 },
    }
    await idbStorage.setItem(
      'pixeldeck-assets',
      JSON.stringify({ state: { assets: legacy }, version: 0 }),
    )

    await useAssetStore.getState().setActiveProject(id)

    expect(useAssetStore.getState().assets).toEqual(legacy)
    expect(await idbStorage.getItem(`pixeldeck-assets:${id}`)).toBe(JSON.stringify(legacy))
  })

  it('clears only the requested project and clears memory when it is active', async () => {
    const a = projectId('A')
    const b = projectId('B')
    await useAssetStore.getState().hydrateProject(a, { 'shot.png': dataUrl('A') })
    await useAssetStore.getState().hydrateProject(b, { 'shot.png': dataUrl('B') })
    await useAssetStore.getState().setActiveProject(a)

    await useAssetStore.getState().clearProject(a)

    expect(useAssetStore.getState().assets).toEqual({})
    expect(await useAssetStore.getState().loadProjectAssets(a)).toEqual({})
    expect((await useAssetStore.getState().loadProjectAssets(b))['shot.png']?.dataUrl)
      .toBe(dataUrl('B'))
  })

  it('loads another project assets without changing the active scope', async () => {
    const a = projectId('A')
    const b = projectId('B')
    await useAssetStore.getState().hydrateProject(a, { 'a.png': dataUrl('A') })
    await useAssetStore.getState().hydrateProject(b, { 'b.png': dataUrl('B') })
    const activeAssets = useAssetStore.getState().assets

    const loaded = await useAssetStore.getState().loadProjectAssets(a)

    expect(loaded['a.png']?.dataUrl).toBe(dataUrl('A'))
    expect(useAssetStore.getState().activeProjectId).toBe(b)
    expect(useAssetStore.getState().assets).toBe(activeAssets)
  })

  it('keeps assets in memory only when there is no active project', async () => {
    const id = projectId('none')
    useAssetStore.getState().addAsset('shot.png', dataUrl('memory'))

    expect(useAssetStore.getState().getAsset('shot.png')).toBe(dataUrl('memory'))
    expect(await useAssetStore.getState().loadProjectAssets(id)).toEqual({})
    expect(await idbStorage.getItem(`pixeldeck-assets:${id}`)).toBeNull()
  })

  it('flushes a pending write under its original project during a scope switch', async () => {
    const a = projectId('A')
    const b = projectId('B')
    await useAssetStore.getState().setActiveProject(a)
    useAssetStore.getState().addAsset('shot.png', dataUrl('A'))

    await useAssetStore.getState().setActiveProject(b)

    expect((await useAssetStore.getState().loadProjectAssets(a))['shot.png']?.dataUrl)
      .toBe(dataUrl('A'))
    expect(await useAssetStore.getState().loadProjectAssets(b)).toEqual({})
  })
})
