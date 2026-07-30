import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PhoneLayer, Project } from '@/types'
import type { ProjectExportBundle } from '@/utils/projectAssets'
import { idbStorage } from './idb-storage'
import { ProjectConflictError, type ProjectStorageAdapter } from './storage/types'

const captureLock = vi.hoisted(() => ({ locked: false }))

vi.mock('@/utils/stageCapture', () => ({
  isCaptureLocked: () => captureLock.locked,
}))

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
vi.stubGlobal('alert', vi.fn())

const { abandonBootstrap, notifyProjectConflict, useProjectsStore } = await import('./projects')
const { useEditorStore } = await import('./index')
const { useAssetStore } = await import('./assets')

async function waitForAssetScope(id: string): Promise<void> {
  await expect.poll(() => useAssetStore.getState().activeProjectId).toBe(id)
}

describe('saveCurrentProject', () => {
  beforeEach(() => {
    localStorage.clear()
    useEditorStore.getState().resetProject()
    useProjectsStore.setState({ projects: [], initialized: true })
  })

  it('strips inline screenshot data while preserving asset paths', async () => {
    useEditorStore.getState().addPhone()
    const state = useEditorStore.getState()
    const group = state.project.slideGroups[0]
    const phone = group.layers.find((layer) => layer.type === 'phone') as PhoneLayer
    useEditorStore.getState().updateLayer(phone.id, {
      screenshotDataUrl: `data:image/png;base64,${'x'.repeat(100_000)}`,
      screenshotPath: 'screenshots/phone.png',
    })

    await useProjectsStore.getState().saveCurrentProject()

    const stored = JSON.parse(localStorage.getItem(`pd:project:${state.project.id}`)!)
    const storedPhone = stored.slideGroups[0].layers.find(
      (layer: PhoneLayer) => layer.type === 'phone',
    ) as PhoneLayer
    expect(storedPhone.screenshotDataUrl).toBeUndefined()
    expect(storedPhone.screenshotPath).toBe('screenshots/phone.png')
  })
})

describe('project autosave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    captureLock.locked = false
    localStorage.clear()
    useEditorStore.getState().resetProject()
    useProjectsStore.setState({ projects: [], initialized: true })
    vi.clearAllTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('retries a pending save after the capture lock clears', () => {
    const saveCurrentProject = vi.spyOn(useProjectsStore.getState(), 'saveCurrentProject')
    captureLock.locked = true

    useEditorStore.getState().setProjectName('Changed during capture')
    vi.advanceTimersByTime(1500)
    expect(saveCurrentProject).not.toHaveBeenCalled()

    captureLock.locked = false
    vi.advanceTimersByTime(250)
    expect(saveCurrentProject).toHaveBeenCalledTimes(1)

    saveCurrentProject.mockRestore()
  })
})

describe('deleteProject', () => {
  beforeEach(() => {
    localStorage.clear()
    useEditorStore.getState().resetProject()
    useProjectsStore.setState({ projects: [], initialized: true })
  })

  it('deletes the active project without restoring it and opens another project', async () => {
    useEditorStore.getState().setProjectName('First')
    await useProjectsStore.getState().saveCurrentProject()
    const firstId = useEditorStore.getState().project.id

    await useProjectsStore.getState().createProject('Second')
    const deletedId = useEditorStore.getState().project.id

    await useProjectsStore.getState().deleteProject(deletedId)

    const storedProjects = JSON.parse(localStorage.getItem('pd:project-list')!)
    expect(localStorage.getItem(`pd:project:${deletedId}`)).toBeNull()
    expect(storedProjects).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: deletedId })]))
    expect(localStorage.getItem('pd:active-project')).toBe(firstId)
    expect(useEditorStore.getState().project.id).toBe(firstId)
  })

  it('resets and persists a fresh default project when deleting the last project', async () => {
    await useProjectsStore.getState().saveCurrentProject()
    const deletedId = useEditorStore.getState().project.id

    await useProjectsStore.getState().deleteProject(deletedId)

    const freshProject = useEditorStore.getState().project
    const storedProjects = JSON.parse(localStorage.getItem('pd:project-list')!)
    expect(freshProject.id).not.toBe(deletedId)
    expect(localStorage.getItem(`pd:project:${deletedId}`)).toBeNull()
    expect(localStorage.getItem(`pd:project:${freshProject.id}`)).not.toBeNull()
    expect(localStorage.getItem('pd:active-project')).toBe(freshProject.id)
    expect(storedProjects).toEqual([expect.objectContaining({ id: freshProject.id })])
  })

  it('deletes a non-active project without reloading the active editor project', async () => {
    useEditorStore.getState().setProjectName('First')
    await useProjectsStore.getState().saveCurrentProject()
    const deletedId = useEditorStore.getState().project.id
    await useProjectsStore.getState().createProject('Second')
    const activeProject = useEditorStore.getState().project

    await useProjectsStore.getState().deleteProject(deletedId)

    const storedProjects = JSON.parse(localStorage.getItem('pd:project-list')!)
    expect(localStorage.getItem(`pd:project:${deletedId}`)).toBeNull()
    expect(storedProjects).toEqual([expect.objectContaining({ id: activeProject.id })])
    expect(localStorage.getItem('pd:active-project')).toBe(activeProject.id)
    expect(useEditorStore.getState().project).toBe(activeProject)
  })

  it('uses the live editor project when the persisted active id is stale', async () => {
    useEditorStore.getState().setProjectName('First')
    await useProjectsStore.getState().saveCurrentProject()
    const deletedId = useEditorStore.getState().project.id

    await useProjectsStore.getState().createProject('Second')
    const secondId = useEditorStore.getState().project.id
    const secondJson = localStorage.getItem(`pd:project:${secondId}`)!
    localStorage.setItem('pd:active-project', deletedId)
    useEditorStore.getState().importProject(secondJson)
    const activeProject = useEditorStore.getState().project

    await useProjectsStore.getState().deleteProject(deletedId)

    expect(localStorage.getItem(`pd:project:${deletedId}`)).toBeNull()
    expect(useEditorStore.getState().project).toBe(activeProject)
    expect(useEditorStore.getState().project.id).toBe(secondId)
  })

  it('resets to a fresh project when the replacement project blob is missing', async () => {
    useEditorStore.getState().setProjectName('First')
    await useProjectsStore.getState().saveCurrentProject()
    const missingReplacementId = useEditorStore.getState().project.id

    await useProjectsStore.getState().createProject('Second')
    const deletedId = useEditorStore.getState().project.id
    localStorage.removeItem(`pd:project:${missingReplacementId}`)

    await useProjectsStore.getState().deleteProject(deletedId)

    const freshProject = useEditorStore.getState().project
    expect(freshProject.id).not.toBe(deletedId)
    expect(freshProject.id).not.toBe(missingReplacementId)
    expect(localStorage.getItem(`pd:project:${deletedId}`)).toBeNull()
    expect(localStorage.getItem(`pd:project:${freshProject.id}`)).not.toBeNull()
    expect(localStorage.getItem('pd:active-project')).toBe(freshProject.id)
  })
})

describe('project asset lifecycle and bundles', () => {
  beforeEach(async () => {
    localStorage.clear()
    await useAssetStore.getState().setActiveProject(null)
    useAssetStore.setState({ activeProjectId: null, assets: {} })
    useEditorStore.getState().resetProject()
    useProjectsStore.setState({ projects: [], initialized: true })
    await useProjectsStore.getState().saveCurrentProject()
    await useAssetStore.getState().setActiveProject(useEditorStore.getState().project.id)
  })

  it('restores each project asset scope when switching projects', async () => {
    const firstId = useEditorStore.getState().project.id
    useAssetStore.getState().addAsset('shot.png', 'data:image/png;base64,first')
    useEditorStore.getState().addPhone()
    const phone = useEditorStore.getState().project.slideGroups[0].layers.find(
      (layer) => layer.type === 'phone',
    ) as PhoneLayer
    useEditorStore.getState().updateLayer(phone.id, { screenshotPath: 'shot.png' })

    await useProjectsStore.getState().createProject('Second')
    const secondId = useEditorStore.getState().project.id
    await waitForAssetScope(secondId)
    expect(useAssetStore.getState().assets).toEqual({})
    const exported = JSON.parse(
      await useProjectsStore.getState().exportProjectBundle(firstId),
    ) as ProjectExportBundle
    expect(exported.assets['shot.png']).toBe('data:image/png;base64,first')

    await useProjectsStore.getState().openProject(firstId)
    await waitForAssetScope(firstId)
    expect(useAssetStore.getState().getAsset('shot.png')).toBe('data:image/png;base64,first')
  })

  it('hydrates base and locale images from an imported project bundle', async () => {
    useEditorStore.getState().addPhone()
    const phone = useEditorStore.getState().project.slideGroups[0].layers.find(
      (layer) => layer.type === 'phone',
    ) as PhoneLayer
    useEditorStore.getState().updateLayer(phone.id, {
      screenshotPath: 'base.png',
      localeContent: { es: { screenshotPath: 'locale::es::phone.png' } },
    })
    const bundle = makeBundle(useEditorStore.getState().project, {
      'base.png': 'data:image/png;base64,base',
      'locale::es::phone.png': 'data:image/png;base64,locale',
    })

    const result = await useProjectsStore.getState().importProjectFromJson(JSON.stringify(bundle))

    expect(result.missing).toEqual([])
    expect(useAssetStore.getState().getAsset('base.png')).toBe('data:image/png;base64,base')
    expect(useAssetStore.getState().getAsset('locale::es::phone.png'))
      .toBe('data:image/png;base64,locale')
  })

  it('assigns a fresh id when importing instead of clobbering an existing project', async () => {
    const original = useEditorStore.getState().project
    const originalId = original.id

    await useProjectsStore.getState().importProjectFromJson(
      JSON.stringify(makeBundle(original, {})),
    )

    const importedId = useEditorStore.getState().project.id
    expect(importedId).not.toBe(originalId)
    expect(localStorage.getItem(`pd:project:${originalId}`)).not.toBeNull()
    expect(localStorage.getItem(`pd:project:${importedId}`)).not.toBeNull()
    expect(useProjectsStore.getState().projects.map((project) => project.id))
      .toEqual(expect.arrayContaining([originalId, importedId]))
  })

  it('garbage-collects only the deleted project assets', async () => {
    const firstId = useEditorStore.getState().project.id
    await useAssetStore.getState().hydrateProject(firstId, {
      'shot.png': 'data:image/png;base64,first',
    })
    await useProjectsStore.getState().createProject('Second')
    const secondId = useEditorStore.getState().project.id
    await waitForAssetScope(secondId)
    await useAssetStore.getState().hydrateProject(secondId, {
      'shot.png': 'data:image/png;base64,second',
    })

    await useProjectsStore.getState().deleteProject(firstId)

    await expect.poll(async () => useAssetStore.getState().loadProjectAssets(firstId))
      .toEqual({})
    expect((await useAssetStore.getState().loadProjectAssets(secondId))['shot.png']?.dataUrl)
      .toBe('data:image/png;base64,second')
  })

  it('garbage-collects thumbnails for the deleted project', async () => {
    const firstId = useEditorStore.getState().project.id
    await idbStorage.setItem(`pixeldeck-thumbs:${firstId}`, JSON.stringify({ stale: true }))
    await useProjectsStore.getState().createProject('Second')
    const secondId = useEditorStore.getState().project.id
    await idbStorage.setItem(`pixeldeck-thumbs:${secondId}`, JSON.stringify({ current: true }))

    await useProjectsStore.getState().deleteProject(firstId)

    await expect.poll(async () => idbStorage.getItem(`pixeldeck-thumbs:${firstId}`)).toBeNull()
    expect(await idbStorage.getItem(`pixeldeck-thumbs:${secondId}`)).toBe(JSON.stringify({ current: true }))
  })

  it('reports missing referenced assets without aborting import', async () => {
    useEditorStore.getState().addPhone()
    const project = useEditorStore.getState().project
    const phone = project.slideGroups[0].layers.find(
      (layer) => layer.type === 'phone',
    ) as PhoneLayer
    useEditorStore.getState().updateLayer(phone.id, { screenshotPath: 'missing.png' })
    const json = JSON.stringify(makeBundle(useEditorStore.getState().project, {}))

    const { missing } = await useProjectsStore.getState().importProjectFromJson(json)

    expect(missing).toEqual(['missing.png'])
    expect(useEditorStore.getState().project.id).toBeDefined()
  })
})

describe('async project save chain', () => {
  const originalWindow = globalThis.window

  beforeEach(() => {
    useEditorStore.getState().resetProject()
    useProjectsStore.setState({ projects: [], initialized: true })
  })

  afterEach(() => {
    Object.assign(globalThis, { window: originalWindow })
  })

  function useAdapter(adapter: ProjectStorageAdapter): void {
    const events = new EventTarget()
    Object.assign(globalThis, {
      window: {
        __PIXELDECK_CONFIG__: { projectStorage: adapter },
        setTimeout: globalThis.setTimeout.bind(globalThis),
        addEventListener: events.addEventListener.bind(events),
        removeEventListener: events.removeEventListener.bind(events),
        dispatchEvent: events.dispatchEvent.bind(events),
        location: { reload: vi.fn() },
      },
    })
  }

  it('flushes the current payload directly on pagehide', async () => {
    const saveProject = vi.fn(async () => {})
    useAdapter({
      listProjects: async () => [], loadProject: async () => null, saveProject,
      deleteProject: async () => {}, renameProject: async () => {}, getActiveProjectId: async () => null, setActiveProjectId: async () => {},
    })
    await useProjectsStore.getState().saveCurrentProject()
    saveProject.mockClear()
    window.dispatchEvent(new Event('pagehide'))
    expect(saveProject).toHaveBeenCalledWith(
      expect.objectContaining({ id: useEditorStore.getState().project.id }),
      expect.any(String),
    )
  })

  it('shows a conflict notice and can persist the active project as a copy', async () => {
    const oldId = useEditorStore.getState().project.id
    await useAssetStore.getState().setActiveProject(oldId)
    await useAssetStore.getState().hydrateProject(oldId, {
      'shot.png': 'data:image/png;base64,copy-me',
    })
    const saveProject = vi.fn(async (meta: { id: string }) => {
      if (meta.id === oldId) throw new ProjectConflictError(oldId)
    })
    useAdapter({
      listProjects: async () => [], loadProject: async () => null, saveProject,
      deleteProject: async () => {}, renameProject: async () => {}, getActiveProjectId: async () => null, setActiveProjectId: async () => {},
    })
    await expect(useProjectsStore.getState().saveCurrentProject()).rejects.toBeInstanceOf(ProjectConflictError)
    expect(useProjectsStore.getState().conflictNotice).toEqual({ projectId: oldId })
    await useProjectsStore.getState().saveConflictedProjectAsCopy()
    const copyId = useEditorStore.getState().project.id
    expect(copyId).not.toBe(oldId)
    expect(useEditorStore.getState().project.name).toMatch(/\(copy\)$/)
    expect(useProjectsStore.getState().conflictNotice).toBeNull()
    expect(useAssetStore.getState().getAsset('shot.png')).toBe('data:image/png;base64,copy-me')
    expect((await useAssetStore.getState().loadProjectAssets(copyId))['shot.png']?.dataUrl)
      .toBe('data:image/png;base64,copy-me')
  })

  it('reloads the page when dismissing a conflict notice', () => {
    useAdapter({
      listProjects: async () => [], loadProject: async () => null, saveProject: async () => {},
      deleteProject: async () => {}, renameProject: async () => {}, getActiveProjectId: async () => null, setActiveProjectId: async () => {},
    })
    useProjectsStore.getState().dismissConflictAndReload()
    expect(window.location.reload).toHaveBeenCalledOnce()
  })

  it('clears a conflict notice without reloading, as used by the dialog Escape and backdrop handlers', () => {
    useAdapter({
      listProjects: async () => [], loadProject: async () => null, saveProject: async () => {},
      deleteProject: async () => {}, renameProject: async () => {}, getActiveProjectId: async () => null, setActiveProjectId: async () => {},
    })
    useProjectsStore.setState({ conflictNotice: { projectId: useEditorStore.getState().project.id } })

    useProjectsStore.setState({ conflictNotice: null })

    expect(useProjectsStore.getState().conflictNotice).toBeNull()
    expect(window.location.reload).not.toHaveBeenCalled()
  })

  it('serializes saves and continues after a rejected save', async () => {
    let active = 0
    let calls = 0
    const adapter: ProjectStorageAdapter = {
      listProjects: async () => [], loadProject: async () => null, deleteProject: async () => {},
      renameProject: async () => {}, getActiveProjectId: async () => null, setActiveProjectId: async () => {},
      saveProject: async () => {
        active += 1
        expect(active).toBe(1)
        calls += 1
        await Promise.resolve()
        active -= 1
        if (calls === 1) throw new Error('temporary failure')
      },
    }
    useAdapter(adapter)
    const first = useProjectsStore.getState().saveCurrentProject()
    const second = useProjectsStore.getState().saveCurrentProject()
    await expect(first).rejects.toThrow('temporary failure')
    await expect(second).resolves.toBeUndefined()
    expect(calls).toBe(2)
  })

  it('queues rename after an in-flight save', async () => {
    const order: string[] = []
    let release!: () => void
    const pending = new Promise<void>((resolve) => { release = resolve })
    useAdapter({
      listProjects: async () => [], loadProject: async () => null,
      saveProject: async () => { order.push('save'); await pending },
      renameProject: async () => { order.push('rename') },
      deleteProject: async () => {}, getActiveProjectId: async () => null, setActiveProjectId: async () => {},
    })
    const saving = useProjectsStore.getState().saveCurrentProject()
    const renaming = useProjectsStore.getState().renameProject(useEditorStore.getState().project.id, 'Queued rename')
    await Promise.resolve()
    expect(order).toEqual(['save'])
    release()
    await Promise.all([saving, renaming])
    expect(order).toEqual(['save', 'rename'])
  })

  it('flushes the outgoing project before loading a replacement', async () => {
    const outgoingId = useEditorStore.getState().project.id
    const replacement = { ...useEditorStore.getState().project, id: 'replacement', name: 'Replacement' }
    let release!: () => void
    const saved = new Promise<void>((resolve) => { release = resolve })
    const order: string[] = []
    const adapter: ProjectStorageAdapter = {
      listProjects: async () => [{ id: 'replacement', name: 'Replacement', createdAt: '', updatedAt: '' }],
      loadProject: async () => { await saved; order.push('load'); return JSON.stringify(replacement) },
      saveProject: async (meta) => { if (meta.id === outgoingId) { order.push('save'); await saved } },
      deleteProject: async () => {}, renameProject: async () => {}, getActiveProjectId: async () => null, setActiveProjectId: async () => {},
    }
    useAdapter(adapter)
    useProjectsStore.setState({ projects: [{ id: 'replacement', name: 'Replacement', createdAt: '', updatedAt: '' }] })
    const opening = useProjectsStore.getState().openProject('replacement')
    await Promise.resolve()
    expect(order).toEqual(['save'])
    release()
    await opening
    expect(order).toEqual(['save', 'load'])
  })

  it('halts autosave retries after a conflict', async () => {
    vi.useFakeTimers()
    let saves = 0
    useAdapter({
      listProjects: async () => [], loadProject: async () => null,
      saveProject: async () => { saves += 1; throw new ProjectConflictError(useEditorStore.getState().project.id) },
      deleteProject: async () => {}, renameProject: async () => {}, getActiveProjectId: async () => null, setActiveProjectId: async () => {},
    })
    useEditorStore.getState().setProjectName('conflicted')
    await vi.advanceTimersByTimeAsync(1500)
    await vi.advanceTimersByTimeAsync(5000)
    expect(saves).toBe(1)
    vi.useRealTimers()
  })

  it('gates only an abandoned bootstrap load and still opens the project normally afterward', async () => {
    let releaseLoad!: () => void
    let signalLoadStarted!: () => void
    const loadStarted = new Promise<void>((resolve) => { signalLoadStarted = resolve })
    const delayedLoad = new Promise<void>((resolve) => { releaseLoad = resolve })
    const current = useEditorStore.getState().project
    const importProject = vi.spyOn(useEditorStore.getState(), 'importProject')
    let loadCalls = 0
    useAdapter({
      listProjects: async () => [{ id: 'saved', name: 'Saved', createdAt: '', updatedAt: '' }],
      getActiveProjectId: async () => 'saved',
      loadProject: async () => {
        loadCalls += 1
        if (loadCalls === 1) {
          signalLoadStarted()
          await delayedLoad
        }
        return JSON.stringify({ ...current, id: 'saved' })
      },
      saveProject: async () => {}, deleteProject: async () => {}, renameProject: async () => {}, setActiveProjectId: async () => {},
    })
    useProjectsStore.setState({ initialized: false, projects: [] })
    const initializing = useProjectsStore.getState().initialize()
    await loadStarted
    abandonBootstrap()
    releaseLoad()
    await initializing
    expect(importProject).not.toHaveBeenCalled()
    expect(useProjectsStore.getState().initialized).toBe(true)

    await useProjectsStore.getState().openProject('saved')
    expect(importProject).toHaveBeenCalledOnce()
    importProject.mockRestore()
  })

  it('clears a prior conflict when the project is successfully reloaded', async () => {
    vi.useFakeTimers()
    const id = useEditorStore.getState().project.id
    const replacement = { ...useEditorStore.getState().project, id, name: 'Reloaded' }
    const saveProject = vi.fn(async () => {})
    useAdapter({
      listProjects: async () => [{ id, name: 'Reloaded', createdAt: '', updatedAt: '' }],
      loadProject: async () => JSON.stringify(replacement),
      saveProject, deleteProject: async () => {}, renameProject: async () => {}, getActiveProjectId: async () => null, setActiveProjectId: async () => {},
    })
    useProjectsStore.setState({ projects: [{ id, name: 'Reloaded', createdAt: '', updatedAt: '' }] })
    notifyProjectConflict(id)

    await useProjectsStore.getState().openProject(id)
    useEditorStore.getState().setProjectName('Autosave resumed')
    await vi.advanceTimersByTimeAsync(1500)

    expect(saveProject).toHaveBeenCalledTimes(2)
    expect(useProjectsStore.getState().conflictNotice).toEqual({ projectId: id })
    vi.useRealTimers()
  })
})

function makeBundle(project: Project, assets: Record<string, string>): ProjectExportBundle {
  return { kind: 'project-export', schemaVersion: 1, project, assets }
}
