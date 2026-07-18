import { beforeEach, describe, expect, it } from 'vitest'
import type { PhoneLayer } from '@/types'

function makeLocalStorageMock() {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size },
  }
}

globalThis.localStorage = makeLocalStorageMock()

const { useProjectsStore } = await import('./projects')
const { useEditorStore } = await import('./index')

describe('saveCurrentProject', () => {
  beforeEach(() => {
    localStorage.clear()
    useEditorStore.getState().resetProject()
    useProjectsStore.setState({ projects: [], initialized: true })
  })

  it('strips inline screenshot data while preserving asset paths', () => {
    useEditorStore.getState().addPhone()
    const state = useEditorStore.getState()
    const group = state.project.slideGroups[0]
    const phone = group.layers.find((layer) => layer.type === 'phone') as PhoneLayer
    useEditorStore.getState().updateLayer(phone.id, {
      screenshotDataUrl: `data:image/png;base64,${'x'.repeat(100_000)}`,
      screenshotPath: 'screenshots/phone.png',
    })

    useProjectsStore.getState().saveCurrentProject()

    const stored = JSON.parse(localStorage.getItem(`pd:project:${state.project.id}`)!)
    const storedPhone = stored.slideGroups[0].layers.find(
      (layer: PhoneLayer) => layer.type === 'phone',
    ) as PhoneLayer
    expect(storedPhone.screenshotDataUrl).toBeUndefined()
    expect(storedPhone.screenshotPath).toBe('screenshots/phone.png')
  })
})

describe('deleteProject', () => {
  beforeEach(() => {
    localStorage.clear()
    useEditorStore.getState().resetProject()
    useProjectsStore.setState({ projects: [], initialized: true })
  })

  it('deletes the active project without restoring it and opens another project', () => {
    useEditorStore.getState().setProjectName('First')
    useProjectsStore.getState().saveCurrentProject()
    const firstId = useEditorStore.getState().project.id

    useProjectsStore.getState().createProject('Second')
    const deletedId = useEditorStore.getState().project.id

    useProjectsStore.getState().deleteProject(deletedId)

    const storedProjects = JSON.parse(localStorage.getItem('pd:project-list')!)
    expect(localStorage.getItem(`pd:project:${deletedId}`)).toBeNull()
    expect(storedProjects).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: deletedId })]))
    expect(localStorage.getItem('pd:active-project')).toBe(firstId)
    expect(useEditorStore.getState().project.id).toBe(firstId)
  })

  it('resets and persists a fresh default project when deleting the last project', () => {
    useProjectsStore.getState().saveCurrentProject()
    const deletedId = useEditorStore.getState().project.id

    useProjectsStore.getState().deleteProject(deletedId)

    const freshProject = useEditorStore.getState().project
    const storedProjects = JSON.parse(localStorage.getItem('pd:project-list')!)
    expect(freshProject.id).not.toBe(deletedId)
    expect(localStorage.getItem(`pd:project:${deletedId}`)).toBeNull()
    expect(localStorage.getItem(`pd:project:${freshProject.id}`)).not.toBeNull()
    expect(localStorage.getItem('pd:active-project')).toBe(freshProject.id)
    expect(storedProjects).toEqual([expect.objectContaining({ id: freshProject.id })])
  })

  it('deletes a non-active project without reloading the active editor project', () => {
    useEditorStore.getState().setProjectName('First')
    useProjectsStore.getState().saveCurrentProject()
    const deletedId = useEditorStore.getState().project.id
    useProjectsStore.getState().createProject('Second')
    const activeProject = useEditorStore.getState().project

    useProjectsStore.getState().deleteProject(deletedId)

    const storedProjects = JSON.parse(localStorage.getItem('pd:project-list')!)
    expect(localStorage.getItem(`pd:project:${deletedId}`)).toBeNull()
    expect(storedProjects).toEqual([expect.objectContaining({ id: activeProject.id })])
    expect(localStorage.getItem('pd:active-project')).toBe(activeProject.id)
    expect(useEditorStore.getState().project).toBe(activeProject)
  })

  it('uses the live editor project when the persisted active id is stale', () => {
    useEditorStore.getState().setProjectName('First')
    useProjectsStore.getState().saveCurrentProject()
    const deletedId = useEditorStore.getState().project.id

    useProjectsStore.getState().createProject('Second')
    const secondId = useEditorStore.getState().project.id
    const secondJson = localStorage.getItem(`pd:project:${secondId}`)!
    localStorage.setItem('pd:active-project', deletedId)
    useEditorStore.getState().importProject(secondJson)
    const activeProject = useEditorStore.getState().project

    useProjectsStore.getState().deleteProject(deletedId)

    expect(localStorage.getItem(`pd:project:${deletedId}`)).toBeNull()
    expect(useEditorStore.getState().project).toBe(activeProject)
    expect(useEditorStore.getState().project.id).toBe(secondId)
  })

  it('resets to a fresh project when the replacement project blob is missing', () => {
    useEditorStore.getState().setProjectName('First')
    useProjectsStore.getState().saveCurrentProject()
    const missingReplacementId = useEditorStore.getState().project.id

    useProjectsStore.getState().createProject('Second')
    const deletedId = useEditorStore.getState().project.id
    localStorage.removeItem(`pd:project:${missingReplacementId}`)

    useProjectsStore.getState().deleteProject(deletedId)

    const freshProject = useEditorStore.getState().project
    expect(freshProject.id).not.toBe(deletedId)
    expect(freshProject.id).not.toBe(missingReplacementId)
    expect(localStorage.getItem(`pd:project:${deletedId}`)).toBeNull()
    expect(localStorage.getItem(`pd:project:${freshProject.id}`)).not.toBeNull()
    expect(localStorage.getItem('pd:active-project')).toBe(freshProject.id)
  })
})
