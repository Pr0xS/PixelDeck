import type { CanvasFormatId, Project } from '@/types'
import { getProjectBaseFormat } from '@/utils/canvasFormats'

export function getScopedEditingIndicator(
  project: Pick<Project, 'settings'>,
  activeLocale: string,
  activeCanvasFormat: CanvasFormatId,
) {
  const baseFormat = getProjectBaseFormat(project)
  const defaultLocale = project.settings.defaultLocale
  const isFormatScoped = activeCanvasFormat !== baseFormat
  const isLocaleScoped = activeLocale !== defaultLocale
  const horizontalFrameBackground = isFormatScoped && isLocaleScoped
    ? 'linear-gradient(90deg, #f59e0b 0%, #f59e0b 50%, #22d3c5 50%, #22d3c5 100%)'
    : isFormatScoped ? '#f59e0b' : '#22d3c5'
  const verticalFrameBackground = isFormatScoped && isLocaleScoped
    ? 'linear-gradient(180deg, #f59e0b 0%, #f59e0b 50%, #22d3c5 50%, #22d3c5 100%)'
    : isFormatScoped ? '#f59e0b' : '#22d3c5'

  return { baseFormat, defaultLocale, isFormatScoped, isLocaleScoped, horizontalFrameBackground, verticalFrameBackground }
}
