import { useRef, useState, useCallback, useEffect, type RefObject } from 'react'
import type Konva from 'konva'
import { useEditorStore } from '@/store'
import { getFormatCanvasDims, getProjectBaseFormat } from '@/utils/canvasFormats'

const IMAGE_READY_TIMEOUT_MS = 3000
const IMAGE_POLL_INTERVAL_MS = 30

/**
 * Wait until every Konva Image node on the stage has its `image()` attribute
 * set (meaning use-image has decoded and resolved it), or until the timeout
 * elapses. Falls back gracefully — a partial render is better than nothing.
 */
function waitForStageImages(stage: Konva.Stage): Promise<void> {
  return new Promise((resolve) => {
    const deadline = Date.now() + IMAGE_READY_TIMEOUT_MS
    const check = () => {
      const images = stage.find('Image') as Konva.Image[]
      const allReady = images.every((img) => img.image() != null)
      if (allReady || Date.now() >= deadline) {
        resolve()
      } else {
        setTimeout(check, IMAGE_POLL_INTERVAL_MS)
      }
    }
    check()
  })
}

export type ThumbnailMap = Record<string, string[]>

const DEBOUNCE_MS = 600

function withIdentityTransform<T>(stage: Konva.Stage, fn: () => T): T {
  const prevX = stage.x()
  const prevY = stage.y()
  const prevScaleX = stage.scaleX()
  const prevScaleY = stage.scaleY()
  try {
    stage.x(0)
    stage.y(0)
    stage.scaleX(1)
    stage.scaleY(1)
    return fn()
  } finally {
    stage.x(prevX)
    stage.y(prevY)
    stage.scaleX(prevScaleX)
    stage.scaleY(prevScaleY)
  }
}

export function useThumbnails(stageRef: RefObject<Konva.Stage | null>) {
  const project = useEditorStore((s) => s.project)
  const activeSlideGroupId = useEditorStore((s) => s.activeSlideGroupId)
  const activeLocale = useEditorStore((s) => s.activeLocale)
  const activeCanvasFormat = useEditorStore((s) => s.activeCanvasFormat)
  const [thumbnails, setThumbnails] = useState<ThumbnailMap>({})
  const [previewThumbs, setPreviewThumbs] = useState<ThumbnailMap>({})
  const [isCapturingPreview, setIsCapturingPreview] = useState(false)
  const debounceRef = useRef<number | null>(null)
  const captureAbortRef = useRef(false)
  const inFlightCaptureRef = useRef<Promise<void> | null>(null)

  const captureGroup = useCallback((groupId?: string) => {
    const stage = stageRef.current
    const targetGroupId = groupId ?? activeSlideGroupId
    const group = project.slideGroups.find((item) => item.id === targetGroupId)

    if (!stage || !group || targetGroupId !== activeSlideGroupId) return

    const activeCanvasFormat = useEditorStore.getState().activeCanvasFormat
    const baseFormat = getProjectBaseFormat(project)
    const dims = getFormatCanvasDims(group, activeCanvasFormat, baseFormat)

    const smallRatio = 88 / dims.height
    const nextThumbs = withIdentityTransform(stage, () =>
      Array.from({ length: group.numSlides }, (_, i) =>
        stage.toDataURL({
          x: i * dims.width,
          y: 0,
          width: dims.width,
          height: dims.height,
          pixelRatio: smallRatio,
          mimeType: 'image/jpeg',
          quality: 0.85,
        }),
      ),
    )

    setThumbnails((prev) => ({
      ...prev,
      [group.id]: nextThumbs,
    }))
  }, [activeSlideGroupId, project, stageRef])

  useEffect(() => {
    if (!activeSlideGroupId) return

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current)
    }

    debounceRef.current = window.setTimeout(() => {
      captureGroup(activeSlideGroupId)
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [activeSlideGroupId, activeLocale, activeCanvasFormat, captureGroup, project])

  const captureAllHighRes = useCallback(async () => {
    // Abort any in-flight capture and wait for it to wind down before restarting,
    // so locale/format switches inside the preview always trigger a fresh pass.
    if (inFlightCaptureRef.current) {
      captureAbortRef.current = true
      await inFlightCaptureRef.current
    }

    // Wait for the stage to be mounted and sized (ResizeObserver may not have
    // fired yet if the editor view was just switched to).
    const stage = await new Promise<Konva.Stage | null>((resolve) => {
      const deadline = Date.now() + 2000
      const poll = () => {
        const s = stageRef.current
        if (s && s.width() > 0) return resolve(s)
        if (Date.now() >= deadline) return resolve(null)
        setTimeout(poll, 30)
      }
      poll()
    })
    if (!stage) return

    const run = (async () => {
      const { project, activeSlideGroupId: originalGroupId, setActiveSlideGroup, activeCanvasFormat } =
        useEditorStore.getState()
      const baseFormat = getProjectBaseFormat(project)

      captureAbortRef.current = false
      setIsCapturingPreview(true)
      setPreviewThumbs({})

      try {
        for (const group of project.slideGroups) {
          if (captureAbortRef.current) break

          setActiveSlideGroup(group.id)

          // Give React one tick to flush the group switch, then wait for all
          // Konva Image nodes (phone frames, screenshots, logos) to finish
          // decoding via use-image before capturing.
          await new Promise<void>((resolve) => setTimeout(resolve, 16))
          await waitForStageImages(stage)

          if (captureAbortRef.current) break

          const groupDims = getFormatCanvasDims(group, activeCanvasFormat, baseFormat)
          const thumbs = withIdentityTransform(stage, () =>
            Array.from({ length: group.numSlides }, (_, i) =>
              stage.toDataURL({
                x: i * groupDims.width,
                y: 0,
                width: groupDims.width,
                height: groupDims.height,
                pixelRatio: 1,
                mimeType: 'image/jpeg',
                quality: 0.92,
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

    inFlightCaptureRef.current = run
    try {
      await run
    } finally {
      if (inFlightCaptureRef.current === run) inFlightCaptureRef.current = null
    }
  }, [stageRef])

  const cancelPreviewCapture = useCallback(() => {
    captureAbortRef.current = true
  }, [])

  return {
    thumbnails,
    captureNow: captureGroup,
    previewThumbs,
    isCapturingPreview,
    captureAllHighRes,
    cancelPreviewCapture,
  }
}
