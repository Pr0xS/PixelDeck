import { useAssetStore } from '@/store/assets'
import { useEditorStore } from '@/store'
import { isDataUrl } from '@/utils/assetKey'

export type AssetImageStatus = 'none' | 'loading' | 'missing' | 'loaded'

export interface AssetImageState {
  status: AssetImageStatus
  /** Resolved data URL when status is 'loaded'. */
  src?: string
  /** Display name for the ref (asset name, manifest name, or the key itself). */
  name?: string
}

/** Pure resolution of a ref against an assets map. `data:` refs pass through. */
export function resolveImageRef(
  ref: string | undefined,
  assets: Record<string, { dataUrl: string }>,
): string | undefined {
  if (!ref) return undefined
  if (isDataUrl(ref)) return ref
  return assets[ref]?.dataUrl
}

/** Pure state computation used by useAssetImage. */
export function computeAssetImageState(
  ref: string | undefined,
  dataUrl: string | undefined,
  hydrated: boolean,
  name?: string,
): AssetImageState {
  if (!ref) return { status: 'none' }
  if (dataUrl) return { status: 'loaded', src: dataUrl, name: name ?? ref }
  if (!hydrated) return { status: 'loading', name: name ?? ref }
  return { status: 'missing', name: name ?? ref }
}

/**
 * Reactive asset lookup. Subscribes only to the specific entry (plus the
 * `hydrated` flag), so unrelated asset changes do not re-render the caller.
 */
export function useAssetImage(ref: string | undefined): AssetImageState {
  const dataUrl = useAssetStore((s) => (ref ? (isDataUrl(ref) ? ref : s.assets[ref]?.dataUrl) : undefined))
  const hydrated = useAssetStore((s) => s.hydrated)
  const entryName = useAssetStore((s) => (ref && !isDataUrl(ref) ? s.assets[ref]?.name : undefined))
  const manifestName = useEditorStore((s) => (ref && !isDataUrl(ref) ? s.project.assetManifest?.[ref]?.name : undefined))
  return computeAssetImageState(ref, dataUrl, hydrated, entryName ?? manifestName)
}
