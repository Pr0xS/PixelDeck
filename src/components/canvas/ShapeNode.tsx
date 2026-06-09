import { useEffect, useRef } from 'react'
import { Rect, Ellipse, Group } from 'react-konva'
import type Konva from 'konva'
import type { ShapeLayer } from '@/types'
import { fillToKonvaProps } from '@/utils/gradients'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShapeNodeProps {
  layer: ShapeLayer
  isSelected: boolean
  onSelect: () => void
  onDragEnd: (x: number, y: number) => void
  onTransformEnd: (attrs: Partial<ShapeLayer>) => void
  forceNotDraggable?: boolean
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ShapeNode({ layer, onSelect, onDragEnd, onTransformEnd, forceNotDraggable }: ShapeNodeProps) {
  const fillProps = fillToKonvaProps(layer.fill, layer.width, layer.height)
  const groupRef = useRef<Konva.Group>(null)
  const rectRef = useRef<Konva.Rect>(null)
  const ellipseRef = useRef<Konva.Ellipse>(null)
  const currentSize = useRef({ w: layer.width, h: layer.height })
  useEffect(() => { currentSize.current = { w: layer.width, h: layer.height } }, [layer.width, layer.height])

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
      } else {
        rectRef.current?.width(w)
        rectRef.current?.height(h)
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
    stroke: layer.stroke,
    strokeWidth: layer.strokeWidth,
    onClick: () => { if (!layer.locked) onSelect() },
    onTap: () => { if (!layer.locked) onSelect() },
    ...fillProps,
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

  // Default: rect (and line treated as rect for now)
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
