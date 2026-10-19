import { useState } from 'react'
import { AssetFromUrlError, URL_FETCH_BLOCKED_MESSAGE, fetchImageAsAsset } from '@/utils/assetFromUrl'

interface ImageUrlInputProps {
  /** Called with the stored asset key once the image has been downloaded. */
  onAdded: (key: string) => void
  fetchAsset?: (url: string) => Promise<string>
  className?: string
  /** Hide the field behind a small "From URL" disclosure. */
  collapsible?: boolean
}

/** "Add from URL": downloads the image into the asset store; the URL itself is never stored. */
export function ImageUrlInput({ onAdded, fetchAsset = fetchImageAsAsset, className = '', collapsible = false }: ImageUrlInputProps) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(!collapsible)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!url.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const key = await fetchAsset(url)
      setUrl('')
      onAdded(key)
    } catch (e) {
      setError(e instanceof AssetFromUrlError ? e.message : URL_FETCH_BLOCKED_MESSAGE)
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[10px] text-[#7c6ef6] transition-colors hover:text-[#9d90f8]"
        >
          + From URL
        </button>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="flex gap-1">
        <input
          type="url"
          value={url}
          placeholder="Add from URL (https://…)"
          aria-label="Image URL"
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void submit() }}
          className="min-w-0 flex-1 rounded-lg border border-[rgba(255,255,255,0.08)] bg-transparent px-2 py-1 text-[10px] text-[#e8e8f0] placeholder:text-[#6b6b7a]"
        />
        <button
          type="button"
          aria-label="Add image from URL"
          disabled={busy || !url.trim()}
          onClick={() => { void submit() }}
          className="rounded-lg border border-[rgba(255,255,255,0.08)] px-2 py-1 text-[10px] text-[#b0b0c4] hover:text-white disabled:opacity-40"
        >
          {busy ? '…' : 'Add'}
        </button>
      </div>
      {error && <p role="alert" className="mt-1 text-[10px] leading-4 text-[#f87171]">{error}</p>}
    </div>
  )
}
