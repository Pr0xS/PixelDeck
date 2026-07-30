import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditorStore } from '@/store'
import { getPanoTotalWidth } from '@/utils/panoGeometry'
import type { SlideGroup } from '@/types'

interface UseStageViewportOptions {
  group: SlideGroup | undefined
  panoCompensate: boolean
  panoCompensationPx: number
  setZoom: (zoom: number) => void
  setViewportPosition: (x: number, y: number) => void
}

export function useStageViewport({
  group,
  panoCompensate,
  panoCompensationPx,
  setZoom,
  setViewportPosition,
}: UseStageViewportOptions) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })
  const spaceRef = useRef(false)
  const [spaceDown, setSpaceDown] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef<{ clientX: number; clientY: number; vpX: number; vpY: number } | null>(null)
  const lastCenteredGroupId = useRef<string | null>(null)
  const lastContainerW = useRef(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setContainerSize({ w: Math.round(width), h: Math.round(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!containerSize.w || !containerSize.h || !group) return
    const totalW = getPanoTotalWidth(group, panoCompensate ? panoCompensationPx : 0)
    const totalH = group.slideHeight
    const needsCenter = lastCenteredGroupId.current !== group.id || lastContainerW.current === 0
    if (!needsCenter) return
    lastCenteredGroupId.current = group.id
    lastContainerW.current = containerSize.w
    const { zoom: currentZoom, setViewportPosition: svp } = useEditorStore.getState()
    const cx = (containerSize.w - totalW * currentZoom) / 2
    const cy = (containerSize.h - totalH * currentZoom) / 2
    svp(cx, cy)
  }, [containerSize.w, containerSize.h, group?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        const { zoom: cz, viewportX: vpX, viewportY: vpY, setZoom: sz, setViewportPosition: svp } =
          useEditorStore.getState()
        const rect = el.getBoundingClientRect()
        const px = e.clientX - rect.left
        const py = e.clientY - rect.top
        const factor = e.deltaY < 0 ? 1.08 : 0.93
        const newZoom = Math.max(0.05, Math.min(4, cz * factor))
        const canvasX = (px - vpX) / cz
        const canvasY = (py - vpY) / cz
        sz(newZoom)
        svp(px - canvasX * newZoom, py - canvasY * newZoom)
      } else {
        const { viewportX: vpX, viewportY: vpY, setViewportPosition: svp } =
          useEditorStore.getState()
        svp(vpX - e.deltaX, vpY - e.deltaY)
      }
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        const tag = (document.activeElement as HTMLElement | null)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault()
        spaceRef.current = true
        setSpaceDown(true)
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceRef.current = false
        setSpaceDown(false)
        panStartRef.current = null
        setIsPanning(false)
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!panStartRef.current) return
      const { clientX: sx, clientY: sy, vpX, vpY } = panStartRef.current
      const { setViewportPosition: svp } = useEditorStore.getState()
      svp(vpX + e.clientX - sx, vpY + e.clientY - sy)
    }
    const handleMouseUp = () => { panStartRef.current = null; setIsPanning(false) }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const handleContainerMouseDown = (e: React.MouseEvent) => {
    if (!spaceRef.current) return
    const { viewportX: vpX, viewportY: vpY } = useEditorStore.getState()
    panStartRef.current = { clientX: e.clientX, clientY: e.clientY, vpX, vpY }
    setIsPanning(true)
  }

  const handleFit = useCallback(() => {
    if (!group || !containerSize.w || !containerSize.h) return
    const totalW = getPanoTotalWidth(group, panoCompensate ? panoCompensationPx : 0)
    const totalH = group.slideHeight
    const PADDING = 80
    const fitScale = Math.max(0.05, Math.min(4, Math.min(
      (containerSize.w - PADDING) / totalW,
      (containerSize.h - PADDING) / totalH,
    )))
    setZoom(fitScale)
    setViewportPosition(
      (containerSize.w - totalW * fitScale) / 2,
      (containerSize.h - totalH * fitScale) / 2,
    )
  }, [group, containerSize.w, containerSize.h, setZoom, setViewportPosition, panoCompensate, panoCompensationPx])

  return {
    containerRef,
    containerSize,
    spaceRef,
    spaceDown,
    isPanning,
    handleContainerMouseDown,
    handleFit,
  }
}
