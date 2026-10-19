/**
 * Minimal IndexedDB key-value storage adapter compatible with Zustand's persist middleware.
 * Uses a single DB / object store shared across all persist keys.
 * Falls back silently to a no-op if IndexedDB is unavailable (e.g., SSR, private mode).
 */

const DB_NAME = 'pixeldeck'
const STORE_NAME = 'kv'

// Singleton DB promise — opened once, reused for every read/write.
let _db: Promise<IDBDatabase> | null = null
const warned = new Set<string>()
let persistRequested = false

/**
 * Ask the browser not to evict our storage under pressure. Once, guarded,
 * best-effort.
 */
export function requestPersistentStorage(): void {
  if (persistRequested) return
  persistRequested = true
  try {
    if (typeof navigator !== 'undefined') void navigator.storage?.persist?.()?.catch?.(() => {})
  } catch {
    // best-effort
  }
}

/**
 * Single, de-duplicated user-facing warning path for storage failures.
 * `kind` dedupes separately for the project JSON and for images.
 */
export function warnStorageFailure(kind: 'project' | 'assets', err: unknown): void {
  console.warn(`[PixelDeck] ${kind} save failed`, err)
  if (warned.has(kind) || typeof window === 'undefined') return
  warned.add(kind)
  const message = kind === 'project'
    ? 'Project library save failed. Export Project now to avoid losing recent changes.'
    : 'Your images could NOT be saved to browser storage, so they will be lost when you close this tab. Export your project now (Projects \u2192 Export) to keep them.'
  window.setTimeout(() => { alert(message) }, 0)
}

function getDB(): Promise<IDBDatabase> {
  if (_db) return _db
  _db = new Promise((resolve, reject) => {
    requestPersistentStorage()
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      _db = null   // allow retry on next call
      reject(req.error)
    }
  })
  return _db
}

export const idbStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const db = await getDB()
      return new Promise((resolve, reject) => {
        const req = db
          .transaction(STORE_NAME, 'readonly')
          .objectStore(STORE_NAME)
          .get(key)
        req.onsuccess = () => resolve((req.result as string | undefined) ?? null)
        req.onerror = () => reject(req.error)
      })
    } catch {
      return null
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      const db = await getDB()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        tx.objectStore(STORE_NAME).put(value, key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    } catch (e) {
      if (key.startsWith('pixeldeck-assets')) warnStorageFailure('assets', e)
      else console.warn('[idbStorage] setItem failed:', e)
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      const db = await getDB()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        tx.objectStore(STORE_NAME).delete(key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    } catch {
      // best-effort
    }
  },
}
