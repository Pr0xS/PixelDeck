import { useRef, useState, useCallback, useEffect, useLayoutEffect, useMemo, type RefObject } from 'react'
import type Konva from 'konva'
import { useEditorStore } from '@/store'
import { usePreviewCache } from '@/store/previewCache'
import { getFormatCanvasDims, getProjectBaseFormat, selectFamilyGroups, selectFormatViewGroups } from '@/utils/canvasFormats'
import { getPanoSlideX, normalizePanoCompensationPx, getEffectivePano } from '@/utils/panoGeometry'
import { nextFrame, runExclusiveCapture, waitForStage, waitForStageCaptureReady, withIdentityTransform } from '@/utils/stageCapture'
import { getGroupPreviewKey } from '@/utils/previewKey'
import { idbStorage } from '@/store/idb-storage'
import { useOffscreenThumbnails } from '@/hooks/useOffscreenThumbnails'

export type ThumbnailMap = Record<string, string[]>
export type ThumbnailEntry = { key: string; thumbs: string[] }

const DEBOUNCE_MS = 600
const THUMBNAIL_FLUSH_MS = 300

export type PersistedThumbnailMap = Record<string, ThumbnailEntry>

export function getFreshThumbs(entries: PersistedThumbnailMap, groupId: string, key: string): string[] | undefined {
  const entry = entries[groupId]
  return entry?.key === key ? entry.thumbs : undefined
}

export function needsThumbnailCapture(entries: PersistedThumbnailMap, groupId: string, key: string, numSlides: number): boolean {
  const thumbs = getFreshThumbs(entries, groupId, key)
  return !thumbs || thumbs.length < numSlides || !thumbs.slice(0, numSlides).every(Boolean)
}

/** Scheduler identity: format/locale/pano swaps must request a fresh idle pass. */
export function getPrecacheScheduleKey(
  family: string,
  format: string,
  locale: string,
  pano: { gapPx?: number; compensate?: boolean } | undefined,
): string {
  return `${family}\u0000${format}\u0000${locale}\u0000${pano?.gapPx ?? 0}\u0000${pano?.compensate ?? false}`
}

export function shouldRestoreCapturedSlideGroup(
  currentState: Pick<ReturnType<typeof useEditorStore.getState>, 'project' | 'activeFamily' | 'activeCanvasFormat' | 'activeSlideGroupId'>,
  original: {
    projectId: string
    groupId: string
    family: ReturnType<typeof useEditorStore.getState>['activeFamily']
    canvasFormat: ReturnType<typeof useEditorStore.getState>['activeCanvasFormat']
  },
  lastCaptureGroupId: string,
): boolean {
  return lastCaptureGroupId !== original.groupId
    && Boolean(original.groupId)
    && currentState.project.id === original.projectId
    && currentState.activeFamily === original.family
    && currentState.activeCanvasFormat === original.canvasFormat
    && currentState.activeSlideGroupId === lastCaptureGroupId
}

const thumbnailStorageKey = (projectId: string) => `pixeldeck-thumbs:${projectId}`

const thumbnailKeyMemo = new WeakMap<object, Map<string, string>>()

function getThumbnailKey(...args: Parameters<typeof getGroupPreviewKey>): string {
  const [group, format, locale, pano] = args
  const scopeKey = `${format}\u0000${locale}\u0000${pano?.gapPx}\u0000${pano?.compensate}`
  let scopes = thumbnailKeyMemo.get(group)
  if (!scopes) {
    scopes = new Map()
    thumbnailKeyMemo.set(group, scopes)
  }
  const cached = scopes.get(scopeKey)
  if (cached) return cached
  const sanitizedGroup = JSON.parse(JSON.stringify(group, (key, value) => (
    key.endsWith('DataUrl') ? undefined : value
  ))) as typeof group
  const hash = getGroupPreviewKey(sanitizedGroup, format, locale, pano)
  scopes.set(scopeKey, hash)
  return hash
}

/** Capture low-res nav thumbnails for a single group. */
async function captureGroupThumbs(
  stage: Konva.Stage,
  group: { id: string; numSlides: number },
  dims: { width: number; height: number },
  panoCompensationPx = 0,
): Promise<string[]> {
  const smallRatio = 88 / dims.height
  const panoGroup = { ...group, slideWidth: dims.width }
  const stripWidth = getPanoSlideX(panoGroup, group.numSlides - 1, panoCompensationPx) + dims.width
  const strip = withIdentityTransform(stage, () => stage.toDataURL({
    x: 0, y: 0, width: stripWidth, height: dims.height,
    pixelRatio: smallRatio, mimeType: 'image/jpeg', quality: 0.85,
  }))
  const image = new Image()
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Failed to decode thumbnail strip'))
    image.src = strip
  })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(dims.width * smallRatio)
  canvas.height = Math.round(dims.height * smallRatio)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Failed to create thumbnail canvas context')
  return Array.from({ length: group.numSlides }, (_, i) => {
    const sourceX = Math.round(getPanoSlideX(panoGroup, i, panoCompensationPx) * smallRatio)
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, sourceX, 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.85)
  })
}

export function useThumbnails(stageRef: RefObject<Konva.Stage | null>, hasCompletedInitialLoad = true) {
  const project = useEditorStore((s) => s.project)
  const activeSlideGroupId = useEditorStore((s) => s.activeSlideGroupId)
  const activeLocale = useEditorStore((s) => s.activeLocale)
  const activeCanvasFormat = useEditorStore((s) => s.activeCanvasFormat)
  const activeFamily = useEditorStore((s) => s.activeFamily)
  const projectPano = useEditorStore((s) => s.project.settings.pano)
  const panoRenderOverride = useEditorStore((s) => s.panoRenderOverride)

  const [thumbnailEntries, setThumbnailEntries] = useState<PersistedThumbnailMap>({})
  const [previewThumbs, setPreviewThumbs] = useState<ThumbnailMap>({})
  const [isCapturingPreview, setIsCapturingPreview] = useState(false)
  const [thumbnailsHydrated, setThumbnailsHydrated] = useState(false)

  const thumbnailEntriesRef = useRef<PersistedThumbnailMap>(thumbnailEntries)
  useEffect(() => { thumbnailEntriesRef.current = thumbnailEntries }, [thumbnailEntries])

  const debounceRef = useRef<number | null>(null)
  const previewAbortRef = useRef(false)
  const previewInFlightRef = useRef<Promise<void> | null>(null)
  const thumbnailFlushRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const {
    request: requestOffscreenThumbnails,
    element: offscreenThumbnailElement,
  } = useOffscreenThumbnails({
    onCaptured: (groupId, entry) => setThumbnailEntries((prev) => ({ ...prev, [groupId]: entry })),
  })

  // ── Project-switch reset ────────────────────────────────────────────────────
  const prevProjectIdRef = useRef(project.id)
  useLayoutEffect(() => {
    if (prevProjectIdRef.current === project.id) return
    prevProjectIdRef.current = project.id
    setThumbnailEntries({})
    setPreviewThumbs({})
    usePreviewCache.getState().clear()
  }, [project.id])

  // ── Debounced capture of the active group after edits ──────────────────────
  const captureGroup = useCallback(async (groupId?: string) => {
    const stage = stageRef.current
    const targetGroupId = groupId ?? activeSlideGroupId
    const currentState = useEditorStore.getState()
    const group = currentState.project.slideGroups.find((g) => g.id === targetGroupId)
    if (!stage || !group || targetGroupId !== currentState.activeSlideGroupId) return

    await nextFrame()
    const captureState = useEditorStore.getState()
    if (targetGroupId !== captureState.activeSlideGroupId) return

    const {
      activeCanvasFormat: format,
      activeLocale: locale,
      project: currentProject,
      panoRenderOverride: currentOverride,
    } = captureState
    const { gapPx, compensate } = getEffectivePano(currentProject.settings.pano, currentOverride)
    const effectivePanoCompensationPx = compensate ? gapPx : 0
    const baseFormat = getProjectBaseFormat(currentProject)
    const dims = getFormatCanvasDims(group, format, baseFormat, currentProject.settings.customFormats)

    const thumbs = await captureGroupThumbs(stage, group, dims, effectivePanoCompensationPx)
    const key = getThumbnailKey(group, format, locale, { gapPx, compensate })
    setThumbnailEntries((prev) => ({
      ...prev,
      [group.id]: { key, thumbs },
    }))

    // Invalidate preview cache for this group — it's now stale
    usePreviewCache.getState().invalidate(group.id)
  }, [activeSlideGroupId, stageRef])

  useEffect(() => {
    if (!activeSlideGroupId || !thumbnailsHydrated) return
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => { void captureGroup(activeSlideGroupId) }, DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) { window.clearTimeout(debounceRef.current); debounceRef.current = null }
    }
  }, [activeSlideGroupId, activeLocale, activeCanvasFormat, projectPano, panoRenderOverride, captureGroup, project, thumbnailsHydrated])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setThumbnailsHydrated(false)
      setThumbnailEntries({})
    })
    void (async () => {
      const raw = typeof indexedDB === 'undefined' ? null : await idbStorage.getItem(thumbnailStorageKey(project.id))
      if (cancelled) return
      if (raw) {
        try {
          const stored = JSON.parse(raw) as PersistedThumbnailMap
          const { project: currentProject } = useEditorStore.getState()
          if (currentProject.id !== project.id) return
          const hydrated: PersistedThumbnailMap = {}
          for (const group of currentProject.slideGroups) {
            const entry = stored[group.id]
            // Keep a valid previous image as a visual fallback. The derived stale
            // state validates its key before it is considered fresh or eligible.
            if (entry && entry.thumbs.length >= group.numSlides) {
              hydrated[group.id] = entry
            }
          }
          setThumbnailEntries(hydrated)
        } catch {
          // Corrupt or old thumbnail caches are disposable.
        }
      }
      if (!cancelled) setThumbnailsHydrated(true)
    })()
    return () => { cancelled = true }
    // Hydration is intentionally scoped to project identity, never ordinary content edits.
  }, [project.id])

  useEffect(() => {
    if (!thumbnailsHydrated) return
    if (thumbnailFlushRef.current) clearTimeout(thumbnailFlushRef.current)
    thumbnailFlushRef.current = setTimeout(() => {
      void idbStorage.setItem(thumbnailStorageKey(project.id), JSON.stringify(thumbnailEntriesRef.current))
    }, THUMBNAIL_FLUSH_MS)
    return () => {
      if (thumbnailFlushRef.current) clearTimeout(thumbnailFlushRef.current)
    }
  }, [thumbnailEntries, thumbnailsHydrated, project.id])

  // ── Eager low-res capture for inactive groups ───────────────────────────────
  const precacheLowResThumbnails = useCallback(() => {
    const {
      project: currentProject,
      activeSlideGroupId: currentGroupId,
      activeFamily: currentFamily,
      activeCanvasFormat: currentFormat,
      activeLocale: currentLocale,
      panoRenderOverride: currentOverride,
    } = useEditorStore.getState()
    const pano = getEffectivePano(currentProject.settings.pano, currentOverride)
    const requests = selectFamilyGroups(currentProject, currentFamily)
      .filter((group) => group.id !== currentGroupId)
      .map((group) => ({
        groupId: group.id,
        format: currentFormat,
        locale: currentLocale,
        pano,
        key: getThumbnailKey(group, currentFormat, currentLocale, pano),
        numSlides: group.numSlides,
      }))
      .filter((request) => needsThumbnailCapture(
        thumbnailEntriesRef.current,
        request.groupId,
        request.key,
        request.numSlides,
      ))
    requestOffscreenThumbnails(requests)
  }, [requestOffscreenThumbnails])

  const slideGroupIds = project.slideGroups.map((group) => group.id).join(',')
  const precacheScheduleKey = getPrecacheScheduleKey(activeFamily, activeCanvasFormat, activeLocale, getEffectivePano(projectPano, panoRenderOverride))
  useEffect(() => {
    if (!hasCompletedInitialLoad || !thumbnailsHydrated) return
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let idleCallbackId: number | null = null
    const start = () => {
      precacheLowResThumbnails()
    }

    if ('requestIdleCallback' in window) {
      idleCallbackId = window.requestIdleCallback(start, { timeout: 500 })
    } else {
      timeoutId = globalThis.setTimeout(start, 0)
    }

    return () => {
      if (idleCallbackId !== null) window.cancelIdleCallback(idleCallbackId)
      if (timeoutId !== null) globalThis.clearTimeout(timeoutId)
    }
  }, [project.id, slideGroupIds, precacheScheduleKey, activeFamily, activeCanvasFormat, activeLocale, projectPano, panoRenderOverride, hasCompletedInitialLoad, thumbnailsHydrated, precacheLowResThumbnails])

  // ── Visibility recovery ──────────────────────────────────────────────────
  // Backgrounded/discarded tabs suspend rAF entirely, which can cause capture
  // polling loops to exit early and leave thumbnails blank with no retry path.
  // When the tab becomes visible again, silently re-trigger capture for any
  // group whose thumbnails look incomplete.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || !hasCompletedInitialLoad || !thumbnailsHydrated) return

      const { project: currentProject, activeSlideGroupId: currentActiveGroupId } = useEditorStore.getState()
      const needsCapture = currentProject.slideGroups.some((group) => {
        if (group.id === currentActiveGroupId) return false
        const state = useEditorStore.getState()
        const pano = getEffectivePano(state.project.settings.pano, state.panoRenderOverride)
        const key = getThumbnailKey(group, state.activeCanvasFormat, state.activeLocale, pano)
        return needsThumbnailCapture(thumbnailEntriesRef.current, group.id, key, group.numSlides)
      })
      if (!needsCapture) return

      precacheLowResThumbnails()
      if (currentActiveGroupId) void captureGroup(currentActiveGroupId)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [precacheLowResThumbnails, captureGroup, activeSlideGroupId, project, hasCompletedInitialLoad, thumbnailsHydrated])

  // ── High-res preview capture (cache-first) ─────────────────────────────────
  const captureAllHighRes = useCallback(async (options: { panoCompensationPx?: number; panoCompensate?: boolean } = {}) => {
    if (previewInFlightRef.current) {
      previewAbortRef.current = true
      await previewInFlightRef.current
    }

    const stage = await waitForStage(stageRef, 2000)
    if (!stage) return

    const run = (async () => {
      const { project, activeSlideGroupId: originalGroupId, activeCanvasFormat, activeFamily } =
        useEditorStore.getState()
      const startProjectId = project.id
      const baseFormat = getProjectBaseFormat(project)
      const panoCompensate = options.panoCompensate ?? false
      const panoCompensationPx = panoCompensate
        ? normalizePanoCompensationPx(options.panoCompensationPx ?? 0)
        : 0

      // Build effective pano for cache key
      const effectivePano = {
        gapPx: panoCompensationPx,
        compensate: panoCompensate,
      }

      previewAbortRef.current = false

      // Check which groups need capture (cache miss)
      const previewGroups = selectFormatViewGroups(project, activeCanvasFormat, activeFamily)
      const groupsToCapture = previewGroups.filter((group) => {
        const key = getGroupPreviewKey(group, activeCanvasFormat, useEditorStore.getState().activeLocale, effectivePano)
        // Check all slides for this group
        for (let i = 0; i < group.numSlides; i++) {
          if (!usePreviewCache.getState().get(group.id, i, key)) return true
        }
        return false
      })

      // If all groups are cached, populate previewThumbs from cache immediately
      if (groupsToCapture.length === 0) {
        const cached: ThumbnailMap = {}
        for (const group of previewGroups) {
          const key = getGroupPreviewKey(group, activeCanvasFormat, useEditorStore.getState().activeLocale, effectivePano)
          cached[group.id] = Array.from({ length: group.numSlides }, (_, i) =>
            usePreviewCache.getState().get(group.id, i, key) ?? ''
          )
        }
        setPreviewThumbs(cached)
        return
      }

      // Populate from cache what we have, show stale for the rest
      const initial: ThumbnailMap = {}
      for (const group of previewGroups) {
        const key = getGroupPreviewKey(group, activeCanvasFormat, useEditorStore.getState().activeLocale, effectivePano)
        const slides = Array.from({ length: group.numSlides }, (_, i) =>
          usePreviewCache.getState().get(group.id, i, key) ?? ''
        )
        if (slides.some(Boolean)) initial[group.id] = slides
      }
      setPreviewThumbs(initial)

      // Only show spinner if we have groups to capture
      setIsCapturingPreview(true)

      await runExclusiveCapture(async () => {
        let lastCaptureGroupId = originalGroupId
        try {
          for (const group of groupsToCapture) {
            const shouldAbortCapture = () => {
              const currentState = useEditorStore.getState()
              return previewAbortRef.current
                || currentState.project.id !== startProjectId
                || currentState.activeFamily !== activeFamily
                || currentState.activeCanvasFormat !== activeCanvasFormat
            }
            if (shouldAbortCapture()) break

            useEditorStore.getState().setCaptureSlideGroup(group.id)
            lastCaptureGroupId = group.id
            useEditorStore.getState().setPanoRenderOverride({
              gapPx: options.panoCompensationPx ?? 0,
              compensate: group.numSlides > 1 && panoCompensate,
            })
            await nextFrame()
            if (shouldAbortCapture()) break
            await nextFrame()
            if (shouldAbortCapture()) break
            await waitForStageCaptureReady(stage)
            if (shouldAbortCapture()) break

            const groupDims = getFormatCanvasDims(group, activeCanvasFormat, baseFormat, project.settings.customFormats)
            const captureLocale = useEditorStore.getState().activeLocale
            const key = getGroupPreviewKey(group, activeCanvasFormat, captureLocale, effectivePano)
            const thumbs = withIdentityTransform(stage, () =>
              Array.from({ length: group.numSlides }, (_, i) =>
                stage.toDataURL({
                  x: getPanoSlideX({ ...group, slideWidth: groupDims.width }, i, panoCompensationPx), y: 0,
                  width: groupDims.width, height: groupDims.height,
                  pixelRatio: Math.min(1, 1600 / groupDims.width), mimeType: 'image/jpeg', quality: 0.92,
                }),
              ),
            )
            const lowResThumbs = await captureGroupThumbs(stage, group, groupDims, panoCompensationPx)
            if (shouldAbortCapture()) break

            // Store in cache
            usePreviewCache.getState().set(group.id, thumbs.map((dataUrl) => ({ key, dataUrl })))
            // Update preview and nav thumbnail state
            setPreviewThumbs((prev) => ({ ...prev, [group.id]: thumbs }))
            const thumbnailKey = getThumbnailKey(group, activeCanvasFormat, captureLocale, effectivePano)
            setThumbnailEntries((prev) => ({ ...prev, [group.id]: { key: thumbnailKey, thumbs: lowResThumbs } }))
          }
        } finally {
          const currentState = useEditorStore.getState()
          if (shouldRestoreCapturedSlideGroup(currentState, {
            projectId: startProjectId,
            groupId: originalGroupId,
            family: activeFamily,
            canvasFormat: activeCanvasFormat,
          }, lastCaptureGroupId)) {
            currentState.setCaptureSlideGroup(originalGroupId)
            if (currentState.selection?.slideGroupId !== originalGroupId) {
              useEditorStore.setState({ selection: null, editingGroupId: null, selectedAccentIndex: null })
            }
          }
          if (currentState.project.id === startProjectId) {
            currentState.setPanoRenderOverride(null)
          }
          setIsCapturingPreview(false)
        }
      })
    })()

    previewInFlightRef.current = run
    try { await run } finally {
      if (previewInFlightRef.current === run) previewInFlightRef.current = null
    }
  }, [stageRef])

  const cancelPreviewCapture = useCallback(() => { previewAbortRef.current = true }, [])

  const { thumbnails, staleGroupIds } = useMemo(() => {
    const pano = getEffectivePano(project.settings.pano, panoRenderOverride)
    const stale = new Set<string>()
    const visibleThumbs: ThumbnailMap = {}
    for (const group of project.slideGroups) {
      const key = getThumbnailKey(group, activeCanvasFormat, activeLocale, pano)
      const fresh = getFreshThumbs(thumbnailEntries, group.id, key)
      const lastKnown = thumbnailEntries[group.id]?.thumbs
      if (fresh ?? lastKnown) visibleThumbs[group.id] = fresh ?? lastKnown!
      if (needsThumbnailCapture(thumbnailEntries, group.id, key, group.numSlides)) {
        stale.add(group.id)
      }
    }
    return {
      // Preserve stale images as a visual fallback while recapture runs.
      thumbnails: visibleThumbs,
      staleGroupIds: stale,
    }
  }, [thumbnailEntries, project, activeCanvasFormat, activeLocale, panoRenderOverride])

  return {
    thumbnails,
    staleGroupIds,
    captureNow: captureGroup,
    previewThumbs,
    isCapturingPreview,
    captureAllHighRes,
    cancelPreviewCapture,
    offscreenThumbnailElement,
    requestOffscreenThumbnails,
  }
}
