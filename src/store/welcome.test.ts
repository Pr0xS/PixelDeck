import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const LIST_KEY = 'pd:project-list'
const KEY = 'img_aaaaaaaaaaaaaaaaaaaaaaaa.webp'

let storage = new Map<string, string>()

const welcomeTemplate = {
  id: 'welcome', kind: 'template', schemaVersion: 1, name: 'Welcome', description: '',
  assetManifest: { [KEY]: { name: 'home.webp', mime: 'image/webp' } },
  slideGroups: [{
    name: 'Intro', numSlides: 1, slideWidth: 1290, slideHeight: 2796, slideNames: ['intro'],
    layers: [{
      id: 'p', name: 'Phone', type: 'phone', x: 0, y: 0, rotation: 0, opacity: 1,
      visible: true, locked: false, model: 'iphone-16-pro', scale: 1,
      screenshotPath: KEY, screenshotFit: 'cover', screenshotOffsetX: 0, screenshotOffsetY: 0,
    }],
  }],
}

function welcomeFetch() {
  return vi.fn(async (url: string) => {
    if (url.endsWith('templates/index.json')) {
      return {
        ok: true, status: 200,
        json: async () => ({ templates: [
          { slug: 'x', name: 'X', description: '', file: '/templates/x.template.json' },
          { slug: 'welcome', name: 'Welcome', description: '', tour: true, file: '/templates/welcome.template.json' },
        ] }),
      }
    }
    if (url.endsWith('welcome.template.json')) return { ok: true, status: 200, json: async () => welcomeTemplate }
    if (url.endsWith(KEY)) return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }
    return { ok: false, status: 404 }
  })
}

beforeEach(() => {
  storage = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.resetModules()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function load() {
  const projects = await import('./projects')
  const { useEditorStore } = await import('./index')
  const { useAssetStore } = await import('./assets')
  return { ...projects, useEditorStore, useAssetStore }
}

describe('first-run Welcome project', () => {
  it('creates the Welcome project as the only, active project with its assets in its own scope', async () => {
    vi.stubGlobal('fetch', welcomeFetch())
    const { bootstrapProjects, useProjectsStore, useEditorStore, useAssetStore } = await load()
    const blankId = useEditorStore.getState().project.id
    await bootstrapProjects()

    const project = useEditorStore.getState().project
    expect(project.name).toBe('Welcome')
    expect(project.id).not.toBe(blankId)
    const list = useProjectsStore.getState().projects
    expect(list.map((p) => p.id)).toEqual([project.id])
    expect(JSON.parse(storage.get(LIST_KEY)!)).toHaveLength(1)
    expect(storage.get('pd:active-project')).toBe(project.id)
    expect(storage.has(`pd:project:${blankId}`)).toBe(false)

    expect(useAssetStore.getState().activeProjectId).toBe(project.id)
    expect(useAssetStore.getState().assets[KEY]?.dataUrl).toBe('data:image/webp;base64,AQID')
    expect(project.assetManifest?.[KEY]?.name).toBe('home.webp')
    await useAssetStore.getState().flushAssets()
    expect((await useAssetStore.getState().loadProjectAssets(project.id))[KEY]).toBeDefined()
  })

  it('falls back to the blank project when the index 404s', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })))
    const { bootstrapProjects, useProjectsStore, useEditorStore } = await load()
    const blankId = useEditorStore.getState().project.id
    await bootstrapProjects()
    expect(useEditorStore.getState().project.id).toBe(blankId)
    expect(useProjectsStore.getState().projects.map((p) => p.id)).toEqual([blankId])
    expect(storage.has(`pd:project:${blankId}`)).toBe(true)
  })

  it('falls back to the blank project when the index has no tour entry', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({ templates: [{ slug: 'x', name: 'X', description: '', file: 'x' }] }),
    })))
    const { bootstrapProjects, useEditorStore } = await load()
    const blankId = useEditorStore.getState().project.id
    await bootstrapProjects()
    expect(useEditorStore.getState().project.id).toBe(blankId)
    expect(storage.has(`pd:project:${blankId}`)).toBe(true)
  })

  it('falls back after the timeout when fetch never resolves', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const { bootstrapProjects, useProjectsStore, useEditorStore } = await load()
    const blankId = useEditorStore.getState().project.id
    let finished = false
    const done = bootstrapProjects().then(() => { finished = true })
    // The deadline timer is only registered after a few async storage steps: keep ticking.
    for (let i = 0; i < 20 && !finished; i++) await vi.advanceTimersByTimeAsync(1000)
    await done
    expect(useEditorStore.getState().project.id).toBe(blankId)
    expect(useProjectsStore.getState().initialized).toBe(true)
    expect(storage.has(`pd:project:${blankId}`)).toBe(true)
  })

  it('skips the Welcome fetch entirely when bootstrap was already abandoned before it started', async () => {
    const f = welcomeFetch()
    vi.stubGlobal('fetch', f)
    const { bootstrapProjects, abandonBootstrap, useEditorStore } = await load()
    const blankId = useEditorStore.getState().project.id
    const done = bootstrapProjects()
    abandonBootstrap() // synchronous: lands before the library read even resolves
    await done
    expect(f).not.toHaveBeenCalled()
    expect(useEditorStore.getState().project.id).toBe(blankId)
  })

  it('abandon DURING the import: stays on the blank project, saves it, leaves no Welcome or orphan scope', async () => {
    vi.stubGlobal('fetch', welcomeFetch())
    const { bootstrapProjects, abandonBootstrap, useProjectsStore, useEditorStore, useAssetStore } = await load()
    const blankId = useEditorStore.getState().project.id
    const scopes = new Set<string>()
    useAssetStore.subscribe((st) => { if (st.activeProjectId) scopes.add(st.activeProjectId) })

    const original = useAssetStore.getState().setActiveProject
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    let held = false
    useAssetStore.setState({
      setActiveProject: async (id) => {
        if (id && id !== blankId && !held) { held = true; await gate }
        return original(id)
      },
    })

    const done = bootstrapProjects()
    await vi.waitFor(() => expect(held).toBe(true))
    abandonBootstrap() // the 8 s timer firing while the first scope switch is in flight
    release()
    await done

    expect(useEditorStore.getState().project.id).toBe(blankId)
    expect(useProjectsStore.getState().projects.map((p) => p.id)).toEqual([blankId])
    expect(JSON.parse(storage.get(LIST_KEY)!).map((p: { id: string }) => p.id)).toEqual([blankId])
    expect([...storage.keys()].filter((k) => k.startsWith('pd:project:'))).toEqual([`pd:project:${blankId}`])
    expect(useAssetStore.getState().activeProjectId).toBe(blankId)
    for (const id of scopes) {
      if (id !== blankId) expect(await useAssetStore.getState().loadProjectAssets(id)).toEqual({})
    }
  })

  it('does not fetch when the library has projects that all fail to load', async () => {
    const f = welcomeFetch()
    vi.stubGlobal('fetch', f)
    storage.set(LIST_KEY, JSON.stringify([{ id: 'ghost', name: 'Ghost', createdAt: 'x', updatedAt: 'x' }]))
    storage.set('pd:active-project', 'ghost') // no pd:project:ghost body
    const { bootstrapProjects, useProjectsStore } = await load()
    await bootstrapProjects()
    expect(f).not.toHaveBeenCalled()
    expect(useProjectsStore.getState().initialized).toBe(true)
  })

  it('does not fetch when reading the library throws', async () => {
    const f = welcomeFetch()
    vi.stubGlobal('fetch', f)
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('storage unavailable') },
      setItem: () => {},
      removeItem: () => {},
    })
    const { bootstrapProjects, useProjectsStore } = await load()
    await bootstrapProjects()
    expect(f).not.toHaveBeenCalled()
    expect(useProjectsStore.getState().initialized).toBe(true)
  })

  it('a save that throws after the swap keeps Welcome open and does not crash', async () => {
    vi.stubGlobal('fetch', welcomeFetch())
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (key.startsWith('pd:project:') && value.includes('"name":"Welcome"')) throw new Error('quota')
        storage.set(key, value)
      },
      removeItem: (key: string) => storage.delete(key),
    })
    const { bootstrapProjects, useProjectsStore, useEditorStore, useAssetStore } = await load()
    const blankId = useEditorStore.getState().project.id
    await expect(bootstrapProjects()).resolves.toBeUndefined()

    const project = useEditorStore.getState().project
    expect(project.name).toBe('Welcome')
    expect(project.id).not.toBe(blankId)
    expect(useProjectsStore.getState().initialized).toBe(true)
    // The blank project never enters the library, and the editor is not swapped back.
    expect(useProjectsStore.getState().projects.map((p) => p.id)).not.toContain(blankId)
    expect([...storage.keys()]).not.toContain(`pd:project:${blankId}`)
    expect(useAssetStore.getState().activeProjectId).toBe(project.id)
    expect(useAssetStore.getState().assets[KEY]).toBeDefined()
  })

  it('skips Welcome when legacy un-scoped assets exist (it must not be the first scope activation)', async () => {
    const f = welcomeFetch()
    vi.stubGlobal('fetch', f)
    vi.stubGlobal('indexedDB', {})
    const kv = new Map<string, string>([['pixeldeck-assets', '{}']])
    vi.doMock('./idb-storage', () => ({
      idbStorage: {
        getItem: async (k: string) => kv.get(k) ?? null,
        setItem: async (k: string, v: string) => { kv.set(k, v) },
        removeItem: async (k: string) => { kv.delete(k) },
      },
      warnStorageFailure: () => {},
      requestPersistentStorage: () => {},
    }))
    try {
      const { bootstrapProjects, useEditorStore } = await load()
      const blankId = useEditorStore.getState().project.id
      await bootstrapProjects()
      expect(f).not.toHaveBeenCalled()
      expect(useEditorStore.getState().project.id).toBe(blankId)
    } finally {
      vi.doUnmock('./idb-storage')
    }
  })
})

describe('createProjectFromTemplate', () => {
  it('throws and restores the previous asset scope when its scope switch was superseded', async () => {
    const { useProjectsStore, useEditorStore, useAssetStore } = await load()
    const blankId = useEditorStore.getState().project.id
    await useAssetStore.getState().setActiveProject(blankId)
    const original = useAssetStore.getState().setActiveProject
    useAssetStore.setState({
      // A newer switch superseded ours: the real action returns silently without activating.
      setActiveProject: async (id) => { if (id && id !== blankId) return; return original(id) },
    })
    await expect(
      useProjectsStore.getState().createProjectFromTemplate(welcomeTemplate as never, []),
    ).rejects.toThrow('superseded')
    expect(useEditorStore.getState().project.id).toBe(blankId)
    expect(useAssetStore.getState().activeProjectId).toBe(blankId)
  })
})
