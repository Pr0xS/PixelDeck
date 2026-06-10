import { useEffect, useRef, useMemo } from 'react'
import { Text, Image as KonvaImage } from 'react-konva'
import type Konva from 'konva'
import type { TextLayer } from '@/types'
import { resolveFill } from '@/utils/brandColors'
import { fillToKonvaProps } from '@/utils/gradients'
import { renderSpansToCanvas, spansRenderKey, spansToMarks } from '@/utils/textRendering'
import { useEditorStore } from '@/store'
import { getShadowProps, useKonvaBlur } from './effects'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TextNodeProps {
  layer: TextLayer
  isSelected: boolean
  onSelect: () => void
  onDragEnd: (x: number, y: number) => void
  onTransformEnd: (attrs: Partial<TextLayer>) => void
  forceNotDraggable?: boolean
}

// ─── Module-level transform helpers ──────────────────────────────────────────

/**
 * Returns the name of the anchor currently being dragged on the transformer
 * that owns `node` (e.g. 'middle-left', 'top-right'), or null when not found.
 */
function getActiveAnchor(node: Konva.Node): string | null {
  const stage = node.getStage()
  if (!stage) return null
  const trs = stage.find('Transformer') as unknown as Konva.Transformer[]
  for (const tr of trs) {
    if (tr.nodes().includes(node)) {
      const a = (tr as Konva.Transformer & { getActiveAnchor?: () => string }).getActiveAnchor?.()
      return a || null
    }
  }
  return null
}

/**
 * Classify a transform tick into:
 * - 'side'     → only X changes (middle-left / middle-right) → resize width only
 * - 'vertical' → only Y changes (top-center / bottom-center) → resize fontSize only
 * - 'corner'   → uniform (corner anchor)                     → resize both
 */
function classifyAnchor(
  anchor: string | null,
  sx: number,
  sy: number,
): 'side' | 'vertical' | 'corner' {
  if (anchor === 'middle-left' || anchor === 'middle-right') return 'side'
  if (anchor === 'top-center'  || anchor === 'bottom-center') return 'vertical'
  if (anchor) return 'corner'
  // Fallback when anchor name is unavailable
  const dx = Math.abs(sx - 1)
  const dy = Math.abs(sy - 1)
  if (dy < 0.001 && dx > 0.001) return 'side'
  if (dx < 0.001 && dy > 0.001) return 'vertical'
  return 'corner'
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TextNode({ layer, onSelect, onDragEnd, onTransformEnd, forceNotDraggable }: TextNodeProps) {
  const textRef = useRef<Konva.Text>(null)
  const imageRef = useRef<Konva.Image>(null)
  // True once a side/corner handle has established an explicit width on an auto-width text.
  const widthEstablished = useRef(false)
  // Snapshot of y/offsetY taken at transform start; used to restore the vertical
  // position when only width changes (prevents y-jump from Transformer's scaleY adjustment).
  const transformStartRef = useRef<{ y: number; offsetY: number } | null>(null)

  const brandColors = useEditorStore((s) => s.project.settings.brandColors) ?? []
  const resolvedLayer: TextLayer = {
    ...layer,
    fill: resolveFill(layer.fill, brandColors),
    marks: layer.marks?.map((mark) => ({
      ...mark,
      fill: mark.fill ? resolveFill(mark.fill, brandColors) : mark.fill,
    })),
    spans: layer.spans?.map((span) => ({
      ...span,
      fill: span.fill ? resolveFill(span.fill, brandColors) : span.fill,
    })),
  }

  // Reset flags when a different layer is mounted
  useEffect(() => {
    widthEstablished.current = false
    transformStartRef.current = null
  }, [layer.id])

  // Rich text mode when the layer has marks (new) or legacy spans
  const hasRichText = (layer.marks?.length ?? 0) > 0 || (layer.spans?.length ?? 0) > 0
  const estimateTextHeight = () => {
    if (spanCanvas) return spanCanvas.height
    const lines = (layer.text || '').split('\n').length || 1
    return lines * layer.fontSize * layer.lineHeight
  }

  // Render rich text to an offscreen canvas — recomputed only when rendering-relevant
  // props change (via stable cache key).
  const renderKey = spansRenderKey(resolvedLayer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const spanCanvas = useMemo(() => hasRichText ? renderSpansToCanvas(resolvedLayer) : null, [renderKey])
  const shadowProps = getShadowProps(layer.shadow)
  useKonvaBlur(textRef, hasRichText ? 0 : layer.blur, renderKey)
  useKonvaBlur(imageRef, hasRichText ? layer.blur : 0, renderKey)

  // ── Double-click inline text editor (plain and rich text) ───────────────
  const handleDblClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (layer.locked) return
    e.cancelBubble = true

    // In rich-text mode the KonvaImage (imageRef) is mounted; textRef is null.
    const node = hasRichText ? imageRef.current : textRef.current
    const stage = node?.getStage()
    if (!node || !stage) return

    const container = stage.container()
    const containerRect = container.getBoundingClientRect()
    const absPos = node.absolutePosition()
    const zoom = useEditorStore.getState().zoom

    // absPos is already in canvas-pixel space (Stage applies scaleX=zoom + x=viewportX).
    // Correct formula: subtract the visual half-width (in screen px), not the canvas half-width.
    const screenX = containerRect.left + absPos.x - (layer.width ?? 1000) / 2 * zoom
    const screenY = containerRect.top  + absPos.y - estimateTextHeight() / 2 * zoom

    node.hide()
    stage.batchDraw()

    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)

    const w = (layer.width ?? 1000) * zoom
    const fontSize = layer.fontSize * zoom

    Object.assign(textarea.style, {
      position: 'fixed',
      top: `${screenY}px`,
      left: `${screenX}px`,
      width: `${w}px`,
      minHeight: `${fontSize * 1.5}px`,
      fontSize: `${fontSize}px`,
      fontFamily: layer.fontFamily,
      fontWeight: String(layer.fontWeight),
      fontStyle: layer.italic ? 'italic' : 'normal',
      lineHeight: String(layer.lineHeight),
      letterSpacing: `${layer.letterSpacing * zoom}px`,
      color: typeof resolvedLayer.fill === 'string' ? resolvedLayer.fill : '#ffffff',
      background: 'rgba(0,0,0,0.6)',
      border: '2px solid rgba(124,110,246,0.8)',
      borderRadius: '4px',
      padding: '2px 4px',
      outline: 'none',
      resize: 'none',
      zIndex: '9999',
      overflow: 'hidden',
      transformOrigin: 'top left',
    })
    // For legacy spans-only layers, text field may be empty — seed from spans.
    textarea.value = layer.text || (layer.spans?.length ? spansToMarks(layer.spans).text : '')
    textarea.select()

    const cleanup = () => {
      const newText = textarea.value
      // Derive base marks — prefer layer.marks; fall back to migrating legacy spans.
      const baseMarks = layer.marks ?? (layer.spans?.length ? spansToMarks(layer.spans).marks : [])
      // Clamp marks to new text length and drop any that collapsed to zero-width.
      const clampedMarks = baseMarks
        .map((m) => ({
          ...m,
          start: Math.min(m.start, newText.length),
          end: Math.min(m.end, newText.length),
        }))
        .filter((m) => m.start < m.end)
      onTransformEnd({
        text: newText,
        marks: clampedMarks.length ? clampedMarks : undefined,
        spans: undefined,   // always clear legacy spans on commit
      })
      node.show()
      stage.batchDraw()
      if (document.body.contains(textarea)) document.body.removeChild(textarea)
      textarea.removeEventListener('blur', cleanup)
    }

    textarea.addEventListener('blur', cleanup)
    textarea.addEventListener('keydown', (ke) => {
      if (ke.key === 'Escape') {
        // Remove blur listener BEFORE removing from DOM — otherwise blur fires
        // synchronously during removeChild and cleanup() tries a second removeChild.
        textarea.removeEventListener('blur', cleanup)
        node.show()
        stage.batchDraw()
        if (document.body.contains(textarea)) document.body.removeChild(textarea)
      }
      ke.stopPropagation()
    })

    setTimeout(() => textarea.focus(), 0)
  }

  // ── Rich text mode: render offscreen canvas as Konva Image ─────────────
  if (hasRichText && spanCanvas) {
    return (
      <KonvaImage
        ref={imageRef}
        id={`layer-${layer.id}`}
        x={layer.x + (layer.width ?? 1000) / 2}
        y={layer.y + spanCanvas.height / 2}
        offsetX={(layer.width ?? 1000) / 2}
        offsetY={spanCanvas.height / 2}
        image={spanCanvas}
        width={layer.width ?? 1000}
        height={spanCanvas.height}
        rotation={layer.rotation}
        opacity={layer.opacity}
        visible={layer.visible}
        draggable={!forceNotDraggable && !layer.locked}
        {...shadowProps}
        onClick={() => { if (!layer.locked) onSelect() }}
        onTap={() => { if (!layer.locked) onSelect() }}
        onDblClick={handleDblClick}
        onDragStart={() => { if (!layer.locked) onSelect() }}
        onDragEnd={() => {
          const node = imageRef.current
          if (!node) return
          onDragEnd(node.x() - (layer.width ?? 1000) / 2, node.y() - spanCanvas.height / 2)
        }}
        onTransformStart={() => {
          const node = imageRef.current
          if (!node) return
          transformStartRef.current = { y: node.y(), offsetY: node.offsetY() }
        }}
        onTransform={() => {
          const node = imageRef.current
          if (!node) return
          const sx = node.scaleX()
          const sy = node.scaleY()
          node.scaleX(1)
          node.scaleY(1)
          const kind = classifyAnchor(getActiveAnchor(node), sx, sy)
          if (kind === 'side' || kind === 'corner') {
            const newW = Math.max(80, node.width() * sx)
            // Re-raster the rich text canvas at the new width to avoid bitmap stretch.
            const newCanvas = renderSpansToCanvas({ ...resolvedLayer, width: newW })
            node.image(newCanvas)
            node.width(newW)
            node.height(newCanvas.height)
            node.offsetX(newW / 2)
            // Pin the top edge: text grows downward as lines reflow.
            const topEdge = transformStartRef.current
              ? transformStartRef.current.y - transformStartRef.current.offsetY
              : node.y() - node.height() / 2
            node.offsetY(newCanvas.height / 2)
            node.y(topEdge + newCanvas.height / 2)
          } else {
            // Vertical handle: no-op — restore y to prevent Transformer-induced jump.
            if (transformStartRef.current) {
              node.y(transformStartRef.current.y)
              node.offsetY(transformStartRef.current.offsetY)
            }
          }
        }}
        onTransformEnd={() => {
          const node = imageRef.current
          if (!node) return
          node.scaleX(1)
          node.scaleY(1)
          const w = node.width()
          const patch: Partial<TextLayer> = {
            width: Math.round(w),
            rotation: node.rotation(),
            x: node.x() - w / 2,
            y: node.y() - node.height() / 2,
          }
          onTransformEnd(patch)
        }}
      />
    )
  }

  // ── Plain text mode (no spans, or spans canvas not ready) ────────────────
  const fontStyle = layer.italic
    ? `italic ${layer.fontWeight}`
    : String(layer.fontWeight)

  const fillProps = fillToKonvaProps(
    resolveFill(layer.fill, brandColors),
    layer.width ?? 1000,
    layer.fontSize * 1.5,
  )

  return (
    <Text
      ref={textRef}
      id={`layer-${layer.id}`}
      x={layer.x + (layer.width ?? 1000) / 2}
      y={layer.y + estimateTextHeight() / 2}
      offsetX={(layer.width ?? 1000) / 2}
      offsetY={estimateTextHeight() / 2}
      text={layer.text}
      fontFamily={layer.fontFamily}
      fontSize={layer.fontSize}
      fontStyle={fontStyle}
      letterSpacing={layer.letterSpacing}
      lineHeight={layer.lineHeight}
      align={layer.align}
      width={layer.width}
      rotation={layer.rotation}
      opacity={layer.opacity}
      visible={layer.visible}
      draggable={!forceNotDraggable && !layer.locked}
      {...fillProps}
      {...shadowProps}
      textDecoration={[layer.underline ? 'underline' : '', layer.strikethrough ? 'line-through' : ''].filter(Boolean).join(' ') || undefined}
      onClick={() => { if (!layer.locked) onSelect() }}
      onTap={() => { if (!layer.locked) onSelect() }}
      onDragStart={() => { if (!layer.locked) onSelect() }}
      onDragEnd={() => {
        const node = textRef.current
        if (!node) return
        onDragEnd(node.x() - (layer.width ?? 1000) / 2, node.y() - estimateTextHeight() / 2)
      }}
      onTransformStart={() => {
        const node = textRef.current
        if (!node) return
        transformStartRef.current = { y: node.y(), offsetY: node.offsetY() }
      }}
      onTransform={() => {
        const node = textRef.current
        if (!node) return
        const sx = node.scaleX()
        const sy = node.scaleY()
        node.scaleX(1)
        node.scaleY(1)
        // Always restore Y: we never change height for plain text.
        // Without this, the Transformer's scaleY adjustment causes a vertical position jump.
        if (transformStartRef.current) {
          node.y(transformStartRef.current.y)
          node.offsetY(transformStartRef.current.offsetY)
        }
        const kind = classifyAnchor(getActiveAnchor(node), sx, sy)
        if (kind === 'side' || kind === 'corner') {
          // Resize width only — text reflows at fixed fontSize.
          const w = Math.max(80, node.width() * sx)
          node.width(w)
          node.offsetX(w / 2)
          widthEstablished.current = true
        }
        // Vertical handle: y already restored, nothing else to do.
      }}
      onTransformEnd={() => {
        const node = textRef.current
        if (!node) return
        node.scaleX(1)
        node.scaleY(1)
        const w = node.width()
        // Pin the top-left corner: layer.y is the top edge, so use the snapshot
        // top (y - offsetY) rather than the node center. This ensures that when
        // text reflows to more/fewer lines the box grows downward, not from center.
        const topY = transformStartRef.current
          ? transformStartRef.current.y - transformStartRef.current.offsetY
          : node.y() - node.height() / 2
        const patch: Partial<TextLayer> = {
          rotation: node.rotation(),
          x: node.x() - w / 2,
          y: topY,
        }
        if (layer.width != null || widthEstablished.current) patch.width = w
        widthEstablished.current = false
        onTransformEnd(patch)
      }}
      onDblClick={handleDblClick}
    />
  )
}
