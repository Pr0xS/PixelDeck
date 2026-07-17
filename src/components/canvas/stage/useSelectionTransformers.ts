import { useEffect, useRef } from 'react'
import type Konva from 'konva'
import type { BackgroundLayer, Selection, SlideGroup } from '@/types'

interface UseSelectionTransformersOptions {
  stageRef: React.RefObject<Konva.Stage | null>
  group: SlideGroup | undefined
  selection: Selection | null
  editingGroupId: string | null
  selectedLayerIds: string[]
  editingTextId: string | null
  selectedBackgroundLayer: BackgroundLayer | null
  selectedAccentIndex: number | null
}

export function useSelectionTransformers({
  stageRef,
  group,
  selection,
  editingGroupId,
  selectedLayerIds,
  editingTextId,
  selectedBackgroundLayer,
  selectedAccentIndex,
}: UseSelectionTransformersOptions) {
  const transformerRef = useRef<Konva.Transformer>(null)
  const accentTransformerRef = useRef<Konva.Transformer>(null)
  const groupOutlineRef = useRef<Konva.Transformer>(null)

  useEffect(() => {
    if (!groupOutlineRef.current || !stageRef.current) return
    const tr = groupOutlineRef.current
    if (!editingGroupId) {
      tr.nodes([])
      tr.getLayer()?.batchDraw()
      return
    }
    const groupNode = stageRef.current.findOne(`#layer-${editingGroupId}`)
    tr.nodes(groupNode ? [groupNode] : [])
    tr.getLayer()?.batchDraw()
  }, [editingGroupId, stageRef])

  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return
    const tr = transformerRef.current
    const stage = stageRef.current
    if (selectedLayerIds.length > 0) {
      const nodes = selectedLayerIds
        .filter((id) => id !== editingTextId)
        .map((id) => stage.findOne(`#layer-${id}`) as Konva.Node | undefined)
        .filter((n): n is Konva.Node => Boolean(n))
      tr.nodes(nodes)
      tr.getLayer()?.batchDraw()
      return
    }
    if (!selection?.layerId || selection.layerId === editingTextId) {
      tr.nodes([])
      tr.getLayer()?.batchDraw()
      return
    }
    if (editingGroupId) {
      const childNode = stage.findOne(`#layer-${selection.layerId}`)
      tr.nodes(childNode ? [childNode] : [])
    } else {
      const selectedLayer = group?.layers.find((layer) => layer.id === selection.layerId)
      if (selectedLayer?.type === 'background') tr.nodes([])
      else {
        const node = stage.findOne(`#layer-${selection.layerId}`)
        tr.nodes(node ? [node] : [])
      }
    }
    tr.getLayer()?.batchDraw()
  }, [selection, editingGroupId, stageRef, selectedLayerIds, editingTextId, group])

  useEffect(() => {
    if (!accentTransformerRef.current || !stageRef.current) return
    const tr = accentTransformerRef.current
    if (!selectedBackgroundLayer || selectedAccentIndex == null) {
      tr.nodes([])
      tr.getLayer()?.batchDraw()
      return
    }
    const node = stageRef.current.findOne(
      `#accent-glow-${selectedBackgroundLayer.id}-${selectedAccentIndex}`,
    )
    tr.nodes(node ? [node] : [])
    tr.getLayer()?.batchDraw()
  }, [selectedBackgroundLayer, selectedAccentIndex, stageRef])

  return { transformerRef, accentTransformerRef, groupOutlineRef }
}
