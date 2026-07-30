import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type Konva from 'konva'
import { useEditorStore } from '@/store'
import { resolveGroupView } from '@/utils/canvasFormats'
import { getThumbnailStageGeometry, enqueueRequests, NAV_THUMB_CAPTURE_HEIGHT_PX, stripExpensiveEffects, type ThumbnailRequest } from '@/utils/thumbnailRender'
import { isCaptureLocked, nextFrame, waitForStage, waitForStageCaptureReady } from '@/utils/stageCapture'
import { ThumbnailStage } from '@/components/canvas/ThumbnailStage'

export type { ThumbnailRequest } from '@/utils/thumbnailRender'

export interface OffscreenThumbnailsApi {
  request: (requests: ThumbnailRequest[]) => void
  cancelAll: () => void
  isCapturing: boolean
  element: ReactNode
}

export function useOffscreenThumbnails(options: {
  onCaptured: (groupId: string, entry: { key: string; thumbs: string[] }) => void
}): OffscreenThumbnailsApi {
  const project = useEditorStore((s) => s.project)
  const [currentRequest, setCurrentRequest] = useState<ThumbnailRequest | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const stageRef = useRef<Konva.Stage | null>(null)
  const queueRef = useRef<ThumbnailRequest[]>([])
  const inFlightRef = useRef(false)
  const abortRef = useRef(false)
  const startProjectIdRef = useRef(project.id)
  const onCapturedRef = useRef(options.onCaptured)
  const kickRef = useRef<() => void>(() => {})
  useEffect(() => { onCapturedRef.current = options.onCaptured }, [options.onCaptured])

  const resolvedGroup = useMemo(() => {
    if (!currentRequest) return null
    const group = project.slideGroups.find((candidate) => candidate.id === currentRequest.groupId)
    if (!group) return null
    const view = resolveGroupView(group, project.settings, currentRequest.locale, currentRequest.format as import('@/types').CanvasFormatId)
    return { ...view, layers: stripExpensiveEffects(view.layers) }
  }, [currentRequest, project])

  const kick = useCallback(() => {
    if (inFlightRef.current || queueRef.current.length === 0) return
    const request = queueRef.current[0]!
    const state = useEditorStore.getState()
    // Active groups may be captured offscreen; defer while inline text editing
    // so TextNode never hides the text currently being edited on the live stage.
    if (isCaptureLocked() || (state.editingTextId !== null && request.groupId === state.activeSlideGroupId)) {
      globalThis.setTimeout(() => kickRef.current(), 250)
      return
    }
    abortRef.current = false
    startProjectIdRef.current = state.project.id
    inFlightRef.current = true
    setIsCapturing(true)
    setCurrentRequest(request)
  }, [])
  useEffect(() => { kickRef.current = kick }, [kick])

  const request = useCallback((incoming: ThumbnailRequest[]) => {
    queueRef.current = enqueueRequests(queueRef.current, incoming)
    kickRef.current()
  }, [])

  const cancelAll = useCallback(() => {
    abortRef.current = true
    queueRef.current = []
    setCurrentRequest(null)
  }, [])

  useLayoutEffect(() => {
    if (startProjectIdRef.current === project.id) return
    startProjectIdRef.current = project.id
    abortRef.current = true
    queueRef.current = []
    setCurrentRequest(null)
  }, [project.id])

  useEffect(() => {
    if (!currentRequest || !resolvedGroup) return
    let cancelled = false
    const run = async () => {
      try {
        const stage = await waitForStage(stageRef, 2000)
        if (!stage || cancelled || abortRef.current) return
        await nextFrame()
        await nextFrame()
        const timingLabel = `[PixelDeck] offscreen thumbnail ${currentRequest.groupId}`
        console.time(timingLabel)
        try {
          await waitForStageCaptureReady(stage)
          if (cancelled || abortRef.current || useEditorStore.getState().project.id !== startProjectIdRef.current) return
          const compensationPx = currentRequest.pano.compensate ? currentRequest.pano.gapPx : 0
          const geometry = getThumbnailStageGeometry(resolvedGroup, compensationPx)
          const thumbs = geometry.sliceXs.map((x) => stage.toDataURL({
            x, y: 0, width: geometry.sliceWidth, height: geometry.sliceHeight,
            pixelRatio: 1, mimeType: 'image/jpeg', quality: 0.85,
          }))
          onCapturedRef.current(currentRequest.groupId, { key: currentRequest.key, thumbs })
        } finally {
          console.timeEnd(timingLabel)
        }
      } finally {
        inFlightRef.current = false
        setIsCapturing(false)
        queueRef.current = queueRef.current.filter((queued) => !(
          queued.groupId === currentRequest.groupId && queued.key === currentRequest.key
        ))
        setCurrentRequest(null)
        if (queueRef.current.length > 0) globalThis.setTimeout(() => kickRef.current(), 0)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [currentRequest, resolvedGroup])

  const element = (
    <div aria-hidden style={{ position: 'fixed', top: 0, left: -99999, width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {currentRequest && resolvedGroup && (
        <ThumbnailStage
          group={resolvedGroup}
          panoCompensationPx={currentRequest.pano.compensate ? currentRequest.pano.gapPx : 0}
          scale={NAV_THUMB_CAPTURE_HEIGHT_PX / resolvedGroup.slideHeight}
          stageRef={stageRef}
        />
      )}
    </div>
  )

  return { request, cancelAll, isCapturing, element }
}
