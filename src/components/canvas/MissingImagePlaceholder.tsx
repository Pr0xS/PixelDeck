import { Group, Rect, Line, Text } from 'react-konva'
import { useShowPlaceholderLabels } from '@/utils/renderMode'

interface MissingImagePlaceholderProps {
  x?: number
  y?: number
  width: number
  height: number
  cornerRadius?: number
  /** Manifest name or key shown in the editor label. */
  name?: string
}

const BG = '#2a2a2e'
const STROKE = '#5b5b66'
const TEXT = '#9a9aa6'

/**
 * Neutral hatched stand-in for an image whose asset is missing. In exports
 * (see utils/renderMode.ts) it is a flat rect with no hatch and no text.
 */
export function MissingImagePlaceholder({ x = 0, y = 0, width, height, cornerRadius = 0, name }: MissingImagePlaceholderProps) {
  const showLabel = useShowPlaceholderLabels()
  const step = 24
  const lines: number[][] = []
  if (showLabel) {
    for (let d = step; d < width + height; d += step) {
      const x1 = Math.min(d, width)
      const y1 = d - x1
      const y2 = Math.min(d, height)
      const x2 = d - y2
      lines.push([x + x1, y + y1, x + x2, y + y2])
    }
  }
  const fontSize = Math.max(10, Math.min(28, Math.min(width, height) / 12))
  return (
    <Group listening={false}>
      <Rect x={x} y={y} width={width} height={height} cornerRadius={cornerRadius} fill={BG} />
      {lines.map((pts, i) => (
        <Line key={i} points={pts} stroke={STROKE} strokeWidth={1} opacity={0.5} />
      ))}
      {showLabel && (
        <Text
          x={x + 8}
          y={y + height / 2 - fontSize / 2}
          width={Math.max(0, width - 16)}
          align="center"
          text={`Missing: ${name ?? ''}`}
          fontSize={fontSize}
          fill={TEXT}
          ellipsis
          wrap="none"
        />
      )}
    </Group>
  )
}
