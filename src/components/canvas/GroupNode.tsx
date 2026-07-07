import { useRef } from 'react'
import { Group } from 'react-konva'
import type Konva from 'konva'
import type { GroupLayer, Layer } from '@/types'
import { LayerNode } from './LayerNode'
import { getShadowProps, useKonvaBlur } from './effects'
import { estimateGroupBox } from './GroupNode.geometry'

interface GroupNodeProps {
  layer: GroupLayer
  isSelected: boolean
  isEditing: boolean
  selectedChildId: string | null
  onSelect: () => void
  onEnterEdit: () => void
  onSelectChild: (childId: string) => void
  onDragEnd: (x: number, y: number) => void
  onChildDragEnd: (childId: string, x: number, y: number) => void
  onTransformEnd: (attrs: Partial<GroupLayer>) => void
  onChildTransformEnd: (childId: string, attrs: Partial<Layer>) => void
}

export function GroupNode({
  layer,
  isEditing,
  selectedChildId,
  onSelect,
  onEnterEdit,
  onSelectChild,
  onDragEnd,
  onChildDragEnd,
  onTransformEnd,
  onChildTransformEnd,
}: GroupNodeProps) {
  const groupRef = useRef<Konva.Group>(null)
  const scale = layer.scale ?? 1
  const box = estimateGroupBox({ ...layer, x: 0, y: 0 })
  // Local (unscaled) center — used as rotation/scale pivot via offsetX/offsetY
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  const centerX = layer.x + cx * scale
  const centerY = layer.y + cy * scale
  const handleClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (layer.locked || isEditing) return
    e.cancelBubble = true
    onSelect()
  }

  const handleDblClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (layer.locked || isEditing) return
    e.cancelBubble = true
    onEnterEdit()
    // Walk ancestors to find which child was double-clicked
    let node: Konva.Node | null = e.target as Konva.Node
    const groupNode = e.currentTarget as Konva.Node
    while (node && node !== groupNode) {
      const nodeId = typeof node.id === 'function' ? node.id() : ''
      if (nodeId.startsWith('layer-')) {
        const childId = nodeId.slice(6)
        if (layer.children.some((c) => c.id === childId)) {
          onSelectChild(childId)
          return
        }
      }
      node = node.getParent() as Konva.Node | null
    }
  }
  useKonvaBlur(groupRef, layer.blur, `${JSON.stringify(layer.children)}:${isEditing}:${scale}`)

  return (
    <Group
      ref={groupRef}
      id={`layer-${layer.id}`}
      x={centerX}
      y={centerY}
      offsetX={cx}
      offsetY={cy}
      scaleX={scale}
      scaleY={scale}
      rotation={layer.rotation}
      opacity={layer.opacity}
      visible={layer.visible}
      draggable={!layer.locked && !isEditing}
      {...getShadowProps(layer.shadow)}
      onClick={handleClick}
      onTap={handleClick}
      onDblClick={handleDblClick}
      onDblTap={handleDblClick}
      onDragStart={() => { if (!layer.locked && !isEditing) onSelect() }}
      onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
        if (!isEditing) onDragEnd(e.target.x() - cx * scale, e.target.y() - cy * scale)
      }}
      onTransformEnd={(e: Konva.KonvaEventObject<Event>) => {
        if (!isEditing) {
          const node = e.target
          // The transformer multiplied the node's existing scale (= `scale` prop).
          // Pick the axis that actually changed (middle anchors only touch one) and
          // persist a uniform scale.
          const sx = node.scaleX()
          const sy = node.scaleY()
          const next = Math.max(0.05, Math.abs(sx / scale - 1) >= Math.abs(sy / scale - 1) ? sx : sy)
          // Normalize the node to the value the next render will set as prop, so
          // react-konva's prop diffing can't leave a stale scale behind.
          node.scaleX(next)
          node.scaleY(next)
          onTransformEnd({
            x: node.x() - cx * next,
            y: node.y() - cy * next,
            rotation: node.rotation(),
            scale: next,
          } as Partial<GroupLayer>)
        }
      }}
    >
      {layer.children.map((child) => (
        <LayerNode
          key={child.id}
          layer={child as Layer}
          // When NOT editing: children are visual-only (not draggable, clicks bubble up to group)
          // When editing: children are fully interactive
          forceNotDraggable={!isEditing}
          isSelected={isEditing && selectedChildId === child.id}
          onSelect={isEditing ? () => { onSelectChild(child.id) } : () => {}}
          onDragEnd={isEditing ? (x, y) => onChildDragEnd(child.id, x, y) : () => {}}
          onTransformEnd={isEditing ? (attrs) => onChildTransformEnd(child.id, attrs) : () => {}}
        />
      ))}
    </Group>
  )
}
