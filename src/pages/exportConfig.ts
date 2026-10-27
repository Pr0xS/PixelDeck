import type { CanvasFormatId, Project } from '@/types'
import { getExportTargets } from '@/utils/canvasFormats'

export function resolveExportFormatIds(
  project: Pick<Project, 'settings'>,
  requestedFormatIds?: CanvasFormatId[],
): CanvasFormatId[] {
  return requestedFormatIds ?? getExportTargets(project)
}
