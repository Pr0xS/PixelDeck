import { useAssetStore } from '@/store/assets'
import type { AssetRef } from '@/types'

export const MAX_URL_IMAGE_BYTES = 25 * 1024 * 1024
export const URL_FETCH_BLOCKED_MESSAGE =
  "This site doesn't allow downloading the image. Save it and upload it instead."

export type AssetFromUrlErrorCode = 'invalid-url' | 'blocked' | 'not-image' | 'too-large'

export class AssetFromUrlError extends Error {
  code: AssetFromUrlErrorCode
  constructor(code: AssetFromUrlErrorCode, message: string) {
    super(message)
    this.name = 'AssetFromUrlError'
    this.code = code
  }
}

function basename(url: URL): string {
  const last = url.pathname.split('/').filter(Boolean).pop()
  try {
    return last ? decodeURIComponent(last) : url.hostname
  } catch {
    return last ?? url.hostname
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image'))
    reader.readAsDataURL(blob)
  })
}

/** Download a remote image (CORS required) into the asset store; returns its key. Never stores the URL. */
export async function fetchImageAsAsset(rawUrl: string): Promise<AssetRef> {
  let url: URL
  try {
    url = new URL(rawUrl.trim())
  } catch {
    throw new AssetFromUrlError('invalid-url', 'Enter a valid http(s) image URL.')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AssetFromUrlError('invalid-url', 'Only http(s) URLs are supported.')
  }

  let blob: Blob
  try {
    const res = await fetch(url.toString(), { mode: 'cors' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    blob = await res.blob()
  } catch {
    throw new AssetFromUrlError('blocked', URL_FETCH_BLOCKED_MESSAGE)
  }

  if (!blob.type.toLowerCase().startsWith('image/')) {
    throw new AssetFromUrlError('not-image', 'That URL is not an image.')
  }
  if (blob.size >= MAX_URL_IMAGE_BYTES) {
    throw new AssetFromUrlError('too-large', 'Image is too large (limit 25 MB).')
  }

  const dataUrl = await blobToDataUrl(blob)
  return useAssetStore.getState().putAsset(dataUrl, basename(url))
}
