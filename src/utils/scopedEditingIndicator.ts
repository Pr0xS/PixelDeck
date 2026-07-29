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
  // The frame reads as ONE rectangle split by a single vertical line down its
  // center — amber (format) on the left half, teal (locale) on the right half.
  // The top/bottom edges cross that center line, so they carry the soft
  // left-to-right blend. The left/right edges sit entirely within one half
  // each, so they must be a single solid color — never their own top-to-bottom
  // gradient, or the frame reads as 4 separate quadrants instead of one split.
  const horizontalFrameBackground = isFormatScoped && isLocaleScoped
    ? 'linear-gradient(90deg, #f59e0b 0%, #f59e0b 42%, #22d3c5 58%, #22d3c5 100%)'
    : isFormatScoped ? '#f59e0b' : '#22d3c5'
  const leftFrameBackground = isFormatScoped ? '#f59e0b' : '#22d3c5'
  const rightFrameBackground = isLocaleScoped ? '#22d3c5' : (isFormatScoped ? '#f59e0b' : '#22d3c5')

  return { baseFormat, defaultLocale, isFormatScoped, isLocaleScoped, horizontalFrameBackground, leftFrameBackground, rightFrameBackground }
}
