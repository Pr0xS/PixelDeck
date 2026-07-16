import type Konva from 'konva'
import type { SlideGroup } from '@/types'
import { withIdentityTransform } from './stageCapture'
import { getPanoSlideX, getPanoTotalWidth } from './panoGeometry'

interface WritableFileHandle {
  write(data: Blob): Promise<void>
  close(): Promise<void>
}

interface FileSystemFileHandleLike {
  createWritable(): Promise<WritableFileHandle>
}

interface FileSystemDirectoryHandleLike {
  getDirectoryHandle?(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandleLike>
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandleLike>
}

declare global {
  interface Window {
    showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandleLike>
  }
}

export type PanoExportMode = 'split' | 'whole'

export interface ExportedImage {
  name: string
  dataUrl: string
}

/**
 * Export a single slide from the Konva stage as a PNG data URL.
 * The stage must be at full resolution (no zoom scaling).
 */
export async function exportSlide(
  stage: Konva.Stage,
  slideIndex: number,
  group: SlideGroup,
  panoCompensationPx = 0,
): Promise<string> {
  const { slideWidth, slideHeight } = group
  return withIdentityTransform(stage, () =>
    stage.toDataURL({
      x: getPanoSlideX(group, slideIndex, panoCompensationPx),
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
  panoCompensationPx = 0,
): Promise<ExportedImage[]> {
  const results: ExportedImage[] = []
  for (let i = 0; i < group.numSlides; i++) {
    const name = group.slideNames[i] ?? `slide-${i + 1}`
    const dataUrl = await exportSlide(stage, i, group, panoCompensationPx)
    results.push({ name, dataUrl })
  }
  return results
}

export async function exportWholeGroup(
  stage: Konva.Stage,
  group: SlideGroup,
  panoCompensationPx = 0,
): Promise<string> {
  return withIdentityTransform(stage, () =>
    stage.toDataURL({
      x: 0,
      y: 0,
      width: getPanoTotalWidth(group, panoCompensationPx),
      height: group.slideHeight,
      pixelRatio: 1,
      mimeType: 'image/png',
    }),
  )
}

export async function exportGroupImages(
  stage: Konva.Stage,
  group: SlideGroup,
  panoMode: PanoExportMode = 'split',
  panoCompensationPx = 0,
): Promise<ExportedImage[]> {
  if (panoMode === 'whole' && group.numSlides > 1) {
    return [{ name: group.name || 'pano', dataUrl: await exportWholeGroup(stage, group, panoCompensationPx) }]
  }
  return exportAllSlides(stage, group, panoMode === 'split' ? panoCompensationPx : 0)
}

/**
 * Download a data URL as a file using a temporary anchor tag.
 * Filenames that already carry an extension (.png, .json, …) are kept as-is;
 * extensionless names default to .png for backwards compatibility.
 */
export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = /\.[a-z0-9]+$/i.test(filename) ? filename : `${filename}.png`
  a.click()
  a.remove()
}
