import type { ProjectMeta, ProjectStorageAdapter } from './types'
import { ProjectConflictError } from './types'

const LIST_KEY = 'pd:project-list'
const ACTIVE_KEY = 'pd:active-project'
const projectKey = (id: string) => `pd:project:${id}`
const etagKey = (id: string) => `pd:project-etag:${id}`

const observedEtags = new Map<string, string>()
let storageListenerRegistered = false
let etagCounter = 0

function nextEtag(): string {
  etagCounter += 1
  return `${Date.now()}-${etagCounter}`
}

function readProjectList(): ProjectMeta[] {
  const raw = localStorage.getItem(LIST_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as ProjectMeta[]
  } catch (err) {
    console.warn('[PixelDeck] Project list is corrupt; using an empty list.', err)
    return []
  }
}

function initializeLocalStorage(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem('pixeldeck-project')
  if (storageListenerRegistered || typeof window === 'undefined') return
  window.addEventListener('storage', (event) => {
    const match = event.key?.match(/^pd:project(?:-etag)?:([^:]+)$/)
    if (match && event.newValue !== event.oldValue) observedEtags.delete(match[1])
  })
  storageListenerRegistered = true
}

initializeLocalStorage()

export const localStorageAdapter: ProjectStorageAdapter = {
  async listProjects() {
    initializeLocalStorage()
    return readProjectList()
  },

  async loadProject(id) {
    initializeLocalStorage()
    const json = localStorage.getItem(projectKey(id))
    if (!json) return null
    const etag = localStorage.getItem(etagKey(id)) ?? '0'
    observedEtags.set(id, etag)
    return json
  },

  async saveProject(meta, json) {
    initializeLocalStorage()
    const storedJson = localStorage.getItem(projectKey(meta.id))
    const currentEtag = localStorage.getItem(etagKey(meta.id)) ?? '0'
    const observedEtag = observedEtags.get(meta.id)
    if (storedJson !== null && observedEtag === undefined) {
      throw new ProjectConflictError(meta.id)
    }
    if (observedEtag !== undefined && currentEtag !== observedEtag) {
      throw new ProjectConflictError(meta.id)
    }

    localStorage.setItem(projectKey(meta.id), json)
    const projects = readProjectList()
    const exists = projects.some((project) => project.id === meta.id)
    localStorage.setItem(
      LIST_KEY,
      JSON.stringify(exists ? projects.map((project) => project.id === meta.id ? meta : project) : [...projects, meta]),
    )
    const etag = nextEtag()
    localStorage.setItem(etagKey(meta.id), etag)
    observedEtags.set(meta.id, etag)
  },

  async deleteProject(id) {
    initializeLocalStorage()
    localStorage.removeItem(projectKey(id))
    localStorage.removeItem(etagKey(id))
    observedEtags.delete(id)
    localStorage.setItem(LIST_KEY, JSON.stringify(readProjectList().filter((project) => project.id !== id)))
  },

  async renameProject(id, name) {
    initializeLocalStorage()
    try {
      const now = new Date().toISOString()
      localStorage.setItem(LIST_KEY, JSON.stringify(readProjectList().map((project) => (
        project.id === id ? { ...project, name, updatedAt: now } : project
      ))))
    } catch (err) {
      console.warn('[PixelDeck] Project rename failed', err)
      throw err
    }
  },

  async getActiveProjectId() {
    initializeLocalStorage()
    return localStorage.getItem(ACTIVE_KEY)
  },

  async setActiveProjectId(id) {
    initializeLocalStorage()
    if (id === null) localStorage.removeItem(ACTIVE_KEY)
    else localStorage.setItem(ACTIVE_KEY, id)
  },
}
