import { sha256 } from '@noble/hashes/sha2.js'

/**
 * Content-addressed asset keys: `img_<24 hex of SHA-256 of decoded bytes>.<ext>`.
 * Pure (atob/Uint8Array only) so it works identically in the browser and Node.
 */

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
}

const EXT_TO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
}

const HASHED_KEY_RE = /^img_[0-9a-f]{24}\.[a-z0-9]+$/

export function isDataUrl(s: unknown): s is string {
  return typeof s === 'string' && s.startsWith('data:')
}

export function isHashedAssetKey(s: unknown): s is string {
  return typeof s === 'string' && HASHED_KEY_RE.test(s)
}

export function extForMime(mime: string): string {
  return MIME_TO_EXT[mime.toLowerCase()] ?? 'bin'
}

export function mimeForKey(key: string): string {
  const dot = key.lastIndexOf('.')
  const ext = dot >= 0 ? key.slice(dot + 1).toLowerCase() : ''
  return EXT_TO_MIME[ext] ?? 'application/octet-stream'
}

export function parseDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } {
  const comma = dataUrl.indexOf(',')
  if (!dataUrl.startsWith('data:') || comma < 0) throw new Error('Invalid data URL')
  const meta = dataUrl.slice(5, comma)
  const payload = dataUrl.slice(comma + 1)
  const parts = meta.split(';')
  const mime = (parts[0] || 'text/plain').toLowerCase()
  const isBase64 = parts.slice(1).some((p) => p.toLowerCase() === 'base64')
  if (isBase64) {
    try {
      const bin = atob(payload.replace(/\s+/g, ''))
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      return { mime, bytes }
    } catch {
      // Malformed base64 (e.g. hand-written fixtures): hash the payload text
      // so the key is still deterministic instead of throwing mid-migration.
      return { mime, bytes: new TextEncoder().encode(payload) }
    }
  }
  let text = payload
  try { text = decodeURIComponent(payload) } catch { /* keep raw payload */ }
  return { mime, bytes: new TextEncoder().encode(text) }
}

function toHex(bytes: Uint8Array): string {
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

export function assetKeyFromBytes(bytes: Uint8Array, mime: string): string {
  return `img_${toHex(sha256(bytes)).slice(0, 24)}.${extForMime(mime)}`
}

export function assetKeyFromDataUrl(dataUrl: string): string {
  const { mime, bytes } = parseDataUrl(dataUrl)
  return assetKeyFromBytes(bytes, mime)
}
