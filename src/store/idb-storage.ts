/**
 * Minimal IndexedDB key-value storage adapter compatible with Zustand's persist middleware.
 * Uses a single DB / object store shared across all persist keys.
 * Falls back silently to a no-op if IndexedDB is unavailable (e.g., SSR, private mode).
 */

const DB_NAME = 'pixeldeck'
const STORE_NAME = 'kv'

// Singleton DB promise — opened once, reused for every read/write.
let _db: Promise<IDBDatabase> | null = null

function getDB(): Promise<IDBDatabase> {
  if (_db) return _db
  _db = new Promise((resolve, reject) => {
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
      console.warn('[idbStorage] setItem failed:', e)
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
