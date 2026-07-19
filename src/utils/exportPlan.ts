import type { CanvasFormatId, Project, SlideGroup } from '@/types'
import { applyCanvasFormat, applyLocaleFormatLayout, getFormatLabel, isCustomFormatId } from './canvasFormats'
import { applyLocale } from './locale'

export type ExportPlanScope = 'current-group' | 'project'
export type ExportPlanPanoMode = 'split' | 'whole'

export interface BuildExportPlanOptions {
  /** Explicit targets may include `base`; defaults only export active non-base formats. */
  formatIds?: CanvasFormatId[]
  locales?: string[]
  scope?: ExportPlanScope
  groupIds?: string[]
  panoMode?: ExportPlanPanoMode
}

export interface ExportPlanEntry {
  formatId: CanvasFormatId
  formatLabel: string
  locale: string
  groupId: string
  groupName: string
  slideIndex: number | null
  name: string
  relativePath: string
}

export interface ExportPlanBatch {
  formatId: CanvasFormatId
  formatLabel: string
  locale: string
  group: SlideGroup
  entries: ExportPlanEntry[]
}

export interface ExportPlan {
  batches: ExportPlanBatch[]
  entries: ExportPlanEntry[]
}

export interface BuildExportFileTargetOptions {
  formatId: CanvasFormatId
  formatLabel: string
  locale: string
  groupName: string
  sourceName: string
  scope: ExportPlanScope
  usedRelativePaths?: ReadonlySet<string>
}

export function safeExportSegment(value: string): string {
  return value.trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'untitled'
}

/** Resolves one canonical, collision-safe output name without mutating the supplied set. */
export function buildExportFileTarget(options: BuildExportFileTargetOptions): Pick<ExportPlanEntry, 'name' | 'relativePath'> {
  const groupSlug = safeExportSegment(options.groupName)
  const imageSlug = safeExportSegment(options.sourceName)
  const baseName = options.scope === 'project' && imageSlug !== groupSlug
    ? `${groupSlug}__${imageSlug}`
    : imageSlug
  const formatSegment = isCustomFormatId(options.formatId) ? options.formatLabel : options.formatId
  const baseRelativePath = [
    safeExportSegment(formatSegment),
    safeExportSegment(options.locale),
    baseName,
  ].join('/')
  let relativePath = baseRelativePath
  let name = baseName
  if (options.usedRelativePaths?.has(relativePath)) {
    let counter = 2
    while (options.usedRelativePaths.has(`${baseRelativePath}-${counter}`)) counter += 1
    relativePath = `${baseRelativePath}-${counter}`
    name = `${baseName}-${counter}`
  }
  return { name, relativePath }
}

/**
 * Builds the deterministic export matrix and its projected groups.
 * Composition is locale-format-layout(format(locale(project))): locale projection
 * is computed once per locale and each remaining projection once per locale/format.
 */
export function buildExportPlan(project: Project, options: BuildExportPlanOptions = {}): ExportPlan {
  const locales = options.locales?.length
    ? options.locales
    : (project.settings.locales?.length
        ? project.settings.locales
        : [project.settings.defaultLocale ?? 'en'])
  const formatIds = options.formatIds !== undefined
    ? options.formatIds
    : (project.settings.activeFormats ?? []).filter((formatId) => formatId !== 'base')
  const scope = options.scope ?? 'project'
  const panoMode = options.panoMode ?? 'split'
  const selectedGroupIds = options.groupIds?.length ? new Set(options.groupIds) : null
  const customFormats = project.settings.customFormats
  const usedPaths = new Set<string>()
  const batches: ExportPlanBatch[] = []
  const entries: ExportPlanEntry[] = []

  for (const locale of locales) {
    const localizedProject = applyLocale(project, locale)
    for (const formatId of formatIds) {
      const resolvedProject = applyLocaleFormatLayout(
        applyCanvasFormat(localizedProject, formatId),
        locale,
        formatId,
      )
      const formatLabel = getFormatLabel(formatId, customFormats)
      for (const group of resolvedProject.slideGroups) {
        if (selectedGroupIds && !selectedGroupIds.has(group.id)) continue

        const imageTargets = panoMode === 'whole' && group.numSlides > 1
          ? [{ slideIndex: null, sourceName: group.name || 'pano' }]
          : Array.from({ length: group.numSlides }, (_, slideIndex) => ({
              slideIndex,
              sourceName: group.slideNames[slideIndex] ?? `slide-${slideIndex + 1}`,
            }))
        const batchEntries: ExportPlanEntry[] = []

        for (const target of imageTargets) {
          const { name, relativePath } = buildExportFileTarget({
            formatId,
            formatLabel,
            locale,
            groupName: group.name,
            sourceName: target.sourceName,
            scope,
            usedRelativePaths: usedPaths,
          })
          usedPaths.add(relativePath)

          const entry: ExportPlanEntry = {
            formatId,
            formatLabel,
            locale,
            groupId: group.id,
            groupName: group.name,
            slideIndex: target.slideIndex,
            name,
            relativePath,
          }
          batchEntries.push(entry)
          entries.push(entry)
        }

        batches.push({ formatId, formatLabel, locale, group, entries: batchEntries })
      }
    }
  }

  return { batches, entries }
}
