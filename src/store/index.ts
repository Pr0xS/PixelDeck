import { create, type StateCreator } from 'zustand'
import { useStore } from 'zustand'
import { temporal } from 'zundo'
import type { Layer, LayerType, Selection } from '@/types'
import {
  BASE_CANVAS_FORMAT,
  getGroupFamilyKey,
  getProjectActiveFormats,
  getProjectBaseFormat,
  selectFamilyFormats,
  selectFamilyGroups,
  selectProjectFamilies,
} from '@/utils/canvasFormats'
import type { EditorStore } from './types'
import { newProject, migrateProject, assertProjectShape, touchProject, stripDataUrls } from './helpers'
import { createSelectionSlice } from './slices/selectionSlice'
import { createLocaleSlice } from './slices/localeSlice'
import { createLocaleLayoutSlice } from './slices/localeLayoutSlice'
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
      selectedAccentIndex: null as number | null,
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
      activeFamily: 'phone',
      lastFormatByFamily: {},
      lastGroupByFamily: {},
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
      ...createLocaleLayoutSlice(set, get),
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
      const restoredGroup = normalizedProject.slideGroups.find((group) => group.id === activeSlideGroupId)
        ?? normalizedProject.slideGroups[0]
      useEditorStore.setState({
        project: normalizedProject,
        activeSlideGroupId: activeSlideGroupId ?? '',
        activeCanvasFormat: BASE_CANVAS_FORMAT,
        activeFamily: restoredGroup ? (getGroupFamilyKey(restoredGroup) ?? 'phone') : 'phone',
        lastFormatByFamily: {},
        lastGroupByFamily: {},
      })
      // Don't let the initial hydration pollute the undo history
      useEditorStore.temporal.getState().clear()
    }
  } catch {
    // localStorage unavailable or data corrupt — start fresh
  }
})()

// zundo restores only `project`; keep transient navigation pointed at a valid
// family/group/format whenever undo or redo swaps that project reference.
useEditorStore.subscribe((state, prev) => {
  if (state.project === prev.project) return
  const groups = state.project.slideGroups
  const families = selectProjectFamilies(state.project)
  const activeFamily = families.includes(state.activeFamily)
    ? state.activeFamily
    : (groups[0] ? (getGroupFamilyKey(groups[0]) ?? 'phone') : 'phone')
  const activeSlideGroupId = groups.some((group) => (
    group.id === state.activeSlideGroupId && getGroupFamilyKey(group) === activeFamily
  ))
    ? state.activeSlideGroupId
    : (selectFamilyGroups(state.project, activeFamily)[0]?.id ?? groups[0]?.id ?? '')
  const activeFormats = selectFamilyFormats(state.project, activeFamily)
    .filter((format) => getProjectActiveFormats(state.project).includes(format))
  const baseFormat = getProjectBaseFormat(state.project)
  const activeCanvasFormat = state.activeCanvasFormat === baseFormat || activeFormats.includes(state.activeCanvasFormat)
    ? state.activeCanvasFormat
    : baseFormat
  if (
    activeSlideGroupId === state.activeSlideGroupId
    && activeFamily === state.activeFamily
    && activeCanvasFormat === state.activeCanvasFormat
  ) return
  useEditorStore.setState({ activeSlideGroupId, activeFamily, activeCanvasFormat })
})

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
