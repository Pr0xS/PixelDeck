import { useAssetStore } from '@/store/assets'
import { fileToDataUrl } from '@/utils/files'
import type { AssetRef } from '@/types'

export interface IngestedImage {
  key: AssetRef
  name: string
  width?: number
  height?: number
}

/** Measure natural image dimensions from a data URL (browser only). */
export function getImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.width, height: img.height })
    img.onerror = () => reject(new Error('Could not load image'))
    img.src = dataUrl
  })
}

/**
 * The single entry point for every image upload/drop/paste: read the file,
 * store it content-addressed, and return the asset key. Callers must store ONLY
 * the returned key in the project (never data URLs or filenames).
 * Pass `{ measure: true }` to also read natural width/height.
 */
export async function ingestImageFile(
  file: File,
  opts: { measure?: boolean } = {},
): Promise<IngestedImage> {
  const dataUrl = await fileToDataUrl(file)
  const key = useAssetStore.getState().putAsset(dataUrl, file.name)
  if (!opts.measure) return { key, name: file.name }
  try {
    const { width, height } = await getImageSize(dataUrl)
    return { key, name: file.name, width, height }
  } catch {
    return { key, name: file.name }
  }
}
