import { useRef, useState } from 'react'
import type Konva from 'konva'
import type { SlideGroup } from '@/types'

interface UseRubberBandSelectionOptions {
  stageRef: React.RefObject<Konva.Stage | null>
  group: SlideGroup | undefined
  spaceRef: React.RefObject<boolean>
  clearMultiSelection: () => void
  deselect: () => void
  select: (layerId: string | null) => void
  setMultiSelection: (layerIds: string[]) => void
}

export function useRubberBandSelection({
  stageRef,
  group,
  spaceRef,
  clearMultiSelection,
  deselect,
  select,
  setMultiSelection,
}: UseRubberBandSelectionOptions) {
  const rbRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const suppressStageClickRef = useRef(false)
  const [rbRect, setRbRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (spaceRef.current) return
    if (e.target !== e.target.getStage()) return
    const stage = e.target.getStage()!
    const pos = stage.getRelativePointerPosition()
    if (!pos) return
    clearMultiSelection()
    deselect()
    rbRef.current = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y }
    setRbRect({ x: pos.x, y: pos.y, w: 0, h: 0 })
  }

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!rbRef.current) return
    const pos = e.target.getStage()?.getRelativePointerPosition()
    if (!pos) return
    rbRef.current.x2 = pos.x
    rbRef.current.y2 = pos.y
    const { x1, y1, x2, y2 } = rbRef.current
    setRbRect({ x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) })
  }

  const handleStageMouseUp = () => {
    const rb = rbRef.current
    rbRef.current = null
    setRbRect(null)
    if (!rb || !stageRef.current || !group) return
    const selW = Math.abs(rb.x2 - rb.x1)
    const selH = Math.abs(rb.y2 - rb.y1)
    if (selW < 4 && selH < 4) return
    suppressStageClickRef.current = true
    const selBox = { x: Math.min(rb.x1, rb.x2), y: Math.min(rb.y1, rb.y2), width: selW, height: selH }
    const stage = stageRef.current
    const hit: string[] = []
    for (const layer of group.layers) {
      if (layer.type === 'background') continue
      const node = stage.findOne(`#layer-${layer.id}`)
      if (!node) continue
      const r = node.getClientRect({ relativeTo: stage as unknown as Konva.Container })
      const fullyContained =
        r.x >= selBox.x &&
        r.x + r.width <= selBox.x + selBox.width &&
        r.y >= selBox.y &&
        r.y + r.height <= selBox.y + selBox.height
      if (fullyContained) hit.push(layer.id)
    }
    if (hit.length === 1) select(hit[0])
    else setMultiSelection(hit)
  }

  return { rbRect, suppressStageClickRef, handleStageMouseDown, handleStageMouseMove, handleStageMouseUp }
}
