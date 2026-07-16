import type { Layer } from '@/types'
import type { EditorStore, EditorSet, EditorGet } from '../types'
import { touchProject, newSlideGroup, newId } from '../helpers'

export const createSlideGroupSlice = (
  set: EditorSet,
  get: EditorGet,
): Pick<
  EditorStore,
  | 'addSlideGroup'
  | 'removeSlideGroup'
  | 'setActiveSlideGroup'
  | 'updateSlideGroup'
  | 'duplicateSlideGroup'
  | 'reorderSlideGroups'
> => ({
  // ─ SlideGroup actions
  addSlideGroup: () => {
    const { project } = get()
    const n = project.slideGroups.length + 1
    const group = newSlideGroup({
      name: `Slide ${n}`,
      slideWidth: project.settings.defaultSlideWidth,
      slideHeight: project.settings.defaultSlideHeight,
      slideNames: ['slide-01'],
    })
    set((s) => ({
      project: touchProject(s.project, { slideGroups: [...s.project.slideGroups, group] }),
      activeSlideGroupId: group.id,
    }))
  },

  removeSlideGroup: (id) => {
    set((s) => {
      const groups = s.project.slideGroups.filter((g) => g.id !== id)
      const activeId =
        s.activeSlideGroupId === id ? (groups[0]?.id ?? '') : s.activeSlideGroupId
      return {
        project: touchProject(s.project, { slideGroups: groups }),
        activeSlideGroupId: activeId,
      }
    })
  },

  setActiveSlideGroup: (id) => set({ activeSlideGroupId: id, selection: null, editingGroupId: null, selectedAccentIndex: null }),

  updateSlideGroup: (id, patch) => {
    set((s) => ({
      project: touchProject(s.project, {
        slideGroups: s.project.slideGroups.map((g) => {
          if (g.id !== id) return g
          const next = { ...g, ...patch }
          // Keep slideNames in sync with numSlides (pad with defaults, trim extras)
          if (next.slideNames.length !== next.numSlides) {
            next.slideNames = Array.from(
              { length: next.numSlides },
              (_, i) => next.slideNames[i] ?? `slide-${String(i + 1).padStart(2, '0')}`,
            )
          }
          return next
        }),
      }),
    }))
  },

  duplicateSlideGroup: (id) => {
    const { project } = get()
    const src = project.slideGroups.find((g) => g.id === id)
    if (!src) return
    const clone = {
      ...JSON.parse(JSON.stringify(src)),
      id: newId(),
      name: `${src.name} (copy)`,
      layers: src.layers.map((l: Layer) => ({ ...JSON.parse(JSON.stringify(l)), id: newId() })),
    }
    set((s) => ({
      project: touchProject(s.project, { slideGroups: [...s.project.slideGroups, clone] }),
      activeSlideGroupId: clone.id,
    }))
  },

  reorderSlideGroups: (ids) => {
    set((s) => {
      const map = new Map(s.project.slideGroups.map((g) => [g.id, g]))
      return {
        project: touchProject(s.project, { slideGroups: ids.map((id) => map.get(id)!) }),
      }
    })
  },
})
