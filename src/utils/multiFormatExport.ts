import type Konva from 'konva'
import type { CanvasFormatId } from '@/types'
import { exportAllSlides } from './export'
import { applyCanvasFormat, CANVAS_FORMAT_PRESETS } from './canvasFormats'
import { useEditorStore } from '@/store'

export interface FormatExportResult {
  formatId: CanvasFormatId
  formatLabel: string
  slides: { name: string; dataUrl: string }[]
}

/**
 * Export all slides for each requested format.
 * Switches activeCanvasFormat sequentially (canvas re-renders), waits for
 * settle, captures, then restores the original format.
 *
 * onProgress(formatId) called before each format capture.
 */
export async function exportAllFormats(
  stage: Konva.Stage,
  formatIds: CanvasFormatId[],
  onProgress?: (formatId: CanvasFormatId) => void,
): Promise<FormatExportResult[]> {
  const store = useEditorStore.getState()
  const originalFormat = store.activeCanvasFormat
  const originalGroupId = store.activeSlideGroupId
  const results: FormatExportResult[] = []

  try {
    for (const formatId of formatIds) {
      onProgress?.(formatId)

      useEditorStore.getState().setActiveCanvasFormat(formatId)
      // Wait for canvas re-render + SVG load
      await new Promise((r) => setTimeout(r, 300))

      const { project, activeSlideGroupId } = useEditorStore.getState()
      const resolvedProject = applyCanvasFormat(project, formatId)
      const resolvedGroup = resolvedProject.slideGroups.find((g) => g.id === activeSlideGroupId)

      if (!resolvedGroup) continue

      const rawSlides = await exportAllSlides(stage, resolvedGroup)

      // Name slides: if multiple formats, append _${formatId} suffix
      const slides =
        formatIds.length === 1
          ? rawSlides
          : rawSlides.map((s) => ({ ...s, name: `${s.name}_${formatId}` }))

      const preset = CANVAS_FORMAT_PRESETS.find((p) => p.id === formatId)
      results.push({
        formatId,
        formatLabel: preset?.label ?? formatId,
        slides,
      })
    }
  } finally {
    useEditorStore.getState().setActiveCanvasFormat(originalFormat)
    if (useEditorStore.getState().activeSlideGroupId !== originalGroupId) {
      useEditorStore.getState().setActiveSlideGroup(originalGroupId)
    }
  }

  return results
}
