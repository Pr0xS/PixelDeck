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
