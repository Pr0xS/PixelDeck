/**
 * Project list store — manages multiple projects with localStorage persistence.
 *
 * Storage layout:
 *   pd:project-list      → JSON array of ProjectMeta (id, name, timestamps)
 *   pd:project:{id}      → full serialized Project JSON
 *   pd:active-project    → string — ID of last open project
 */

import { create } from 'zustand'
import { useEditorStore } from './index'
import { stripDataUrls } from './helpers'

// ─── Keys ──────────────────────────────────────────────────────────────────────

const LIST_KEY = 'pd:project-list'
const ACTIVE_KEY = 'pd:active-project'
const projectKey = (id: string) => `pd:project:${id}`

let storageWarningShown = false

function warnStorageFailure(err: unknown) {
  console.warn('[PixelDeck] Project library save failed', err)
  if (storageWarningShown || typeof window === 'undefined') return
  storageWarningShown = true
  window.setTimeout(() => {
    alert('Project library save failed. Export Project now to avoid losing recent changes.')
  }, 0)
}

/** Load a saved project without persisting the currently loaded editor project. */
function loadProjectById(id: string): boolean {
  const json = localStorage.getItem(projectKey(id))
  if (!json) return false
  localStorage.setItem(ACTIVE_KEY, id)
  useEditorStore.getState().importProject(json)
  return true
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ProjectMeta {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

interface ProjectsStore {
  projects: ProjectMeta[]
  initialized: boolean

  /** Load project list and restore last active project from localStorage. */
  initialize: () => void

  /** Persist the current editor project to localStorage immediately. */
  saveCurrentProject: () => void

  /** Create a brand-new project, save current first, then switch. */
  createProject: (name: string) => void

  /** Load a saved project into the editor (saves current first). */
  openProject: (id: string) => void

  /** Permanently delete a project from localStorage. */
  deleteProject: (id: string) => void

  /** Rename a project (updates list + editor store if active). */
  renameProject: (id: string, name: string) => void

  /** Sync list metadata with whatever is currently in the editor store. */
  syncMeta: () => void
}

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useProjectsStore = create<ProjectsStore>((set, get) => ({
  projects: [],
  initialized: false,

  initialize() {
    const listJson = localStorage.getItem(LIST_KEY)
    const projects: ProjectMeta[] = listJson ? (JSON.parse(listJson) as ProjectMeta[]) : []

    const activeId = localStorage.getItem(ACTIVE_KEY)

    if (activeId && projects.find((p) => p.id === activeId)) {
      if (!loadProjectById(activeId) && projects.length > 0) loadProjectById(projects[0].id)
    } else if (projects.length > 0) {
      loadProjectById(projects[0].id)
    }

    // Always persist whatever is now in the editor (covers first-ever run)
    set({ projects, initialized: true })
    get().saveCurrentProject()
  },

  saveCurrentProject() {
    const { project } = useEditorStore.getState()

    const meta: ProjectMeta = {
      id: project.id,
      name: project.name,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    }

    const { projects } = get()
    const exists = projects.some((p) => p.id === project.id)
    const updated = exists
      ? projects.map((p) => (p.id === project.id ? meta : p))
      : [...projects, meta]

    try {
      localStorage.setItem(projectKey(project.id), JSON.stringify(stripDataUrls(project)))
      localStorage.setItem(ACTIVE_KEY, project.id)
      localStorage.setItem(LIST_KEY, JSON.stringify(updated))
    } catch (err) {
      warnStorageFailure(err)
    }
    set({ projects: updated })
  },

  createProject(name) {
    const trimmed = name.trim()
    const { projects } = get()
    const duplicate = projects.find((p) => p.name.toLowerCase() === trimmed.toLowerCase())
    if (duplicate) {
      throw new Error(`A project named "${trimmed}" already exists.`)
    }
    get().saveCurrentProject()
    useEditorStore.getState().resetProject()
    useEditorStore.getState().setProjectName(trimmed)
    get().saveCurrentProject()
  },

  openProject(id) {
    const { projects } = get()
    if (!projects.find((p) => p.id === id)) return
    get().saveCurrentProject()
    loadProjectById(id)
  },

  deleteProject(id) {
    localStorage.removeItem(projectKey(id))

    const { projects } = get()
    const updated = projects.filter((p) => p.id !== id)
    try {
      localStorage.setItem(LIST_KEY, JSON.stringify(updated))
    } catch (err) {
      warnStorageFailure(err)
    }
    set({ projects: updated })

    const activeProjectId = useEditorStore.getState().project.id
    if (activeProjectId !== id) return

    const replacement = updated[0]
    if (replacement && loadProjectById(replacement.id)) return

    useEditorStore.getState().resetProject()
    get().saveCurrentProject()
  },

  renameProject(id, name) {
    // Update list
    const { projects } = get()
    const updated = projects.map((p) => (p.id === id ? { ...p, name } : p))
    localStorage.setItem(LIST_KEY, JSON.stringify(updated))
    set({ projects: updated })

    // If renaming the active project, update the editor store too
    const activeId = localStorage.getItem(ACTIVE_KEY)
    if (activeId === id) {
      useEditorStore.getState().setProjectName(name)
    }
  },

  syncMeta() {
    get().saveCurrentProject()
  },
}))

// ─── Auto-init + auto-save ─────────────────────────────────────────────────────

// Initialize on first import
useProjectsStore.getState().initialize()

// Debounced auto-save: 1.5s after last project change
let _saveTimer: ReturnType<typeof setTimeout> | null = null

useEditorStore.subscribe((state, prev) => {
  if (!useProjectsStore.getState().initialized) return
  if (state.project === prev.project) return

  if (_saveTimer) clearTimeout(_saveTimer)
  _saveTimer = setTimeout(() => {
    useProjectsStore.getState().saveCurrentProject()
  }, 1500)
})
