import { useMemo, useRef } from 'react'
import { Group, Rect, Image } from 'react-konva'
import type Konva from 'konva'
import useImage from 'use-image'
import type { PhoneLayer } from '@/types'
import { getPhoneSpec } from '@/assets/mockups/specs'
import { IPHONE_16_PRO_SVG } from '@/assets/mockups/iphone-16-pro'
import { IPHONE_16_PRO_PLAIN_SVG } from '@/assets/mockups/iphone-16-pro-plain'
import { PIXEL_9_SVG } from '@/assets/mockups/pixel-9'
import { PIXEL_9_PLAIN_SVG } from '@/assets/mockups/pixel-9-plain'
import { useEditorStore } from '@/store'
import { useAssetStore } from '@/store/assets'
import { resolveBrandColor } from '@/utils/brandColors'
import { PhoneStatusBar } from './PhoneStatusBar'
import { getShadowProps, useKonvaBlur } from './effects'
import { calcScreenshotLayout } from './PhoneNode.geometry'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PhoneNodeProps {
  layer: PhoneLayer
  isSelected: boolean
  onSelect: () => void
  onDragEnd: (x: number, y: number) => void
  onTransformEnd: (attrs: Partial<PhoneLayer>) => void
  forceNotDraggable?: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSvgString(model: string): string {
  if (model === 'pixel-9') return PIXEL_9_SVG
  if (model === 'pixel-9-plain') return PIXEL_9_PLAIN_SVG
  if (model === 'iphone-16-pro-plain') return IPHONE_16_PRO_PLAIN_SVG
  return IPHONE_16_PRO_SVG
}

/**
 * Draw a rounded-rect clip path with independent per-corner radii.
 * Extra params default to `tlr` so existing single-radius call sites work unchanged.
 * Order: top-left, top-right, bottom-right, bottom-left.
 */
function drawRoundedRectClip(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  tlr: number, trr = tlr, brr = tlr, blr = tlr,
) {
  ctx.beginPath()
  ctx.moveTo(x + tlr, y)
  ctx.lineTo(x + w - trr, y)
  ctx.arcTo(x + w, y,     x + w,     y + trr, trr)
  ctx.lineTo(x + w, y + h - brr)
  ctx.arcTo(x + w, y + h, x + w - brr, y + h, brr)
  ctx.lineTo(x + blr, y + h)
  ctx.arcTo(x,     y + h, x,         y + h - blr, blr)
  ctx.lineTo(x, y + tlr)
  ctx.arcTo(x,     y,     x + tlr,   y, tlr)
  ctx.closePath()
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PhoneNode({ layer, onSelect, onDragEnd, onTransformEnd, forceNotDraggable }: PhoneNodeProps) {
  const groupRef = useRef<Konva.Group>(null)
  const brandColors = useEditorStore((s) => s.project.settings.brandColors) ?? []
  const spec = getPhoneSpec(layer.model)
  const scale = layer.scale

  // Scaled dimensions
  const fw = spec.frameWidth * scale
  const fh = spec.frameHeight * scale
  const sx = spec.screen.x * scale
  const sy = spec.screen.y * scale
  const sw = spec.screen.width * scale
  const sh = spec.screen.height * scale
  const sr = spec.screen.cornerRadius * scale

  // Load SVG frame
  const svgString = getSvgString(layer.model)
  const svgDataUrl = useMemo(
    () => `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`,
    [svgString],
  )
  const [frameImage] = useImage(svgDataUrl)

  // Resolve screenshot source: prefer path-based (from asset store), fallback to inline
  // Subscribe to `assets` (the data object) — not `getAsset` (stable function ref).
  // Without this, components won't re-render when IDB finishes hydrating on refresh.
  const assets = useAssetStore((s) => s.assets)
  const screenshotSrc = layer.screenshotPath
    ? (assets[layer.screenshotPath]?.dataUrl ?? layer.screenshotDataUrl ?? '')
    : (layer.screenshotDataUrl ?? '')

  // Load screenshot
  const [screenshotImage] = useImage(screenshotSrc)

  // Solid status bar shrinks the screenshot area from the top
  const isSolidSb = layer.showStatusBar !== false && (layer.statusBarBg ?? 'transparent') === 'solid'
  const sbOffset = isSolidSb ? spec.statusBar.height * scale : 0   // scaled px to push screenshot down

  // Screenshot clip region (may start below the solid status bar)
  const shotClipY = sy + sbOffset
  const shotClipH = sh - sbOffset

  // Screenshot layout — uses the effective (possibly reduced) height
  const imgLayout = useMemo(() => {
    if (!screenshotImage) return null
    return calcScreenshotLayout(
      screenshotImage.width,
      screenshotImage.height,
      sw,
      shotClipH,
      layer.screenshotFit,
      layer.screenshotOffsetX,
      layer.screenshotOffsetY,
    )
  }, [screenshotImage, sw, shotClipH, layer.screenshotFit, layer.screenshotOffsetX, layer.screenshotOffsetY])

  useKonvaBlur(groupRef, layer.blur, `${layer.model}:${scale}:${screenshotSrc}:${layer.screenshotFit}:${layer.screenshotOffsetX}:${layer.screenshotOffsetY}:${layer.border?.width ?? 0}:${layer.showStatusBar}`)

  // Shadow props
  const shadowProps = getShadowProps(layer.shadow)

  return (
    <Group
      ref={groupRef}
      id={`layer-${layer.id}`}
      x={layer.x + fw / 2}
      y={layer.y + fh / 2}
      offsetX={fw / 2}
      offsetY={fh / 2}
      rotation={layer.rotation}
      opacity={layer.opacity}
      visible={layer.visible}
      draggable={!forceNotDraggable && !layer.locked}
      width={fw}
      height={fh}
      onClick={() => { if (!layer.locked) onSelect() }}
      onTap={() => { if (!layer.locked) onSelect() }}
      onDragStart={() => { if (!layer.locked) onSelect() }}
      onDragEnd={(e) => {
        const node = e.target
        onDragEnd(node.x() - fw / 2, node.y() - fh / 2)
      }}
      onTransformEnd={(e) => {
        const node = e.target
        const scaleX = node.scaleX()
        node.scaleX(1)
        node.scaleY(1)
        const nextScale = Math.max(0.1, layer.scale * scaleX)
        const nextFw = spec.frameWidth * nextScale
        const nextFh = spec.frameHeight * nextScale
        onTransformEnd({
          x: node.x() - nextFw / 2,
          y: node.y() - nextFh / 2,
          rotation: node.rotation(),
          scale: nextScale,
        })
      }}
      {...shadowProps}
    >
      {/* Screen background */}
      <Rect
        x={sx}
        y={sy}
        width={sw}
        height={sh}
        cornerRadius={sr}
        fill="#111111"
      />

      {/* Screenshot clipped to its effective area.
          In solid-bar mode the clip starts below the status bar (top corners become square
          because sbOffset > screen cornerRadius for all supported models). */}
      {screenshotImage && imgLayout && (
        <Group
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          clipFunc={(ctx: any) =>
            isSolidSb
              ? drawRoundedRectClip(ctx as CanvasRenderingContext2D, sx, shotClipY, sw, shotClipH, 0, 0, sr, sr)
              : drawRoundedRectClip(ctx as CanvasRenderingContext2D, sx, sy, sw, sh, sr)
          }
        >
          <Image
            image={screenshotImage}
            x={sx + imgLayout.x}
            y={shotClipY + imgLayout.y}
            width={imgLayout.width}
            height={imgLayout.height}
          />
        </Group>
      )}

      {/* Screenshot border — drawn above screenshot, below status bar and frame */}
      {layer.border && layer.border.width > 0 && (
        <Rect
          x={sx}
          y={sy}
          width={sw}
          height={sh}
          cornerRadius={sr}
          fill="transparent"
          stroke={resolveBrandColor(layer.border.color, brandColors)}
          strokeWidth={layer.border.width * scale}
          opacity={layer.border.opacity}
          listening={false}
        />
      )}

      {/* Status bar overlay (above screenshot, below frame) */}
      {layer.showStatusBar !== false && (
        <Group x={sx} y={sy}>
          <PhoneStatusBar
            spec={spec.statusBar}
            scale={scale}
            screenWidth={spec.screen.width}
            screenCornerRadius={spec.screen.cornerRadius}
            theme={layer.statusBarTheme ?? 'dark'}
            bg={layer.statusBarBg ?? 'transparent'}
            bgColor={resolveBrandColor(layer.statusBarColor ?? '#000000', brandColors)}
          />
        </Group>
      )}

      {/* Phone frame on top */}
      <Image
        image={frameImage}
        x={0}
        y={0}
        width={fw}
        height={fh}
      />
    </Group>
  )
}
