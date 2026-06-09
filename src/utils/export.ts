import type Konva from 'konva'
import type { SlideGroup } from '@/types'

interface WritableFileHandle {
  write(data: Blob): Promise<void>
  close(): Promise<void>
}

interface FileSystemFileHandleLike {
  createWritable(): Promise<WritableFileHandle>
}

interface FileSystemDirectoryHandleLike {
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandleLike>
}

declare global {
  interface Window {
    showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandleLike>
  }
}

function withIdentityTransform<T>(stage: Konva.Stage, fn: () => T): T {
  const prevX = stage.x()
  const prevY = stage.y()
  const prevScaleX = stage.scaleX()
  const prevScaleY = stage.scaleY()
  try {
    stage.x(0)
    stage.y(0)
    stage.scaleX(1)
    stage.scaleY(1)
    return fn()
  } finally {
    stage.x(prevX)
    stage.y(prevY)
    stage.scaleX(prevScaleX)
    stage.scaleY(prevScaleY)
  }
}

/**
 * Export a single slide from the Konva stage as a PNG data URL.
 * The stage must be at full resolution (no zoom scaling).
 */
export async function exportSlide(
  stage: Konva.Stage,
  slideIndex: number,
  group: SlideGroup,
): Promise<string> {
  const { slideWidth, slideHeight } = group
  return withIdentityTransform(stage, () =>
    stage.toDataURL({
      x: slideIndex * slideWidth,
      y: 0,
      width: slideWidth,
      height: slideHeight,
      pixelRatio: 1,
      mimeType: 'image/png',
    }),
  )
}

/**
 * Export all slides in a SlideGroup as PNG data URLs.
 */
export async function exportAllSlides(
  stage: Konva.Stage,
  group: SlideGroup,
): Promise<{ name: string; dataUrl: string }[]> {
  const results: { name: string; dataUrl: string }[] = []
  for (let i = 0; i < group.numSlides; i++) {
    const name = group.slideNames[i] ?? `slide-${i + 1}`
    const dataUrl = await exportSlide(stage, i, group)
    results.push({ name, dataUrl })
  }
  return results
}

/**
 * Download a data URL as a PNG file using a temporary anchor tag.
 */
export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename.endsWith('.png') ? filename : `${filename}.png`
  a.click()
  a.remove()
}

/**
 * Save all slides in a SlideGroup by downloading them.
 */
export async function downloadSlideGroup(
  stage: Konva.Stage,
  group: SlideGroup,
): Promise<void> {
  const slides = await exportAllSlides(stage, group)
  for (const { name, dataUrl } of slides) {
    downloadDataUrl(dataUrl, name)
    // Brief delay to avoid browser blocking multiple downloads
    await new Promise((r) => setTimeout(r, 80))
  }
}

/**
 * Save a single slide by downloading it.
 */
export async function downloadSlide(
  stage: Konva.Stage,
  slideIndex: number,
  group: SlideGroup,
): Promise<void> {
  const name = group.slideNames[slideIndex] ?? `slide-${slideIndex + 1}`
  const dataUrl = await exportSlide(stage, slideIndex, group)
  downloadDataUrl(dataUrl, name)
}

/**
 * Use File System Access API to save all slides to a chosen directory.
 * Falls back to download if API not supported.
 */
export async function saveToDirectory(
  stage: Konva.Stage,
  group: SlideGroup,
): Promise<void> {
  const slides = await exportAllSlides(stage, group)

  if (!window.showDirectoryPicker) {
    // Fallback: download individually
    for (const { name, dataUrl } of slides) {
      downloadDataUrl(dataUrl, name)
      await new Promise((r) => setTimeout(r, 80))
    }
    return
  }

  try {
    const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' })
    for (const { name, dataUrl } of slides) {
      const filename = name.endsWith('.png') ? name : `${name}.png`
      const fileHandle = await dirHandle.getFileHandle(filename, { create: true })
      const writable = await fileHandle.createWritable()
      // Convert data URL to blob
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      await writable.write(blob)
      await writable.close()
    }
  } catch (err: unknown) {
    if (!(err instanceof DOMException && err.name === 'AbortError')) throw err
  }
}
