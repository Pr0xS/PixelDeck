import { create } from 'zustand'
import { fileToDataUrl } from '@/utils/files'
import { idbStorage } from './idb-storage'
import { assetKeyFromDataUrl, isDataUrl, mimeForKey } from '@/utils/assetKey'
import type { AssetRef } from '@/types'

const LEGACY_KEY = 'pixeldeck-assets'
const assetsKey = (id: string) => `pixeldeck-assets:${id}`
const FLUSH_MS = 300

export interface AssetEntry {
  /** Map key: content-hash key (`img_<hash>.<ext>`) or a legacy filename. */
  key: string
  /** Human display name (original filename). */
  name: string
  mime: string
  dataUrl: string
  sizeBytes: number
  /** @deprecated Alias of `key`, kept so existing UI keeps working. */
  filename: string
}

function mimeOfDataUrl(dataUrl: string, fallbackKey: string): string {
  const m = /^data:([^;,]+)/i.exec(dataUrl)
  return m ? m[1].toLowerCase() : mimeForKey(fallbackKey)
}

function makeEntry(key: string, name: string, dataUrl: string): AssetEntry {
  return {
    key,
    name,
    mime: mimeOfDataUrl(dataUrl, key),
    dataUrl,
    sizeBytes: Math.round(dataUrl.length * 0.75),
    filename: key,
  }
}

/** Upgrade entries persisted before the key/name/mime fields existed. */
function normalizeEntries(raw: Record<string, Partial<AssetEntry>>): Record<string, AssetEntry> {
  const out: Record<string, AssetEntry> = {}
  for (const [mapKey, e] of Object.entries(raw)) {
    if (!e || typeof e.dataUrl !== 'string') continue
    const name = e.name ?? e.filename ?? mapKey
    out[mapKey] = {
      key: e.key ?? mapKey,
      name,
      mime: e.mime ?? mimeOfDataUrl(e.dataUrl, mapKey),
      dataUrl: e.dataUrl,
      sizeBytes: e.sizeBytes ?? Math.round(e.dataUrl.length * 0.75),
      filename: e.key ?? mapKey,
    }
  }
  return out
}

interface AssetStoreState {
  activeProjectId: string | null
  assets: Record<string, AssetEntry>
  /** False until the active project's assets finished loading from IndexedDB. */
  hydrated: boolean
  setAssetsHydrated: (hydrated: boolean) => void
  /** Hash the data URL's bytes, store under `img_<hash>.<ext>` (deduped), return the key. */
  putAsset: (dataUrl: string, name: string) => AssetRef
  /** Resolve a ref to a data URL. `data:` strings pass through; legacy filename keys resolve as map lookups. */
  resolveAsset: (ref: string) => string | undefined
  /** Bulk-store assets under their given keys (no re-hashing; dedupes existing keys). */
  putAssetEntries: (entries: Array<{ key: string; name: string; dataUrl: string }>) => void
  /** Await any pending debounced write to IndexedDB. */
  flushAssets: () => Promise<void>
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
  /** `names` optionally preserves display names (e.g. from assetManifest). */
  hydrateProject: (id: string, assets: Record<string, string>, names?: Record<string, string>) => Promise<void>
  loadProjectAssets: (id: string) => Promise<Record<string, AssetEntry>>
}

let _flushTimer: ReturnType<typeof setTimeout> | null = null
let _pendingId: string | null = null
// Serialized IndexedDB write queue + in-flight counter (item: writes were untracked).
let _chain: Promise<void> = Promise.resolve()
let _inflight = 0
// Bumped on every setActiveProject call; a switch that is no longer the latest aborts.
let _switchGen = 0
// Keys known to be durable in IndexedDB for the active scope (see areAssetsDurable).
let _durable: { id: string | null; keys: Set<string> } = { id: null, keys: new Set() }
let _getState: () => AssetStoreState = () => { throw new Error('asset store not initialised') }

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
      return normalizeEntries(legacyAssets as Record<string, Partial<AssetEntry>>)
    }
  }
  return normalizeEntries(parsed as Record<string, Partial<AssetEntry>>)
}

async function writeThrough(id: string, assets: Record<string, AssetEntry>): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  await idbStorage.setItem(assetsKey(id), serialize(assets))
}

/**
 * Queue a write of scope `id`. The map is snapshotted when the write RUNS and
 * only if `id` is still the active scope: the in-memory map belongs to exactly
 * one scope, so it must never be written under another scope's key.
 */
function enqueueWrite(id: string): Promise<void> {
  _inflight += 1
  const task = _chain
    .then(async () => {
      const st = _getState()
      if (st.activeProjectId !== id) return
      const snapshot = st.assets
      await writeThrough(id, snapshot)
      _durable = { id, keys: new Set(Object.keys(snapshot)) }
    })
    .finally(() => { _inflight -= 1 })
  _chain = task.catch(() => {})
  return task
}

/** Write everything pending and wait for all in-flight writes. */
async function flushNow(): Promise<void> {
  for (;;) {
    if (_flushTimer) {
      clearTimeout(_flushTimer)
      _flushTimer = null
    }
    const id = _pendingId
    _pendingId = null
    if (id != null) void enqueueWrite(id).catch(() => {})
    if (_inflight === 0) return
    await _chain
    if (_pendingId == null && _flushTimer === null && _inflight === 0) return
  }
}

function scheduleFlush(id: string | null): void {
  if (id == null) return
  if (_pendingId != null && _pendingId !== id) {
    // Defensive: never let a pending write for another scope be re-targeted.
    void enqueueWrite(_pendingId).catch(() => {})
  }
  _pendingId = id
  if (_flushTimer) clearTimeout(_flushTimer)
  _flushTimer = setTimeout(() => {
    const target = _pendingId
    _flushTimer = null
    _pendingId = null
    if (target != null) void enqueueWrite(target).catch(() => {})
  }, FLUSH_MS)
}

/** True while a debounced write is waiting to run OR a write is in flight. */
export const hasPendingAssetWrites = (): boolean => _flushTimer !== null || _inflight > 0

/**
 * True when every key (that exists in memory) is already persisted in IndexedDB
 * for the active scope — used to decide whether a project snapshot that
 * references them is safe to save synchronously (pagehide).
 */
export function areAssetsDurable(keys: Iterable<string>): boolean {
  const st = _getState()
  if (_durable.id !== st.activeProjectId) return false
  for (const key of keys) {
    if (st.assets[key] && !_durable.keys.has(key)) return false
  }
  return true
}

export const useAssetStore = create<AssetStoreState>((set, get) => {
  _getState = get
  return {
  activeProjectId: null,
  assets: {},
  hydrated: false,

  setAssetsHydrated: (hydrated) => set({ hydrated }),

  putAsset: (dataUrl, name) => {
    const key = assetKeyFromDataUrl(dataUrl)
    if (!get().assets[key]) {
      set((s) => ({ assets: { ...s.assets, [key]: makeEntry(key, name, dataUrl) } }))
      scheduleFlush(get().activeProjectId)
    }
    return key
  },

  resolveAsset: (ref) => {
    if (!ref) return undefined
    if (isDataUrl(ref)) return ref
    return get().assets[ref]?.dataUrl
  },

  putAssetEntries: (entries) => {
    if (entries.length === 0) return
    set((s) => {
      const next = { ...s.assets }
      for (const e of entries) {
        if (!next[e.key]) next[e.key] = makeEntry(e.key, e.name, e.dataUrl)
      }
      return { assets: next }
    })
    scheduleFlush(get().activeProjectId)
  },

  flushAssets: () => flushNow(),

  addAsset: (filename, dataUrl) => {
    set((s) => ({
      assets: {
        ...s.assets,
        [filename]: makeEntry(filename, filename, dataUrl),
      },
    }))
    scheduleFlush(get().activeProjectId)
  },

  getAsset: (filename) => (filename ? get().assets[filename]?.dataUrl : undefined),

  removeAsset: (filename) => {
    set((s) => {
      const next = { ...s.assets }
      delete next[filename]
      return { assets: next }
    })
    scheduleFlush(get().activeProjectId)
  },

  clearAssets: () => {
    set({ assets: {} })
    scheduleFlush(get().activeProjectId)
  },

  loadFolder: async () => {
    if (!('showDirectoryPicker' in window)) {
      throw new Error('File System Access API not supported in this browser')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dirHandle = await (window as any).showDirectoryPicker({ mode: 'read' })
    let count = 0

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
          get().putAsset(dataUrl, assetKey)
          count++
        }
      }
    }

    await traverseDir(dirHandle, '')
    return count
  },

  loadFiles: async (files) => {
    for (const file of files) {
      if (!/\.(png|jpg|jpeg|webp)$/i.test(file.name)) continue
      const dataUrl = await fileToDataUrl(file)
      const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath
      const assetKey = relativePath
        ? relativePath.split('/').slice(1).join('/') || file.name
        : file.name
      get().putAsset(dataUrl, assetKey)
    }
  },

  listAssets: () => Object.values(get().assets),

  /**
   * Switch the active asset scope.
   *
   * Invariant: `assets` always belongs to `activeProjectId`; it is only ever
   * written to IndexedDB under that id (see enqueueWrite).
   *
   * Puts that arrive WHILE a switch is in flight (during the IDB read) land in
   * the OLD scope's map — `activeProjectId` flips only in the final synchronous
   * `set`. They are flushed under the old id before the flip, so they belong
   * to (and are saved with) the old project. Callers that want assets in the
   * new project must `await setActiveProject(id)` first.
   *
   * A newer setActiveProject call supersedes an older in-flight one: the older
   * call returns without activating its scope.
   */
  setActiveProject: async (id) => {
    const gen = ++_switchGen
    if (get().activeProjectId === id) {
      // Also cancels an in-flight switch to another scope (gen bump above).
      if (!get().hydrated) set({ hydrated: true })
      return
    }
    await flushNow()
    if (gen !== _switchGen) return

    let assets: Record<string, AssetEntry> = {}
    if (id != null) {
      set({ hydrated: false })
      try {
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
        assets = raw ? deserialize(raw) : {}
      } catch (err) {
        console.warn('[PixelDeck] Failed to read project assets', err)
        assets = {}
      }
    }
    if (gen !== _switchGen) return

    // Anything put into the old scope during the read must hit disk (under the
    // old id) before the map is replaced. No await between the final check and set().
    while (hasPendingAssetWrites()) {
      await flushNow()
      if (gen !== _switchGen) return
    }
    _durable = { id, keys: new Set(Object.keys(assets)) }
    set({ activeProjectId: id, assets, hydrated: true })
  },

  clearProject: async (id) => {
    if (_pendingId === id) {
      if (_flushTimer) clearTimeout(_flushTimer)
      _flushTimer = null
      _pendingId = null
    }
    await _chain
    if (typeof indexedDB !== 'undefined') await idbStorage.removeItem(assetsKey(id))
    if (get().activeProjectId === id) set({ assets: {} })
  },

  hydrateProject: async (id, incoming, names) => {
    await get().setActiveProject(id)
    set((s) => {
      const next = { ...s.assets }
      for (const [key, dataUrl] of Object.entries(incoming)) {
        next[key] = makeEntry(key, names?.[key] ?? key, dataUrl)
      }
      return { assets: next }
    })
    scheduleFlush(id)
    await flushNow()
  },

  loadProjectAssets: async (id) => {
    if (typeof indexedDB === 'undefined') return {}
    const raw = await idbStorage.getItem(assetsKey(id))
    return raw ? deserialize(raw) : {}
  },
}
})
