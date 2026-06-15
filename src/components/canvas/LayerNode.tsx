import type { Layer, BackgroundLayer, PhoneLayer, TextLayer, ImageLayer, ShapeLayer, EmojiLayer, BrandLayer, GroupLayer } from '@/types'
import { BackgroundNode } from './BackgroundNode'
import { PhoneNode } from './PhoneNode'
import { TextNode } from './TextNode'
import { ImageNode } from './ImageNode'
import { ShapeNode } from './ShapeNode'
import { EmojiNode } from './EmojiNode'
import { BrandNode } from './BrandNode'
import { GroupNode } from './GroupNode'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LayerNodeProps {
  layer: Layer
  isSelected: boolean
  onSelect: () => void
  onDragEnd: (x: number, y: number) => void
  onTransformEnd: (attrs: Partial<Layer>) => void
  canvasWidth?: number
  canvasHeight?: number
  forceNotDraggable?: boolean
  // Group editing props (only used when layer.type === 'group')
  isEditing?: boolean
  selectedChildId?: string | null
  onEnterEdit?: () => void
  onSelectChild?: (childId: string) => void
  onChildDragEnd?: (childId: string, x: number, y: number) => void
  onChildTransformEnd?: (childId: string, attrs: Partial<Layer>) => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LayerNode({
  layer, isSelected, onSelect, onDragEnd, onTransformEnd,
  canvasWidth, canvasHeight, forceNotDraggable,
  isEditing, selectedChildId, onEnterEdit, onSelectChild, onChildDragEnd, onChildTransformEnd,
}: LayerNodeProps) {
  switch (layer.type) {
    case 'background':
      return (
        <BackgroundNode
          layer={layer as BackgroundLayer}
          canvasWidth={canvasWidth ?? 1290}
          canvasHeight={canvasHeight ?? 2796}
        />
      )
    case 'phone':
      return (
        <PhoneNode
          layer={layer as PhoneLayer}
          isSelected={isSelected}
          onSelect={onSelect}
          onDragEnd={onDragEnd}
          onTransformEnd={(attrs) => onTransformEnd(attrs as Partial<Layer>)}
          forceNotDraggable={forceNotDraggable}
        />
      )
    case 'text':
      return (
        <TextNode
          layer={layer as TextLayer}
          isSelected={isSelected}
          onSelect={onSelect}
          onDragEnd={onDragEnd}
          onTransformEnd={(attrs) => onTransformEnd(attrs as Partial<Layer>)}
          forceNotDraggable={forceNotDraggable}
        />
      )
    case 'image':
      return (
        <ImageNode
          layer={layer as ImageLayer}
          isSelected={isSelected}
          onSelect={onSelect}
          onDragEnd={onDragEnd}
          onTransformEnd={(attrs) => onTransformEnd(attrs as Partial<Layer>)}
          forceNotDraggable={forceNotDraggable}
        />
      )
    case 'shape':
      return (
        <ShapeNode
          layer={layer as ShapeLayer}
          isSelected={isSelected}
          onSelect={onSelect}
          onDragEnd={onDragEnd}
          onTransformEnd={(attrs) => onTransformEnd(attrs as Partial<Layer>)}
          forceNotDraggable={forceNotDraggable}
        />
      )
    case 'emoji':
      return (
        <EmojiNode
          layer={layer as EmojiLayer}
          isSelected={isSelected}
          onSelect={onSelect}
          onDragEnd={onDragEnd}
          onTransformEnd={(attrs) => onTransformEnd(attrs as Partial<Layer>)}
          forceNotDraggable={forceNotDraggable}
        />
      )
    case 'brand':
      return (
        <BrandNode
          layer={layer as BrandLayer}
          isSelected={isSelected}
          onSelect={onSelect}
          onDragEnd={onDragEnd}
          onTransformEnd={(attrs) => onTransformEnd(attrs as Partial<Layer>)}
          forceNotDraggable={forceNotDraggable}
        />
      )
    case 'group':
      return (
        <GroupNode
          layer={layer as GroupLayer}
          isSelected={isSelected}
          isEditing={isEditing ?? false}
          selectedChildId={selectedChildId ?? null}
          onSelect={onSelect}
          onDragEnd={onDragEnd}
          onTransformEnd={(attrs) => onTransformEnd(attrs as Partial<Layer>)}
          onEnterEdit={onEnterEdit ?? (() => {})}
          onSelectChild={onSelectChild ?? (() => {})}
          onChildDragEnd={onChildDragEnd ?? (() => {})}
          onChildTransformEnd={onChildTransformEnd ?? (() => {})}
        />
      )
    default:
      return null
  }
}
