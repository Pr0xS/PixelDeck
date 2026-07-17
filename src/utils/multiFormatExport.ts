import type Konva from 'konva'
import type { CanvasFormatId } from '@/types'
import { exportGroupImages, type PanoExportMode } from './export'
import { acquireCaptureLock, waitForStageCaptureReady } from './stageCapture'
import { useEditorStore } from '@/store'
import { normalizePanoCompensationPx } from './panoGeometry'
import { buildExportFileTarget, buildExportPlan } from './exportPlan'

export interface FormatExportResult {
  formatId: CanvasFormatId
  formatLabel: string
  slides: { name: string; dataUrl: string }[]
}

export type ProjectExportScope = 'current-group' | 'project'

export interface ProjectImageExportOptions {
  formatIds: CanvasFormatId[]
  locales: string[]
  scope: ProjectExportScope
  groupIds?: string[]
  panoMode?: PanoExportMode
  panoCompensate?: boolean
  panoCompensationPx?: number
  onProgress?: (status: { formatId: CanvasFormatId; locale: string; groupName: string }) => void
}

export interface ProjectImageExportResult {
  formatId: CanvasFormatId
  formatLabel: string
  locale: string
  groupId: string
  groupName: string
  name: string
  relativePath: string
  dataUrl: string
}

export async function exportProjectImages(
  stage: Konva.Stage,
  options: ProjectImageExportOptions,
): Promise<ProjectImageExportResult[]> {
  const release = await acquireCaptureLock()
  const store = useEditorStore.getState()
  const originalFormat = store.activeCanvasFormat
  const originalGroupId = store.activeSlideGroupId
  const originalLocale = store.activeLocale
  const projectPano = store.project.settings.pano ?? { gapPx: 24, compensate: false }
  const project = store.project
  const formatIds = options.formatIds.length ? options.formatIds : [originalFormat]
  const locales = options.locales.length ? options.locales : [project.settings.defaultLocale ?? originalLocale]
  const panoMode = options.panoMode ?? 'split'
  const panoCompensate = panoMode === 'split' && options.panoCompensate === true
  const panoCompensationPx = panoCompensate
    ? normalizePanoCompensationPx(options.panoCompensationPx ?? 0)
    : 0
  const groupIds = options.scope === 'current-group'
    ? [options.groupIds?.[0] ?? originalGroupId]
    : (options.groupIds?.length ? options.groupIds : project.slideGroups.map((group) => group.id))
  const plan = buildExportPlan(project, {
    formatIds,
    locales,
    scope: options.scope,
    groupIds,
    panoMode,
  })
  const results: ProjectImageExportResult[] = []
  const usedRelativePaths = new Set<string>()

  try {
    for (const batch of plan.batches) {
      useEditorStore.getState().setActiveLocale(batch.locale)
      useEditorStore.getState().setActiveCanvasFormat(batch.formatId)
      options.onProgress?.({ formatId: batch.formatId, locale: batch.locale, groupName: batch.group.name })
      useEditorStore.getState().setActiveSlideGroup(batch.group.id)
      useEditorStore.getState().setPanoRenderOverride({
        gapPx: options.panoCompensationPx ?? projectPano.gapPx,
        compensate: batch.group.numSlides > 1 && panoCompensate,
      })
      await waitForStageCaptureReady(stage)

      const images = await exportGroupImages(stage, batch.group, panoMode, panoCompensationPx)
      for (const image of images) {
        const target = buildExportFileTarget({
          formatId: batch.formatId,
          formatLabel: batch.formatLabel,
          locale: batch.locale,
          groupName: batch.group.name,
          sourceName: image.name,
          scope: options.scope,
          usedRelativePaths,
        })
        usedRelativePaths.add(target.relativePath)
        results.push({
          formatId: batch.formatId,
          formatLabel: batch.formatLabel,
          locale: batch.locale,
          groupId: batch.group.id,
          groupName: batch.group.name,
          name: target.name,
          relativePath: target.relativePath,
          dataUrl: image.dataUrl,
        })
      }
    }
  } finally {
    useEditorStore.getState().setActiveLocale(originalLocale)
    useEditorStore.getState().setActiveCanvasFormat(originalFormat)
    useEditorStore.getState().setPanoRenderOverride(null)
    if (useEditorStore.getState().activeSlideGroupId !== originalGroupId) {
      useEditorStore.getState().setActiveSlideGroup(originalGroupId)
    }
    await waitForStageCaptureReady(stage)
    release()
  }

  return results
}
