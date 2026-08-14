import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Konva from 'konva'
vi.mock('./export', () => ({ exportGroupImages: vi.fn() }))
vi.mock('./stageCapture', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./stageCapture')>()
  return { ...mod, waitForStageCaptureReady: vi.fn().mockResolvedValue(undefined) }
})
import { ExportCancelledError, exportProjectImages } from './multiFormatExport'
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

  it('reports image-level progress with batch metadata and restores state', async () => {
    const store = useEditorStore.getState()
    store.setActiveLocale('es')
    store.setActiveCanvasFormat('android-phone')
    const originalGroupId = store.activeSlideGroupId
    store.updateSlideGroup(originalGroupId, { name: 'Hero', numSlides: 2, slideNames: ['one', 'two'] })
    vi.mocked(exportGroupImages).mockImplementation(async (_stage, group, _mode, _gap, onImageCaptured) => {
      onImageCaptured?.(1, group.numSlides)
      onImageCaptured?.(2, group.numSlides)
      return [{ name: 'one', dataUrl: 'd1' }, { name: 'two', dataUrl: 'd2' }]
    })
    const onProgress = vi.fn()

    await exportProjectImages(stage, {
      formatIds: ['base'],
      locales: ['en', 'fr'],
      scope: 'current-group',
      onProgress,
    })

    expect(onProgress).toHaveBeenNthCalledWith(1, expect.objectContaining({
      completed: 1, total: 4, formatId: 'base', formatLabel: 'Base', locale: 'en', groupName: 'Hero', phase: 'rendering',
    }))
    expect(onProgress).toHaveBeenNthCalledWith(2, expect.objectContaining({
      completed: 2, total: 4, formatLabel: 'Base', locale: 'en', groupName: 'Hero', phase: 'rendering',
    }))
    expect(onProgress).toHaveBeenNthCalledWith(3, expect.objectContaining({
      completed: 3, total: 4, formatLabel: 'Base', locale: 'fr', groupName: 'Hero', phase: 'rendering',
    }))
    expect(onProgress).toHaveBeenNthCalledWith(4, expect.objectContaining({
      completed: 4, total: 4, formatLabel: 'Base', locale: 'fr', groupName: 'Hero', phase: 'rendering',
    }))
    expect(onProgress).toHaveBeenLastCalledWith(expect.objectContaining({
      completed: 4, total: 4, formatLabel: 'Base', locale: 'fr', groupName: 'Hero', phase: 'restoring',
    }))
    const restored = useEditorStore.getState()
    expect(restored.activeLocale).toBe('es')
    expect(restored.activeCanvasFormat).toBe('android-phone')
    expect(restored.activeSlideGroupId).toBe(originalGroupId)
  })

  it('exports unchanged when onProgress is omitted', async () => {
    mockSingleImage()

    await expect(exportProjectImages(stage, {
      formatIds: ['base'],
      locales: ['en'],
      scope: 'current-group',
    })).resolves.toHaveLength(1)
  })

  it('rejects cancelled exports and restores global export state', async () => {
    const store = useEditorStore.getState()
    store.setActiveLocale('es')
    store.setActiveCanvasFormat('android-phone')
    const originalGroupId = store.activeSlideGroupId
    const controller = new AbortController()
    controller.abort()

    await expect(exportProjectImages(stage, {
      formatIds: ['base'],
      locales: ['en'],
      scope: 'current-group',
      signal: controller.signal,
    })).rejects.toThrow(ExportCancelledError)

    const restored = useEditorStore.getState()
    expect(restored.activeLocale).toBe('es')
    expect(restored.activeCanvasFormat).toBe('android-phone')
    expect(restored.activeSlideGroupId).toBe(originalGroupId)
    expect(restored.panoRenderOverride).toBeNull()
  })
})
