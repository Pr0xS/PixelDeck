import { useEditorStore } from '@/store'
import { useAssetStore } from '@/store/assets'
import type { AssetEntry } from '@/store/assets'
import { forEachLayerTree } from '@/utils/layerTree'
import type { Layer, Project } from '@/types'

function layerRefs(layer: Layer, add: (v: unknown) => void): void {
  const l = layer as unknown as Record<string, unknown>
  add(l.screenshotPath)
  add(l.src)
  add(l.imageRef)
  add(l.logoRef)
  const scan = (patch: unknown) => {
    if (!patch || typeof patch !== 'object') return
    const p = patch as Record<string, unknown>
    add(p.screenshotPath)
    add(p.src)
    add(p.imageRef)
    add(p.logoRef)
  }
  for (const c of Object.values(layer.localeContent ?? {})) scan(c)
  for (const o of Object.values(layer.formatOverrides ?? {})) scan(o)
}

export function collectLayerAssetKeys(layers: Layer[], into: Set<string> = new Set()): Set<string> {
  const add = (v: unknown) => { if (typeof v === 'string' && v) into.add(v) }
  forEachLayerTree(layers, (layer) => layerRefs(layer, add))
  return into
}

/** All asset keys referenced by a project (layers incl. group children, locale/format overrides, settings). */
export function collectReferencedAssetKeys(project: Project, into: Set<string> = new Set()): Set<string> {
  for (const g of project.slideGroups) collectLayerAssetKeys(g.layers, into)
  const logo = project.settings.brandLogoRef
  if (logo) into.add(logo)
  return into
}

/** Pure core: entries not referenced by any of the given projects / clipboard layers. */
export function findUnusedAssets(
  entries: AssetEntry[],
  projects: Project[],
  clipboard: Layer[] | null = null,
): AssetEntry[] {
  const used = new Set<string>()
  for (const p of projects) collectReferencedAssetKeys(p, used)
  if (clipboard) collectLayerAssetKeys(clipboard, used)
  return entries.filter((e) => !used.has(e.key))
}

/** Unused = not referenced by the current project, any undo/redo state, or the layer clipboard. */
export function computeUnusedAssets(): AssetEntry[] {
  const editor = useEditorStore.getState()
  const temporal = useEditorStore.temporal.getState()
  const projects = [
    editor.project,
    ...temporal.pastStates.map((s) => s.project),
    ...temporal.futureStates.map((s) => s.project),
  ].filter((p): p is Project => !!p)
  return findUnusedAssets(useAssetStore.getState().listAssets(), projects, editor.clipboard)
}

export interface AssetKeyUsage {
  /** Layers in the current project referencing the key (incl. group children, overrides). */
  currentLayers: number
  /** Whether the project's brand logo setting uses it. */
  inSettings: boolean
  /** Referenced only by undo/redo history states. */
  inHistory: boolean
  inClipboard: boolean
  referenced: boolean
}

function countLayersUsing(layers: Layer[], key: string): number {
  let n = 0
  forEachLayerTree(layers, (layer) => {
    const keys = new Set<string>()
    layerRefs(layer, (v) => { if (typeof v === 'string') keys.add(v) })
    if (keys.has(key)) n += 1
  })
  return n
}

/** Pure: where is `key` used? Drives the confirm prompt for single-asset removal. */
export function getAssetKeyUsage(
  key: string,
  current: Project,
  history: Project[] = [],
  clipboard: Layer[] | null = null,
): AssetKeyUsage {
  const currentLayers = current.slideGroups.reduce((n, g) => n + countLayersUsing(g.layers, key), 0)
  const inSettings = current.settings.brandLogoRef === key
  const inHistory = history.some((p) => collectReferencedAssetKeys(p).has(key))
  const inClipboard = !!clipboard && countLayersUsing(clipboard, key) > 0
  return {
    currentLayers,
    inSettings,
    inHistory,
    inClipboard,
    referenced: currentLayers > 0 || inSettings || inHistory || inClipboard,
  }
}

/** Confirm text for removing an in-use asset, or null when it is safe to remove silently. */
export function removalWarning(usage: AssetKeyUsage): string | null {
  if (!usage.referenced) return null
  const where: string[] = []
  if (usage.currentLayers > 0) where.push(`${usage.currentLayers} layer${usage.currentLayers === 1 ? '' : 's'}`)
  if (usage.inSettings) where.push('the brand logo setting')
  if (usage.inHistory) where.push('undo/redo history')
  if (usage.inClipboard) where.push('the clipboard')
  return `This image is used by ${where.join(', ')}. Removing it will leave missing images. Remove anyway?`
}

/** Usage of a single key against the live editor state. */
export function computeAssetKeyUsage(key: string): AssetKeyUsage {
  const editor = useEditorStore.getState()
  const temporal = useEditorStore.temporal.getState()
  const history = [...temporal.pastStates, ...temporal.futureStates].map((s) => s.project).filter((p): p is Project => !!p)
  return getAssetKeyUsage(key, editor.project, history, editor.clipboard)
}
