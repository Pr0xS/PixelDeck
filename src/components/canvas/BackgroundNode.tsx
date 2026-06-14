import { useRef, useEffect } from 'react'
import { Rect, Ellipse, Group, Image as KonvaImage } from 'react-konva'
import Konva from 'konva'
import useImage from 'use-image'
import { useEditorStore } from '@/store'
import type { BackgroundLayer } from '@/types'
import { resolveBrandColor, resolveFill } from '@/utils/brandColors'
import { fillToKonvaProps } from '@/utils/gradients'

interface BackgroundNodeProps {
  layer: BackgroundLayer
  canvasWidth: number
  canvasHeight: number
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
}: BackgroundNodeProps) {
  const brandColors = useEditorStore((s) => s.project.settings.brandColors) ?? []
  const fillProps = fillToKonvaProps(resolveFill(layer.fill, brandColors), canvasWidth, canvasHeight)

  // Background image
  const [bgImage] = useImage(layer.imageDataUrl ?? '')
  const bgImageRef = useRef<Konva.Image>(null)

  // Apply blur filter via Konva.Filters whenever image or blur value changes
  useEffect(() => {
    const node = bgImageRef.current
    if (!node || !bgImage) return
    const blur = layer.imageBlur ?? 0
    if (blur > 0) {
      node.cache()
      node.filters([Konva.Filters.Blur])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(node as any).blurRadius(blur)
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

  return (
    <Group
      id={`layer-${layer.id}`}
      opacity={layer.opacity}
      visible={layer.visible}
      listening={false}
    >
      {/* 1. Gradient / solid fill — always rendered as base */}
      <Rect
        x={0}
        y={0}
        width={canvasWidth}
        height={canvasHeight}
        {...fillProps}
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
      {layer.accents.map((accent, i) => (
        <Ellipse
          key={i}
          x={(accent.cx / 100) * canvasWidth}
          y={(accent.cy / 100) * canvasHeight}
          radiusX={accent.rx}
          radiusY={accent.ry}
          fill={resolveBrandColor(accent.color, brandColors)}
          listening={false}
        />
      ))}

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
