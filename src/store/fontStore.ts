import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { idbStorage } from './idb-storage'

export interface FontAssetEntry {
  filename: string      // original filename e.g. "MyBrand.ttf"
  dataUrl: string       // base64 data URL
  sizeBytes: number
  format: 'ttf' | 'otf' | 'woff2' | 'woff'
}

interface FontStoreState {
  fonts: Record<string, FontAssetEntry>   // keyed by filename
  addFont: (filename: string, dataUrl: string) => void
  getFont: (filename: string) => string | undefined
  removeFont: (filename: string) => void
  clearFonts: () => void
  listFonts: () => FontAssetEntry[]
}

export const useFontStore = create<FontStoreState>()(
  persist(
    (set, get) => ({
      fonts: {},
      addFont: (filename, dataUrl) => {
        const ext = filename.split('.').pop()?.toLowerCase() ?? 'ttf'
        const format = (['ttf','otf','woff2','woff'].includes(ext) ? ext : 'ttf') as FontAssetEntry['format']
        set((s) => ({
          fonts: {
            ...s.fonts,
            [filename]: { filename, dataUrl, sizeBytes: Math.round(dataUrl.length * 0.75), format },
          },
        }))
      },
      getFont: (filename) => get().fonts[filename]?.dataUrl,
      removeFont: (filename) => {
        set((s) => {
          const next = { ...s.fonts }
          delete next[filename]
          return { fonts: next }
        })
      },
      clearFonts: () => set({ fonts: {} }),
      listFonts: () => Object.values(get().fonts),
    }),
    {
      name: 'pixeldeck-fonts',
      storage: createJSONStorage(() => idbStorage),
    }
  )
)
