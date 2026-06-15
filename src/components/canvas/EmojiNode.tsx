import { useMemo, useRef, useEffect } from 'react'
import { Image as KonvaImage, Group } from 'react-konva'
import type Konva from 'konva'
import type { EmojiLayer } from '@/types'
import { getShadowProps, useKonvaBlur } from './effects'

interface EmojiNodeProps {
  layer: EmojiLayer
  isSelected: boolean
  onSelect: () => void
  onDragEnd: (x: number, y: number) => void
  onTransformEnd: (attrs: Partial<EmojiLayer>) => void
  forceNotDraggable?: boolean
}

/** Render an emoji to an offscreen canvas synchronously via useMemo. */
function useEmojiCanvas(emoji: string, size: number): HTMLCanvasElement | null {
  return useMemo(() => {
    if (typeof document === 'undefined') return null
    const c = document.createElement('canvas')
    c.width = size
    c.height = size
    const ctx = c.getContext('2d')
    if (!ctx) return null
    ctx.clearRect(0, 0, size, size)
    ctx.font = `${size * 0.85}px 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(emoji, size / 2, size / 2)
    return c
  }, [emoji, size])
}

export function EmojiNode({ layer, onSelect, onDragEnd, onTransformEnd, forceNotDraggable }: EmojiNodeProps) {
  const groupRef = useRef<Konva.Group>(null)
  const imageRef = useRef<Konva.Image>(null)
  const currentFontSize = useRef(layer.fontSize)
  useEffect(() => { currentFontSize.current = layer.fontSize }, [layer.fontSize])
  useKonvaBlur(groupRef, layer.blur, `emoji:${layer.emoji}:${layer.fontSize}`)

  const emojiCanvas = useEmojiCanvas(layer.emoji, layer.fontSize)
  const half = layer.fontSize / 2

  return (
    <Group
      ref={groupRef}
      id={`layer-${layer.id}`}
      x={layer.x + half}
      y={layer.y + half}
      offsetX={half}
      offsetY={half}
      opacity={layer.opacity}
      visible={layer.visible}
      rotation={layer.rotation}
      draggable={!forceNotDraggable && !layer.locked}
      onDragStart={() => { if (!layer.locked) onSelect() }}
      onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
        const node = e.target
        onDragEnd(node.x() - currentFontSize.current / 2, node.y() - currentFontSize.current / 2)
      }}
      onTransform={() => {
        const group = groupRef.current
        const img = imageRef.current
        if (!group || !img) return
        const scale = (group.scaleX() + group.scaleY()) / 2
        const newSize = Math.max(10, Math.round(currentFontSize.current * scale))
        currentFontSize.current = newSize
        group.scaleX(1)
        group.scaleY(1)
        group.offsetX(newSize / 2)
        group.offsetY(newSize / 2)
        img.width(newSize)
        img.height(newSize)
        img.offsetX(0)
        img.offsetY(0)
      }}
      onTransformEnd={() => {
        const group = groupRef.current
        if (!group) return
        group.scaleX(1)
        group.scaleY(1)
        const newSize = currentFontSize.current
        onTransformEnd({
          x: group.x() - newSize / 2,
          y: group.y() - newSize / 2,
          rotation: group.rotation(),
          fontSize: newSize,
        })
      }}
    >
      <KonvaImage
        ref={imageRef}
        image={emojiCanvas ?? undefined}
        x={0}
        y={0}
        width={layer.fontSize}
        height={layer.fontSize}
        onClick={() => { if (!layer.locked) onSelect() }}
        onTap={() => { if (!layer.locked) onSelect() }}
        {...getShadowProps(layer.shadow)}
      />
    </Group>
  )
}
