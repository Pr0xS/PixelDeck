import { useEffect, useRef } from 'react'
import { Rect, Ellipse, Group, Line } from 'react-konva'
import type Konva from 'konva'
import { useEditorStore } from '@/store'
import type { ShapeLayer } from '@/types'
import { resolveBrandColor, resolveFill } from '@/utils/brandColors'
import { fillToKonvaProps } from '@/utils/gradients'
import { getShadowProps, useKonvaBlur } from './effects'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShapeNodeProps {
  layer: ShapeLayer
  isSelected: boolean
  onSelect: () => void
  onDragEnd: (x: number, y: number) => void
  onTransformEnd: (attrs: Partial<ShapeLayer>) => void
  forceNotDraggable?: boolean
}

// ─── Polygon point helpers ────────────────────────────────────────────────────

function polygonPoints(cx: number, cy: number, rx: number, ry: number, sides: number, startAngle = -Math.PI / 2): number[] {
  const pts: number[] = []
  for (let i = 0; i < sides; i++) {
    const angle = startAngle + (2 * Math.PI * i) / sides
    pts.push(cx + rx * Math.cos(angle), cy + ry * Math.sin(angle))
  }
  return pts
}

function starPoints(cx: number, cy: number, rx: number, ry: number, points: number, innerRatio: number): number[] {
  const pts: number[] = []
  for (let i = 0; i < points * 2; i++) {
    const angle = -Math.PI / 2 + (Math.PI * i) / points
    const r = i % 2 === 0 ? 1 : innerRatio
    pts.push(cx + rx * r * Math.cos(angle), cy + ry * r * Math.sin(angle))
  }
  return pts
}

function crossPoints(cx: number, cy: number, w: number, h: number, thickness = 0.3): number[] {
  const tx = (w * thickness) / 2
  const ty = (h * thickness) / 2
  return [
    cx - tx, cy - h / 2,
    cx + tx, cy - h / 2,
    cx + tx, cy - ty,
    cx + w / 2, cy - ty,
    cx + w / 2, cy + ty,
    cx + tx, cy + ty,
    cx + tx, cy + h / 2,
    cx - tx, cy + h / 2,
    cx - tx, cy + ty,
    cx - w / 2, cy + ty,
    cx - w / 2, cy - ty,
    cx - tx, cy - ty,
  ]
}

function arrowPoints(w: number, h: number): number[] {
  // Arrow pointing right; rotation applied via group for other directions
  const shaftH = h * 0.35
  const headW = w * 0.4
  return [
    0, (h - shaftH) / 2,
    w - headW, (h - shaftH) / 2,
    w - headW, 0,
    w, h / 2,
    w - headW, h,
    w - headW, (h + shaftH) / 2,
    0, (h + shaftH) / 2,
  ]
}

// ─── Shape point dispatcher ───────────────────────────────────────────────────

function getShapePoints(shapeType: string, w: number, h: number, layer: ShapeLayer): number[] {
  const cx = w / 2
  const cy = h / 2
  switch (shapeType) {
    case 'triangle':
      return polygonPoints(cx, cy, w / 2, h / 2, 3)
    case 'pentagon':
      return polygonPoints(cx, cy, w / 2, h / 2, 5)
    case 'hexagon':
      return polygonPoints(cx, cy, w / 2, h / 2, 6, 0)
    case 'diamond':
      return [cx, 0, w, cy, cx, h, 0, cy]
    case 'star':
      return starPoints(cx, cy, w / 2, h / 2, layer.starPoints ?? 5, layer.starInnerRatio ?? 0.4)
    case 'cross':
      return crossPoints(cx, cy, w, h, 0.3)
    case 'arrow':
      return arrowPoints(w, h)
    default:
      return [0, 0, w, 0, w, h, 0, h]
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ShapeNode({ layer, onSelect, onDragEnd, onTransformEnd, forceNotDraggable }: ShapeNodeProps) {
  const brandColors = useEditorStore((s) => s.project.settings.brandColors) ?? []
  const fillProps = fillToKonvaProps(resolveFill(layer.fill, brandColors), layer.width, layer.height)
  const groupRef = useRef<Konva.Group>(null)
  const rectRef = useRef<Konva.Rect>(null)
  const ellipseRef = useRef<Konva.Ellipse>(null)
  const lineRef = useRef<Konva.Line>(null)
  const currentSize = useRef({ w: layer.width, h: layer.height })
  useEffect(() => { currentSize.current = { w: layer.width, h: layer.height } }, [layer.width, layer.height])
  useKonvaBlur(groupRef, layer.blur, `${layer.shapeType}:${layer.width}:${layer.height}:${layer.cornerRadius}:${JSON.stringify(layer.fill)}:${layer.stroke}:${layer.strokeWidth}`)

  const arrowRotation = layer.shapeType === 'arrow' ? (
    layer.arrowDirection === 'up' ? -90
    : layer.arrowDirection === 'down' ? 90
    : layer.arrowDirection === 'left' ? 180
    : 0
  ) : 0

  const groupProps = {
    id: `layer-${layer.id}`,
    x: layer.x + layer.width / 2,
    y: layer.y + layer.height / 2,
    offsetX: layer.width / 2,
    offsetY: layer.height / 2,
    opacity: layer.opacity,
    visible: layer.visible,
    draggable: !forceNotDraggable && !layer.locked,
    rotation: layer.rotation,
    onDragStart: () => { if (!layer.locked) onSelect() },
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target
      onDragEnd(node.x() - currentSize.current.w / 2, node.y() - currentSize.current.h / 2)
    },
    onTransform: () => {
      const group = groupRef.current
      if (!group) return
      const scaleX = group.scaleX()
      const scaleY = group.scaleY()
      currentSize.current = {
        w: Math.max(5, currentSize.current.w * scaleX),
        h: Math.max(5, currentSize.current.h * scaleY),
      }
      group.scaleX(1)
      group.scaleY(1)
      const { w, h } = currentSize.current
      group.offsetX(w / 2)
      group.offsetY(h / 2)
      if (layer.shapeType === 'ellipse') {
        ellipseRef.current?.x(w / 2)
        ellipseRef.current?.y(h / 2)
        ellipseRef.current?.radiusX(w / 2)
        ellipseRef.current?.radiusY(h / 2)
      } else if (layer.shapeType === 'rect') {
        rectRef.current?.width(w)
        rectRef.current?.height(h)
      } else if (lineRef.current) {
        lineRef.current.points(getShapePoints(layer.shapeType, w, h, layer))
      }
    },
    onTransformEnd: () => {
      const group = groupRef.current
      if (!group) return
      group.scaleX(1)
      group.scaleY(1)
      onTransformEnd({
        x: group.x() - currentSize.current.w / 2,
        y: group.y() - currentSize.current.h / 2,
        rotation: group.rotation(),
        width: currentSize.current.w,
        height: currentSize.current.h,
      })
    },
  }

  const shapeProps = {
    stroke: layer.stroke ? resolveBrandColor(layer.stroke, brandColors) : layer.stroke,
    strokeWidth: layer.strokeWidth,
    onClick: () => { if (!layer.locked) onSelect() },
    onTap: () => { if (!layer.locked) onSelect() },
    ...fillProps,
    ...getShadowProps(layer.shadow),
  }

  if (layer.shapeType === 'ellipse') {
    return (
      <Group ref={groupRef} {...groupProps}>
        <Ellipse
          ref={ellipseRef}
          x={layer.width / 2}
          y={layer.height / 2}
          radiusX={layer.width / 2}
          radiusY={layer.height / 2}
          {...shapeProps}
        />
      </Group>
    )
  }

  if (layer.shapeType === 'rect') {
    return (
      <Group ref={groupRef} {...groupProps}>
        <Rect
          ref={rectRef}
          x={0}
          y={0}
          width={layer.width}
          height={layer.height}
          cornerRadius={Math.min(layer.cornerRadius, Math.min(layer.width, layer.height) / 2)}
          {...shapeProps}
        />
      </Group>
    )
  }

  // Polygon / star / arrow / diamond / cross shapes
  const points = getShapePoints(layer.shapeType, layer.width, layer.height, layer)

  if (layer.shapeType === 'arrow') {
    return (
      <Group ref={groupRef} {...groupProps} rotation={layer.rotation + arrowRotation}>
        <Line
          ref={lineRef}
          points={points}
          closed
          {...shapeProps}
        />
      </Group>
    )
  }

  return (
    <Group ref={groupRef} {...groupProps}>
      <Line
        ref={lineRef}
        points={points}
        closed
        {...shapeProps}
      />
    </Group>
  )
}
