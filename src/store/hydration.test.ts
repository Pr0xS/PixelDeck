import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { newProject } from './helpers'

const LIST_KEY = 'pd:project-list'
const ACTIVE_KEY = 'pd:active-project'
const projectKey = (id: string) => `pd:project:${id}`

let storage = new Map<string, string>()

beforeEach(() => {
  storage = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('project library bootstrap', () => {
  it('hydrates the active project before the editor mounts', async () => {
    const project = newProject()
    const phone = project.slideGroups[0]!
    const tablet = { ...phone, id: 'hydrated-tablet', formats: ['ipad-13' as const] }
    const storedProject = { ...project, slideGroups: [tablet] }
    storage.set(LIST_KEY, JSON.stringify([{
      id: project.id,
      name: project.name,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    }]))
    storage.set(ACTIVE_KEY, project.id)
    storage.set(projectKey(project.id), JSON.stringify(storedProject))

    vi.resetModules()
    const { bootstrapProjects, useProjectsStore } = await import('./projects')
    const { useEditorStore } = await import('./index')
    await bootstrapProjects()

    expect(useProjectsStore.getState().initialized).toBe(true)
    expect(useEditorStore.getState().project.id).toBe(project.id)
    expect(useEditorStore.getState().activeSlideGroupId).toBe(tablet.id)
    expect(useEditorStore.getState().activeFamily).toBe('tablet')
  })
})
