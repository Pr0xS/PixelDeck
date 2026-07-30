import { beforeEach, describe, expect, it, vi } from 'vitest'
import { localStorageAdapter } from './localStorageAdapter'
import { ProjectConflictError } from './types'

const storage = vi.hoisted(() => {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
    clear: () => values.clear(),
  }
})

Object.assign(globalThis, { localStorage: storage })
if (typeof window === 'undefined') Object.assign(globalThis, { window: new EventTarget() })

const meta = (id: string, name = id) => ({ id, name, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' })

describe('localStorageAdapter', () => {
  beforeEach(() => storage.clear())

  it('upserts one project without overwriting other list entries', async () => {
    await localStorageAdapter.saveProject(meta('one'), '{"one":1}')
    await localStorageAdapter.saveProject(meta('two'), '{"two":2}')
    await localStorageAdapter.saveProject(meta('one', 'renamed'), '{"one":3}')
    expect(JSON.parse(localStorage.getItem('pd:project-list')!)).toEqual([
      expect.objectContaining({ id: 'one', name: 'renamed' }),
      expect.objectContaining({ id: 'two' }),
    ])
  })

  it('rejects a stale observed etag and an unobserved existing project', async () => {
    await localStorageAdapter.saveProject(meta('stale'), '{}')
    await localStorageAdapter.loadProject('stale')
    localStorage.setItem('pd:project-etag:stale', 'external')
    await expect(localStorageAdapter.saveProject(meta('stale'), '{}')).rejects.toBeInstanceOf(ProjectConflictError)
    localStorage.setItem('pd:project:unknown', '{}')
    await expect(localStorageAdapter.saveProject(meta('unknown'), '{}')).rejects.toBeInstanceOf(ProjectConflictError)
  })

  it('allows rename and delete without observing an etag', async () => {
    localStorage.setItem('pd:project:legacy', '{}')
    localStorage.setItem('pd:project-list', JSON.stringify([meta('legacy')]))
    await expect(localStorageAdapter.renameProject('legacy', 'Renamed')).resolves.toBeUndefined()
    await expect(localStorageAdapter.deleteProject('legacy')).resolves.toBeUndefined()
    expect(localStorage.getItem('pd:project:legacy')).toBeNull()
  })

  it('invalidates an observed etag after an external storage event', async () => {
    await localStorageAdapter.saveProject(meta('event'), '{}')
    await localStorageAdapter.loadProject('event')
    const event = Object.assign(new Event('storage'), {
      key: 'pd:project:event', oldValue: '{}', newValue: '{"external":true}', storageArea: localStorage,
    })
    window.dispatchEvent(event)
    localStorage.setItem('pd:project:event', '{"external":true}')
    await expect(localStorageAdapter.saveProject(meta('event'), '{}')).rejects.toBeInstanceOf(ProjectConflictError)
  })

  it('returns an empty list for corrupt list JSON', async () => {
    localStorage.setItem('pd:project-list', '{bad')
    await expect(localStorageAdapter.listProjects()).resolves.toEqual([])
  })
})
