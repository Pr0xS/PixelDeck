import { beforeEach, describe, expect, it } from 'vitest'
import type { PhoneLayer, Project } from '@/types'
import type { ProjectExportBundle } from '@/utils/projectAssets'

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

describe('project asset lifecycle and bundles', () => {
  beforeEach(async () => {
    localStorage.clear()
    await useAssetStore.getState().setActiveProject(null)
    useAssetStore.setState({ activeProjectId: null, assets: {} })
    useEditorStore.getState().resetProject()
    useProjectsStore.setState({ projects: [], initialized: true })
    useProjectsStore.getState().saveCurrentProject()
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

    useProjectsStore.getState().createProject('Second')
    const secondId = useEditorStore.getState().project.id
    await waitForAssetScope(secondId)
    expect(useAssetStore.getState().assets).toEqual({})
    const exported = JSON.parse(
      await useProjectsStore.getState().exportProjectBundle(firstId),
    ) as ProjectExportBundle
    expect(exported.assets['shot.png']).toBe('data:image/png;base64,first')

    useProjectsStore.getState().openProject(firstId)
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
      localeOverrides: { es: { screenshotPath: 'locale::es::phone.png' } },
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
    useProjectsStore.getState().createProject('Second')
    const secondId = useEditorStore.getState().project.id
    await waitForAssetScope(secondId)
    await useAssetStore.getState().hydrateProject(secondId, {
      'shot.png': 'data:image/png;base64,second',
    })

    useProjectsStore.getState().deleteProject(firstId)

    await expect.poll(async () => useAssetStore.getState().loadProjectAssets(firstId))
      .toEqual({})
    expect((await useAssetStore.getState().loadProjectAssets(secondId))['shot.png']?.dataUrl)
      .toBe('data:image/png;base64,second')
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

function makeBundle(project: Project, assets: Record<string, string>): ProjectExportBundle {
  return { kind: 'project-export', schemaVersion: 1, project, assets }
}
