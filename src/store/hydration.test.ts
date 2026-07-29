import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { newProject } from './helpers'

const PROJECT_STORAGE_KEY = 'pixeldeck-project'

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

describe('project hydration', () => {
  it('derives activeFamily from the restored active slide group', async () => {
    const project = newProject()
    const phone = project.slideGroups[0]!
    const tablet = { ...phone, id: 'hydrated-tablet', formats: ['ipad-13' as const] }
    storage.set(PROJECT_STORAGE_KEY, JSON.stringify({
      project: { ...project, slideGroups: [{ ...phone, formats: ['iphone-69' as const] }, tablet] },
      activeSlideGroupId: tablet.id,
    }))

    vi.resetModules()
    const { useEditorStore } = await import('./index')

    expect(useEditorStore.getState().activeSlideGroupId).toBe(tablet.id)
    expect(useEditorStore.getState().activeFamily).toBe('tablet')
  })
})
