import { Rect, Ellipse, Group } from 'react-konva'
import type { BackgroundLayer } from '@/types'
import { fillToKonvaProps } from '@/utils/gradients'

interface BackgroundNodeProps {
  layer: BackgroundLayer
  canvasWidth: number
  canvasHeight: number
}

export function BackgroundNode({
  layer,
  canvasWidth,
  canvasHeight,
}: BackgroundNodeProps) {
  const fillProps = fillToKonvaProps(layer.fill, canvasWidth, canvasHeight)

  return (
    <Group
      id={`layer-${layer.id}`}
      opacity={layer.opacity}
      visible={layer.visible}
      listening={false}
    >
      {/* Background fill — not interactive on canvas; select via LayersPanel */}
      <Rect
        x={0}
        y={0}
        width={canvasWidth}
        height={canvasHeight}
        {...fillProps}
      />
      {/* Radial accent overlays */}
      {layer.accents.map((accent, i) => (
        <Ellipse
          key={i}
          x={(accent.cx / 100) * canvasWidth}
          y={(accent.cy / 100) * canvasHeight}
          radiusX={accent.rx}
          radiusY={accent.ry}
          fill={accent.color}
          listening={false}
        />
      ))}
    </Group>
  )
}
