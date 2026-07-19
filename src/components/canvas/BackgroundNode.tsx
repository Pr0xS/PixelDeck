import { useRef, useEffect } from 'react'
import { Rect, Ellipse, Group, Image as KonvaImage } from 'react-konva'
import Konva from 'konva'
import useImage from 'use-image'
import type { BackgroundAccent, BackgroundLayer, BrandColor } from '@/types'
import { resolveBrandColor } from '@/utils/brandColors'
import { toTransparentColor } from '@/utils/gradients'
import { layerFillToKonvaProps } from '@/utils/konvaFill'
import { useBrandColors } from '@/hooks/useBrandColors'
import {
  getBackgroundAccentOpacity,
  getBackgroundAccentRenderColor,
  getNextBackgroundAccentIndex,
} from '@/utils/backgroundAccents'
import { useKonvaBlur } from './effects'

interface BackgroundNodeProps {
  layer: BackgroundLayer
  canvasWidth: number
  canvasHeight: number
  isSelected: boolean
  selectedAccentIndex: number | null
  onSelectAccent: (index: number) => void
  onAccentDragEnd: (index: number, cx: number, cy: number) => void
  onAccentTransformEnd: (index: number, rx: number, ry: number) => void
}

function AccentGlow({
  accent,
  index,
  layerId,
  x,
  y,
  isBackgroundSelected,
  brandColors,
  onSelect,
  onDragSelect,
  onDragEnd,
  onTransformEnd,
}: {
  accent: BackgroundAccent
  index: number
  layerId: string
  x: number
  y: number
  isBackgroundSelected: boolean
  brandColors: BrandColor[]
  onSelect: () => void
  onDragSelect: () => void
  onDragEnd: (x: number, y: number) => void
  onTransformEnd: (rx: number, ry: number) => void
}) {
  const ref = useRef<Konva.Ellipse>(null)
  const currentRadius = useRef({ rx: accent.rx, ry: accent.ry })
  useEffect(() => {
    currentRadius.current = { rx: accent.rx, ry: accent.ry }
  }, [accent.rx, accent.ry])
  useKonvaBlur(ref, accent.blur, `${accent.rx}:${accent.ry}:${accent.color}`)

  const resolved = getBackgroundAccentRenderColor(
    accent,
    resolveBrandColor(accent.color, brandColors),
  )
  const glowRadius = Math.max(accent.rx, accent.ry)

  return (
    <Ellipse
      ref={ref}
      id={`accent-glow-${layerId}-${index}`}
      x={x}
      y={y}
      radiusX={accent.rx}
      radiusY={accent.ry}
      opacity={accent.opacity === undefined ? undefined : getBackgroundAccentOpacity(accent)}
      fillRadialGradientStartPoint={{ x: 0, y: 0 }}
      fillRadialGradientEndPoint={{ x: 0, y: 0 }}
      fillRadialGradientStartRadius={0}
      fillRadialGradientEndRadius={glowRadius}
      fillRadialGradientColorStops={[0, resolved, 1, toTransparentColor(resolved)]}
      listening={isBackgroundSelected}
      draggable={isBackgroundSelected}
      onClick={() => { if (isBackgroundSelected) onSelect() }}
      onTap={() => { if (isBackgroundSelected) onSelect() }}
      onDragStart={() => { if (isBackgroundSelected) onDragSelect() }}
      onDragEnd={(e) => onDragEnd(e.target.x(), e.target.y())}
      onTransform={() => {
        const node = ref.current
        if (!node) return
        const nextRx = Math.max(10, currentRadius.current.rx * node.scaleX())
        const nextRy = Math.max(10, currentRadius.current.ry * node.scaleY())
        currentRadius.current = { rx: nextRx, ry: nextRy }
        node.scaleX(1)
        node.scaleY(1)
        node.radiusX(nextRx)
        node.radiusY(nextRy)
        node.fillRadialGradientEndRadius(Math.max(nextRx, nextRy))
        if ((accent.blur ?? 0) > 0) node.clearCache()
      }}
      onTransformEnd={() => {
        const node = ref.current
        if (!node) return
        node.scaleX(1)
        node.scaleY(1)
        onTransformEnd(currentRadius.current.rx, currentRadius.current.ry)
      }}
    />
  )
}

// ─── Noise canvas — generated once at module level (not inside any React component) ──
function createNoiseCanvas(): HTMLCanvasElement {
  const size = 200
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.createImageData(size, size)
  for (let i = 0; i < imageData.data.length; i += 4) {
    const v = Math.floor(Math.random() * 256)
    imageData.data[i] = v
    imageData.data[i + 1] = v
    imageData.data[i + 2] = v
    imageData.data[i + 3] = 255
  }
  ctx.putImageData(imageData, 0, 0)
  return canvas
}
let _noiseCanvas: HTMLCanvasElement | null = null
function getNoiseCanvas(): HTMLCanvasElement {
  if (!_noiseCanvas) _noiseCanvas = createNoiseCanvas()
  return _noiseCanvas
}

function calcImageLayout(
  imgW: number,
  imgH: number,
  cW: number,
  cH: number,
  fit: 'cover' | 'contain' | 'fill',
) {
  if (fit === 'fill') return { x: 0, y: 0, w: cW, h: cH }
  const scaleX = cW / imgW
  const scaleY = cH / imgH
  const s = fit === 'cover' ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY)
  const w = imgW * s
  const h = imgH * s
  return { x: (cW - w) / 2, y: (cH - h) / 2, w, h }
}

export function BackgroundNode({
  layer,
  canvasWidth,
  canvasHeight,
  isSelected,
  selectedAccentIndex,
  onSelectAccent,
  onAccentDragEnd,
  onAccentTransformEnd,
}: BackgroundNodeProps) {
  const brandColors = useBrandColors()
  const fillProps = layerFillToKonvaProps(layer.fill, brandColors, { width: canvasWidth, height: canvasHeight })
  const groupRef = useRef<Konva.Group>(null)

  // Background image
  const [bgImage] = useImage(layer.imageDataUrl ?? '')
  const bgImageRef = useRef<Konva.Image>(null)

  // Apply blur filter via Konva.Filters whenever image or blur value changes
  useEffect(() => {
    const node = bgImageRef.current
    if (!node || !bgImage) return
    const blur = layer.imageBlur ?? 0
    if (blur > 0) {
      // See effects.ts useKonvaBlur for why the padding is 3× the blur radius.
      node.cache({ offset: Math.ceil(blur * 3) })
      // Native CSS blur avoids Konva.Filters.Blur's known white-halo artifact on
      // anti-aliased transparent edges (konvajs/konva#428, #1799).
      node.filters([`blur(${blur}px)`])
    } else {
      node.clearCache()
      node.filters([])
    }
    node.getLayer()?.batchDraw()
  }, [bgImage, layer.imageBlur])

  const noiseCanvas = getNoiseCanvas()

  const imgLayout = bgImage
    ? calcImageLayout(bgImage.width, bgImage.height, canvasWidth, canvasHeight, layer.imageFit ?? 'cover')
    : null

  const accentOrder = layer.accents.map((_, index) => index)
  if (selectedAccentIndex !== null && accentOrder.includes(selectedAccentIndex)) {
    accentOrder.splice(accentOrder.indexOf(selectedAccentIndex), 1)
    accentOrder.push(selectedAccentIndex)
  }

  const selectAccentAtPointer = (clickedIndex: number) => {
    const point = groupRef.current?.getRelativePointerPosition()
    if (!point) {
      onSelectAccent(clickedIndex)
      return
    }
    onSelectAccent(getNextBackgroundAccentIndex(
      layer.accents,
      point,
      canvasWidth,
      canvasHeight,
      clickedIndex,
      selectedAccentIndex,
    ))
  }

  return (
    <Group
      ref={groupRef}
      id={`layer-${layer.id}`}
      opacity={layer.opacity}
      visible={layer.visible}
      listening={isSelected}
    >
      {/* 1. Gradient / solid fill — always rendered as base */}
      <Rect
        x={0}
        y={0}
        width={canvasWidth}
        height={canvasHeight}
        {...fillProps}
        listening={false}
      />

      {/* 2. Background image — clipped to canvas bounds */}
      {bgImage && imgLayout && (
        <Group
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          clipFunc={(ctx: any) => {
            ctx.rect(0, 0, canvasWidth, canvasHeight)
          }}
        >
          <KonvaImage
            ref={bgImageRef}
            image={bgImage}
            x={imgLayout.x}
            y={imgLayout.y}
            width={imgLayout.w}
            height={imgLayout.h}
            listening={false}
          />
        </Group>
      )}

      {/* 3. Tint overlay above image */}
      {bgImage && (layer.imageOverlayOpacity ?? 0) > 0 && (
        <Rect
          x={0}
          y={0}
          width={canvasWidth}
          height={canvasHeight}
          fill={layer.imageOverlayColor ?? '#000000'}
          opacity={layer.imageOverlayOpacity}
          listening={false}
        />
      )}

      {/* 4. Accent ellipses */}
      {accentOrder.map((i) => {
        const accent = layer.accents[i]
        return (
          <AccentGlow
            key={i}
            accent={accent}
            index={i}
            layerId={layer.id}
            x={(accent.cx / 100) * canvasWidth}
            y={(accent.cy / 100) * canvasHeight}
            isBackgroundSelected={isSelected}
            brandColors={brandColors}
            onSelect={() => selectAccentAtPointer(i)}
            onDragSelect={() => onSelectAccent(i)}
            onDragEnd={(nodeX, nodeY) => {
              const cx = Math.min(100, Math.max(0, (nodeX / canvasWidth) * 100))
              const cy = Math.min(100, Math.max(0, (nodeY / canvasHeight) * 100))
              onAccentDragEnd(i, cx, cy)
            }}
            onTransformEnd={(rx, ry) => onAccentTransformEnd(i, rx, ry)}
          />
        )
      })}

      {/* 5. Noise texture */}
      {(layer.noise ?? 0) > 0 && (
        <Rect
          x={0}
          y={0}
          width={canvasWidth}
          height={canvasHeight}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fillPatternImage={noiseCanvas as any}
          fillPatternRepeat="repeat"
          opacity={layer.noise}
          listening={false}
        />
      )}
    </Group>
  )
}
