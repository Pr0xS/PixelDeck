import { describe, it, expect, beforeEach } from 'vitest'
import { BASE_CANVAS_FORMAT } from '@/utils/canvasFormats'
import { useEditorStore } from './index'

function getActiveGroup() {
  const { project, activeSlideGroupId } = useEditorStore.getState()
  return project.slideGroups.find((g) => g.id === activeSlideGroupId)!
}

beforeEach(() => {
  useEditorStore.getState().resetProject()
  useEditorStore.setState({ editingGroupId: null, selectedLayerIds: [], clipboard: null, clipboardSourceGroupId: null, pasteCount: 0, selection: null })
  useEditorStore.temporal.getState().clear()
})

describe('project persistence', () => {
  it('round-trips project content through exportProject/importProject', () => {
    useEditorStore.getState().addText()
    const textLayer = getActiveGroup().layers.find((layer) => layer.type === 'text')!

    const json = useEditorStore.getState().exportProject()

    useEditorStore.getState().resetProject()
    expect(getActiveGroup().layers.find((layer) => layer.id === textLayer.id)).toBeUndefined()

    useEditorStore.getState().importProject(json)

    const imported = getActiveGroup().layers.find((layer) => layer.id === textLayer.id)
    expect(imported?.type).toBe('text')
  })

  it('accepts a project export bundle while keeping bare project imports compatible', () => {
    useEditorStore.getState().addText()
    const project = useEditorStore.getState().project

    useEditorStore.getState().resetProject()
    useEditorStore.getState().importProject(JSON.stringify({
      kind: 'project-export',
      schemaVersion: 1,
      project,
      assets: { 'shot.png': 'data:image/png;base64,asset' },
    }))

    expect(useEditorStore.getState().project.id).toBe(project.id)
    expect(getActiveGroup().layers.some((layer) => layer.type === 'text')).toBe(true)
  })

  it('exportProject returns valid parseable JSON of the current project', () => {
    const parsed = JSON.parse(useEditorStore.getState().exportProject())

    expect(parsed.slideGroups).toHaveLength(useEditorStore.getState().project.slideGroups.length)
  })

  it('throws for malformed JSON strings', () => {
    expect(() => useEditorStore.getState().importProject('not valid json{{')).toThrow()
  })

  it('throws when valid JSON is missing the slideGroups array', () => {
    expect(() => useEditorStore.getState().importProject('{}')).toThrow('Invalid project file: missing "slideGroups" array.')
  })

  it('throws when valid JSON is missing the settings object', () => {
    expect(() => useEditorStore.getState().importProject('{"slideGroups":[]}')).toThrow('Invalid project file: missing "settings" object.')
  })

  it('throws when a slide group is missing its layers array', () => {
    expect(() => useEditorStore.getState().importProject('{"slideGroups":[{}],"settings":{}}')).toThrow('Invalid project file: every slide group needs a "layers" array.')
  })

  it('resets editor side effects after successful import', () => {
    const json = JSON.stringify({
      id: 'project-import-side-effects',
      name: 'Import side effects',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      settings: { defaultLocale: 'fr' },
      slideGroups: [
        { id: 'group-a', name: 'Group A', numSlides: 1, slideWidth: 1290, slideHeight: 2796, slideNames: ['a'], layers: [] },
        { id: 'group-b', name: 'Group B', numSlides: 1, slideWidth: 1290, slideHeight: 2796, slideNames: ['b'], layers: [] },
      ],
    })

    useEditorStore.setState({
      selection: { slideGroupId: useEditorStore.getState().activeSlideGroupId, layerId: null },
      editingGroupId: 'editing-group',
      selectedLayerIds: ['selected-layer'],
      selectedAccentIndex: 1,
      activeLocale: 'es',
      activeCanvasFormat: 'android-phone',
    })

    useEditorStore.getState().importProject(json)

    const state = useEditorStore.getState()
    expect(state.activeSlideGroupId).toBe(state.project.slideGroups[0].id)
    expect(state.selection).toBeNull()
    expect(state.editingGroupId).toBeNull()
    expect(state.selectedLayerIds).toHaveLength(0)
    expect(state.selectedAccentIndex).toBeNull()
    expect(state.activeLocale).toBe('fr')
    expect(state.activeCanvasFormat).toBe(BASE_CANVAS_FORMAT)
  })

  it('migrates legacy projects on import', () => {
    const json = JSON.stringify({
      id: 'project-legacy',
      name: 'Legacy Project',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      settings: { defaultLocale: 'en' },
      slideGroups: [
        {
          id: 'group-legacy',
          name: 'Legacy Group',
          numSlides: 1,
          slideWidth: 1290,
          slideHeight: 2796,
          slideNames: ['legacy'],
          layers: [
            {
              id: 'text-legacy',
              name: 'Legacy Text',
              type: 'text',
              x: 10,
              y: 20,
              rotation: 0,
              opacity: 1,
              visible: true,
              locked: false,
              text: 'Hello',
              fontFamily: 'Inter',
              fontSize: 48,
              fontWeight: 700,
              fill: '#ffffff',
              letterSpacing: 0,
              lineHeight: 1.1,
              align: 'center',
            },
          ],
        },
      ],
    })

    useEditorStore.getState().importProject(json)

    expect(getActiveGroup().layers[0].type).toBe('background')
    expect(useEditorStore.getState().project.settings.pano).toEqual({ gapPx: 24, compensate: false })
  })
})
