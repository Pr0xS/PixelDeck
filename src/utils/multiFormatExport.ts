import type Konva from 'konva'
import type { CanvasFormatId } from '@/types'
import { exportGroupImages, type PanoExportMode } from './export'
import { applyCanvasFormat, getFormatLabel, isCustomFormatId } from './canvasFormats'
import { applyLocale } from './locale'
import { acquireCaptureLock, waitForStageCaptureReady } from './stageCapture'
import { useEditorStore } from '@/store'
import { normalizePanoCompensationPx } from './panoGeometry'

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

function safeSegment(value: string): string {
  return value.trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'untitled'
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
  const customFormats = project.settings.customFormats
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
  const results: ProjectImageExportResult[] = []
  // Guard against duplicate relativePaths (e.g. colliding slideNames in pano groups).
  // If two slides resolve to the same path, append a numeric suffix so no file is silently lost.
  const usedPaths = new Set<string>()

  try {
    for (const locale of locales) {
      useEditorStore.getState().setActiveLocale(locale)
      for (const formatId of formatIds) {
        useEditorStore.getState().setActiveCanvasFormat(formatId)
        const resolvedProject = applyCanvasFormat(applyLocale(project, locale), formatId)

        for (const groupId of groupIds) {
          const resolvedGroup = resolvedProject.slideGroups.find((group) => group.id === groupId)
          if (!resolvedGroup) continue

          options.onProgress?.({ formatId, locale, groupName: resolvedGroup.name })
          useEditorStore.getState().setActiveSlideGroup(groupId)
          useEditorStore.getState().setPanoRenderOverride({
            gapPx: options.panoCompensationPx ?? projectPano.gapPx,
            compensate: resolvedGroup.numSlides > 1 && panoCompensate,
          })
          await waitForStageCaptureReady(stage)

          const images = await exportGroupImages(stage, resolvedGroup, panoMode, panoCompensationPx)
          for (const image of images) {
            const groupSlug = safeSegment(resolvedGroup.name)
            const imageSlug = safeSegment(image.name)
            const baseFileName = options.scope === 'project' && imageSlug !== groupSlug
              ? `${groupSlug}__${imageSlug}`
              : imageSlug
            const formatSegment = isCustomFormatId(formatId)
              ? getFormatLabel(formatId, customFormats)
              : formatId
            const baseRelativePath = [safeSegment(formatSegment), safeSegment(locale), baseFileName].join('/')
            // Deduplicate: if this path was already used, append a counter suffix
            let relativePath = baseRelativePath
            let fileName = baseFileName
            if (usedPaths.has(relativePath)) {
              let counter = 2
              while (usedPaths.has(`${baseRelativePath}-${counter}`)) counter++
              relativePath = `${baseRelativePath}-${counter}`
              fileName = `${baseFileName}-${counter}`
            }
            usedPaths.add(relativePath)
            results.push({
              formatId,
              formatLabel: getFormatLabel(formatId, customFormats),
              locale,
              groupId,
              groupName: resolvedGroup.name,
              name: fileName,
              relativePath,
              dataUrl: image.dataUrl,
            })
          }
        }
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
