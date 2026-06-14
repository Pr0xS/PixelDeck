import { useEffect, useRef } from 'react'
import { Image } from 'react-konva'
import useImage from 'use-image'
import type Konva from 'konva'
import type { ImageLayer } from '@/types'
import { useAssetStore } from '@/store/assets'
import { getShadowProps, useKonvaBlur } from './effects'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImageNodeProps {
  layer: ImageLayer
  isSelected: boolean
  onSelect: () => void
  onDragEnd: (x: number, y: number) => void
  onTransformEnd: (attrs: Partial<ImageLayer>) => void
  forceNotDraggable?: boolean
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ImageNode({ layer, onSelect, onDragEnd, onTransformEnd, forceNotDraggable }: ImageNodeProps) {
  const assets = useAssetStore((s) => s.assets)
  const imageSrc = assets[layer.src]?.dataUrl ?? layer.src
  const [image] = useImage(imageSrc)
  const nodeRef = useRef<Konva.Image>(null)
  const currentSize = useRef({ w: layer.width, h: layer.height })
  useEffect(() => { currentSize.current = { w: layer.width, h: layer.height } }, [layer.width, layer.height])

  useKonvaBlur(nodeRef, layer.blur, `${imageSrc}:${layer.width}:${layer.height}:${layer.cornerRadius}`)

  const shadowProps = getShadowProps(layer.shadow)
  const cx = layer.x + layer.width / 2
  const cy = layer.y + layer.height / 2

  return (
    <Image
      ref={nodeRef}
      id={`layer-${layer.id}`}
      image={image}
      x={cx}
      y={cy}
      offsetX={layer.width / 2}
      offsetY={layer.height / 2}
      width={layer.width}
      height={layer.height}
      cornerRadius={layer.cornerRadius}
      rotation={layer.rotation}
      opacity={layer.opacity}
      visible={layer.visible}
      draggable={!forceNotDraggable && !layer.locked}
      {...shadowProps}
      onClick={() => { if (!layer.locked) onSelect() }}
      onTap={() => { if (!layer.locked) onSelect() }}
      onDragStart={() => { if (!layer.locked) onSelect() }}
      onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
        const node = e.target
        onDragEnd(node.x() - layer.width / 2, node.y() - layer.height / 2)
      }}
      onTransform={() => {
        const node = nodeRef.current
        if (!node) return
        const scaleX = node.scaleX()
        const scaleY = node.scaleY()
        currentSize.current = {
          w: Math.max(5, node.width() * scaleX),
          h: Math.max(5, node.height() * scaleY),
        }
        node.scaleX(1)
        node.scaleY(1)
        node.width(currentSize.current.w)
        node.height(currentSize.current.h)
        node.offsetX(currentSize.current.w / 2)
        node.offsetY(currentSize.current.h / 2)
      }}
      onTransformEnd={() => {
        const node = nodeRef.current
        if (!node) return
        node.scaleX(1)
        node.scaleY(1)
        onTransformEnd({
          x: node.x() - currentSize.current.w / 2,
          y: node.y() - currentSize.current.h / 2,
          rotation: node.rotation(),
          width: currentSize.current.w,
          height: currentSize.current.h,
        })
      }}
    />
  )
}
