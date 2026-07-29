import { useRef, useState, useCallback, useEffect, useLayoutEffect, type RefObject } from 'react'
import type Konva from 'konva'
import { useEditorStore } from '@/store'
import { usePreviewCache } from '@/store/previewCache'
import { getFormatCanvasDims, getProjectBaseFormat, selectFamilyGroups, selectFormatViewGroups } from '@/utils/canvasFormats'
import { getPanoSlideX, normalizePanoCompensationPx, getEffectivePano } from '@/utils/panoGeometry'
import { nextFrame, runExclusiveCapture, waitForStage, waitForStageCaptureReady, withIdentityTransform } from '@/utils/stageCapture'
import { getGroupPreviewKey } from '@/utils/previewKey'
import { idbStorage } from '@/store/idb-storage'

export type ThumbnailMap = Record<string, string[]>

const DEBOUNCE_MS = 600
const THUMBNAIL_FLUSH_MS = 300
const MAX_BACKGROUND_PRECACHE_CANVAS_AREA = 8_000_000

type PersistedThumbnailMap = Record<string, { key: string; thumbs: string[] }>

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

export function isBackgroundPrecacheEligible(group: { slideWidth: number; slideHeight: number; numSlides?: number }): boolean {
  return group.slideWidth * (group.numSlides ?? 1) * group.slideHeight <= MAX_BACKGROUND_PRECACHE_CANVAS_AREA
}

const thumbnailStorageKey = (projectId: string) => `pixeldeck-thumbs:${projectId}`

function getThumbnailKey(...args: Parameters<typeof getGroupPreviewKey>): string {
  const [group, format, locale, pano] = args
  const sanitizedGroup = JSON.parse(JSON.stringify(group, (key, value) => (
    key.endsWith('DataUrl') ? undefined : value
  ))) as typeof group
  return getGroupPreviewKey(sanitizedGroup, format, locale, pano)
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

  const [thumbnails, setThumbnails] = useState<ThumbnailMap>({})
  const [previewThumbs, setPreviewThumbs] = useState<ThumbnailMap>({})
  const [isCapturingPreview, setIsCapturingPreview] = useState(false)
  const [isPrecachingThumbnails, setIsPrecachingThumbnails] = useState(false)
  const [precacheFreezeFrame, setPrecacheFreezeFrame] = useState<string | null>(null)
  const [hasCompletedInitialPrecache, setHasCompletedInitialPrecache] = useState(false)
  const [thumbnailsHydrated, setThumbnailsHydrated] = useState(false)

  const thumbnailsRef = useRef<ThumbnailMap>(thumbnails)
  useEffect(() => { thumbnailsRef.current = thumbnails }, [thumbnails])
  // Keys are captured with their rendered thumbnails so persistence never has
  // to walk every group's layer tree during an ordinary edit-triggered flush.
  const thumbnailKeysRef = useRef<Record<string, string>>({})

  const debounceRef = useRef<number | null>(null)
  const previewAbortRef = useRef(false)
  const previewInFlightRef = useRef<Promise<void> | null>(null)
  const precacheAbortRef = useRef(false)
  const precacheInFlightRef = useRef<Promise<void> | null>(null)
  const precacheRerunRequestedRef = useRef(false)
  const thumbnailFlushRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Project-switch reset ────────────────────────────────────────────────────
  const prevProjectIdRef = useRef(project.id)
  useLayoutEffect(() => {
    if (prevProjectIdRef.current === project.id) return
    prevProjectIdRef.current = project.id
    precacheAbortRef.current = true
    thumbnailKeysRef.current = {}
    setThumbnails({})
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
    thumbnailKeysRef.current[group.id] = getThumbnailKey(group, format, locale, { gapPx, compensate })
    setThumbnails((prev) => ({
      ...prev,
      [group.id]: thumbs,
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
      setThumbnails({})
    })
    void (async () => {
      const raw = typeof indexedDB === 'undefined' ? null : await idbStorage.getItem(thumbnailStorageKey(project.id))
      if (cancelled) return
      if (raw) {
        try {
          const stored = JSON.parse(raw) as PersistedThumbnailMap
          const {
            project: currentProject,
            activeCanvasFormat: currentCanvasFormat,
            activeLocale: currentLocale,
            panoRenderOverride: currentPanoOverride,
          } = useEditorStore.getState()
          if (currentProject.id !== project.id) return
          const { gapPx, compensate } = getEffectivePano(currentProject.settings.pano, currentPanoOverride)
          const hydrated: ThumbnailMap = {}
          const hydratedKeys: Record<string, string> = {}
          for (const group of currentProject.slideGroups) {
            const entry = stored[group.id]
            const key = getThumbnailKey(group, currentCanvasFormat, currentLocale, { gapPx, compensate })
            if (entry?.key === key && entry.thumbs.length >= group.numSlides) {
              hydrated[group.id] = entry.thumbs
              hydratedKeys[group.id] = entry.key
            }
          }
          thumbnailKeysRef.current = hydratedKeys
          setThumbnails(hydrated)
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
      const persisted: PersistedThumbnailMap = {}
      for (const [groupId, thumbs] of Object.entries(thumbnailsRef.current)) {
        const key = thumbnailKeysRef.current[groupId]
        if (key) persisted[groupId] = { key, thumbs }
      }
      void idbStorage.setItem(thumbnailStorageKey(project.id), JSON.stringify(persisted))
    }, THUMBNAIL_FLUSH_MS)
    return () => {
      if (thumbnailFlushRef.current) clearTimeout(thumbnailFlushRef.current)
    }
  }, [thumbnails, thumbnailsHydrated, project.id])

  // ── Eager low-res capture for inactive groups ───────────────────────────────
  const precacheLowResThumbnails = useCallback(async () => {
    if (precacheInFlightRef.current) {
      precacheRerunRequestedRef.current = true
      return
    }
    const { project: currentProject, activeSlideGroupId: currentGroupId, activeFamily: currentFamily } = useEditorStore.getState()
    const hasGroupsToCapture = selectFamilyGroups(currentProject, currentFamily).some((group) => {
      if (group.id === currentGroupId) return false
      const existing = thumbnailsRef.current[group.id]
      return isBackgroundPrecacheEligible(group)
        && (!existing || existing.length < group.numSlides || !existing.slice(0, group.numSlides).every(Boolean))
    })
    if (!hasGroupsToCapture) {
      setHasCompletedInitialPrecache(true)
      return
    }

    let retryMode: 'idle' | 'backoff' | null = null
    const run = (async () => {
      setIsPrecachingThumbnails(true)
      useEditorStore.getState().setIsPrecachingThumbnails(true)
      precacheAbortRef.current = false
      precacheRerunRequestedRef.current = false
      try {
        await runExclusiveCapture(async () => {
          const stage = await waitForStage(stageRef, 2000)
          if (!stage || precacheAbortRef.current) return
          // Explicit dimensions and the live transform preserve the user's viewport.
          const freezeFrame = stage.toDataURL({
            x: 0, y: 0, width: stage.width(), height: stage.height(),
            pixelRatio: 1, mimeType: 'image/jpeg', quality: 0.8,
          })
          setPrecacheFreezeFrame(freezeFrame)
          const freezeFrameImage = new Image()
          await new Promise<void>((resolve, reject) => {
            freezeFrameImage.onload = () => resolve()
            freezeFrameImage.onerror = () => reject(new Error('Failed to decode precache freeze frame'))
            freezeFrameImage.src = freezeFrame
          })
          if (precacheAbortRef.current) return

          const {
            project: startProject,
            activeSlideGroupId: originalGroupId,
            activeCanvasFormat: startCanvasFormat,
            activeFamily: startFamily,
          } = useEditorStore.getState()
          const startProjectId = startProject.id
          const baseFormat = getProjectBaseFormat(startProject)
          const groupsToCapture = selectFamilyGroups(startProject, startFamily)
            .filter((group) => {
              if (group.id === originalGroupId) return false
              const existing = thumbnailsRef.current[group.id]
              return isBackgroundPrecacheEligible(group)
                && (!existing || existing.length < group.numSlides || !existing.slice(0, group.numSlides).every(Boolean))
            })
          let lastCaptureGroupId = originalGroupId

          try {
            const group = groupsToCapture[0]
            if (group) {
              const currentBeforeCapture = useEditorStore.getState()
              if (
                precacheAbortRef.current
                || currentBeforeCapture.project.id !== startProjectId
                || currentBeforeCapture.activeFamily !== startFamily
                || currentBeforeCapture.activeCanvasFormat !== startCanvasFormat
              ) return
              useEditorStore.getState().setCaptureSlideGroup(group.id)
              lastCaptureGroupId = group.id
              await nextFrame()
              const currentAfterFirstFrame = useEditorStore.getState()
              if (
                precacheAbortRef.current
                || currentAfterFirstFrame.project.id !== startProjectId
                || currentAfterFirstFrame.activeFamily !== startFamily
                || currentAfterFirstFrame.activeCanvasFormat !== startCanvasFormat
              ) return
              await nextFrame()
              const currentAfterSecondFrame = useEditorStore.getState()
              if (
                precacheAbortRef.current
                || currentAfterSecondFrame.project.id !== startProjectId
                || currentAfterSecondFrame.activeFamily !== startFamily
                || currentAfterSecondFrame.activeCanvasFormat !== startCanvasFormat
              ) return
              await waitForStageCaptureReady(stage, { quietFrames: 1, timeoutMs: 1200 })
              const currentState = useEditorStore.getState()
              if (
                precacheAbortRef.current
                || currentState.project.id !== startProjectId
                || currentState.activeFamily !== startFamily
                || currentState.activeCanvasFormat !== startCanvasFormat
              ) return
              const { gapPx, compensate } = getEffectivePano(currentState.project.settings.pano, currentState.panoRenderOverride)
              const dims = getFormatCanvasDims(group, startCanvasFormat, baseFormat, currentState.project.settings.customFormats)
              const captureLocale = currentState.activeLocale
              const groupThumbs = await captureGroupThumbs(stage, group, dims, compensate ? gapPx : 0)
              const currentAfterCapture = useEditorStore.getState()
              if (
                precacheAbortRef.current
                || currentAfterCapture.project.id !== startProjectId
                || currentAfterCapture.activeFamily !== startFamily
                || currentAfterCapture.activeCanvasFormat !== startCanvasFormat
              ) return
              thumbnailKeysRef.current[group.id] = getThumbnailKey(group, startCanvasFormat, captureLocale, { gapPx, compensate })
              setThumbnails((prev) => ({ ...prev, [group.id]: groupThumbs }))
              precacheRerunRequestedRef.current = true
            }
          } finally {
            const currentState = useEditorStore.getState()
            if (shouldRestoreCapturedSlideGroup(currentState, {
              projectId: startProjectId,
              groupId: originalGroupId,
              family: startFamily,
              canvasFormat: startCanvasFormat,
            }, lastCaptureGroupId)) {
              currentState.setCaptureSlideGroup(originalGroupId)
              if (currentState.selection?.slideGroupId !== originalGroupId) {
                useEditorStore.setState({ selection: null, editingGroupId: null, selectedAccentIndex: null })
              }
            }
          }
        })
      } finally {
        setIsPrecachingThumbnails(false)
        useEditorStore.getState().setIsPrecachingThumbnails(false)
        setPrecacheFreezeFrame(null)
        setHasCompletedInitialPrecache(true)
        if (precacheRerunRequestedRef.current || precacheAbortRef.current) {
          retryMode = precacheAbortRef.current ? 'backoff' : 'idle'
        }
      }
    })()

    precacheInFlightRef.current = run
    try { await run } finally {
      if (precacheInFlightRef.current === run) precacheInFlightRef.current = null
      if (retryMode) {
        const retry = () => { void precacheLowResThumbnails() }
        globalThis.setTimeout(retry, retryMode === 'backoff' ? 3000 : 750)
      }
    }
  }, [stageRef])

  useEffect(() => {
    if (!isPrecachingThumbnails) return
    const abortPrecache = () => { precacheAbortRef.current = true }
    window.addEventListener('pointerdown', abortPrecache, { capture: true })
    window.addEventListener('keydown', abortPrecache, { capture: true })
    window.addEventListener('wheel', abortPrecache, { capture: true, passive: true })
    return () => {
      window.removeEventListener('pointerdown', abortPrecache, { capture: true })
      window.removeEventListener('keydown', abortPrecache, { capture: true })
      window.removeEventListener('wheel', abortPrecache, { capture: true })
    }
  }, [isPrecachingThumbnails])

  const slideGroupIds = project.slideGroups.map((group) => group.id).join(',')
  useEffect(() => {
    if (!hasCompletedInitialLoad || !thumbnailsHydrated) return
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let idleCallbackId: number | null = null
    const start = () => {
      precacheLowResThumbnails().catch((err) => console.error('[PixelDeck] precache failed', err))
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
  }, [project.id, slideGroupIds, activeFamily, hasCompletedInitialLoad, thumbnailsHydrated, precacheLowResThumbnails])

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
        const existing = thumbnailsRef.current[group.id]
        return !existing || existing.length < group.numSlides || !existing.slice(0, group.numSlides).every(Boolean)
      })
      if (!needsCapture) return

      precacheLowResThumbnails().catch((err) => console.error('[PixelDeck] precache failed', err))
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
            thumbnailKeysRef.current[group.id] = getThumbnailKey(group, activeCanvasFormat, captureLocale, effectivePano)
            setThumbnails((prev) => ({ ...prev, [group.id]: lowResThumbs }))
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

  return {
    thumbnails,
    captureNow: captureGroup,
    previewThumbs,
    isCapturingPreview,
    isPrecachingThumbnails,
    precacheFreezeFrame,
    hasCompletedInitialPrecache,
    isCapturingThumbnails: isPrecachingThumbnails,
    captureAllHighRes,
    cancelPreviewCapture,
  }
}
