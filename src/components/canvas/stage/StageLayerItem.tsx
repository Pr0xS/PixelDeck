import { memo, useCallback } from 'react'
import { useEditorStore } from '@/store'
import { updateBackgroundAccentAt } from '@/utils/backgroundAccents'
import type { Layer as AppLayer } from '@/types'
import { LayerNode } from '../LayerNode'

interface StageLayerItemProps {
  layer: AppLayer
  isSelected: boolean
  isEditing: boolean
  selectedChildId: string | null
  canvasWidth: number
  canvasHeight: number
  ctrlRef: React.RefObject<boolean>
  selectedAccentIndex: number | null
}

export const StageLayerItem = memo(function StageLayerItem({
  layer, isSelected, isEditing, selectedChildId, canvasWidth, canvasHeight, ctrlRef,
  selectedAccentIndex,
}: StageLayerItemProps) {
  const layerId = layer.id
  const handleSelect = useCallback(() => {
    const state = useEditorStore.getState()
    if (ctrlRef.current) {
      if (state.selectedLayerIds.length === 0 && state.selection?.layerId) {
        if (state.selection.layerId === layerId) return
        state.setMultiSelection([state.selection.layerId, layerId])
      } else state.toggleLayerSelection(layerId)
      return
    }
    if (state.selectedLayerIds.length > 1 && state.selectedLayerIds.includes(layerId)) return
    state.select(layerId)
  }, [layerId, ctrlRef])
  const handleDragEnd = useCallback((x: number, y: number) => {
    useEditorStore.getState().updateLayer(layerId, { x, y } as Partial<AppLayer>)
  }, [layerId])
  const handleTransformEnd = useCallback((attrs: Partial<AppLayer>) => {
    useEditorStore.getState().updateLayer(layerId, attrs)
  }, [layerId])
  const isGroup = layer.type === 'group'
  const handleEnterEdit = useCallback(() => { useEditorStore.getState().enterGroupEdit(layerId) }, [layerId])
  const handleSelectChild = useCallback((childId: string) => { useEditorStore.getState().selectChild(layerId, childId) }, [layerId])
  const handleChildDragEnd = useCallback((childId: string, x: number, y: number) => {
    useEditorStore.getState().updateChildLayer(layerId, childId, { x, y } as Partial<AppLayer>)
  }, [layerId])
  const handleChildTransformEnd = useCallback((childId: string, attrs: Partial<AppLayer>) => {
    useEditorStore.getState().updateChildLayer(layerId, childId, attrs)
  }, [layerId])
  const handleSelectAccent = useCallback((index: number) => {
    if (layer.type !== 'background') return
    useEditorStore.getState().selectAccent(index)
  }, [layer])
  const handleAccentDragEnd = useCallback((index: number, cx: number, cy: number) => {
    if (layer.type !== 'background') return
    useEditorStore.getState().updateLayer(layerId, { accents: updateBackgroundAccentAt(layer.accents, index, { cx, cy }) } as Partial<AppLayer>)
  }, [layer, layerId])
  const handleAccentTransformEnd = useCallback((index: number, rx: number, ry: number) => {
    if (layer.type !== 'background') return
    useEditorStore.getState().updateLayer(layerId, { accents: updateBackgroundAccentAt(layer.accents, index, { rx, ry }) } as Partial<AppLayer>)
  }, [layer, layerId])

  return <LayerNode layer={layer} isSelected={isSelected} onSelect={handleSelect} onDragEnd={handleDragEnd} onTransformEnd={handleTransformEnd} canvasWidth={canvasWidth} canvasHeight={canvasHeight} selectedAccentIndex={selectedAccentIndex} onSelectAccent={handleSelectAccent} onAccentDragEnd={handleAccentDragEnd} onAccentTransformEnd={handleAccentTransformEnd} isEditing={isEditing} selectedChildId={selectedChildId} onEnterEdit={isGroup ? handleEnterEdit : undefined} onSelectChild={isGroup ? handleSelectChild : undefined} onChildDragEnd={isGroup ? handleChildDragEnd : undefined} onChildTransformEnd={isGroup ? handleChildTransformEnd : undefined} />
})
