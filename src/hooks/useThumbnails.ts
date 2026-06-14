import { useRef, useState, useCallback, useEffect, useLayoutEffect, type RefObject } from 'react'
import type Konva from 'konva'
import { useEditorStore } from '@/store'
import { usePreviewCache } from '@/store/previewCache'
import { getFormatCanvasDims, getProjectBaseFormat } from '@/utils/canvasFormats'
import { getPanoSlideX, normalizePanoCompensationPx, getEffectivePano } from '@/utils/panoGeometry'
import { waitForStage, waitForStageCaptureReady, withIdentityTransform } from '@/utils/stageCapture'
import { getGroupPreviewKey } from '@/utils/previewKey'

export type ThumbnailMap = Record<string, string[]>

const DEBOUNCE_MS = 600

/** Capture low-res nav thumbnails for a single group. */
function captureGroupThumbs(
  stage: Konva.Stage,
  group: { id: string; numSlides: number },
  dims: { width: number; height: number },
  panoCompensationPx = 0,
): string[] {
  const smallRatio = 88 / dims.height
  return withIdentityTransform(stage, () =>
    Array.from({ length: group.numSlides }, (_, i) =>
      stage.toDataURL({
        x: getPanoSlideX({ ...group, slideWidth: dims.width }, i, panoCompensationPx), y: 0,
        width: dims.width, height: dims.height,
        pixelRatio: smallRatio,
        mimeType: 'image/jpeg', quality: 0.85,
      }),
    ),
  )
}

export function useThumbnails(stageRef: RefObject<Konva.Stage | null>) {
  const project = useEditorStore((s) => s.project)
  const activeSlideGroupId = useEditorStore((s) => s.activeSlideGroupId)
  const activeLocale = useEditorStore((s) => s.activeLocale)
  const activeCanvasFormat = useEditorStore((s) => s.activeCanvasFormat)
  const projectPano = useEditorStore((s) => s.project.settings.pano)
  const panoRenderOverride = useEditorStore((s) => s.panoRenderOverride)

  const [thumbnails, setThumbnails] = useState<ThumbnailMap>({})
  const [previewThumbs, setPreviewThumbs] = useState<ThumbnailMap>({})
  const [isCapturingPreview, setIsCapturingPreview] = useState(false)

  const thumbnailsRef = useRef<ThumbnailMap>(thumbnails)
  useEffect(() => { thumbnailsRef.current = thumbnails }, [thumbnails])

  const debounceRef = useRef<number | null>(null)
  const previewAbortRef = useRef(false)
  const previewInFlightRef = useRef<Promise<void> | null>(null)

  // ── Project-switch reset ────────────────────────────────────────────────────
  const prevProjectIdRef = useRef(project.id)
  useLayoutEffect(() => {
    if (prevProjectIdRef.current === project.id) return
    prevProjectIdRef.current = project.id
    setThumbnails({})
    setPreviewThumbs({})
    usePreviewCache.getState().clear()
  }, [project.id])

  // ── Debounced capture of the active group after edits ──────────────────────
  const captureGroup = useCallback((groupId?: string) => {
    const stage = stageRef.current
    const targetGroupId = groupId ?? activeSlideGroupId
    const group = project.slideGroups.find((g) => g.id === targetGroupId)
    if (!stage || !group || targetGroupId !== activeSlideGroupId) return

    const format = useEditorStore.getState().activeCanvasFormat
    const { project: currentProject, panoRenderOverride: currentOverride } = useEditorStore.getState()
    const { gapPx, compensate } = getEffectivePano(currentProject.settings.pano, currentOverride)
    const effectivePanoCompensationPx = compensate ? gapPx : 0
    const baseFormat = getProjectBaseFormat(project)
    const dims = getFormatCanvasDims(group, format, baseFormat)

    setThumbnails((prev) => ({
      ...prev,
      [group.id]: captureGroupThumbs(stage, group, dims, effectivePanoCompensationPx),
    }))

    // Invalidate preview cache for this group — it's now stale
    usePreviewCache.getState().invalidate(group.id)
  }, [activeSlideGroupId, project, stageRef])

  useEffect(() => {
    if (!activeSlideGroupId) return
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => captureGroup(activeSlideGroupId), DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) { window.clearTimeout(debounceRef.current); debounceRef.current = null }
    }
  }, [activeSlideGroupId, activeLocale, activeCanvasFormat, projectPano, panoRenderOverride, captureGroup, project])

  // ── High-res preview capture (cache-first) ─────────────────────────────────
  const captureAllHighRes = useCallback(async (options: { panoCompensationPx?: number; panoCompensate?: boolean } = {}) => {
    if (previewInFlightRef.current) {
      previewAbortRef.current = true
      await previewInFlightRef.current
    }

    const stage = await waitForStage(stageRef, 2000)
    if (!stage) return

    const run = (async () => {
      const { project, activeSlideGroupId: originalGroupId, setActiveSlideGroup, activeCanvasFormat } =
        useEditorStore.getState()
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
      const groupsToCapture = project.slideGroups.filter((group) => {
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
        for (const group of project.slideGroups) {
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
      for (const group of project.slideGroups) {
        const key = getGroupPreviewKey(group, activeCanvasFormat, useEditorStore.getState().activeLocale, effectivePano)
        const slides = Array.from({ length: group.numSlides }, (_, i) =>
          usePreviewCache.getState().get(group.id, i, key) ?? ''
        )
        if (slides.some(Boolean)) initial[group.id] = slides
      }
      setPreviewThumbs(initial)

      // Only show spinner if we have groups to capture
      setIsCapturingPreview(true)

      try {
        for (const group of groupsToCapture) {
          if (previewAbortRef.current) break

          setActiveSlideGroup(group.id)
          useEditorStore.getState().setPanoRenderOverride({
            gapPx: options.panoCompensationPx ?? 0,
            compensate: group.numSlides > 1 && panoCompensate,
          })
          await new Promise<void>((resolve) => setTimeout(resolve, 16))
          await waitForStageCaptureReady(stage)
          if (previewAbortRef.current) break

          const groupDims = getFormatCanvasDims(group, activeCanvasFormat, baseFormat)
          const key = getGroupPreviewKey(group, activeCanvasFormat, useEditorStore.getState().activeLocale, effectivePano)
          const thumbs = withIdentityTransform(stage, () =>
            Array.from({ length: group.numSlides }, (_, i) =>
              stage.toDataURL({
                x: getPanoSlideX({ ...group, slideWidth: groupDims.width }, i, panoCompensationPx), y: 0,
                width: groupDims.width, height: groupDims.height,
                pixelRatio: 1, mimeType: 'image/jpeg', quality: 0.92,
              }),
            ),
          )

          // Store in cache
          usePreviewCache.getState().set(group.id, thumbs.map((dataUrl) => ({ key, dataUrl })))
          // Update preview state
          setPreviewThumbs((prev) => ({ ...prev, [group.id]: thumbs }))
        }
      } finally {
        const restoreId = originalGroupId ?? useEditorStore.getState().project.slideGroups[0]?.id
        if (restoreId) useEditorStore.getState().setActiveSlideGroup(restoreId)
        useEditorStore.getState().setPanoRenderOverride(null)
        setIsCapturingPreview(false)
      }
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
    isCapturingThumbnails: false,  // No more initial overlay
    captureAllHighRes,
    cancelPreviewCapture,
  }
}
