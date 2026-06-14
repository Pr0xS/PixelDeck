import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { fileToDataUrl } from '@/utils/files'
import { idbStorage } from './idb-storage'

export interface AssetEntry {
  filename: string
  dataUrl: string
  sizeBytes: number
}

interface AssetStoreState {
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
}

export const useAssetStore = create<AssetStoreState>()(
  persist(
  (set, get) => ({
  assets: {},

  addAsset: (filename, dataUrl) => {
    set((s) => ({
      assets: {
        ...s.assets,
        [filename]: { filename, dataUrl, sizeBytes: dataUrl.length * 0.75 },
      },
    }))
  },

  getAsset: (filename) => {
    if (!filename) return undefined
    return get().assets[filename]?.dataUrl
  },

  removeAsset: (filename) => {
    set((s) => {
      const next = { ...s.assets }
      delete next[filename]
      return { assets: next }
    })
  },

  clearAssets: () => set({ assets: {} }),

  loadFolder: async () => {
    if (!('showDirectoryPicker' in window)) {
      throw new Error('File System Access API not supported in this browser')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dirHandle = await (window as any).showDirectoryPicker({ mode: 'read' })
    let count = 0
    const { addAsset } = get()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const [name, handle] of (dirHandle as any).entries()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((handle as any).kind !== 'file') continue
      if (!/\.(png|jpg|jpeg|webp)$/i.test(name)) continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const file = await (handle as any).getFile() as File
      const dataUrl = await fileToDataUrl(file)
      addAsset(name, dataUrl)
      count++
    }
    return count
  },

  loadFiles: async (files) => {
    const { addAsset } = get()
    for (const file of files) {
      const dataUrl = await fileToDataUrl(file)
      addAsset(file.name, dataUrl)
    }
  },

  listAssets: () => Object.values(get().assets),
  }),
  {
    name: 'pixeldeck-assets',
    storage: createJSONStorage(() => idbStorage),
  }
))
