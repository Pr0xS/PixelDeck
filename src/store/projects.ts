/** Project library state and async persistence. */

import { create } from 'zustand'
import type { Project } from '@/types'
import { buildProjectExportBundle, collectAssetKeys } from '@/utils/projectAssets'
import { buildProjectZip, finalizeProjectImport, parseProjectFile } from '@/utils/projectZip'
import { useEditorStore } from './index'
import { newId, stripDataUrls } from './helpers'
import { areAssetsDurable, hasPendingAssetWrites, useAssetStore } from './assets'
import { idbStorage, warnStorageFailure as warnProjectStorageFailure } from './idb-storage'
import { isCaptureLocked } from '@/utils/stageCapture'
import { getProjectStorage } from './storage'
import { ProjectConflictError, type ProjectMeta } from './storage/types'

export type { ProjectMeta } from './storage/types'

const thumbnailKey = (id: string) => `pixeldeck-thumbs:${id}`
const conflictedProjectIds = new Set<string>()
let saveChain: Promise<void> = Promise.resolve()
let bootstrapAbandoned = false
let pagehideListenerRegistered = false

function warnStorageFailure(err: unknown): void {
  warnProjectStorageFailure('project', err)
}

function handleProjectSaveConflict(id: string): void {
  if (conflictedProjectIds.has(id)) return
  conflictedProjectIds.add(id)
  useProjectsStore.setState({ conflictNotice: { projectId: id } })
}

export function notifyProjectConflict(id: string): void {
  handleProjectSaveConflict(id)
}

export function abandonBootstrap(): void {
  bootstrapAbandoned = true
}

/** True when loading rewrote image refs (inline data / legacy filename keys) and the project must be re-saved. */
function assetRefsChanged(storedJson: string, loaded: Project): boolean {
  if (storedJson.includes('"data:')) return true
  try {
    const before = collectAssetKeys(JSON.parse(storedJson) as Project)
    const after = collectAssetKeys(loaded)
    if (before.size !== after.size) return true
    for (const key of before) if (!after.has(key)) return true
    return false
  } catch {
    return false
  }
}

async function loadProjectById(id: string, opts?: { checkAbandonment?: boolean }): Promise<boolean> {
  const json = await getProjectStorage().loadProject(id)
  // Only bootstrap reads are disposable; later user-initiated project switches must load normally.
  if (opts?.checkAbandonment && bootstrapAbandoned) return false
  if (!json) return false
  const assetStore = useAssetStore.getState()
  const previousScope = assetStore.activeProjectId
  // Load the project's images BEFORE the project becomes active so nothing
  // renders blank, and so legacy-key/inline migration lands in the right scope.
  await assetStore.setActiveProject(id)
  try {
    useEditorStore.getState().importProject(json)
  } catch (err) {
    console.warn('[PixelDeck] Failed to load project', err)
    await useAssetStore.getState().setActiveProject(previousScope)
    return false
  }
  await getProjectStorage().setActiveProjectId(id)
  conflictedProjectIds.delete(id)
  // Step B / inline migration may have rewritten refs: persist the new shape.
  if (assetRefsChanged(json, useEditorStore.getState().project)) {
    void enqueueCurrentProjectSave().catch(() => {})
  }
  return true
}

function projectPersistencePayload(): { meta: ProjectMeta; json: string } {
  registerPagehideFlush()
  const { project } = useEditorStore.getState()
  const meta: ProjectMeta = {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }
  return { meta, json: JSON.stringify(stripDataUrls(project)) }
}

async function persistCurrentProject({ meta, json }: { meta: ProjectMeta; json: string }): Promise<void> {
  try {
    // Images first: a saved project must never reference bytes that are not yet durable.
    if (hasPendingAssetWrites()) await useAssetStore.getState().flushAssets()
    await getProjectStorage().saveProject(meta, json)
    const { projects } = useProjectsStore.getState()
    const exists = projects.some((item) => item.id === meta.id)
    useProjectsStore.setState({
      projects: exists
        ? projects.map((item) => item.id === meta.id ? meta : item)
        : [...projects, meta],
    })
  } catch (err) {
    if (err instanceof ProjectConflictError) handleProjectSaveConflict(meta.id)
    else warnStorageFailure(err)
    throw err
  }
}

async function enqueueCurrentProjectSave(): Promise<void> {
  const payload = projectPersistencePayload()
  const task = saveChain.then(() => persistCurrentProject(payload))
  saveChain = task.catch(() => {})
  return task
}

async function persistRename(id: string, name: string): Promise<void> {
  try {
    await getProjectStorage().renameProject(id, name)
    const updated = await getProjectStorage().listProjects()
    useProjectsStore.setState({ projects: updated })
    if (useEditorStore.getState().project.id === id) useEditorStore.getState().setProjectName(name)
  } catch (err) {
    warnStorageFailure(err)
    throw err
  }
}

async function enqueueRename(id: string, name: string): Promise<void> {
  const task = saveChain.then(() => persistRename(id, name))
  saveChain = task.catch(() => {})
  return task
}

interface ProjectsStore {
  projects: ProjectMeta[]
  initialized: boolean
  conflictNotice: { projectId: string } | null
  initialize: () => Promise<void>
  saveCurrentProject: () => Promise<void>
  createProject: (name: string) => Promise<void>
  openProject: (id: string) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  renameProject: (id: string, name: string) => Promise<void>
  dismissConflictAndReload: () => void
  saveConflictedProjectAsCopy: () => Promise<void>
  /** Single-file JSON bundle v2 (secondary export format). */
  exportProjectBundle: (id: string) => Promise<string>
  /** ZIP (project.json + assets/<key>) — the default export format. */
  exportProjectZip: (id: string) => Promise<Blob>
  importProjectFromJson: (json: string) => Promise<{ missing: string[] }>
  /** Accepts .zip, JSON bundle v1/v2, raw project JSON (sniffed by magic bytes). */
  importProjectFromFile: (file: Blob | ArrayBuffer | Uint8Array) => Promise<{ missing: string[] }>
}

export const useProjectsStore = create<ProjectsStore>((set, get) => ({
  projects: [],
  initialized: false,
  conflictNotice: null,

  async initialize() {
    try {
      const projects = await getProjectStorage().listProjects()
      const activeId = await getProjectStorage().getActiveProjectId()
      let loaded = false
      if (activeId && projects.some((project) => project.id === activeId)) {
        loaded = await loadProjectById(activeId, { checkAbandonment: true })
      }
      if (!loaded && projects.length > 0) {
        loaded = await loadProjectById(projects[0].id, { checkAbandonment: true })
      }

      set({ projects })
      await useAssetStore.getState().setActiveProject(useEditorStore.getState().project.id)
      // With no stored projects, persisting the current default is still correct even after an abandoned read.
      if (projects.length === 0) await get().saveCurrentProject()
      // This also writes the pointer when no project was loaded (empty or unreadable library paths).
      await getProjectStorage().setActiveProjectId(useEditorStore.getState().project.id)
    } catch (err) {
      console.warn('[PixelDeck] Project library initialization failed', err)
    } finally {
      // Never leave the UI believing assets are still loading after a failed init.
      if (!useAssetStore.getState().hydrated) useAssetStore.getState().setAssetsHydrated(true)
      set({ initialized: true })
    }
  },

  saveCurrentProject() {
    return enqueueCurrentProjectSave()
  },

  async createProject(name) {
    const trimmed = name.trim()
    const { projects } = get()
    const duplicate = projects.find((project) => project.name.toLowerCase() === trimmed.toLowerCase())
    if (duplicate) throw new Error(`A project named "${trimmed}" already exists.`)

    await get().saveCurrentProject()
    useEditorStore.getState().resetProject()
    useEditorStore.getState().setProjectName(trimmed)
    await getProjectStorage().setActiveProjectId(useEditorStore.getState().project.id)
    await useAssetStore.getState().setActiveProject(useEditorStore.getState().project.id)
    await get().saveCurrentProject()
  },

  async openProject(id) {
    if (!get().projects.some((project) => project.id === id)) return
    await get().saveCurrentProject()
    if (!await loadProjectById(id)) return
    await useAssetStore.getState().setActiveProject(useEditorStore.getState().project.id)
  },

  async deleteProject(id) {
    await get().saveCurrentProject()
    await getProjectStorage().deleteProject(id)
    await useAssetStore.getState().clearProject(id)
    await idbStorage.removeItem(thumbnailKey(id))

    const updated = get().projects.filter((project) => project.id !== id)
    set({ projects: updated })

    if (useEditorStore.getState().project.id !== id) return
    const replacement = updated[0]
    if (!replacement || !await loadProjectById(replacement.id)) {
      useEditorStore.getState().resetProject()
      await getProjectStorage().setActiveProjectId(useEditorStore.getState().project.id)
      await get().saveCurrentProject()
    }
    await useAssetStore.getState().setActiveProject(useEditorStore.getState().project.id)
  },

  renameProject(id, name) {
    return enqueueRename(id, name)
  },

  // Retained for a future explicit Reload button; conflict dismissal must not call this implicitly.
  dismissConflictAndReload() {
    if (typeof window !== 'undefined') window.location.reload()
  },

  async saveConflictedProjectAsCopy() {
    const oldProjectId = useEditorStore.getState().project.id
    if (oldProjectId !== get().conflictNotice?.projectId) {
      set({ conflictNotice: null })
      return
    }
    const project = useEditorStore.getState().project
    const originalProjectJson = JSON.stringify(project)
    const newProjectId = newId()
    try {
      const assetStore = useAssetStore.getState()
      // Copy from memory when the old scope is active (pending writes are not in IDB yet);
      // otherwise flush first so the stored map is complete. Display names are preserved.
      let entries: Array<{ key: string; name: string; dataUrl: string }>
      if (assetStore.activeProjectId === oldProjectId) {
        entries = Object.values(assetStore.assets).map((a) => ({ key: a.key, name: a.name, dataUrl: a.dataUrl }))
      } else {
        await assetStore.flushAssets()
        entries = Object.values(await assetStore.loadProjectAssets(oldProjectId))
          .map((a) => ({ key: a.key, name: a.name, dataUrl: a.dataUrl }))
      }
      await useAssetStore.getState().setActiveProject(newProjectId)
      useAssetStore.getState().putAssetEntries(entries)
      useEditorStore.getState().importProject(JSON.stringify({
        ...project,
        id: newProjectId,
        name: `${project.name} (copy)`,
      }))
      await useAssetStore.getState().flushAssets()
      await get().saveCurrentProject()
      await getProjectStorage().setActiveProjectId(newProjectId)
      conflictedProjectIds.delete(oldProjectId)
      set({ conflictNotice: null })
    } catch (err) {
      // Restore the conflicted working copy so the notice remains retryable after any copy failure.
      useEditorStore.getState().importProject(originalProjectJson)
      try {
        await useAssetStore.getState().setActiveProject(oldProjectId)
      } catch (restoreErr) {
        console.error('[PixelDeck] Failed to restore conflicted project assets', restoreErr)
      }
      console.error('[PixelDeck] Failed to save conflicted project as a copy', err)
      if (typeof window !== 'undefined') alert('Could not save a copy of this project. Please try again.')
    }
  },

  async exportProjectBundle(id) {
    const { project, resolve, nameOf } = await loadExportSource(id)
    const { bundle } = buildProjectExportBundle(project, resolve, nameOf)
    return JSON.stringify(bundle, null, 2)
  },

  async exportProjectZip(id) {
    const { project, resolve, nameOf } = await loadExportSource(id)
    return (await buildProjectZip(project, resolve, nameOf)).blob
  },

  async importProjectFromJson(json) {
    return importIncoming(await parseProjectFile(json), get().saveCurrentProject)
  },

  async importProjectFromFile(file) {
    return importIncoming(await parseProjectFile(file), get().saveCurrentProject)
  },
}))

interface ExportSource {
  project: Project
  resolve: (key: string) => string | undefined
  nameOf: (key: string) => string | undefined
}

async function loadExportSource(id: string): Promise<ExportSource> {
  const editor = useEditorStore.getState()
  const assetStore = useAssetStore.getState()
  if (editor.project.id === id) {
    return {
      project: editor.project,
      resolve: (key) => assetStore.resolveAsset(key),
      nameOf: (key) => assetStore.assets[key]?.name,
    }
  }
  const json = await getProjectStorage().loadProject(id)
  if (!json) throw new Error('Project not found')
  // Make sure pending writes for the (possibly active) scope are on disk before reading.
  if (hasPendingAssetWrites()) await assetStore.flushAssets()
  const stored = await assetStore.loadProjectAssets(id)
  return {
    project: JSON.parse(json) as Project,
    resolve: (key) => stored[key]?.dataUrl,
    nameOf: (key) => stored[key]?.name,
  }
}

/**
 * Import any parsed project file as a NEW project. Assets are written into
 * the new project's own asset scope before the project becomes active.
 */
async function importIncoming(
  incoming: Awaited<ReturnType<typeof parseProjectFile>>,
  saveCurrent: () => Promise<void>,
): Promise<{ missing: string[] }> {
  await saveCurrent()
  const finalized = finalizeProjectImport(incoming)
  const newProjectId = newId()
  const previousScope = useAssetStore.getState().activeProjectId
  try {
    await useAssetStore.getState().setActiveProject(newProjectId)
    useAssetStore.getState().putAssetEntries(finalized.assets)
    useEditorStore.getState().importProject(JSON.stringify({ ...finalized.project, id: newProjectId }))
  } catch (err) {
    // The editor still shows the previous project: put its asset scope back
    // (and drop the half-created one) instead of leaving the new scope active.
    await useAssetStore.getState().setActiveProject(previousScope)
    await useAssetStore.getState().clearProject(newProjectId).catch(() => {})
    throw err
  }
  await getProjectStorage().setActiveProjectId(newProjectId)
  await useAssetStore.getState().flushAssets()
  await useProjectsStore.getState().saveCurrentProject()
  return { missing: finalized.missing }
}

export async function bootstrapProjects(): Promise<void> {
  await useProjectsStore.getState().initialize()
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleAutoSave(delayMs: number): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    if (isCaptureLocked()) {
      scheduleAutoSave(250)
      return
    }
    if (conflictedProjectIds.has(useEditorStore.getState().project.id)) return
    void useProjectsStore.getState().saveCurrentProject().catch(() => {})
  }, delayMs)
}

useEditorStore.subscribe((state, previous) => {
  if (!useProjectsStore.getState().initialized || state.project === previous.project) return
  scheduleAutoSave(1500)
})

/** Synchronous best-effort save on pagehide. Exported for tests. */
export function flushOnPagehide(): void {
  if (!useProjectsStore.getState().initialized || isCaptureLocked()) return
  // The project snapshot below is saved synchronously (localStorage) but image
  // writes to IndexedDB are async. Start any pending image write immediately, and
  // if this snapshot references images that are not yet durable, do NOT overwrite
  // the last consistent snapshot (it references only images already on disk).
  const payload = projectPersistencePayload()
  const writesPending = hasPendingAssetWrites()
  if (writesPending) void useAssetStore.getState().flushAssets()
  if (conflictedProjectIds.has(payload.meta.id)) return
  if (writesPending && !areAssetsDurable(collectAssetKeys(useEditorStore.getState().project))) return
  // This is only reliable for the synchronous local adapter; a network adapter needs sendBeacon support.
  void getProjectStorage().saveProject(payload.meta, payload.json).catch(() => {})
}

function registerPagehideFlush(): void {
  if (pagehideListenerRegistered || typeof window === 'undefined') return
  pagehideListenerRegistered = true
  window.addEventListener('pagehide', flushOnPagehide)
}

registerPagehideFlush()
