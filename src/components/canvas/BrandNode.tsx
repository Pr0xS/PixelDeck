import { useRef } from 'react'
import { Group, Image, Text } from 'react-konva'
import useImage from 'use-image'
import type Konva from 'konva'
import type { BrandLayer } from '@/types'
import { resolveBrandColor } from '@/utils/brandColors'
import { useBrandColors } from '@/hooks/useBrandColors'
import { useLayerEffects } from '@/hooks/useLayerEffects'
import { useLayerInteraction } from '@/hooks/useLayerInteraction'
import { useLayerTransform } from '@/hooks/useLayerTransform'

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
  const groupRef = useRef<Konva.Group>(null)
  const brandColors = useBrandColors()
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
  const shadowProps = useLayerEffects(groupRef, layer, `${layer.logoDataUrl}:${layer.logoSize}:${layer.appName}:${layer.nameFontSize}:${layer.nameFontFamily}:${layer.nameFontWeight}:${layer.nameColor}:${layer.direction}:${layer.gap}`)
  const interactionProps = useLayerInteraction({
    nodeRef: groupRef,
    locked: layer.locked,
    onSelect,
    onDragEnd,
    getDragPosition: (node) => ({ x: node.x() - width / 2, y: node.y() - height / 2 }),
  })
  const handleTransformEnd = useLayerTransform({
    nodeRef: groupRef,
    onChange: onTransformEnd,
    buildPatch: (node): Partial<BrandLayer> => ({
      x: node.x() - width / 2,
      y: node.y() - height / 2,
      rotation: node.rotation(),
    }),
  })

  return (
    <Group
      ref={groupRef}
      id={`layer-${layer.id}`}
      x={layer.x + width / 2}
      y={layer.y + height / 2}
      offsetX={width / 2}
      offsetY={height / 2}
      rotation={layer.rotation}
      opacity={layer.opacity}
      visible={layer.visible}
      draggable={!forceNotDraggable && !layer.locked}
      {...interactionProps}
      onTransformEnd={handleTransformEnd}
    >
      {hasLogo && (
        <Image
          image={logoImage}
          x={logoX}
          y={logoY}
          width={layer.logoSize}
          height={layer.logoSize}
          {...shadowProps}
        />
      )}
      <Text
        x={textX}
        y={textY}
        text={layer.appName}
        fontSize={layer.nameFontSize}
        fontFamily={layer.nameFontFamily}
        fontStyle={`${layer.nameFontWeight}`}
        fill={resolveBrandColor(layer.nameColor, brandColors)}
        {...shadowProps}
      />
    </Group>
  )
}
