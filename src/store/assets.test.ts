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
    const legacy: Record<string, Partial<AssetEntry>> = {
      'shot.png': { filename: 'shot.png', dataUrl: dataUrl('legacy'), sizeBytes: 10 },
    }
    const normalized = {
      'shot.png': {
        key: 'shot.png', name: 'shot.png', mime: 'image/png', filename: 'shot.png',
        dataUrl: dataUrl('legacy'), sizeBytes: 10,
      },
    }
    await idbStorage.setItem('pixeldeck-assets', JSON.stringify(legacy))

    await useAssetStore.getState().setActiveProject(id)

    expect(useAssetStore.getState().assets).toEqual(normalized)
    expect(await idbStorage.getItem('pixeldeck-assets')).toBeNull()
    expect(JSON.parse((await idbStorage.getItem(`pixeldeck-assets:${id}`))!)).toEqual(normalized)
  })

  it('unwraps the legacy Zustand persist envelope during migration', async () => {
    const id = projectId('legacy-envelope')
    const legacy: Record<string, Partial<AssetEntry>> = {
      'shot.png': { filename: 'shot.png', dataUrl: dataUrl('legacy'), sizeBytes: 10 },
    }
    const normalized = {
      'shot.png': {
        key: 'shot.png', name: 'shot.png', mime: 'image/png', filename: 'shot.png',
        dataUrl: dataUrl('legacy'), sizeBytes: 10,
      },
    }
    await idbStorage.setItem(
      'pixeldeck-assets',
      JSON.stringify({ state: { assets: legacy }, version: 0 }),
    )

    await useAssetStore.getState().setActiveProject(id)

    expect(useAssetStore.getState().assets).toEqual(normalized)
    expect(JSON.parse((await idbStorage.getItem(`pixeldeck-assets:${id}`))!)).toEqual(normalized)
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

describe('content-addressed assets', () => {
  const PNG = 'data:image/png;base64,cG5n'

  it('putAsset hashes bytes, dedupes, and keeps the first display name', () => {
    const { putAsset, resolveAsset } = useAssetStore.getState()
    const a = putAsset(PNG, 'first.png')
    const b = putAsset(PNG, 'second.png')
    expect(a).toBe(b)
    expect(a).toMatch(/^img_[0-9a-f]{24}\.png$/)
    expect(Object.keys(useAssetStore.getState().assets)).toEqual([a])
    expect(useAssetStore.getState().assets[a].name).toBe('first.png')
    expect(useAssetStore.getState().assets[a].mime).toBe('image/png')
    expect(resolveAsset(a)).toBe(PNG)
  })

  it('resolveAsset resolves legacy filename keys and passes data URLs through', () => {
    useAssetStore.getState().addAsset('legacy.png', PNG)
    expect(useAssetStore.getState().resolveAsset('legacy.png')).toBe(PNG)
    expect(useAssetStore.getState().resolveAsset('missing.png')).toBeUndefined()
    expect(useAssetStore.getState().resolveAsset(PNG)).toBe(PNG)
  })

  it('exposes a hydrated flag that flips after project load', async () => {
    await useAssetStore.getState().setActiveProject(projectId('hydr'))
    expect(useAssetStore.getState().hydrated).toBe(true)
    useAssetStore.getState().setAssetsHydrated(false)
    expect(useAssetStore.getState().hydrated).toBe(false)
  })
})

describe('scope switching safety', () => {
  const PNG = 'data:image/png;base64,cG5n'
  const JPG = 'data:image/jpeg;base64,anBlZw=='
  const WEBP = 'data:image/webp;base64,d2VicA=='

  it('a put during an in-flight switch is saved under the OLD scope and never leaks into the new one', async () => {
    const a = projectId('A')
    const b = projectId('B')
    const s = () => useAssetStore.getState()
    await s().setActiveProject(a)
    const keyA = s().putAsset(PNG, 'a.png')
    await s().flushAssets()
    await s().setActiveProject(b)
    const keyB = s().putAsset(JPG, 'b.jpg')
    await s().flushAssets()

    const switching = s().setActiveProject(a)
    const keyMid = s().putAsset(WEBP, 'mid.webp') // lands in B (still active) and is flushed under B
    await switching
    await s().flushAssets()

    expect(s().activeProjectId).toBe(a)
    expect(Object.keys(s().assets)).toEqual([keyA])
    const storedA = await s().loadProjectAssets(a)
    const storedB = await s().loadProjectAssets(b)
    expect(Object.keys(storedA)).toEqual([keyA])
    expect(Object.keys(storedB).sort()).toEqual([keyB, keyMid].sort())
  })

  it('a pending debounced write never writes the new scope map under the old key', async () => {
    const a = projectId('A')
    const b = projectId('B')
    const s = () => useAssetStore.getState()
    await s().setActiveProject(a)
    s().putAsset(PNG, 'a.png') // debounced flush scheduled for A
    await s().setActiveProject(b)
    const keyB = s().putAsset(JPG, 'b.jpg')
    await s().flushAssets()
    await new Promise((r) => setTimeout(r, 400)) // let any stale timer fire
    const storedA = await s().loadProjectAssets(a)
    expect(Object.keys(storedA)).toHaveLength(1)
    expect(storedA[keyB]).toBeUndefined()
  })

  it('a quick double switch ends on the latest scope and corrupts nothing', async () => {
    const x = projectId('X')
    const a = projectId('A')
    const b = projectId('B')
    const s = () => useAssetStore.getState()
    await s().setActiveProject(x)
    const keyX = s().putAsset(PNG, 'x.png')
    await s().flushAssets()

    const p1 = s().setActiveProject(a)
    const p2 = s().setActiveProject(b)
    await Promise.all([p1, p2])
    expect(s().activeProjectId).toBe(b)
    expect(s().hydrated).toBe(true)
    expect(s().assets).toEqual({})
    expect(Object.keys(await s().loadProjectAssets(x))).toEqual([keyX])
    expect(await s().loadProjectAssets(a)).toEqual({})

    // Switching back to the active scope cancels an in-flight switch.
    const p3 = s().setActiveProject(x)
    const p4 = s().setActiveProject(b)
    await Promise.all([p3, p4])
    expect(s().activeProjectId).toBe(b)
    expect(s().hydrated).toBe(true)
  })

  it('hasPendingAssetWrites covers debounced and in-flight writes', async () => {
    const { hasPendingAssetWrites } = await import('./assets')
    await useAssetStore.getState().setActiveProject(projectId('P'))
    await useAssetStore.getState().flushAssets()
    expect(hasPendingAssetWrites()).toBe(false)
    useAssetStore.getState().putAsset(PNG, 'p.png')
    expect(hasPendingAssetWrites()).toBe(true)
    const flushing = useAssetStore.getState().flushAssets()
    expect(hasPendingAssetWrites()).toBe(true) // in flight
    await flushing
    expect(hasPendingAssetWrites()).toBe(false)
  })
})
