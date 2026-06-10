import { useRef } from 'react'
import { Group, Rect, Text } from 'react-konva'
import type Konva from 'konva'
import { useEditorStore } from '@/store'
import type { ChipsLayer, ChipItem, ChipVariant } from '@/types'
import { resolveBrandColor } from '@/utils/brandColors'
import { getShadowProps, useKonvaBlur } from './effects'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChipsNodeProps {
  layer: ChipsLayer
  isSelected: boolean
  onSelect: () => void
  onDragEnd: (x: number, y: number) => void
  onTransformEnd: (attrs: Partial<ChipsLayer>) => void
  forceNotDraggable?: boolean
}

interface ChipLayout {
  item: ChipItem
  x: number
  y: number
  width: number
  height: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CHIP_PADDING_H = 32
const CHIP_PADDING_V = 16
const WRAP_WIDTH = 800

/** Resolve effective variant — falls back to legacy primary flag */
function effectiveVariant(item: ChipItem): ChipVariant {
  if (item.variant) return item.variant
  return item.primary ? 'filled' : 'plain'
}

/** Convert a 6-digit hex color to an rgba(...) string */
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16) || 0
  const g = parseInt(clean.slice(2, 4), 16) || 0
  const b = parseInt(clean.slice(4, 6), 16) || 0
  return `rgba(${r},${g},${b},${alpha})`
}

function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.55
}

function layoutChips(
  items: ChipItem[],
  fontSize: number,
  gap: number,
  direction: 'row' | 'column',
): ChipLayout[] {
  const chipHeight = fontSize + CHIP_PADDING_V * 2
  const layouts: ChipLayout[] = []

  if (direction === 'column') {
    let curY = 0
    for (const item of items) {
      const chipWidth = estimateTextWidth(item.label, fontSize) + CHIP_PADDING_H * 2
      layouts.push({ item, x: 0, y: curY, width: chipWidth, height: chipHeight })
      curY += chipHeight + gap
    }
  } else {
    let curX = 0
    let curY = 0
    for (const item of items) {
      const chipWidth = estimateTextWidth(item.label, fontSize) + CHIP_PADDING_H * 2
      if (curX > 0 && curX + chipWidth > WRAP_WIDTH) {
        curX = 0
        curY += chipHeight + gap
      }
      layouts.push({ item, x: curX, y: curY, width: chipWidth, height: chipHeight })
      curX += chipWidth + gap
    }
  }

  return layouts
}

// ─── Per-variant chip renderer ────────────────────────────────────────────────

interface ChipRenderProps {
  variant: ChipVariant
  layer: ChipsLayer
  shadowProps: ReturnType<typeof getShadowProps>
  x: number
  y: number
  width: number
  chipHeight: number
  textX: number
  textY: number
  label: string
}

function ChipShape({ variant, layer, shadowProps, x, y, width, chipHeight, textX, textY, label }: ChipRenderProps) {
  const r = chipHeight / 2

  switch (variant) {
    case 'filled':
      return (
        <Group>
          <Rect
            x={x} y={y} width={width} height={chipHeight}
            cornerRadius={r}
            fillLinearGradientStartPoint={{ x: 0, y: 0 }}
            fillLinearGradientEndPoint={{ x: width, y: 0 }}
            fillLinearGradientColorStops={[0, layer.primaryGradientFrom, 1, layer.primaryGradientTo]}
            {...shadowProps}
          />
          <Text x={textX} y={textY} text={label} fontSize={layer.chipFontSize} fill={layer.primaryTextColor} fontStyle="600" />
        </Group>
      )

    case 'outlined':
      return (
        <Group>
          <Rect
            x={x} y={y} width={width} height={chipHeight}
            cornerRadius={r}
            fill="transparent"
            stroke={layer.primaryGradientFrom}
            strokeWidth={2}
            {...shadowProps}
          />
          <Text x={textX} y={textY} text={label} fontSize={layer.chipFontSize} fill={layer.primaryGradientFrom} fontStyle="600" />
        </Group>
      )

    case 'soft':
      return (
        <Group>
          <Rect
            x={x} y={y} width={width} height={chipHeight}
            cornerRadius={r}
            fill={hexToRgba(layer.primaryGradientFrom, 0.18)}
            {...shadowProps}
          />
          <Text x={textX} y={textY} text={label} fontSize={layer.chipFontSize} fill={layer.primaryGradientFrom} fontStyle="600" />
        </Group>
      )

    case 'dark':
      return (
        <Group>
          <Rect
            x={x} y={y} width={width} height={chipHeight}
            cornerRadius={r}
            fill="rgba(0,0,0,0.42)"
            {...shadowProps}
          />
          <Text x={textX} y={textY} text={label} fontSize={layer.chipFontSize} fill="#ffffff" fontStyle="600" />
        </Group>
      )

    case 'plain':
    default:
      return (
        <Group>
          <Rect
            x={x} y={y} width={width} height={chipHeight}
            cornerRadius={r}
            fill={layer.defaultBg}
            {...shadowProps}
          />
          <Text x={textX} y={textY} text={label} fontSize={layer.chipFontSize} fill={layer.defaultTextColor} fontStyle="600" />
        </Group>
      )
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ChipsNode({ layer, onSelect, onDragEnd, onTransformEnd, forceNotDraggable }: ChipsNodeProps) {
  const groupRef = useRef<Konva.Group>(null)
  const brandColors = useEditorStore((s) => s.project.settings.brandColors) ?? []
  const resolvedLayer: ChipsLayer = {
    ...layer,
    primaryGradientFrom: resolveBrandColor(layer.primaryGradientFrom, brandColors),
    primaryGradientTo: resolveBrandColor(layer.primaryGradientTo, brandColors),
    primaryTextColor: resolveBrandColor(layer.primaryTextColor, brandColors),
    defaultBg: resolveBrandColor(layer.defaultBg, brandColors),
    defaultTextColor: resolveBrandColor(layer.defaultTextColor, brandColors),
  }
  const layouts = layoutChips(resolvedLayer.items, resolvedLayer.chipFontSize, resolvedLayer.gap, resolvedLayer.direction)
  const chipHeight = layer.chipFontSize + CHIP_PADDING_V * 2
  const width = Math.max(1, ...layouts.map((item) => item.x + item.width))
  const height = Math.max(1, ...layouts.map((item) => item.y + item.height))
  useKonvaBlur(groupRef, layer.blur, `${JSON.stringify(resolvedLayer.items)}:${resolvedLayer.chipFontSize}:${resolvedLayer.gap}:${resolvedLayer.direction}:${resolvedLayer.primaryGradientFrom}:${resolvedLayer.primaryGradientTo}:${resolvedLayer.defaultBg}`)
  const shadowProps = getShadowProps(layer.shadow)

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
        onTransformEnd({ x: node.x() - width / 2, y: node.y() - height / 2, rotation: node.rotation() })
      }}
    >
      {layouts.map(({ item, x, y, width }) => (
        <ChipShape
          key={item.label + x + y}
          variant={effectiveVariant(item)}
          layer={resolvedLayer}
          shadowProps={shadowProps}
          x={x} y={y}
          width={width}
          chipHeight={chipHeight}
          textX={x + CHIP_PADDING_H}
          textY={y + CHIP_PADDING_V}
          label={item.label}
        />
      ))}
    </Group>
  )
}
