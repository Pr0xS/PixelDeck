import type { FormatLayerPatch, Layer, LocaleLayerPatch, Project } from '@/types'
import { forEachLayerTree } from '@/utils/layerTree'

const isKey = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && !value.startsWith('data:')

function addPatchKeys(patch: LocaleLayerPatch | FormatLayerPatch | undefined, out: Set<string>): void {
  if (!patch) return
  if ('screenshotPath' in patch && isKey(patch.screenshotPath)) out.add(patch.screenshotPath)
  if ('src' in patch && isKey(patch.src)) out.add(patch.src)
}

function addLayerKeys(layer: Layer, out: Set<string>): void {
  if (layer.type === 'phone' && isKey(layer.screenshotPath)) out.add(layer.screenshotPath)
  if (layer.type === 'image' && isKey(layer.src)) out.add(layer.src)

  for (const patch of Object.values(layer.localeContent ?? {})) addPatchKeys(patch, out)
  for (const patch of Object.values(layer.formatOverrides ?? {})) addPatchKeys(patch, out)
}

export function collectAssetKeys(project: Project): Set<string> {
  const out = new Set<string>()
  for (const slideGroup of project.slideGroups) {
    forEachLayerTree(slideGroup.layers, (layer) => addLayerKeys(layer, out))
  }
  return out
}

export interface ProjectExportBundle {
  kind: 'project-export'
  schemaVersion: 1
  project: Project
  assets: Record<string, string>
}

export function buildProjectExportBundle(
  project: Project,
  resolve: (key: string) => string | undefined,
): { bundle: ProjectExportBundle; missing: string[] } {
  const assets: Record<string, string> = {}
  const missing: string[] = []
  for (const key of collectAssetKeys(project)) {
    const dataUrl = resolve(key)
    if (dataUrl) assets[key] = dataUrl
    else missing.push(key)
  }
  return {
    bundle: { kind: 'project-export', schemaVersion: 1, project, assets },
    missing,
  }
}

export function isProjectExportBundle(value: unknown): value is ProjectExportBundle {
  return (
    !!value
    && typeof value === 'object'
    && (value as ProjectExportBundle).kind === 'project-export'
    && (value as ProjectExportBundle).schemaVersion === 1
    && typeof (value as ProjectExportBundle).project === 'object'
    && typeof (value as ProjectExportBundle).assets === 'object'
  )
}
