import { create } from 'zustand'
import { fileToDataUrl } from '@/utils/files'
import { idbStorage } from './idb-storage'

const LEGACY_KEY = 'pixeldeck-assets'
const assetsKey = (id: string) => `pixeldeck-assets:${id}`
const FLUSH_MS = 300

export interface AssetEntry {
  filename: string
  dataUrl: string
  sizeBytes: number
}

interface AssetStoreState {
  activeProjectId: string | null
  assets: Record<string, AssetEntry>
  addAsset: (filename: string, dataUrl: string) => void
  getAsset: (filename: string) => string | undefined
  removeAsset: (filename: string) => void
  clearAssets: () => void
  /** Load all image files from a directory via File System Access API */
  loadFolder: () => Promise<number>
  /** Load individual File objects (from file input) */
  loadFiles: (files: File[]) => Promise<void>
  /** List all loaded assets */
  listAssets: () => AssetEntry[]
  setActiveProject: (id: string | null) => Promise<void>
  clearProject: (id: string) => Promise<void>
  hydrateProject: (id: string, assets: Record<string, string>) => Promise<void>
  loadProjectAssets: (id: string) => Promise<Record<string, AssetEntry>>
}

let _flushTimer: ReturnType<typeof setTimeout> | null = null
let _pendingId: string | null = null

function serialize(assets: Record<string, AssetEntry>): string {
  return JSON.stringify(assets)
}

function deserialize(raw: string): Record<string, AssetEntry> {
  const parsed: unknown = JSON.parse(raw)
  if (typeof parsed !== 'object' || parsed === null) return {}

  // Zustand's former persist middleware wrapped the legacy map in
  // { state: { assets }, version }. Scoped entries use the bare map.
  const legacyState = (parsed as { state?: unknown }).state
  if (typeof legacyState === 'object' && legacyState !== null) {
    const legacyAssets = (legacyState as { assets?: unknown }).assets
    if (typeof legacyAssets === 'object' && legacyAssets !== null) {
      return legacyAssets as Record<string, AssetEntry>
    }
  }
  return parsed as Record<string, AssetEntry>
}

async function writeThrough(id: string, assets: Record<string, AssetEntry>): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  await idbStorage.setItem(assetsKey(id), serialize(assets))
}

async function flushNow(getAssets: () => Record<string, AssetEntry>): Promise<void> {
  if (_flushTimer) {
    clearTimeout(_flushTimer)
    _flushTimer = null
  }
  const id = _pendingId
  _pendingId = null
  if (id == null) return
  await writeThrough(id, getAssets())
}

function scheduleFlush(id: string | null, getAssets: () => Record<string, AssetEntry>): void {
  if (id == null) return
  _pendingId = id
  if (_flushTimer) clearTimeout(_flushTimer)
  _flushTimer = setTimeout(() => {
    const target = _pendingId
    _flushTimer = null
    _pendingId = null
    if (target != null) void writeThrough(target, getAssets())
  }, FLUSH_MS)
}

export const useAssetStore = create<AssetStoreState>((set, get) => ({
  activeProjectId: null,
  assets: {},

  addAsset: (filename, dataUrl) => {
    set((s) => ({
      assets: {
        ...s.assets,
        [filename]: { filename, dataUrl, sizeBytes: dataUrl.length * 0.75 },
      },
    }))
    scheduleFlush(get().activeProjectId, () => get().assets)
  },

  getAsset: (filename) => (filename ? get().assets[filename]?.dataUrl : undefined),

  removeAsset: (filename) => {
    set((s) => {
      const next = { ...s.assets }
      delete next[filename]
      return { assets: next }
    })
    scheduleFlush(get().activeProjectId, () => get().assets)
  },

  clearAssets: () => {
    set({ assets: {} })
    scheduleFlush(get().activeProjectId, () => get().assets)
  },

  loadFolder: async () => {
    if (!('showDirectoryPicker' in window)) {
      throw new Error('File System Access API not supported in this browser')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dirHandle = await (window as any).showDirectoryPicker({ mode: 'read' })
    let count = 0
    const { addAsset } = get()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async function traverseDir(handle: any, prefix: string): Promise<void> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for await (const [name, entry] of handle.entries() as AsyncIterable<[string, any]>) {
        if (entry.kind === 'directory') {
          const subPrefix = prefix ? `${prefix}/${name}` : name
          await traverseDir(entry, subPrefix)
        } else if (entry.kind === 'file') {
          if (!/\.(png|jpg|jpeg|webp)$/i.test(name)) continue
          const file = await entry.getFile() as File
          const dataUrl = await fileToDataUrl(file)
          const assetKey = prefix ? `${prefix}/${name}` : name
          addAsset(assetKey, dataUrl)
          count++
        }
      }
    }

    await traverseDir(dirHandle, '')
    return count
  },

  loadFiles: async (files) => {
    const { addAsset } = get()
    for (const file of files) {
      if (!/\.(png|jpg|jpeg|webp)$/i.test(file.name)) continue
      const dataUrl = await fileToDataUrl(file)
      const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath
      const assetKey = relativePath
        ? relativePath.split('/').slice(1).join('/') || file.name
        : file.name
      addAsset(assetKey, dataUrl)
    }
  },

  listAssets: () => Object.values(get().assets),

  setActiveProject: async (id) => {
    if (get().activeProjectId === id) return
    await flushNow(() => get().assets)
    if (id == null) {
      set({ activeProjectId: null, assets: {} })
      return
    }

    let raw = typeof indexedDB !== 'undefined'
      ? await idbStorage.getItem(assetsKey(id))
      : null
    if (raw == null && typeof indexedDB !== 'undefined') {
      const legacy = await idbStorage.getItem(LEGACY_KEY)
      if (legacy != null) {
        const migrated = deserialize(legacy)
        raw = serialize(migrated)
        await idbStorage.setItem(assetsKey(id), raw)
        await idbStorage.removeItem(LEGACY_KEY)
      }
    }
    const assets = raw ? deserialize(raw) : {}
    set({ activeProjectId: id, assets })
  },

  clearProject: async (id) => {
    if (_pendingId === id) {
      if (_flushTimer) clearTimeout(_flushTimer)
      _flushTimer = null
      _pendingId = null
    }
    if (typeof indexedDB !== 'undefined') await idbStorage.removeItem(assetsKey(id))
    if (get().activeProjectId === id) set({ assets: {} })
  },

  hydrateProject: async (id, incoming) => {
    await get().setActiveProject(id)
    set((s) => {
      const next = { ...s.assets }
      for (const [key, dataUrl] of Object.entries(incoming)) {
        next[key] = { filename: key, dataUrl, sizeBytes: dataUrl.length * 0.75 }
      }
      return { assets: next }
    })
    scheduleFlush(id, () => get().assets)
    await flushNow(() => get().assets)
  },

  loadProjectAssets: async (id) => {
    if (typeof indexedDB === 'undefined') return {}
    const raw = await idbStorage.getItem(assetsKey(id))
    return raw ? deserialize(raw) : {}
  },
}))
