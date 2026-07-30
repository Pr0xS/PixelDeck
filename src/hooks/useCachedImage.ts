import { useEffect, useState } from 'react'

export type CachedImageStatus = 'loading' | 'loaded' | 'failed'

const imageCache = new Map<string, HTMLImageElement>()
const MAX_CACHE_SIZE = 120

function cacheGet(src: string): HTMLImageElement | undefined {
  const img = imageCache.get(src)
  if (img) {
    // Refresh recency (Map preserves insertion order; re-inserting moves it to the end).
    imageCache.delete(src)
    imageCache.set(src, img)
  }
  return img
}

function cacheSet(src: string, img: HTMLImageElement): void {
  imageCache.set(src, img)
  if (imageCache.size > MAX_CACHE_SIZE) {
    const oldest = imageCache.keys().next().value
    if (oldest !== undefined) imageCache.delete(oldest)
  }
}

/** Clear the shared decode cache. Exposed for tests only. */
export function __clearImageCacheForTests(): void {
  imageCache.clear()
}

/**
 * Decode an image into the shared cache without mounting a consumer.
 * Safe to call speculatively/eagerly (e.g. background warm-up); resolves
 * once decoded (or on error, so callers never hang).
 */
export function warmImageCache(src: string): Promise<void> {
  if (!src || cacheGet(src)) return Promise.resolve()
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      img
        .decode()
        .catch(() => {
          // Ignore decode errors — image can still render fine via drawImage on canvas.
        })
        .finally(() => {
          cacheSet(src, img)
          resolve()
        })
    }
    img.onerror = () => resolve()
    img.src = src
  })
}

/**
 * Drop-in replacement for use-image's `useImage`, backed by the shared
 * module-level decode cache above. Prevents the black-flash-on-slide-switch
 * regression: `use-image` has no cache and always resets to `undefined` the
 * instant `src` changes, even for a URL it already decoded moments ago.
 * Returns the same `[image, status]` shape as `use-image`.
 */
export function useCachedImage(src: string): [HTMLImageElement | undefined, CachedImageStatus] {
  const [state, setState] = useState<{ src: string; image: HTMLImageElement | undefined; status: CachedImageStatus }>(() => {
    const image = src ? cacheGet(src) : undefined
    return { src, image, status: image ? 'loaded' as const : 'loading' as const }
  })
  const cached = state.src !== src && src ? cacheGet(src) : undefined
  const current = state.src === src
    ? state
    : { src, image: cached, status: cached ? 'loaded' as const : 'loading' as const }

  if (state.src !== src) {
    setState(current)
  }

  useEffect(() => {
    if (!src || current.image) return
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      img
        .decode()
        .catch(() => {})
        .finally(() => {
          if (cancelled) return
          cacheSet(src, img)
          setState((previous) => previous.src === src
            ? { src, image: img, status: 'loaded' }
            : previous)
        })
    }
    img.onerror = () => {
      if (cancelled) return
      setState((previous) => previous.src === src
        ? { src, image: undefined, status: 'failed' }
        : previous)
    }
    img.src = src
    return () => { cancelled = true }
  }, [src, current.image])

  return [current.image, current.status]
}
