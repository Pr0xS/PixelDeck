import type { BackgroundLayer, CanvasFormatId, GroupLayer, Layer, PhoneLayer, Project, SlideGroup } from '@/types'
import type { EditorStore, EditorSet, EditorGet } from '../types'
import { cloneLayerWithNewIds, createBackgroundLayer, touchProject, newSlideGroup, newId, mutateActiveGroup } from '../helpers'
import { planContentSync, type ContentSyncPlan } from '@/utils/contentSync'
import {
  appendFormatToFamilyGroups,
  BASE_CANVAS_FORMAT,
  FORMAT_FAMILY_ANCHOR,
  FAMILY_SURFACE,
  getFormatCanvasDims,
  getFormatFamilyKey,
  getFamilyDefaultPhoneModel,
  getFormatScaleFactor,
  getProjectActiveFormats,
  getProjectBaseFormat,
  rebasePhoneModelSwap,
  resolveCounterpartGroup,
  getGroupFamilyKey,
  scaleLayerToCanvas,
  selectFamilyFormats,
  selectFamilyGroups,
  selectForkSourceGroups,
  type FormatFamilyKey,
} from '@/utils/canvasFormats'
import { mapLayerTree } from '@/utils/layerTree'

export function resolveContentSyncSourceGroup(
  project: Project,
  activeFamily: FormatFamilyKey,
  activeSlideGroupId: string,
  sourceFamily: FormatFamilyKey,
): SlideGroup | undefined {
  if (sourceFamily === activeFamily) return undefined
  const activeGroup = project.slideGroups.find((group) => group.id === activeSlideGroupId)
  if (!activeGroup) return undefined
  return resolveCounterpartGroup(project, activeGroup, sourceFamily)
}

function emptyContentSyncPlan(layers: Layer[]): ContentSyncPlan {
  return { entries: [], layers, updatedCount: 0, skippedCount: 0 }
}

function getSlideGroupActivationPatch(state: EditorStore, id: string) {
  const target = state.project.slideGroups.find((group) => group.id === id)
  if (!target) return {}
  const family = getGroupFamilyKey(target) ?? state.activeFamily
  const familyFormats = selectFamilyFormats(state.project, family)
  const format = familyFormats.includes(state.activeCanvasFormat)
    ? state.activeCanvasFormat
    : getProjectBaseFormat(state.project)
  return {
    activeSlideGroupId: id,
    activeFamily: family,
    activeCanvasFormat: format,
    lastGroupByFamily: { ...state.lastGroupByFamily, [family]: id },
  }
}

export const createSlideGroupSlice = (
  set: EditorSet,
  get: EditorGet,
): Pick<
  EditorStore,
  | 'addSlideGroup'
  | 'removeSlideGroup'
  | 'setActiveSlideGroup'
  | 'setCaptureSlideGroup'
  | 'updateSlideGroup'
  | 'duplicateSlideGroup'
  | 'forkSlideGroupForFormat'
  | 'addFormatToFamily'
  | 'pullContentFromFamily'
  | 'createFormatLayout'
  | 'deleteFormatLayout'
  | 'reorderSlideGroups'
> => ({
  // ─ SlideGroup actions
  addSlideGroup: () => {
    const { project } = get()
    const n = project.slideGroups.length + 1
    const activeGroup = project.slideGroups.find((candidate) => candidate.id === get().activeSlideGroupId)
    const group = newSlideGroup({
      name: `Slide ${n}`,
      slideWidth: project.settings.defaultSlideWidth,
      slideHeight: project.settings.defaultSlideHeight,
      slideNames: ['slide-01'],
      formats: activeGroup?.formats ? [...activeGroup.formats] : undefined,
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
        groups.some((group) => group.id === s.activeSlideGroupId)
          ? s.activeSlideGroupId
          : (groups[0]?.id ?? '')
      const activeGroup = groups.find((group) => group.id === activeId)
      const activeFamily = activeGroup ? (getGroupFamilyKey(activeGroup) ?? 'phone') : 'phone'
      const activeCanvasFormat = selectFamilyFormats(s.project, activeFamily).includes(s.activeCanvasFormat)
        ? s.activeCanvasFormat
        : getProjectBaseFormat(s.project)
      return {
        project: touchProject(s.project, { slideGroups: groups }),
        activeSlideGroupId: activeId,
        activeFamily,
        activeCanvasFormat,
      }
    })
  },

  setActiveSlideGroup: (id) => set((state) => ({
    ...getSlideGroupActivationPatch(state, id),
    selection: null,
    editingGroupId: null,
    selectedAccentIndex: null,
  })),

  setCaptureSlideGroup: (id) => set((state) => (
    getSlideGroupActivationPatch(state, id)
  )),

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
      slideKey: newId(),
      layers: src.layers.map((layer: Layer) => cloneLayerWithNewIds(layer)),
    }
    set((s) => ({
      project: touchProject(s.project, { slideGroups: [...s.project.slideGroups, clone] }),
      activeSlideGroupId: clone.id,
    }))
  },

  forkSlideGroupForFormat: (sourceGroupId, targetFormatId, options) => {
    const { project } = get()
    const source = project.slideGroups.find((group) => group.id === sourceGroupId)
    if (!source) return ''

    const baseFormat = getProjectBaseFormat(project)
    const family = getFormatFamilyKey(targetFormatId) ?? 'phone'
    const anchor = FORMAT_FAMILY_ANCHOR[family]
    const target = getFormatCanvasDims(source, anchor, baseFormat, project.settings.customFormats)
    const scaleFactor = getFormatScaleFactor(source, anchor, baseFormat, project.settings.customFormats)
    const sourceSlideKey = source.slideKey ?? newId()
    const fork = buildFormatFork(project, family, source, target, scaleFactor, sourceSlideKey, options)

    set((state) => ({
      project: touchProject(state.project, {
        slideGroups: [
          ...state.project.slideGroups.map((g) => (g.id === source.id && !g.slideKey ? { ...g, slideKey: sourceSlideKey } : g)),
          fork,
        ],
      }),
      activeSlideGroupId: fork.id,
    }))
    return fork.id
  },

  addFormatToFamily: (formatId) => {
    const family = getFormatFamilyKey(formatId) ?? 'phone'
    set((state) => {
      const activeFormats = getProjectActiveFormats(state.project)
      return {
        project: touchProject(state.project, {
          settings: {
            ...state.project.settings,
            activeFormats: activeFormats.includes(formatId) ? activeFormats : [...activeFormats, formatId],
          },
          slideGroups: appendFormatToFamilyGroups(state.project, family, formatId),
        }),
      }
    })
  },

  pullContentFromFamily: (sourceFamily) => {
    const { project, activeFamily, activeSlideGroupId } = get()
    const activeGroup = project.slideGroups.find((group) => group.id === activeSlideGroupId)
    const sourceGroup = resolveContentSyncSourceGroup(project, activeFamily, activeSlideGroupId, sourceFamily)
    if (!activeGroup || !sourceGroup) return emptyContentSyncPlan(activeGroup?.layers ?? [])
    const plan = planContentSync(sourceGroup.layers, activeGroup.layers)
    mutateActiveGroup(set, (group) => ({ ...group, layers: plan.layers }))
    return plan
  },

  createFormatLayout: (targetFormatId, options) => {
    if (targetFormatId === BASE_CANVAS_FORMAT) return { createdGroupIds: [] }
    const { project } = get()
    const targetFamily = getFormatFamilyKey(targetFormatId) ?? 'phone'
    if (selectFamilyGroups(project, targetFamily).length > 0) {
      get().addFormatToFamily(targetFormatId)
      const activeGroupId = selectFamilyGroups(get().project, targetFamily)[0]?.id ?? ''
      set({ activeFamily: targetFamily, activeCanvasFormat: targetFormatId, activeSlideGroupId: activeGroupId })
      return { createdGroupIds: [] }
    }
    const baseFormat = getProjectBaseFormat(project)
    const sourceGroups = selectForkSourceGroups(project, options.sourceFormat, targetFormatId)
    if (sourceGroups.length === 0) return { createdGroupIds: [] }

    const sourceFamily = options.sourceFormat === BASE_CANVAS_FORMAT
      ? 'phone'
      : (getFormatFamilyKey(options.sourceFormat) ?? 'phone')
    const pinFormats = selectFamilyFormats(project, sourceFamily)
    const sourceSlideKeys = new Map(sourceGroups.map((source) => [source.id, source.slideKey ?? newId()] as const))
    const forks = sourceGroups.map((source) => {
      const anchor = FORMAT_FAMILY_ANCHOR[targetFamily]
      const target = getFormatCanvasDims(source, anchor, baseFormat, project.settings.customFormats)
      const scaleFactor = getFormatScaleFactor(source, anchor, baseFormat, project.settings.customFormats)
      return buildFormatFork(project, targetFamily, source, target, scaleFactor, sourceSlideKeys.get(source.id)!, { content: options.content })
    })
    const createdGroupIds = forks.map((fork) => fork.id)

    set((state) => ({
      project: touchProject(state.project, {
        settings: {
          ...state.project.settings,
          activeFormats: getProjectActiveFormats(state.project).includes(targetFormatId)
            ? getProjectActiveFormats(state.project)
            : [...getProjectActiveFormats(state.project), targetFormatId],
        },
        slideGroups: [
          ...state.project.slideGroups.map((group) => {
            const isSource = sourceGroups.some((source) => source.id === group.id)
            if (!isSource) return group
            const needsFormatsPatch = group.formats === undefined && pinFormats.length > 0
            const backfillSlideKey = !group.slideKey ? sourceSlideKeys.get(group.id) : undefined
            if (!needsFormatsPatch && !backfillSlideKey) return group
            return {
              ...group,
              ...(needsFormatsPatch ? { formats: [...pinFormats] } : {}),
              ...(backfillSlideKey ? { slideKey: backfillSlideKey } : {}),
            }
          }),
          ...forks,
        ],
      }),
      activeSlideGroupId: createdGroupIds[0],
      activeFamily: targetFamily,
      activeCanvasFormat: targetFormatId,
    }))
    return { createdGroupIds }
  },

  deleteFormatLayout: (formatId: CanvasFormatId) => {
    const { project } = get()
    const family = getFormatFamilyKey(formatId) ?? 'phone'
    const remainingActiveFormats = getProjectActiveFormats(project).filter((format) => format !== formatId)
    const familyStillActive = selectFamilyFormats(project, family)
      .some((format) => remainingActiveFormats.includes(format))
    const groups = familyStillActive
      ? project.slideGroups
      : project.slideGroups.filter((group) => getGroupFamilyKey(group) !== family)
    // Match the SlideNavigator guard: a project must always retain one slide group.
    if (groups.length === 0) return

    set((state) => {
      const activeGroupId = groups.some((group) => group.id === state.activeSlideGroupId)
        ? state.activeSlideGroupId
        : (groups[0]?.id ?? '')
      return {
        project: touchProject(state.project, {
          settings: {
            ...state.project.settings,
            activeFormats: remainingActiveFormats,
          },
          slideGroups: groups,
        }),
        activeSlideGroupId: activeGroupId,
        activeCanvasFormat: state.activeCanvasFormat === formatId
          ? getProjectBaseFormat(state.project)
          : state.activeCanvasFormat,
        activeFamily: getGroupFamilyKey(groups.find((group) => group.id === activeGroupId)!) ?? 'phone',
      }
    })
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

function scaleLocaleAdjust(layer: Layer, scaleFactor: number, belongsToSourceFamily: (format: CanvasFormatId) => boolean): Layer {
  const localeAdjust = layer.localeAdjust && Object.fromEntries(Object.entries(layer.localeAdjust).map(([locale, scopes]) => [
    locale,
    Object.fromEntries(
      Object.entries(scopes ?? {})
        .filter(([scope]) => scope === BASE_CANVAS_FORMAT || !belongsToSourceFamily(scope as CanvasFormatId))
        .map(([scope, delta]) => [
          scope,
          scope === BASE_CANVAS_FORMAT && delta
            ? { ...delta, ...(typeof delta.dx === 'number' ? { dx: delta.dx * scaleFactor } : {}), ...(typeof delta.dy === 'number' ? { dy: delta.dy * scaleFactor } : {}) }
            : delta,
        ]),
    ),
  ]))
  if (layer.type === 'group') {
    return { ...layer, ...(localeAdjust ? { localeAdjust } : {}), children: (layer as GroupLayer).children.map((child) => scaleLocaleAdjust(child, scaleFactor, belongsToSourceFamily)) } as Layer
  }
  return localeAdjust ? { ...layer, localeAdjust } as Layer : layer
}

function buildFormatFork(
  project: import('@/types').Project,
  family: import('@/utils/canvasFormats').FormatFamilyKey,
  source: SlideGroup,
  target: { width: number; height: number },
  scaleFactor: number,
  sourceSlideKey: string,
  options?: { blank?: boolean; content?: 'copy' | 'blank' },
): SlideGroup {
  const numSlides = source.numSlides ?? 1
  const sourceBackground = source.layers.find((layer): layer is BackgroundLayer => layer.type === 'background')
  const blank = options?.content === 'blank' || options?.blank === true
  const sourceFamily = getGroupFamilyKey(source)
  const belongsToSourceFamily = (format: CanvasFormatId) => sourceFamily !== null && getFormatFamilyKey(format) === sourceFamily
  const layers = blank
    ? [createBackgroundLayer({ fill: sourceBackground?.fill ?? source.background?.fill })]
    : mapLayerTree(source.layers.map((layer) =>
      scaleLocaleAdjust(scaleLayerToCanvas(cloneLayerWithNewIds(layer), source.slideWidth * numSlides, source.slideHeight, target.width * numSlides, target.height, scaleFactor), scaleFactor, belongsToSourceFamily),
    ), (layer) => {
      const formatOverrides = layer.formatOverrides && Object.fromEntries(
        Object.entries(layer.formatOverrides).filter(([format]) => !belongsToSourceFamily(format as CanvasFormatId)),
      )
      const formatVisibility = layer.formatVisibility && Object.fromEntries(
        Object.entries(layer.formatVisibility).filter(([format]) => !belongsToSourceFamily(format as CanvasFormatId)),
      )
      const { ownerFormat, ...withoutOwnerFormat } = layer
      const pruned: Layer = {
        ...withoutOwnerFormat,
        ...(formatOverrides && Object.keys(formatOverrides).length > 0 ? { formatOverrides } : {}),
        ...(formatVisibility && Object.keys(formatVisibility).length > 0 ? { formatVisibility } : {}),
        ...(ownerFormat !== undefined && !belongsToSourceFamily(ownerFormat) ? { ownerFormat } : {}),
      } as Layer

      const familyDefault = getFamilyDefaultPhoneModel(family)
      const familyModels = Object.values(FAMILY_SURFACE[family])
      return pruned.type === 'phone' && familyDefault !== undefined && !familyModels.includes(pruned.model)
        ? rebasePhoneModelSwap(pruned as PhoneLayer, familyDefault, target.width * numSlides, target.height)
        : pruned
    })
  return { ...source, id: newId(), name: source.name, slideWidth: target.width, slideHeight: target.height, layers, formats: selectFamilyFormats(project, family), slideKey: sourceSlideKey }
}
