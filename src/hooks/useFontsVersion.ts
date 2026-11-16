import { useEffect, useSyncExternalStore, type RefObject } from 'react'
import type Konva from 'konva'

let version = 0
let attached = false
const listeners = new Set<() => void>()

function attach(): void {
  if (attached || typeof document === 'undefined' || !document.fonts?.addEventListener) return
  attached = true
  document.fonts.addEventListener('loadingdone', () => {
    version += 1
    listeners.forEach((listener) => listener())
  })
}

function subscribe(listener: () => void): () => void {
  attach()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * A number that changes whenever web fonts finish loading.
 *
 * Canvas text is drawn with a fallback font while its face is still
 * downloading, and nothing redraws it when the face arrives: rich text is
 * rasterised once into a cached canvas, and Konva.Text keeps the line metrics
 * it measured with the fallback. Anything that rasterises or measures text
 * must depend on this value, or a cold load (a new user's first screen) keeps
 * showing the fallback font.
 */
export function useFontsVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => 0)
}

/** Re-measure a plain Konva.Text node once its font has actually loaded. */
export function useRemeasureOnFontLoad(nodeRef: RefObject<Konva.Text | null>, fontsVersion: number): void {
  useEffect(() => {
    const node = nodeRef.current
    if (!node || fontsVersion === 0) return
    node._setTextData()
    node.getLayer()?.batchDraw()
  }, [nodeRef, fontsVersion])
}
