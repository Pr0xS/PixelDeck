import { memo, useRef, useEffect, useCallback, useMemo, useState } from 'react'
import { Stage, Layer, Rect, Line, Transformer } from 'react-konva'
import type Konva from 'konva'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '@/store'
import { useAssetStore } from '@/store/assets'
import { fileToDataUrl } from '@/utils/files'
import { applyLocale } from '@/utils/locale'
import { applyCanvasFormat } from '@/utils/canvasFormats'
import { getPanoGapPx, getPanoSlideX, getPanoTotalWidth, getEffectivePano } from '@/utils/panoGeometry'
import { LayerNode } from './LayerNode'
import { CanvasTextEditor } from './CanvasTextEditor'
import type { Layer as AppLayer } from '@/types'

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

interface StageCanvasProps {
  stageRef: React.RefObject<Konva.Stage | null>
}

interface StageLayerItemProps {
  layer: AppLayer
  isSelected: boolean
  isEditing: boolean
  selectedChildId: string | null
  canvasWidth: number
  canvasHeight: number
  ctrlRef: React.RefObject<boolean>
}

/**
 * Memo boundary between the (frequently re-rendering) StageCanvas and the
 * Konva node tree of each layer. All handlers read store state via
 * `getState()` so their identity is stable across renders — pan/zoom and
 * unrelated selection changes skip reconciling untouched layer subtrees.
 */
const StageLayerItem = memo(function StageLayerItem({
  layer, isSelected, isEditing, selectedChildId, canvasWidth, canvasHeight, ctrlRef,
}: StageLayerItemProps) {
  const layerId = layer.id

  const handleSelect = useCallback(() => {
    const state = useEditorStore.getState()
    if (ctrlRef.current) {
      if (state.selectedLayerIds.length === 0 && state.selection?.layerId) {
        if (state.selection.layerId === layerId) return
        state.setMultiSelection([state.selection.layerId, layerId])
      } else {
        state.toggleLayerSelection(layerId)
      }
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
  const handleEnterEdit = useCallback(() => {
    useEditorStore.getState().enterGroupEdit(layerId)
  }, [layerId])
  const handleSelectChild = useCallback((childId: string) => {
    useEditorStore.getState().selectChild(layerId, childId)
  }, [layerId])
  const handleChildDragEnd = useCallback((childId: string, x: number, y: number) => {
    useEditorStore.getState().updateChildLayer(layerId, childId, { x, y } as Partial<AppLayer>)
  }, [layerId])
  const handleChildTransformEnd = useCallback((childId: string, attrs: Partial<AppLayer>) => {
    useEditorStore.getState().updateChildLayer(layerId, childId, attrs)
  }, [layerId])

  return (
    <LayerNode
      layer={layer}
      isSelected={isSelected}
      onSelect={handleSelect}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
      canvasWidth={canvasWidth}
      canvasHeight={canvasHeight}
      isEditing={isEditing}
      selectedChildId={selectedChildId}
      onEnterEdit={isGroup ? handleEnterEdit : undefined}
      onSelectChild={isGroup ? handleSelectChild : undefined}
      onChildDragEnd={isGroup ? handleChildDragEnd : undefined}
      onChildTransformEnd={isGroup ? handleChildTransformEnd : undefined}
    />
  )
})

export function StageCanvas({ stageRef }: StageCanvasProps) {
  const transformerRef = useRef<Konva.Transformer>(null)
  const groupOutlineRef = useRef<Konva.Transformer>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rbRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const suppressStageClickRef = useRef(false)
  const [rbRect, setRbRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [assetDropHighlight, setAssetDropHighlight] = useState<{
    x: number
    y: number
    w: number
    h: number
    label: string
    mode: 'replace' | 'create'
  } | null>(null)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })
  const spaceRef = useRef(false)
  const [spaceDown, setSpaceDown] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [zoomInput, setZoomInput] = useState<string | null>(null)
  const panStartRef = useRef<{ clientX: number; clientY: number; vpX: number; vpY: number } | null>(null)
  // Track which group + container size we last auto-centered for
  const lastCenteredGroupId = useRef<string | null>(null)
  const lastContainerW = useRef(0)

  /** Tracks in-progress multi-drag state */
  const multiDragRef = useRef<{
    draggingId: string
    startX: number
    startY: number
    startPositions: Map<string, { nodeX: number; nodeY: number; layerX: number; layerY: number }>
  } | null>(null)

  const {
    project,
    activeSlideGroupId,
    zoom,
    viewportX,
    viewportY,
    showGrid,
    showSeamGuides,
    selection,
    select,
    deselect,
    updateLayer,
    addImageAt,
    editingGroupId,
    exitGroupEdit,
    setZoom,
    setViewportPosition,
    clearMultiSelection,
    selectedLayerIds,
    setMultiSelection,
    activeLocale,
    activeCanvasFormat,
    projectPano,
    panoRenderOverride,
    editingTextId,
  } = useEditorStore(useShallow((s) => ({
    project: s.project,
    activeSlideGroupId: s.activeSlideGroupId,
    zoom: s.zoom,
    viewportX: s.viewportX,
    viewportY: s.viewportY,
    showGrid: s.showGrid,
    showSeamGuides: s.showSeamGuides,
    selection: s.selection,
    select: s.select,
    deselect: s.deselect,
    updateLayer: s.updateLayer,
    addImageAt: s.addImageAt,
    editingGroupId: s.editingGroupId,
    exitGroupEdit: s.exitGroupEdit,
    setZoom: s.setZoom,
    setViewportPosition: s.setViewportPosition,
    clearMultiSelection: s.clearMultiSelection,
    selectedLayerIds: s.selectedLayerIds,
    setMultiSelection: s.setMultiSelection,
    activeLocale: s.activeLocale,
    activeCanvasFormat: s.activeCanvasFormat,
    projectPano: s.project.settings.pano,
    panoRenderOverride: s.panoRenderOverride,
    editingTextId: s.editingTextId,
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

  // keepRatio=false for text layers: corner handles should resize the box independently
  // (not force aspect-ratio scaling which causes scaleY artifacts on a text node).
  const selectedLayerIsText = useMemo(() => {
    const layerId = selection?.layerId
    if (!group || !layerId) return false
    for (const l of group.layers) {
      if (l.id === layerId) return l.type === 'text'
      if (l.type === 'group') {
        const child = l.children.find((c) => c.id === layerId)
        if (child) return child.type === 'text'
      }
    }
    return false
  }, [group, selection?.layerId])

  // ─── Container ResizeObserver ──────────────────────────────────────────────

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

  // ─── Auto-center canvas on first load / group switch ──────────────────────

  useEffect(() => {
    if (!containerSize.w || !containerSize.h || !group) return
    const totalW = getPanoTotalWidth(group, panoCompensate ? panoCompensationPx : 0)
    const totalH = group.slideHeight
    // Only re-center when the group changes or this is the very first render
    const needsCenter = lastCenteredGroupId.current !== group.id || lastContainerW.current === 0
    if (!needsCenter) return
    lastCenteredGroupId.current = group.id
    lastContainerW.current = containerSize.w
    // Only center the position — don't change zoom so initial scale stays consistent
    const { zoom: currentZoom, setViewportPosition: svp } = useEditorStore.getState()
    const cx = (containerSize.w - totalW * currentZoom) / 2
    const cy = (containerSize.h - totalH * currentZoom) / 2
    svp(cx, cy)
  }, [containerSize.w, containerSize.h, group?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Group edit outline ────────────────────────────────────────────────────

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

  // ─── Attach transformer to selected node(s) ───────────────────────────────

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

    // Hide the transformer while the in-canvas text editor covers the node
    if (!selection?.layerId || selection.layerId === editingTextId) {
      tr.nodes([])
      tr.getLayer()?.batchDraw()
      return
    }
    if (editingGroupId) {
      const childNode = stage.findOne(`#layer-${selection.layerId}`)
      tr.nodes(childNode ? [childNode] : [])
    } else {
      const node = stage.findOne(`#layer-${selection.layerId}`)
      tr.nodes(node ? [node] : [])
    }
    tr.getLayer()?.batchDraw()
  }, [selection, editingGroupId, stageRef, selectedLayerIds, editingTextId])

  // ─── Wheel: Ctrl+scroll = zoom-to-cursor; scroll = pan ────────────────────

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        // Zoom toward the cursor position
        const { zoom: cz, viewportX: vpX, viewportY: vpY, setZoom: sz, setViewportPosition: svp } =
          useEditorStore.getState()
        const rect = el.getBoundingClientRect()
        const px = e.clientX - rect.left
        const py = e.clientY - rect.top
        const factor = e.deltaY < 0 ? 1.08 : 0.93
        const newZoom = Math.max(0.05, Math.min(4, cz * factor))
        // The canvas point under the cursor must remain stationary
        const canvasX = (px - vpX) / cz
        const canvasY = (py - vpY) / cz
        sz(newZoom)
        svp(px - canvasX * newZoom, py - canvasY * newZoom)
      } else {
        // Scroll = pan the viewport
        const { viewportX: vpX, viewportY: vpY, setViewportPosition: svp } =
          useEditorStore.getState()
        svp(vpX - e.deltaX, vpY - e.deltaY)
      }
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  // ─── Space key for pan mode ────────────────────────────────────────────────

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

  // Global mouse move/up to handle pan drag even outside the canvas
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

  // ─── Fit canvas in viewport ────────────────────────────────────────────────

  const handleFit = useCallback(() => {
    if (!group || !containerSize.w || !containerSize.h) return
    const totalW = getPanoTotalWidth(group, panoCompensate ? panoCompensationPx : 0)
    const totalH = group.slideHeight
    const PADDING = 80
    const fitScale = Math.max(0.05, Math.min(4, Math.min(
      (containerSize.w - PADDING) / totalW,
      (containerSize.h - PADDING) / totalH
    )))
    setZoom(fitScale)
    setViewportPosition(
      (containerSize.w - totalW * fitScale) / 2,
      (containerSize.h - totalH * fitScale) / 2
    )
  }, [group, containerSize.w, containerSize.h, setZoom, setViewportPosition, panoCompensate, panoCompensationPx])

  // ─── Stage click / rubber-band selection ──────────────────────────────────

  const handleStageClick = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: any) => {
      if (suppressStageClickRef.current) {
        suppressStageClickRef.current = false
        return
      }
      if (e.target === e.target.getStage()) {
        clearMultiSelection()
        if (editingGroupId) {
          exitGroupEdit()
        } else {
          deselect()
        }
      }
    },
    [deselect, editingGroupId, exitGroupEdit, clearMultiSelection],
  )

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (spaceRef.current) return  // Space + drag = pan, skip rubber-band
    if (e.target !== e.target.getStage()) return
    const stage = e.target.getStage()!
    // Use getRelativePointerPosition() to get canvas-space coords (accounts for scale/position)
    const pos = stage.getRelativePointerPosition()
    if (!pos) return
    clearMultiSelection()
    deselect()
    rbRef.current = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y }
    setRbRect({ x: pos.x, y: pos.y, w: 0, h: 0 })
  }

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!rbRef.current) return
    const pos = e.target.getStage()?.getRelativePointerPosition()  // canvas-space
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
      // getClientRect({ relativeTo: stage }) returns canvas-space coords — matches rubber-band coords
      const r = node.getClientRect({ relativeTo: stage as unknown as Konva.Container })
      const fullyContained =
        r.x >= selBox.x &&
        r.x + r.width <= selBox.x + selBox.width &&
        r.y >= selBox.y &&
        r.y + r.height <= selBox.y + selBox.height
      if (fullyContained) hit.push(layer.id)
    }
    if (hit.length === 1) {
      select(hit[0])
    } else {
      setMultiSelection(hit)
    }
  }

  // When compensate is ON the gap is real geometry: it expands the Konva canvas
  // and pushes each slide apart by effectiveGap, matching the capture window math
  // in useThumbnails (getPanoSlideX with the same effective gap). When compensate
  // is OFF effectiveGap is 0 → geometry is continuous (identical to legacy, no regression).
  const effectiveCompensationPx = group && panoCompensate ? panoCompensationPx : 0
  const visualGapPx = group ? getPanoGapPx(group, effectiveCompensationPx) : 0
  const totalWidth = group ? getPanoTotalWidth(group, effectiveCompensationPx) : 0
  const totalHeight = group ? group.slideHeight : 0

  // Grid lines (every 100 real px)
  const gridLines: React.ReactNode[] = []
  if (showGrid) {
    for (let x = 0; x <= totalWidth; x += 100) {
      gridLines.push(
        <Line
          key={`gx-${x}`}
          points={[x, 0, x, totalHeight]}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={1}
          listening={false}
        />,
      )
    }
    for (let y = 0; y <= totalHeight; y += 100) {
      gridLines.push(
        <Line
          key={`gy-${y}`}
          points={[0, y, totalWidth, y]}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={1}
          listening={false}
        />,
      )
    }
  }

  // Seam guides between slides.
  // These are DOM overlays (never inside the Stage) so they don't appear in exports.
  // When compensate is OFF: thin dashed line at the exact seam — purely decorative.
  // When compensate is ON: solid dark band aligned to the actual gutter in expanded space.
  const seamGuides = showSeamGuides && group && group.numSlides > 1
    ? Array.from({ length: group.numSlides - 1 }, (_, i) => {
        const screenH = Math.round(totalHeight * zoom)

        if (panoCompensate && visualGapPx > 0) {
          // Compensate ON: slide (i+1) starts at getPanoSlideX(i+1, gap); the dead
          // gutter that export skips is the band [seamX - gap, seamX].
          const seamX = getPanoSlideX(group, i + 1, effectiveCompensationPx)
          const bandScreenX = Math.round(viewportX + (seamX - visualGapPx) * zoom)
          const bandW = Math.max(2, Math.round(visualGapPx * zoom))
          return (
            <div
              key={`seam-${i}`}
              style={{
                position: 'absolute',
                left: bandScreenX,
                top: Math.round(viewportY),
                width: bandW,
                height: screenH,
                background: 'rgba(17,17,24,0.85)',
                borderLeft: '1px solid rgba(124,110,246,0.5)',
                borderRight: '1px solid rgba(124,110,246,0.5)',
                pointerEvents: 'none',
                zIndex: 6,
              }}
            />
          )
        }

        // Compensate OFF (or gap=0): thin dashed line at the continuous seam.
        const seamX = getPanoSlideX(group, i + 1, 0)
        const screenX = Math.round(viewportX + seamX * zoom)
        return (
          <div
            key={`seam-${i}`}
            style={{
              position: 'absolute',
              left: screenX - 1,
              top: Math.round(viewportY),
              width: 2,
              height: screenH,
              background: 'rgba(255,255,255,0.15)',
              pointerEvents: 'none',
              zIndex: 6,
            }}
          />
        )
      })
    : null

  // ─── Multi-drag ────────────────────────────────────────────────────────────

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
    const { project, activeSlideGroupId } = useEditorStore.getState()
    const currentGroup = project.slideGroups.find((item) => item.id === activeSlideGroupId)
    for (const id of ids) {
      if (id === layerId) continue
      const layer = currentGroup?.layers.find((item) => item.id === id)
      const layerNode = stage.findOne(`#layer-${id}`) as Konva.Node | undefined
      if (layer && layerNode) {
        startPositions.set(id, {
          nodeX: layerNode.x(),
          nodeY: layerNode.y(),
          layerX: layer.x,
          layerY: layer.y,
        })
      }
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
      const n = stage.findOne(`#layer-${id}`) as Konva.Node | undefined
      if (n) { n.x(pos.nodeX + dx); n.y(pos.nodeY + dy) }
    }
  }, [stageRef])

  const handleContentLayerDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    if (!multiDragRef.current) return
    const drag = multiDragRef.current
    const node = e.target as Konva.Node
    if (node.id() !== `layer-${drag.draggingId}`) return
    const dx = node.x() - drag.startX
    const dy = node.y() - drag.startY
    for (const [id, pos] of drag.startPositions) {
      updateLayer(id, { x: pos.layerX + dx, y: pos.layerY + dy } as Partial<AppLayer>)
    }
    multiDragRef.current = null
  }, [updateLayer])

  const findLayerById = useCallback((layerId: string | null | undefined) => {
    if (!layerId || !group) return null
    const stack = [...group.layers]
    while (stack.length > 0) {
      const layer = stack.shift()!
      if (layer.id === layerId) return layer
      if (layer.type === 'group') stack.push(...layer.children)
    }
    return null
  }, [group])

  const getLayerIdFromNode = (node: Konva.Node | null) => {
    let current: Konva.Node | null = node
    while (current) {
      const id = current.id()
      if (id?.startsWith('layer-')) return id.slice('layer-'.length)
      current = current.getParent()
    }
    return null
  }

  const getImageSize = (dataUrl: string) =>
    new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve({ width: img.width, height: img.height })
      img.onerror = () => reject(new Error('Could not load dragged asset image'))
      img.src = dataUrl
    })

  /** Resolve the stage pointer + the phone/image layer (if any) targeted by a DOM drag event. */
  const resolveDropTarget = (e: React.DragEvent<HTMLDivElement>) => {
    const stage = stageRef.current
    if (!stage || !group) return null
    stage.setPointersPositions(e.nativeEvent)
    const pointer = stage.getPointerPosition()
    if (!pointer) return null

    const hitLayer = findLayerById(getLayerIdFromNode(stage.getIntersection(pointer)))
    const selectedLayer = findLayerById(selection?.layerId)
    const targetLayer = hitLayer?.type === 'phone' || hitLayer?.type === 'image'
      ? hitLayer
      : selectedLayer?.type === 'phone' || selectedLayer?.type === 'image'
        ? selectedLayer
        : null

    return { stage, pointer, targetLayer }
  }

  /** Apply a dropped asset: replace phone screenshot / image src, or create a new image layer. */
  const applyAssetToTarget = async (
    filename: string,
    dataUrl: string,
    targetLayer: AppLayer | null,
    pointer: { x: number; y: number },
    cascade = 0,
  ) => {
    if (targetLayer?.type === 'phone') {
      updateLayer(targetLayer.id, { screenshotPath: filename, screenshotDataUrl: dataUrl } as Partial<AppLayer>)
      return
    }

    const { width, height } = await getImageSize(dataUrl)

    if (targetLayer?.type === 'image') {
      updateLayer(targetLayer.id, { src: filename, width, height } as Partial<AppLayer>)
      return
    }

    const x = (pointer.x - viewportX) / zoom - width / 2 + cascade
    const y = (pointer.y - viewportY) / zoom - height / 2 + cascade
    addImageAt(filename, width, height, x, y)
  }

  const handleAssetDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    const target = resolveDropTarget(e)
    if (!target) return

    // Internal drag from the assets panel
    const internalName = e.dataTransfer.getData('application/x-pixeldeck-asset') || e.dataTransfer.getData('text/plain')
    const internalAsset = internalName ? assets[internalName] : undefined

    if (internalAsset) {
      e.preventDefault()
      e.stopPropagation()
      setAssetDropHighlight(null)
      await applyAssetToTarget(internalName, internalAsset.dataUrl, target.targetLayer, target.pointer)
      return
    }

    // External OS file drop
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
    if (files.length === 0) {
      setAssetDropHighlight(null)
      return
    }

    e.preventDefault()
    e.stopPropagation()
    setAssetDropHighlight(null)

    for (const [i, file] of files.entries()) {
      const dataUrl = await fileToDataUrl(file)
      addAsset(file.name, dataUrl)
      // Only the first file may replace the targeted layer; the rest cascade as new image layers.
      await applyAssetToTarget(file.name, dataUrl, i === 0 ? target.targetLayer : null, target.pointer, i * 48)
    }
  }

  const handleAssetDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    const isInternal = e.dataTransfer.types.includes('application/x-pixeldeck-asset')
    const isFiles = e.dataTransfer.types.includes('Files')
    if (!isInternal && !isFiles) return
    e.preventDefault()
    if (isFiles && !isInternal) e.dataTransfer.dropEffect = 'copy'

    const target = resolveDropTarget(e)
    if (!target) return
    const { stage, pointer, targetLayer } = target

    if (targetLayer) {
      const node = stage.findOne(`#layer-${targetLayer.id}`)
      const rect = node?.getClientRect({ relativeTo: stage })
      if (rect) {
        setAssetDropHighlight({
          x: viewportX + rect.x * zoom,
          y: viewportY + rect.y * zoom,
          w: rect.width * zoom,
          h: rect.height * zoom,
          label: targetLayer.type === 'phone' ? 'Replace phone screenshot' : 'Replace image',
          mode: 'replace',
        })
        return
      }
    }

    setAssetDropHighlight({
      x: pointer.x - 72,
      y: pointer.y - 54,
      w: 144,
      h: 108,
      label: 'Create image layer',
      mode: 'create',
    })
  }

  // ─── Derived display values (for overlay elements positioned in screen space) ──

  const displayWidth = totalWidth * zoom
  const displayHeight = totalHeight * zoom

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        cursor: spaceDown ? (isPanning ? 'grabbing' : 'grab') : 'default',
      }}
      onMouseDown={handleContainerMouseDown}
      onDragOver={handleAssetDragOver}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setAssetDropHighlight(null)
      }}
      onDrop={(e) => { void handleAssetDrop(e) }}
    >
      {!group ? (
        <div className="flex items-center justify-center w-full h-full text-[#6b6b7a] text-sm">
          No slide group selected
        </div>
      ) : containerSize.w > 0 && (
        <>
          {/* Canvas shadow frame — follows viewport position */}
          {group.numSlides === 1 && (
            <div
              style={{
                position: 'absolute',
                left: viewportX,
                top: viewportY,
                width: displayWidth,
                height: displayHeight,
                borderRadius: 10,
                boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)',
                pointerEvents: 'none',
                zIndex: 1,
              }}
            />
          )}

          {/* Konva Stage — fills container, viewport applied via scale + position */}
          <Stage
            ref={stageRef}
            width={containerSize.w}
            height={containerSize.h}
            scaleX={zoom}
            scaleY={zoom}
            x={viewportX}
            y={viewportY}
            onClick={handleStageClick}
            onTap={handleStageClick}
            onMouseDown={handleStageMouseDown}
            onMouseMove={handleStageMouseMove}
            onMouseUp={handleStageMouseUp}
            style={{ position: 'absolute', top: 0, left: 0 }}
          >
            {/* ── Background layer ── */}
            <Layer listening={false}>
              {gridLines}
            </Layer>

            {/* ── Content layer — all user layers ── */}
            <Layer
              onDragStart={handleContentLayerDragStart}
              onDragMove={handleContentLayerDragMove}
              onDragEnd={handleContentLayerDragEnd}
            >
              {group.layers.map((layer) => (
                <StageLayerItem
                  key={layer.id}
                  layer={layer}
                  isSelected={selection?.layerId === layer.id && !editingGroupId}
                  isEditing={layer.type === 'group' && editingGroupId === layer.id}
                  selectedChildId={editingGroupId === layer.id ? (selection?.layerId ?? null) : null}
                  canvasWidth={totalWidth}
                  canvasHeight={totalHeight}
                  ctrlRef={ctrlRef}
                />
              ))}
            </Layer>

            {/* ── UI layer: transformer ── */}
            <Layer>
              {/* Group edit outline */}
              <Transformer
                ref={groupOutlineRef}
                enabledAnchors={[]}
                rotateEnabled={false}
                borderStroke="rgba(255,255,255,0.65)"
                borderStrokeWidth={1.5}
                borderDash={[6, 4]}
                anchorSize={0}
                listening={false}
              />

              {/* Rubber-band selection rect (drawn in canvas coords) */}
              {rbRect && rbRect.w > 2 && rbRect.h > 2 && (
                <Rect
                  x={rbRect.x}
                  y={rbRect.y}
                  width={rbRect.w}
                  height={rbRect.h}
                  fill="rgba(124,110,246,0.08)"
                  stroke="rgba(124,110,246,0.7)"
                  strokeWidth={1 / zoom}
                  dash={[4 / zoom, 3 / zoom]}
                  listening={false}
                />
              )}
              <Transformer
                ref={transformerRef}
                keepRatio={!selectedLayerIsText}
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < 20 || newBox.height < 20) return oldBox
                  return newBox
                }}
                enabledAnchors={[
                  'top-left', 'top-center', 'top-right',
                  'middle-right', 'middle-left',
                  'bottom-left', 'bottom-center', 'bottom-right',
                ]}
                rotateEnabled={true}
                borderStroke="rgba(124,110,246,0.9)"
                borderStrokeWidth={2}
                anchorFill="#7c6ef6"
                anchorStroke="#ffffff"
                anchorSize={10}
                anchorCornerRadius={3}
                rotateAnchorOffset={40}
              />
            </Layer>
          </Stage>

          {/* Visual-only pano separators. DOM overlay so preview/export PNGs stay clean. */}
          {seamGuides}

          {/* In-canvas WYSIWYG text editor overlay */}
          {editingTextId && <CanvasTextEditor stageRef={stageRef} />}

          {/* Per-slide card frames for pano groups.
              Card frames always align to the continuous canvas (no gap offset).
              When compensate is ON, the seam guide overlay shows the dead zone. */}
          {group.numSlides > 1 && Array.from({ length: group.numSlides }, (_, i) => {
            const slideScreenW = Math.round(group.slideWidth * zoom)
            // Frame i starts at getPanoSlideX(i, gap): continuous when compensate is
            // OFF, expanded by the gutter when it is ON.
            const slideScreenX = Math.round(viewportX + getPanoSlideX(group, i, effectiveCompensationPx) * zoom)
            const isFirst = i === 0
            const isLast = i === group.numSlides - 1
            const R = 10
            return (
              <div
                key={`card-frame-${i}`}
                style={{
                  position: 'absolute',
                  left: slideScreenX,
                  top: Math.round(viewportY),
                  width: slideScreenW,
                  height: Math.round(displayHeight),
                  borderTopLeftRadius: isFirst ? R : 0,
                  borderBottomLeftRadius: isFirst ? R : 0,
                  borderTopRightRadius: isLast ? R : 0,
                  borderBottomRightRadius: isLast ? R : 0,
                  border: '1px solid rgba(255,255,255,0.09)',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
                  pointerEvents: 'none',
                  zIndex: 5,
                }}
              />
            )
          })}

          {/* Group edit mode banner */}
          {editingGroupId && (
            <div
              style={{
                position: 'absolute',
                top: 12,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: 'rgba(124,110,246,0.95)',
                borderRadius: 8,
                padding: '6px 14px',
                zIndex: 100,
                pointerEvents: 'all',
                boxShadow: '0 4px 20px rgba(124,110,246,0.4)',
              }}
            >
              <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>
                ✦ Editing group
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); exitGroupEdit() }}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  borderRadius: 4,
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '3px 10px',
                }}
              >
                Exit
              </button>
            </div>
          )}

          {/* Zoom controls overlay */}
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              right: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'rgba(15,15,19,0.88)',
              backdropFilter: 'blur(8px)',
              borderRadius: 8,
              padding: '4px 8px',
              border: '1px solid rgba(255,255,255,0.1)',
              zIndex: 100,
              pointerEvents: 'all',
            }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setZoom(Math.max(0.05, zoom - 0.02)) }}
              title="Zoom out"
              style={{ background: 'none', border: 'none', color: '#e8e8f0', cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1 }}
            >−</button>
            <input
              type="text"
              value={zoomInput ?? `${Math.round(zoom * 100)}`}
              onChange={(e) => setZoomInput(e.target.value)}
              onFocus={(e) => { setZoomInput(`${Math.round(zoom * 100)}`); e.target.select() }}
              onBlur={() => {
                const parsed = parseInt(zoomInput ?? '', 10)
                if (!isNaN(parsed) && parsed > 0) setZoom(Math.max(0.05, Math.min(4, parsed / 100)))
                setZoomInput(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                if (e.key === 'Escape') { setZoomInput(null); (e.target as HTMLInputElement).blur() }
                e.stopPropagation()
              }}
              onClick={(e) => e.stopPropagation()}
              title="Zoom level — click to edit"
              style={{
                background: 'none',
                border: 'none',
                color: '#6b6b7a',
                fontSize: 11,
                width: 36,
                textAlign: 'center',
                cursor: 'text',
                outline: 'none',
                padding: 0,
              }}
            />
            <span style={{ color: '#6b6b7a', fontSize: 11, marginLeft: -2 }}>%</span>
            <button
              onClick={(e) => { e.stopPropagation(); setZoom(Math.min(4, zoom + 0.02)) }}
              title="Zoom in"
              style={{ background: 'none', border: 'none', color: '#e8e8f0', cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1 }}
            >＋</button>
            <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.12)', margin: '0 2px' }} />
            <button
              onClick={(e) => { e.stopPropagation(); handleFit() }}
              title="Fit canvas in view"
              style={{
                background: 'none',
                border: 'none',
                color: '#a0a0b0',
                cursor: 'pointer',
                fontSize: 11,
                padding: '0 4px',
                lineHeight: 1,
              }}
            >Fit</button>
          </div>

          {/* Asset drop target highlight */}
          {assetDropHighlight && (
            <div
              style={{
                position: 'absolute',
                left: assetDropHighlight.x,
                top: assetDropHighlight.y,
                width: assetDropHighlight.w,
                height: assetDropHighlight.h,
                borderRadius: 10,
                border: `2px solid ${assetDropHighlight.mode === 'replace' ? '#7c6ef6' : '#38bdf8'}`,
                background: assetDropHighlight.mode === 'replace' ? 'rgba(124,110,246,0.14)' : 'rgba(56,189,248,0.10)',
                boxShadow: assetDropHighlight.mode === 'replace'
                  ? '0 0 0 1px rgba(124,110,246,0.22), 0 0 32px rgba(124,110,246,0.28)'
                  : '0 0 0 1px rgba(56,189,248,0.18), 0 0 28px rgba(56,189,248,0.22)',
                pointerEvents: 'none',
                zIndex: 90,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 8,
                  top: -28,
                  borderRadius: 999,
                  padding: '4px 9px',
                  background: assetDropHighlight.mode === 'replace' ? 'rgba(124,110,246,0.94)' : 'rgba(14,116,144,0.94)',
                  color: 'white',
                  fontSize: 11,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 10px 24px rgba(0,0,0,0.35)',
                }}
              >
                {assetDropHighlight.label}
              </div>
            </div>
          )}

          {/* Pan hint */}
          {spaceDown && (
            <div
              style={{
                position: 'absolute',
                bottom: 12,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(15,15,19,0.88)',
                backdropFilter: 'blur(8px)',
                borderRadius: 8,
                padding: '4px 12px',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#6b6b7a',
                fontSize: 11,
                zIndex: 100,
                pointerEvents: 'none',
              }}
            >
              ✋ Pan mode — drag to move
            </div>
          )}

          {/* Seam slide name labels */}
          {group.numSlides > 1 && Array.from({ length: group.numSlides }, (_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: Math.round(viewportY + displayHeight) + 8,
                left: Math.round(viewportX + (getPanoSlideX(group, i, effectiveCompensationPx) + group.slideWidth / 2) * zoom) - 20,
                color: 'rgba(124,110,246,0.6)',
                fontSize: 10,
                pointerEvents: 'none',
                zIndex: 5,
              }}
            >
              {group.slideNames[i] ?? `slide ${i + 1}`}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
