import type { RefObject } from 'react'
import { Layer, Stage } from 'react-konva'
import type Konva from 'konva'
import type { Layer as AppLayer, SlideGroup } from '@/types'
import { getThumbnailStageGeometry } from '@/utils/thumbnailRender'
import { LayerNode } from './LayerNode'

interface ThumbnailStageProps {
  group: SlideGroup
  panoCompensationPx: number
  scale: number
  stageRef: RefObject<Konva.Stage | null>
}

const noop = () => {}

export function ThumbnailStage({ group, panoCompensationPx, scale, stageRef }: ThumbnailStageProps) {
  const { totalWidth, totalHeight, stageWidth, stageHeight } = getThumbnailStageGeometry(group, panoCompensationPx)

  return (
    <Stage ref={stageRef} width={stageWidth} height={stageHeight} scaleX={scale} scaleY={scale} listening={false}>
      <Layer listening={false}>
        {group.layers.map((layer) => (
          <LayerNode
            key={layer.id}
            layer={layer as AppLayer}
            isSelected={false}
            onSelect={noop}
            onDragEnd={noop}
            onTransformEnd={noop}
            canvasWidth={totalWidth}
            canvasHeight={totalHeight}
            forceNotDraggable
          />
        ))}
      </Layer>
    </Stage>
  )
}
