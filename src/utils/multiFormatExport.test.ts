import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Konva from 'konva'
vi.mock('./export', () => ({ exportGroupImages: vi.fn() }))
vi.mock('./stageCapture', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./stageCapture')>()
  return { ...mod, waitForStageCaptureReady: vi.fn().mockResolvedValue(undefined) }
})
import { exportProjectImages } from './multiFormatExport'
import { exportGroupImages } from './export'
import { useEditorStore } from '@/store'

const stage = {} as unknown as Konva.Stage

beforeEach(() => {
  useEditorStore.getState().resetProject()
  vi.mocked(exportGroupImages).mockReset()
})

function mockSingleImage(name = 'slide', dataUrl = 'data') {
  vi.mocked(exportGroupImages).mockResolvedValue([{ name, dataUrl }])
}

function setupTwoGroups() {
  const store = useEditorStore.getState()
  const firstGroupId = store.activeSlideGroupId
  store.addSlideGroup()
  const secondGroupId = useEditorStore.getState().activeSlideGroupId
  return { firstGroupId, secondGroupId }
}

describe('exportProjectImages', () => {
  it('deduplicates colliding image names without losing data urls', async () => {
    vi.mocked(exportGroupImages).mockResolvedValue([
      { name: 'slide', dataUrl: 'd1' },
      { name: 'slide', dataUrl: 'd2' },
    ])

    const results = await exportProjectImages(stage, {
      formatIds: ['base'],
      locales: ['en'],
      scope: 'current-group',
    })

    expect(results).toHaveLength(2)
    expect(new Set(results.map((result) => result.relativePath)).size).toBe(2)
    expect(results[1].relativePath).toMatch(/-2$/)
    expect(results.map((result) => result.dataUrl).sort()).toEqual(['d1', 'd2'])
  })

  it('sanitizes group-name path segments and uses untitled for empty names', async () => {
    const store = useEditorStore.getState()
    const activeGroupId = store.activeSlideGroupId
    store.updateSlideGroup(activeGroupId, { name: 'My Hero/Group' })
    mockSingleImage('Other')

    const namedResults = await exportProjectImages(stage, {
      formatIds: ['base'],
      locales: ['en'],
      scope: 'project',
    })

    expect(namedResults[0].relativePath).toContain('My-Hero-Group__Other')
    expect(namedResults[0].relativePath).not.toContain('My Hero/Group')

    useEditorStore.getState().updateSlideGroup(activeGroupId, { name: '' })
    mockSingleImage('Other')
    const emptyResults = await exportProjectImages(stage, {
      formatIds: ['base'],
      locales: ['en'],
      scope: 'project',
    })

    expect(emptyResults[0].relativePath).toContain('untitled__Other')
  })

  it("exports only the active group for scope 'current-group'", async () => {
    const { secondGroupId } = setupTwoGroups()
    mockSingleImage()

    const results = await exportProjectImages(stage, {
      formatIds: ['base'],
      locales: ['en'],
      scope: 'current-group',
    })

    expect(new Set(results.map((result) => result.groupId))).toEqual(new Set([secondGroupId]))
  })

  it("exports all groups for scope 'project'", async () => {
    const { firstGroupId, secondGroupId } = setupTwoGroups()
    mockSingleImage()

    const results = await exportProjectImages(stage, {
      formatIds: ['base'],
      locales: ['en'],
      scope: 'project',
    })

    expect(new Set(results.map((result) => result.groupId))).toEqual(new Set([firstGroupId, secondGroupId]))
  })

  it('prefixes project-scope result names when image slug differs from group slug', async () => {
    const store = useEditorStore.getState()
    store.updateSlideGroup(store.activeSlideGroupId, { name: 'Group Name' })
    mockSingleImage('Image Name')

    const results = await exportProjectImages(stage, {
      formatIds: ['base'],
      locales: ['en'],
      scope: 'project',
    })

    expect(results[0].name).toBe('Group-Name__Image-Name')
  })

  it("forces pano compensation off for panoMode 'whole'", async () => {
    mockSingleImage()

    await exportProjectImages(stage, {
      formatIds: ['base'],
      locales: ['en'],
      scope: 'current-group',
      panoMode: 'whole',
      panoCompensate: true,
      panoCompensationPx: 24,
    })

    expect(vi.mocked(exportGroupImages).mock.calls[0][3]).toBe(0)
  })

  it("respects pano compensation for panoMode 'split'", async () => {
    mockSingleImage()

    await exportProjectImages(stage, {
      formatIds: ['base'],
      locales: ['en'],
      scope: 'current-group',
      panoMode: 'split',
      panoCompensate: true,
      panoCompensationPx: 24,
    })

    expect(vi.mocked(exportGroupImages).mock.calls[0][3]).toBe(24)
  })

  it('restores global export state in finally', async () => {
    const store = useEditorStore.getState()
    store.setActiveLocale('es')
    store.setActiveCanvasFormat('android-phone')
    const originalGroupId = store.activeSlideGroupId
    mockSingleImage()

    await exportProjectImages(stage, {
      formatIds: ['base'],
      locales: ['en'],
      scope: 'current-group',
      panoMode: 'split',
      panoCompensate: true,
      panoCompensationPx: 24,
    })

    const restored = useEditorStore.getState()
    expect(restored.activeLocale).toBe('es')
    expect(restored.activeCanvasFormat).toBe('android-phone')
    expect(restored.activeSlideGroupId).toBe(originalGroupId)
    expect(restored.panoRenderOverride).toBeNull()
  })
})
