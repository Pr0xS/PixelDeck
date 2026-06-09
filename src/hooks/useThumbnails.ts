import { useRef, useState, useCallback, useEffect, type RefObject } from 'react'
import type Konva from 'konva'
import { useEditorStore } from '@/store'

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
  const [thumbnails, setThumbnails] = useState<ThumbnailMap>({})
  const [previewThumbs, setPreviewThumbs] = useState<ThumbnailMap>({})
  const [isCapturingPreview, setIsCapturingPreview] = useState(false)
  const debounceRef = useRef<number | null>(null)
  const isCapturingRef = useRef(false)
  const captureAbortRef = useRef(false)

  const captureGroup = useCallback((groupId?: string) => {
    const stage = stageRef.current
    const targetGroupId = groupId ?? activeSlideGroupId
    const group = project.slideGroups.find((item) => item.id === targetGroupId)

    if (!stage || !group || targetGroupId !== activeSlideGroupId) return

    const smallRatio = 88 / group.slideHeight
    const nextThumbs = withIdentityTransform(stage, () =>
      Array.from({ length: group.numSlides }, (_, i) =>
        stage.toDataURL({
          x: i * group.slideWidth,
          y: 0,
          width: group.slideWidth,
          height: group.slideHeight,
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
  }, [activeSlideGroupId, project.slideGroups, stageRef])

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
  }, [activeSlideGroupId, activeLocale, captureGroup, project])

  const captureAllHighRes = useCallback(async () => {
    if (isCapturingRef.current) return
    const stage = stageRef.current
    if (!stage) return

    const { project, activeSlideGroupId: originalGroupId, setActiveSlideGroup } =
      useEditorStore.getState()

    captureAbortRef.current = false
    isCapturingRef.current = true
    setIsCapturingPreview(true)
    setPreviewThumbs({})

    try {
      for (const group of project.slideGroups) {
        if (captureAbortRef.current) break

        setActiveSlideGroup(group.id)

        await new Promise<void>((resolve) => setTimeout(resolve, 80))

        if (captureAbortRef.current) break

        const thumbs = withIdentityTransform(stage, () =>
          Array.from({ length: group.numSlides }, (_, i) =>
            stage.toDataURL({
              x: i * group.slideWidth,
              y: 0,
              width: group.slideWidth,
              height: group.slideHeight,
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
      isCapturingRef.current = false
      setIsCapturingPreview(false)
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
