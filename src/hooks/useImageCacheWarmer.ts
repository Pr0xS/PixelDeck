import { useEffect, useRef } from 'react'
import { useEditorStore } from '@/store'
import { useAssetStore } from '@/store/assets'
import { forEachLayerTree } from '@/utils/layerTree'
import type { Layer } from '@/types'
import { warmImageCache } from './useCachedImage'

function collectLayerImageSrcs(layer: Layer, assets: Record<string, { dataUrl: string }>): string[] {
  switch (layer.type) {
    case 'phone': {
      const src = layer.screenshotPath
        ? (assets[layer.screenshotPath]?.dataUrl ?? layer.screenshotDataUrl ?? '')
        : (layer.screenshotDataUrl ?? '')
      return src ? [src] : []
    }
    case 'image': {
      const src = assets[layer.src]?.dataUrl ?? layer.src
      return src ? [src] : []
    }
    case 'background':
      return layer.imageDataUrl ? [layer.imageDataUrl] : []
    case 'brand':
      return layer.logoDataUrl ? [layer.logoDataUrl] : []
    default:
      return []
  }
}

/**
 * Background-idle warm-up of the shared image decode cache (see
 * useCachedImage.ts) for every layer image in the whole project. Call once,
 * gated on the same `hasCompletedInitialLoad` flag App.tsx already threads
 * into useThumbnails, so it never competes with first paint.
 */
export function useImageCacheWarmer(hasCompletedInitialLoad: boolean): void {
  const project = useEditorStore((s) => s.project)
  const assets = useAssetStore((s) => s.assets)
  const cancelledRef = useRef(false)

  useEffect(() => {
    if (!hasCompletedInitialLoad) return
    cancelledRef.current = false

    const srcs = new Set<string>()
    for (const group of project.slideGroups) {
      forEachLayerTree(group.layers, (layer) => {
        for (const src of collectLayerImageSrcs(layer, assets)) srcs.add(src)
      })
    }

    const queue = Array.from(srcs)
    let index = 0
    let idleId: number | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const scheduleNext = () => {
      if ('requestIdleCallback' in window) {
        idleId = window.requestIdleCallback(processChunk, { timeout: 500 })
      } else {
        timeoutId = setTimeout(() => processChunk(), 0)
      }
    }
    const processChunk = (deadline?: IdleDeadline) => {
      if (cancelledRef.current) return
      while (index < queue.length && (!deadline || deadline.timeRemaining() > 0)) {
        void warmImageCache(queue[index])
        index += 1
      }
      if (index < queue.length) scheduleNext()
    }
    scheduleNext()

    return () => {
      cancelledRef.current = true
      if (idleId !== null && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleId)
      if (timeoutId !== null) clearTimeout(timeoutId)
    }
  }, [project, assets, hasCompletedInitialLoad])
}
