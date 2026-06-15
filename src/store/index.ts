import { create, type StateCreator } from 'zustand'
import { useStore } from 'zustand'
import { temporal } from 'zundo'
import type { Layer, LayerType, Selection } from '@/types'
import { BASE_CANVAS_FORMAT } from '@/utils/canvasFormats'
import type { EditorStore } from './types'
import { newProject, migrateProject, assertProjectShape, touchProject, stripDataUrls } from './helpers'
import { createSelectionSlice } from './slices/selectionSlice'
import { createLocaleSlice } from './slices/localeSlice'
import { createFormatSlice } from './slices/formatSlice'
import { createSlideGroupSlice } from './slices/slideGroupSlice'
import { createLayerSlice } from './slices/layerSlice'
import { createGroupSlice } from './slices/groupSlice'
import { createClipboardSlice } from './slices/clipboardSlice'
import { createProjectSlice } from './slices/projectSlice'

export type { EditorStore } from './types'

// ─── Store ────────────────────────────────────────────────────────────────────

let projectStorageWarningShown = false

export const useEditorStore = create<EditorStore>()(
  temporal(
    ((set, get) => ({
      // ─ Initial state
      project: newProject(),
      activeSlideGroupId: '',
      selection: null as Selection | null,
      zoom: 0.28,
      viewportX: 0,
      viewportY: 0,
      showGrid: false,
      showSeamGuides: true,
      editingGroupId: null as string | null,
      selectedLayerIds: [] as string[],
      clipboard: null as Layer[] | null,
      clipboardSourceGroupId: null as string | null,
      pasteCount: 0,
      styleClipboard: null as { layerType: LayerType; style: Record<string, unknown> } | null,
      editingTextId: null as string | null,
      pendingContentFocusLayerId: null as string | null,
      activeLocale: 'en',
      activeCanvasFormat: BASE_CANVAS_FORMAT,
      panoRenderOverride: null as { gapPx: number; compensate: boolean } | null,
      setPanoRenderOverride: (override) => set({ panoRenderOverride: override }),
      updatePanoSettings: (patch) => set((s) => ({
        project: touchProject(s.project, {
          settings: {
            ...s.project.settings,
            pano: { ...(s.project.settings.pano ?? { gapPx: 24, compensate: false }), ...patch },
          },
        }),
      })),

      // ─ Init activeSlideGroupId after project creation
      // (called once in App.tsx on mount)

      // ─ Slices
      ...createSelectionSlice(set, get),
      ...createLocaleSlice(set, get),
      ...createFormatSlice(set, get),
      ...createSlideGroupSlice(set, get),
      ...createLayerSlice(set, get),
      ...createGroupSlice(set, get),
      ...createClipboardSlice(set, get),
      ...createProjectSlice(set, get, () => useEditorStore.temporal.getState().clear()),
    })) as StateCreator<EditorStore>,
    {
      // Only track project changes, ignore all UI state
      partialize: (state) => ({ project: state.project }),
      // Don't create a new history entry if project reference hasn't changed
      equality: (a, b) => a.project === b.project,
      // Keep max 50 undo steps
      limit: 50,
    }
  )
)

// ─── Project persistence (localStorage) ─────────────────────────────────────
// Hydrate saved project before the "init activeSlideGroupId" check below.
const PROJECT_STORAGE_KEY = 'pixeldeck-project'
;(function hydrateProject() {
  try {
    const raw = localStorage.getItem(PROJECT_STORAGE_KEY)
    if (!raw) return
    const { project, activeSlideGroupId } = JSON.parse(raw) as {
      project: import('@/types').Project
      activeSlideGroupId: string
    }
    if (project) {
      assertProjectShape(project)
      const normalizedProject = migrateProject(project)
      useEditorStore.setState({
        project: normalizedProject,
        activeSlideGroupId: activeSlideGroupId ?? '',
        activeCanvasFormat: BASE_CANVAS_FORMAT,
      })
      // Don't let the initial hydration pollute the undo history
      useEditorStore.temporal.getState().clear()
    }
  } catch {
    // localStorage unavailable or data corrupt — start fresh
  }
})()

// Save to localStorage whenever project structure or active group changes.
// Selection / zoom / editingGroupId are intentionally excluded (transient UI).
useEditorStore.subscribe((state, prev) => {
  if (state.project === prev.project && state.activeSlideGroupId === prev.activeSlideGroupId) return
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify({
      project: stripDataUrls(state.project),
      activeSlideGroupId: state.activeSlideGroupId,
    }))
  } catch (err) {
    // Storage quota exceeded or unavailable. Surface once; silent failure risks data loss.
    console.warn('[PixelDeck] Project autosave failed', err)
    if (!projectStorageWarningShown && typeof window !== 'undefined') {
      projectStorageWarningShown = true
      window.setTimeout(() => {
        alert('Project autosave failed. Export Project now to avoid losing recent changes.')
      }, 0)
    }
  }
})

// Init activeSlideGroupId on first load (no-op when hydrated from storage)
const initial = useEditorStore.getState()
if (!initial.activeSlideGroupId && initial.project.slideGroups.length > 0) {
  useEditorStore.setState({ activeSlideGroupId: initial.project.slideGroups[0].id })
}

// ─── Undo/Redo hook ───────────────────────────────────────────────────────────

export const useUndoRedo = () => {
  const undo = useStore(useEditorStore.temporal, (s) => s.undo)
  const redo = useStore(useEditorStore.temporal, (s) => s.redo)
  const canUndo = useStore(useEditorStore.temporal, (s) => s.pastStates.length > 0)
  const canRedo = useStore(useEditorStore.temporal, (s) => s.futureStates.length > 0)
  const pause = () => useEditorStore.temporal.getState().pause()
  const resume = () => useEditorStore.temporal.getState().resume()
  return { undo, redo, canUndo, canRedo, pause, resume }
}
