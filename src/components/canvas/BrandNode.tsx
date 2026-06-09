import { Group, Image, Text } from 'react-konva'
import useImage from 'use-image'
import type Konva from 'konva'
import type { BrandLayer } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BrandNodeProps {
  layer: BrandLayer
  isSelected: boolean
  onSelect: () => void
  onDragEnd: (x: number, y: number) => void
  onTransformEnd: (attrs: Partial<BrandLayer>) => void
  forceNotDraggable?: boolean
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BrandNode({ layer, onSelect, onDragEnd, onTransformEnd, forceNotDraggable }: BrandNodeProps) {
  const [logoImage] = useImage(layer.logoDataUrl ?? '')

  const hasLogo = Boolean(layer.logoDataUrl && logoImage)

  // Determine positions based on direction
  const [logoX, logoY, textX, textY] = layer.direction === 'row'
    ? [0, 0, hasLogo ? layer.logoSize + layer.gap : 0, (layer.logoSize - layer.nameFontSize) / 2]
    : [0, 0, 0, hasLogo ? layer.logoSize + layer.gap : 0]
  const textWidth = layer.appName.length * layer.nameFontSize * 0.58
  const width = layer.direction === 'row'
    ? (hasLogo ? layer.logoSize + layer.gap : 0) + textWidth
    : Math.max(hasLogo ? layer.logoSize : 0, textWidth)
  const height = layer.direction === 'row'
    ? Math.max(hasLogo ? layer.logoSize : 0, layer.nameFontSize)
    : (hasLogo ? layer.logoSize + layer.gap : 0) + layer.nameFontSize

  return (
    <Group
      id={`layer-${layer.id}`}
      x={layer.x + width / 2}
      y={layer.y + height / 2}
      offsetX={width / 2}
      offsetY={height / 2}
      rotation={layer.rotation}
      opacity={layer.opacity}
      visible={layer.visible}
      draggable={!forceNotDraggable && !layer.locked}
      onClick={() => { if (!layer.locked) onSelect() }}
      onTap={() => { if (!layer.locked) onSelect() }}
      onDragStart={() => { if (!layer.locked) onSelect() }}
      onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
        const node = e.target
        onDragEnd(node.x() - width / 2, node.y() - height / 2)
      }}
      onTransformEnd={(e) => {
        const node = e.target
        node.scaleX(1)
        node.scaleY(1)
        onTransformEnd({
          x: node.x() - width / 2,
          y: node.y() - height / 2,
          rotation: node.rotation(),
        })
      }}
    >
      {hasLogo && (
        <Image
          image={logoImage}
          x={logoX}
          y={logoY}
          width={layer.logoSize}
          height={layer.logoSize}
        />
      )}
      <Text
        x={textX}
        y={textY}
        text={layer.appName}
        fontSize={layer.nameFontSize}
        fontFamily={layer.nameFontFamily}
        fontStyle={`${layer.nameFontWeight}`}
        fill={layer.nameColor}
      />
    </Group>
  )
}
