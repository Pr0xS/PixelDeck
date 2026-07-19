import { useCallback, useState } from 'react'
import type Konva from 'konva'
import { fileToDataUrl } from '@/utils/files'
import type { Layer, Selection, SlideGroup } from '@/types'

export interface AssetDropHighlight {
  x: number
  y: number
  w: number
  h: number
  label: string
  mode: 'replace' | 'create'
}

interface UseAssetDropTargetOptions {
  stageRef: React.RefObject<Konva.Stage | null>
  group: SlideGroup | undefined
  selection: Selection | null
  assets: Record<string, { dataUrl: string }>
  addAsset: (filename: string, dataUrl: string) => void
  updateLayer: (layerId: string, patch: Partial<Layer>) => void
  addImageAt: (src: string, width: number, height: number, x: number, y: number) => void
  viewportX: number
  viewportY: number
  zoom: number
}

export function useAssetDropTarget({
  stageRef,
  group,
  selection,
  assets,
  addAsset,
  updateLayer,
  addImageAt,
  viewportX,
  viewportY,
  zoom,
}: UseAssetDropTargetOptions) {
  const [assetDropHighlight, setAssetDropHighlight] = useState<AssetDropHighlight | null>(null)

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

  const applyAssetToTarget = async (
    filename: string,
    dataUrl: string,
    targetLayer: Layer | null,
    pointer: { x: number; y: number },
    cascade = 0,
  ) => {
    if (targetLayer?.type === 'phone') {
      updateLayer(targetLayer.id, { screenshotPath: filename, screenshotDataUrl: dataUrl } as Partial<Layer>)
      return
    }
    const { width, height } = await getImageSize(dataUrl)
    if (targetLayer?.type === 'image') {
      updateLayer(targetLayer.id, { src: filename, width, height } as Partial<Layer>)
      return
    }
    const x = (pointer.x - viewportX) / zoom - width / 2 + cascade
    const y = (pointer.y - viewportY) / zoom - height / 2 + cascade
    addImageAt(filename, width, height, x, y)
  }

  const handleAssetDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    const target = resolveDropTarget(e)
    if (!target) return
    const internalName = e.dataTransfer.getData('application/x-pixeldeck-asset') || e.dataTransfer.getData('text/plain')
    const internalAsset = internalName ? assets[internalName] : undefined
    if (internalAsset) {
      e.preventDefault()
      e.stopPropagation()
      setAssetDropHighlight(null)
      await applyAssetToTarget(internalName, internalAsset.dataUrl, target.targetLayer, target.pointer)
      return
    }
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

  return { assetDropHighlight, setAssetDropHighlight, handleAssetDrop, handleAssetDragOver }
}
