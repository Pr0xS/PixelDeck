import type { CanvasFormatId, CustomCanvasFormat, Project } from '@/types'
import { getCanvasFormat, getExportTargets } from '@/utils/canvasFormats'

export function resolveExportFormatIds(
  project: Pick<Project, 'settings'>,
  requestedFormatIds?: CanvasFormatId[],
): CanvasFormatId[] {
  return requestedFormatIds ?? getExportTargets(project)
}

/** Ids that are neither the base sentinel, a built-in preset, nor one of the project's custom formats. */
export function findUnknownFormatIds(
  formatIds: CanvasFormatId[],
  customFormats?: CustomCanvasFormat[],
): CanvasFormatId[] {
  return formatIds.filter((formatId) => {
    try {
      getCanvasFormat(formatId, customFormats)
      return false
    } catch {
      return true
    }
  })
}
