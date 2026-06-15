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
      // Preserve folder structure from webkitRelativePath (e.g. "en/screenshot.png")
      // Strip the top-level folder name (the selected folder itself) to get relative path
      const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath
      const assetKey = relativePath
        ? relativePath.split('/').slice(1).join('/') || file.name
        : file.name
      addAsset(assetKey, dataUrl)
    }
  },

  listAssets: () => Object.values(get().assets),
  }),
  {
    name: 'pixeldeck-assets',
    storage: createJSONStorage(() => idbStorage),
  }
))
