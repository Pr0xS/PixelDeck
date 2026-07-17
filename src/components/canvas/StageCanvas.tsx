import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Rect, Line, Transformer } from 'react-konva'
import type Konva from 'konva'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '@/store'
import { useAssetStore } from '@/store/assets'
import { applyLocale } from '@/utils/locale'
import { applyCanvasFormat } from '@/utils/canvasFormats'
import { getEffectivePano } from '@/utils/panoGeometry'
import type { Layer as AppLayer, BackgroundLayer } from '@/types'
import { CanvasTextEditor } from './CanvasTextEditor'
import { StageLayerItem } from './stage/StageLayerItem'
import { CanvasShadow, SeamGuides, StageChrome } from './stage/StageOverlays'
import { useAssetDropTarget } from './stage/useAssetDropTarget'
import { useRubberBandSelection } from './stage/useRubberBandSelection'
import { useSelectionTransformers } from './stage/useSelectionTransformers'
import { useStageGeometry } from './stage/useStageGeometry'
import { useStageViewport } from './stage/useStageViewport'

function useCtrlKey() {
  const ref = useRef(false)
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.ctrlKey || e.metaKey) ref.current = true }
    const up = (e: KeyboardEvent) => { if (!e.ctrlKey && !e.metaKey) ref.current = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])
  return ref
}

interface StageCanvasProps { stageRef: React.RefObject<Konva.Stage | null> }

export function StageCanvas({ stageRef }: StageCanvasProps) {
  const [zoomInput, setZoomInput] = useState<string | null>(null)
  const multiDragRef = useRef<{
    draggingId: string
    startX: number
    startY: number
    startPositions: Map<string, { nodeX: number; nodeY: number; layerX: number; layerY: number }>
  } | null>(null)
  const {
    project, activeSlideGroupId, zoom, viewportX, viewportY, showGrid, showSeamGuides,
    selection, selectedAccentIndex, select, deselect, updateLayer, addImageAt,
    editingGroupId, exitGroupEdit, setZoom, setViewportPosition, clearMultiSelection,
    selectedLayerIds, setMultiSelection, activeLocale, activeCanvasFormat, projectPano,
    panoRenderOverride, editingTextId,
  } = useEditorStore(useShallow((s) => ({
    project: s.project, activeSlideGroupId: s.activeSlideGroupId, zoom: s.zoom,
    viewportX: s.viewportX, viewportY: s.viewportY, showGrid: s.showGrid,
    showSeamGuides: s.showSeamGuides, selection: s.selection,
    selectedAccentIndex: s.selectedAccentIndex, select: s.select, deselect: s.deselect,
    updateLayer: s.updateLayer, addImageAt: s.addImageAt, editingGroupId: s.editingGroupId,
    exitGroupEdit: s.exitGroupEdit, setZoom: s.setZoom, setViewportPosition: s.setViewportPosition,
    clearMultiSelection: s.clearMultiSelection, selectedLayerIds: s.selectedLayerIds,
    setMultiSelection: s.setMultiSelection, activeLocale: s.activeLocale,
    activeCanvasFormat: s.activeCanvasFormat, projectPano: s.project.settings.pano,
    panoRenderOverride: s.panoRenderOverride, editingTextId: s.editingTextId,
  })))
  const ctrlRef = useCtrlKey()
  const assets = useAssetStore((s) => s.assets)
  const addAsset = useAssetStore((s) => s.addAsset)
  const viewProject = useMemo(
    () => applyCanvasFormat(applyLocale(project, activeLocale), activeCanvasFormat),
    [project, activeLocale, activeCanvasFormat],
  )
  const group = viewProject.slideGroups.find((g) => g.id === activeSlideGroupId)
  const { gapPx: panoCompensationPx, compensate: panoCompensate } = getEffectivePano(projectPano, panoRenderOverride)
  const selectedLayerIsText = useMemo(() => {
    const layerId = selection?.layerId
    if (!group || !layerId) return false
    for (const layer of group.layers) {
      if (layer.id === layerId) return layer.type === 'text'
      if (layer.type === 'group') {
        const child = layer.children.find((item) => item.id === layerId)
        if (child) return child.type === 'text'
      }
    }
    return false
  }, [group, selection?.layerId])
  const selectedBackgroundLayer = useMemo(() => {
    const layerId = selection?.layerId
    if (!group || !layerId || editingGroupId || selectedLayerIds.length > 0) return null
    const layer = group.layers.find((item) => item.id === layerId)
    return layer?.type === 'background' ? layer as BackgroundLayer : null
  }, [group, selection?.layerId, editingGroupId, selectedLayerIds.length])
  const {
    containerRef, containerSize, spaceRef, spaceDown, isPanning,
    handleContainerMouseDown, handleFit,
  } = useStageViewport({ group, panoCompensate, panoCompensationPx, setZoom, setViewportPosition })
  const {
    effectiveCompensationPx, visualGapPx, totalWidth, totalHeight, displayWidth, displayHeight,
  } = useStageGeometry(group, panoCompensate, panoCompensationPx, zoom)
  const { transformerRef, accentTransformerRef, groupOutlineRef } = useSelectionTransformers({
    stageRef, group, selection, editingGroupId, selectedLayerIds, editingTextId,
    selectedBackgroundLayer, selectedAccentIndex,
  })
  const { rbRect, suppressStageClickRef, handleStageMouseDown, handleStageMouseMove, handleStageMouseUp } =
    useRubberBandSelection({ stageRef, group, spaceRef, clearMultiSelection, deselect, select, setMultiSelection })
  const { assetDropHighlight, setAssetDropHighlight, handleAssetDrop, handleAssetDragOver } =
    useAssetDropTarget({ stageRef, group, selection, assets, addAsset, updateLayer, addImageAt, viewportX, viewportY, zoom })

  const handleStageClick = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: any) => {
      if (suppressStageClickRef.current) { suppressStageClickRef.current = false; return }
      if (e.target === e.target.getStage()) {
        clearMultiSelection()
        if (editingGroupId) exitGroupEdit()
        else deselect()
      }
    },
    // Ref stability is provided by useRubberBandSelection; preserve the original dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deselect, editingGroupId, exitGroupEdit, clearMultiSelection],
  )

  const handleContentLayerDragStart = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target as Konva.Node
    const nodeId = node.id()
    if (!nodeId.startsWith('layer-')) return
    const layerId = nodeId.slice(6)
    const ids = useEditorStore.getState().selectedLayerIds
    if (ids.length < 2 || !ids.includes(layerId)) return
    const stage = stageRef.current
    if (!stage) return
    const startPositions = new Map<string, { nodeX: number; nodeY: number; layerX: number; layerY: number }>()
    const { project: currentProject, activeSlideGroupId: currentGroupId } = useEditorStore.getState()
    const currentGroup = currentProject.slideGroups.find((item) => item.id === currentGroupId)
    for (const id of ids) {
      if (id === layerId) continue
      const layer = currentGroup?.layers.find((item) => item.id === id)
      const layerNode = stage.findOne(`#layer-${id}`) as Konva.Node | undefined
      if (layer && layerNode) startPositions.set(id, { nodeX: layerNode.x(), nodeY: layerNode.y(), layerX: layer.x, layerY: layer.y })
    }
    multiDragRef.current = { draggingId: layerId, startX: node.x(), startY: node.y(), startPositions }
  }, [stageRef])
  const handleContentLayerDragMove = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    if (!multiDragRef.current) return
    const drag = multiDragRef.current
    const node = e.target as Konva.Node
    if (node.id() !== `layer-${drag.draggingId}`) return
    const dx = node.x() - drag.startX
    const dy = node.y() - drag.startY
    const stage = stageRef.current
    if (!stage) return
    for (const [id, pos] of drag.startPositions) {
      const otherNode = stage.findOne(`#layer-${id}`) as Konva.Node | undefined
      if (otherNode) { otherNode.x(pos.nodeX + dx); otherNode.y(pos.nodeY + dy) }
    }
  }, [stageRef])
  const handleContentLayerDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    if (!multiDragRef.current) return
    const drag = multiDragRef.current
    const node = e.target as Konva.Node
    if (node.id() !== `layer-${drag.draggingId}`) return
    const dx = node.x() - drag.startX
    const dy = node.y() - drag.startY
    for (const [id, pos] of drag.startPositions) updateLayer(id, { x: pos.layerX + dx, y: pos.layerY + dy } as Partial<AppLayer>)
    multiDragRef.current = null
  }, [updateLayer])

  const gridLines: React.ReactNode[] = []
  if (showGrid) {
    for (let x = 0; x <= totalWidth; x += 100) gridLines.push(<Line key={`gx-${x}`} points={[x, 0, x, totalHeight]} stroke="rgba(255,255,255,0.06)" strokeWidth={1} listening={false} />)
    for (let y = 0; y <= totalHeight; y += 100) gridLines.push(<Line key={`gy-${y}`} points={[0, y, totalWidth, y]} stroke="rgba(255,255,255,0.06)" strokeWidth={1} listening={false} />)
  }
  const renderStageLayerItem = (layer: AppLayer) => <StageLayerItem key={layer.id} layer={layer} isSelected={selection?.layerId === layer.id && !editingGroupId} isEditing={layer.type === 'group' && editingGroupId === layer.id} selectedChildId={editingGroupId === layer.id ? (selection?.layerId ?? null) : null} canvasWidth={totalWidth} canvasHeight={totalHeight} ctrlRef={ctrlRef} selectedAccentIndex={selection?.layerId === layer.id ? selectedAccentIndex : null} />

  return <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', cursor: spaceDown ? (isPanning ? 'grabbing' : 'grab') : 'default' }} onMouseDown={handleContainerMouseDown} onDragOver={handleAssetDragOver} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setAssetDropHighlight(null) }} onDrop={(e) => { void handleAssetDrop(e) }}>
    {!group ? <div className="flex items-center justify-center w-full h-full text-[#6b6b7a] text-sm">No slide group selected</div> : containerSize.w > 0 && <>
      <CanvasShadow group={group} viewportX={viewportX} viewportY={viewportY} displayWidth={displayWidth} displayHeight={displayHeight} />
      <Stage ref={stageRef} width={containerSize.w} height={containerSize.h} scaleX={zoom} scaleY={zoom} x={viewportX} y={viewportY} onClick={handleStageClick} onTap={handleStageClick} onMouseDown={handleStageMouseDown} onMouseMove={handleStageMouseMove} onMouseUp={handleStageMouseUp} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Layer listening={false}>{gridLines}</Layer>
        <Layer>{group.layers.filter((layer) => layer.type === 'background').map(renderStageLayerItem)}</Layer>
        <Layer listening={!selectedBackgroundLayer} onDragStart={handleContentLayerDragStart} onDragMove={handleContentLayerDragMove} onDragEnd={handleContentLayerDragEnd}>{group.layers.filter((layer) => layer.type !== 'background').map(renderStageLayerItem)}</Layer>
        <Layer>
          <Transformer ref={groupOutlineRef} enabledAnchors={[]} rotateEnabled={false} borderStroke="rgba(255,255,255,0.65)" borderStrokeWidth={1.5} borderDash={[6, 4]} anchorSize={0} listening={false} />
          {rbRect && rbRect.w > 2 && rbRect.h > 2 && <Rect x={rbRect.x} y={rbRect.y} width={rbRect.w} height={rbRect.h} fill="rgba(124,110,246,0.08)" stroke="rgba(124,110,246,0.7)" strokeWidth={1 / zoom} dash={[4 / zoom, 3 / zoom]} listening={false} />}
          <Transformer ref={transformerRef} keepRatio={!selectedLayerIsText} boundBoxFunc={(oldBox, newBox) => newBox.width < 20 || newBox.height < 20 ? oldBox : newBox} enabledAnchors={['top-left', 'top-center', 'top-right', 'middle-right', 'middle-left', 'bottom-left', 'bottom-center', 'bottom-right']} rotateEnabled={true} borderStroke="rgba(124,110,246,0.9)" borderStrokeWidth={2} anchorFill="#7c6ef6" anchorStroke="#ffffff" anchorSize={10} anchorCornerRadius={3} rotateAnchorOffset={40} />
          <Transformer ref={accentTransformerRef} keepRatio={false} enabledAnchors={['top-left', 'top-center', 'top-right', 'middle-right', 'middle-left', 'bottom-left', 'bottom-center', 'bottom-right']} rotateEnabled={false} borderStroke="rgba(124,110,246,0.9)" borderStrokeWidth={2} anchorFill="#7c6ef6" anchorStroke="#ffffff" anchorSize={10} anchorCornerRadius={3} />
        </Layer>
      </Stage>
      {/* Visual-only DOM separators never appear in Stage exports. */}
      <SeamGuides group={group} showSeamGuides={showSeamGuides} panoCompensate={panoCompensate} visualGapPx={visualGapPx} effectiveCompensationPx={effectiveCompensationPx} totalHeight={totalHeight} zoom={zoom} viewportX={viewportX} viewportY={viewportY} />
      {editingTextId && <CanvasTextEditor stageRef={stageRef} />}
      <StageChrome group={group} effectiveCompensationPx={effectiveCompensationPx} displayHeight={displayHeight} zoom={zoom} viewportX={viewportX} viewportY={viewportY} editingGroupId={editingGroupId} exitGroupEdit={exitGroupEdit} setZoom={setZoom} zoomInput={zoomInput} setZoomInput={setZoomInput} handleFit={handleFit} assetDropHighlight={assetDropHighlight} spaceDown={spaceDown} />
    </>}
  </div>
}
