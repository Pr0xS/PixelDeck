import { useRef, useState, useCallback, useEffect, useLayoutEffect, type RefObject } from 'react'
import type Konva from 'konva'
import { useEditorStore } from '@/store'
import { getFormatCanvasDims, getProjectBaseFormat } from '@/utils/canvasFormats'

const IMAGE_READY_TIMEOUT_MS = 3000
const IMAGE_POLL_INTERVAL_MS = 30

function waitForStageImages(stage: Konva.Stage): Promise<void> {
  return new Promise((resolve) => {
    const deadline = Date.now() + IMAGE_READY_TIMEOUT_MS
    const check = () => {
      const images = stage.find('Image') as Konva.Image[]
      const allReady = images.every((img) => img.image() != null)
      if (allReady || Date.now() >= deadline) resolve()
      else setTimeout(check, IMAGE_POLL_INTERVAL_MS)
    }
    check()
  })
}

/** Poll until the stage is mounted and has a non-zero width, or timeout. */
function pollStage(stageRef: RefObject<Konva.Stage | null>, timeoutMs = 3000): Promise<Konva.Stage | null> {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs
    const poll = () => {
      const s = stageRef.current
      if (s && s.width() > 0) return resolve(s)
      if (Date.now() >= deadline) return resolve(null)
      setTimeout(poll, 30)
    }
    poll()
  })
}

/** Wait two animation frames — enough for React to flush + browser to paint. */
function doubleRaf(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

export type ThumbnailMap = Record<string, string[]>

const DEBOUNCE_MS = 600

function withIdentityTransform<T>(stage: Konva.Stage, fn: () => T): T {
  const prevX = stage.x()
  const prevY = stage.y()
  const prevScaleX = stage.scaleX()
  const prevScaleY = stage.scaleY()
  try {
    stage.x(0); stage.y(0); stage.scaleX(1); stage.scaleY(1)
    return fn()
  } finally {
    stage.x(prevX); stage.y(prevY); stage.scaleX(prevScaleX); stage.scaleY(prevScaleY)
  }
}

/** Capture low-res nav thumbnails for a single group. */
function captureGroupThumbs(
  stage: Konva.Stage,
  group: { id: string; numSlides: number },
  dims: { width: number; height: number },
): string[] {
  const smallRatio = 88 / dims.height
  return withIdentityTransform(stage, () =>
    Array.from({ length: group.numSlides }, (_, i) =>
      stage.toDataURL({
        x: i * dims.width, y: 0,
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

  // Start in loading state — overlay is visible from the very first paint.
  const [thumbnails, setThumbnails] = useState<ThumbnailMap>({})
  const [previewThumbs, setPreviewThumbs] = useState<ThumbnailMap>({})
  const [isCapturingPreview, setIsCapturingPreview] = useState(false)
  const [isCapturingThumbnails, setIsCapturingThumbnails] = useState(true)

  // Kept in sync via an effect declared before the capture effect, so React's
  // effect ordering guarantee ensures it's current when the capture effect runs.
  const thumbnailsRef = useRef<ThumbnailMap>(thumbnails)
  useEffect(() => { thumbnailsRef.current = thumbnails }, [thumbnails])

  const debounceRef = useRef<number | null>(null)
  const captureAbortRef = useRef(false)
  const inFlightCaptureRef = useRef<Promise<void> | null>(null)
  const previewAbortRef = useRef(false)
  const previewInFlightRef = useRef<Promise<void> | null>(null)

  // ── Project-switch reset ────────────────────────────────────────────────────
  // useLayoutEffect fires before paint, so the overlay is already up when the
  // new project's canvas renders for the first time.
  const prevProjectIdRef = useRef(project.id)
  useLayoutEffect(() => {
    if (prevProjectIdRef.current === project.id) return
    prevProjectIdRef.current = project.id
    setThumbnails({})
    setIsCapturingThumbnails(true)
    // Abort any in-flight thumbnail capture for the old project.
    captureAbortRef.current = true
  }, [project.id])

  // ── Debounced capture of the active group after edits ──────────────────────
  const captureGroup = useCallback((groupId?: string) => {
    const stage = stageRef.current
    const targetGroupId = groupId ?? activeSlideGroupId
    const group = project.slideGroups.find((g) => g.id === targetGroupId)
    if (!stage || !group || targetGroupId !== activeSlideGroupId) return

    const format = useEditorStore.getState().activeCanvasFormat
    const baseFormat = getProjectBaseFormat(project)
    const dims = getFormatCanvasDims(group, format, baseFormat)

    setThumbnails((prev) => ({
      ...prev,
      [group.id]: captureGroupThumbs(stage, group, dims),
    }))
  }, [activeSlideGroupId, project, stageRef])

  useEffect(() => {
    if (!activeSlideGroupId) return
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => captureGroup(activeSlideGroupId), DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) { window.clearTimeout(debounceRef.current); debounceRef.current = null }
    }
  }, [activeSlideGroupId, activeLocale, activeCanvasFormat, captureGroup, project])

  // ── Initial / project-switch full capture pass ─────────────────────────────
  // Deps use a stable id-list string instead of the slideGroups array ref to
  // avoid re-running on every routine edit (updateLayer, moveLayer, etc.).
  const slideGroupIdList = project.slideGroups.map((g) => g.id).join('|')

  useEffect(() => {
    const missingIds = project.slideGroups
      .filter((g) => !thumbnailsRef.current[g.id])
      .map((g) => g.id)

    if (missingIds.length === 0) {
      setIsCapturingThumbnails(false)
      return
    }

    // Reset abort flag for this new run.
    captureAbortRef.current = false

    const run = (async () => {
      const stage = await pollStage(stageRef)
      if (!stage || captureAbortRef.current) {
        setIsCapturingThumbnails(false)
        return
      }

      const {
        project: currentProject,
        activeSlideGroupId: originalGroupId,
        setActiveSlideGroup,
        activeCanvasFormat: currentFormat,
      } = useEditorStore.getState()
      const baseFormat = getProjectBaseFormat(currentProject)

      try {
        for (const group of currentProject.slideGroups) {
          if (captureAbortRef.current) break
          if (!missingIds.includes(group.id)) continue

          setActiveSlideGroup(group.id)
          await new Promise<void>((resolve) => setTimeout(resolve, 16))
          await waitForStageImages(stage)
          if (captureAbortRef.current) break

          const dims = getFormatCanvasDims(group, currentFormat, baseFormat)
          setThumbnails((prev) => ({ ...prev, [group.id]: captureGroupThumbs(stage, group, dims) }))
        }
      } finally {
        const restoreId = originalGroupId ?? useEditorStore.getState().project.slideGroups[0]?.id
        if (restoreId) setActiveSlideGroup(restoreId)
        // Two rAFs: enough for React to flush the group restore + StageCanvas
        // auto-center effect to run before we drop the overlay.
        await doubleRaf()
        setIsCapturingThumbnails(false)
      }
    })()

    inFlightCaptureRef.current = run
    run.finally(() => { if (inFlightCaptureRef.current === run) inFlightCaptureRef.current = null })

    return () => {
      // Abort the in-flight loop when deps change mid-capture.
      captureAbortRef.current = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideGroupIdList, activeLocale, activeCanvasFormat, stageRef])

  // ── High-res preview capture ───────────────────────────────────────────────
  const captureAllHighRes = useCallback(async () => {
    if (previewInFlightRef.current) {
      previewAbortRef.current = true
      await previewInFlightRef.current
    }

    const stage = await pollStage(stageRef, 2000)
    if (!stage) return

    const run = (async () => {
      const { project, activeSlideGroupId: originalGroupId, setActiveSlideGroup, activeCanvasFormat } =
        useEditorStore.getState()
      const baseFormat = getProjectBaseFormat(project)

      previewAbortRef.current = false
      setIsCapturingPreview(true)
      setPreviewThumbs({})

      try {
        for (const group of project.slideGroups) {
          if (previewAbortRef.current) break

          setActiveSlideGroup(group.id)
          await new Promise<void>((resolve) => setTimeout(resolve, 16))
          await waitForStageImages(stage)
          if (previewAbortRef.current) break

          const groupDims = getFormatCanvasDims(group, activeCanvasFormat, baseFormat)
          const thumbs = withIdentityTransform(stage, () =>
            Array.from({ length: group.numSlides }, (_, i) =>
              stage.toDataURL({
                x: i * groupDims.width, y: 0,
                width: groupDims.width, height: groupDims.height,
                pixelRatio: 1, mimeType: 'image/jpeg', quality: 0.92,
              }),
            ),
          )
          setPreviewThumbs((prev) => ({ ...prev, [group.id]: thumbs }))
        }
      } finally {
        const restoreId = originalGroupId ?? useEditorStore.getState().project.slideGroups[0]?.id
        if (restoreId) useEditorStore.getState().setActiveSlideGroup(restoreId)
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
    isCapturingThumbnails,
    captureAllHighRes,
    cancelPreviewCapture,
  }
}
