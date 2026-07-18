import type { BrandColor, Template } from '@/types'
import { normalizeProjectFormats, BASE_CANVAS_FORMAT } from '@/utils/canvasFormats'
import { projectToTemplate, applyTemplate, extractInlineScreenshots } from '@/utils/templates'
import { isProjectExportBundle } from '@/utils/projectAssets'
import type { EditorStore, EditorSet, EditorGet } from '../types'
import { useAssetStore } from '../assets'
import {
  newId,
  newProject,
  assertProjectShape,
  migrateProject,
  touchProject,
  touchSettings,
} from '../helpers'

export const createProjectSlice = (
  set: EditorSet,
  get: EditorGet,
  clearHistory: () => void,
): Pick<
  EditorStore,
  | 'setProjectName'
  | 'updateSettings'
  | 'updateProject'
  | 'addBrandColor'
  | 'updateBrandColor'
  | 'removeBrandColor'
  | 'exportProject'
  | 'importProject'
  | 'resetProject'
  | 'exportActiveAsTemplate'
  | 'importTemplateAsNewProject'
  | 'addTemplateSlideGroups'
> => ({
  // ─ Project actions
  setProjectName: (name) =>
    set((s) => ({ project: touchProject(s.project, { name }) })),

  updateSettings: (patch) =>
    set((s) => ({ project: touchSettings(s.project, patch) })),

  updateProject: (patch) =>
    set((s) => ({ project: touchProject(s.project, patch) })),

  // ─ Brand color actions
  addBrandColor: (name, value) => {
    const color: BrandColor = { id: newId(), name, value }
    set((s) => ({
      project: touchSettings(s.project, {
        brandColors: [...(s.project.settings.brandColors ?? []), color],
      }),
    }))
  },

  updateBrandColor: (id, patch) => {
    set((s) => ({
      project: touchSettings(s.project, {
        brandColors: (s.project.settings.brandColors ?? []).map((c) =>
          c.id === id ? { ...c, ...patch } : c,
        ),
      }),
    }))
  },

  removeBrandColor: (id) => {
    set((s) => ({
      project: touchSettings(s.project, {
        brandColors: (s.project.settings.brandColors ?? []).filter((c) => c.id !== id),
      }),
    }))
  },

  // ─ Project persistence
  exportProject: () => {
    return JSON.stringify(get().project, null, 2)
  },

  importProject: (json) => {
    const parsed: unknown = JSON.parse(json)
    const rawProject = isProjectExportBundle(parsed) ? parsed.project : parsed
    assertProjectShape(rawProject)
    const project = migrateProject(rawProject)
    set({
      project,
      activeSlideGroupId: project.slideGroups[0]?.id ?? '',
      selection: null,
      editingGroupId: null,
      selectedLayerIds: [],
      selectedAccentIndex: null,
      activeLocale: project.settings.defaultLocale ?? 'en',
      activeCanvasFormat: BASE_CANVAS_FORMAT,
    })
    // Clear undo history — undo must not cross project boundaries
    clearHistory()
  },

  resetProject: () => {
    const project = newProject()
    set({
      project,
      activeSlideGroupId: project.slideGroups[0].id,
      selection: null,
      editingGroupId: null,
      selectedLayerIds: [],
      selectedAccentIndex: null,
      activeLocale: 'en',
      activeCanvasFormat: BASE_CANVAS_FORMAT,
    })
    // Clear undo history — new project starts fresh
    clearHistory()
  },

  exportActiveAsTemplate: (opts) => {
    return projectToTemplate(get().project, opts)
  },

  importTemplateAsNewProject: (tpl: Template) => {
    const { slideGroups, settings } = applyTemplate(tpl)
    const extracted = extractInlineScreenshots(tpl.name, slideGroups)
    extracted.assets.forEach((asset) => useAssetStore.getState().addAsset(asset.filename, asset.dataUrl))
    const now = new Date().toISOString()
    const base = newProject()
    const project = normalizeProjectFormats({
      id: newId(),
      name: tpl.name,
      createdAt: now,
      updatedAt: now,
      settings: { ...base.settings, ...settings },
      slideGroups: extracted.slideGroups,
    })
    set({
      project,
      activeSlideGroupId: extracted.slideGroups[0]?.id ?? '',
      selection: null,
      editingGroupId: null,
      selectedLayerIds: [],
      selectedAccentIndex: null,
      activeLocale: project.settings.defaultLocale ?? 'en',
      activeCanvasFormat: BASE_CANVAS_FORMAT,
    })
    // Clear undo history — new project starts fresh
    clearHistory()
  },

  addTemplateSlideGroups: (tpl: Template) => {
    const { slideGroups, settings } = applyTemplate(tpl)
    const extracted = extractInlineScreenshots(tpl.name, slideGroups)
    extracted.assets.forEach((asset) => useAssetStore.getState().addAsset(asset.filename, asset.dataUrl))
    set((s) => {
      // Merge template brand colors into the current palette so {brand:id}
      // tokens in the appended layers resolve. Existing ids win (never
      // overwrite the user's palette); only missing entries are added.
      const existing = s.project.settings.brandColors ?? []
      const existingIds = new Set(existing.map((c) => c.id))
      const incoming = (settings?.brandColors ?? []).filter((c) => !existingIds.has(c.id))
      return {
        project: touchProject(s.project, {
          settings: incoming.length > 0
            ? { ...s.project.settings, brandColors: [...existing, ...incoming] }
            : s.project.settings,
          slideGroups: [...s.project.slideGroups, ...extracted.slideGroups],
        }),
        activeSlideGroupId: extracted.slideGroups[0]?.id ?? s.activeSlideGroupId,
      }
    })
  },
})
