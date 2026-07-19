import { useEffect, useRef, useMemo } from 'react'
import { Text, Image as KonvaImage } from 'react-konva'
import type Konva from 'konva'
import type { TextLayer } from '@/types'
import { resolveFill } from '@/utils/brandColors'
import { layerFillToKonvaProps } from '@/utils/konvaFill'
import { DEFAULT_TEXT_WIDTH, renderSpansToCanvas, spansRenderKey } from '@/utils/textRendering'
import { useEditorStore } from '@/store'
import { useBrandColors } from '@/hooks/useBrandColors'
import { useLayerEffects } from '@/hooks/useLayerEffects'
import { useLayerInteraction } from '@/hooks/useLayerInteraction'
import { useLayerTransform } from '@/hooks/useLayerTransform'
import { useKonvaBlur } from './effects'

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
 * - 'side'     → only X changes (middle-left / middle-right) → resize box width only
 * - 'vertical' → only Y changes (top-center / bottom-center) → resize box height only
 * - 'corner'   → uniform (corner anchor)                     → resize box width + height
 * Font size is NEVER scaled by the transformer — only the wrapping box changes.
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
  // True once a vertical/corner handle has established an explicit height on an auto-height text.
  const heightEstablished = useRef(false)
  // Snapshot of y/offsetY taken at transform start; used to restore the vertical
  // position when only width changes (prevents y-jump from Transformer's scaleY adjustment).
  const transformStartRef = useRef<{ y: number; offsetY: number } | null>(null)

  const brandColors = useBrandColors()
  // Hide the node while the in-canvas overlay editor is open for this layer
  const isTextEditing = useEditorStore((s) => s.editingTextId === layer.id)
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
    heightEstablished.current = false
    transformStartRef.current = null
  }, [layer.id])

  // Rich text mode when the layer has marks (new) or legacy spans
  const hasRichText = (layer.marks?.length ?? 0) > 0 || (layer.spans?.length ?? 0) > 0
  // Visual box height: explicit layer.height wins; otherwise the content height.
  // (In rich mode the offscreen canvas is already sized to layer.height when set.)
  const estimateTextHeight = () => {
    if (spanCanvas) return spanCanvas.height
    if (layer.height != null) return layer.height
    const lines = (layer.text || '').split('\n').length || 1
    return lines * layer.fontSize * layer.lineHeight
  }
  // Minimum box height = one line of text
  const minBoxHeight = () => Math.max(8, layer.fontSize * layer.lineHeight)

  // Render rich text to an offscreen canvas — recomputed only when rendering-relevant
  // props change (via stable cache key).
  const renderKey = spansRenderKey(resolvedLayer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const spanCanvas = useMemo(() => hasRichText ? renderSpansToCanvas(resolvedLayer) : null, [renderKey])
  const shadowProps = useLayerEffects(textRef, layer, renderKey, hasRichText ? 0 : layer.blur)
  useKonvaBlur(imageRef, hasRichText ? layer.blur : 0, renderKey)

  const richInteractionProps = useLayerInteraction({
    nodeRef: imageRef,
    locked: layer.locked,
    onSelect,
    onDragEnd,
    getDragPosition: (node) => ({
      x: node.x() - (layer.width ?? DEFAULT_TEXT_WIDTH) / 2,
      y: node.y() - (spanCanvas?.height ?? 0) / 2,
    }),
  })
  const plainInteractionProps = useLayerInteraction({
    nodeRef: textRef,
    locked: layer.locked,
    onSelect,
    onDragEnd,
    getDragPosition: (node) => ({
      x: node.x() - (layer.width ?? DEFAULT_TEXT_WIDTH) / 2,
      y: node.y() - estimateTextHeight() / 2,
    }),
  })
  const handleRichTransformEnd = useLayerTransform({
    nodeRef: imageRef,
    onChange: onTransformEnd,
    buildPatch: (node): Partial<TextLayer> => {
      const width = node.width()
      const patch: Partial<TextLayer> = {
        width: Math.round(width),
        rotation: node.rotation(),
        x: node.x() - width / 2,
        y: node.y() - node.height() / 2,
      }
      if (layer.height != null || heightEstablished.current) patch.height = Math.round(node.height())
      return patch
    },
    beforeChange: () => { heightEstablished.current = false },
  })
  const handlePlainTransformEnd = useLayerTransform({
    nodeRef: textRef,
    onChange: onTransformEnd,
    buildPatch: (node): Partial<TextLayer> => {
      const patch: Partial<TextLayer> = {
        rotation: node.rotation(),
        x: node.x() - node.offsetX(),
        y: node.y() - node.offsetY(),
      }
      if (layer.width != null || widthEstablished.current) patch.width = node.width()
      if (layer.height != null || heightEstablished.current) patch.height = Math.round(node.height())
      return patch
    },
    beforeChange: () => {
      widthEstablished.current = false
      heightEstablished.current = false
    },
  })

  // ── Double-click → in-canvas WYSIWYG editor (overlay mounted by StageCanvas)
  const handleDblClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (layer.locked) return
    const { activeLocale, project, startTextEdit } = useEditorStore.getState()
    if (activeLocale !== project.settings.defaultLocale) return
    if (forceNotDraggable) {
      // Inside a non-editing group: let the event bubble so GroupNode enters
      // group-edit mode and selects this child, then the overlay opens.
      startTextEdit(layer.id)
      return
    }
    e.cancelBubble = true
    onSelect()
    startTextEdit(layer.id)
  }

  // ── Rich text mode: render offscreen canvas as Konva Image ─────────────
  if (hasRichText && spanCanvas) {
    return (
      <KonvaImage
        ref={imageRef}
        id={`layer-${layer.id}`}
        x={layer.x + (layer.width ?? DEFAULT_TEXT_WIDTH) / 2}
        y={layer.y + spanCanvas.height / 2}
        offsetX={(layer.width ?? DEFAULT_TEXT_WIDTH) / 2}
        offsetY={spanCanvas.height / 2}
        image={spanCanvas}
        width={layer.width ?? DEFAULT_TEXT_WIDTH}
        height={spanCanvas.height}
        rotation={layer.rotation}
        opacity={layer.opacity}
        visible={layer.visible && !isTextEditing}
        draggable={!forceNotDraggable && !layer.locked}
        {...shadowProps}
        {...richInteractionProps}
        onDblClick={handleDblClick}
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

          // New box dimensions — font size never changes, only the box.
          let newW = node.width()
          let newH: number | undefined =
            layer.height != null || heightEstablished.current ? node.height() : undefined
          if (kind !== 'vertical') newW = Math.max(80, node.width() * sx)
          if (kind !== 'side') {
            newH = Math.max(minBoxHeight(), node.height() * sy)
            heightEstablished.current = true
          }

          // Re-raster the rich text canvas at the new box size to avoid bitmap stretch.
          const newCanvas = renderSpansToCanvas({ ...resolvedLayer, width: newW, height: newH })
          node.image(newCanvas)
          node.width(newW)
          node.height(newCanvas.height)
          node.offsetX(newW / 2)
          node.offsetY(newCanvas.height / 2)

          if (kind === 'side') {
            // Auto-height reflow: pin the top edge so text grows downward.
            const topEdge = transformStartRef.current
              ? transformStartRef.current.y - transformStartRef.current.offsetY
              : node.y() - node.height() / 2
            node.y(topEdge + newCanvas.height / 2)
          }
          // vertical/corner: the Transformer already positioned the node for the new size.
        }}
        onTransformEnd={handleRichTransformEnd}
      />
    )
  }

  // ── Plain text mode (no spans, or spans canvas not ready) ────────────────
  const fontStyle = layer.italic
    ? `italic ${layer.fontWeight}`
    : String(layer.fontWeight)

  const fillProps = layerFillToKonvaProps(layer.fill, brandColors, {
    width: layer.width ?? DEFAULT_TEXT_WIDTH,
    height: layer.fontSize * 1.5,
  })

  return (
    <Text
      ref={textRef}
      id={`layer-${layer.id}`}
      x={layer.x + (layer.width ?? DEFAULT_TEXT_WIDTH) / 2}
      y={layer.y + estimateTextHeight() / 2}
      offsetX={(layer.width ?? DEFAULT_TEXT_WIDTH) / 2}
      offsetY={estimateTextHeight() / 2}
      text={layer.text}
      fontFamily={layer.fontFamily}
      fontSize={layer.fontSize}
      fontStyle={fontStyle}
      letterSpacing={layer.letterSpacing}
      lineHeight={layer.lineHeight}
      align={layer.align}
      width={layer.width}
      height={layer.height}
      verticalAlign={layer.verticalAlign ?? 'top'}
      rotation={layer.rotation}
      opacity={layer.opacity}
      visible={layer.visible && !isTextEditing}
      draggable={!forceNotDraggable && !layer.locked}
      {...fillProps}
      {...shadowProps}
      textDecoration={[layer.underline ? 'underline' : '', layer.strikethrough ? 'line-through' : ''].filter(Boolean).join(' ') || undefined}
      {...plainInteractionProps}
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
        const kind = classifyAnchor(getActiveAnchor(node), sx, sy)
        if (kind === 'side') {
          // Width-only drag: restore Y so the auto-height reflow doesn't cause
          // a vertical position jump from the Transformer's scaleY adjustment.
          if (transformStartRef.current) {
            node.y(transformStartRef.current.y)
            node.offsetY(transformStartRef.current.offsetY)
          }
        } else {
          // Vertical / corner drag: resize the box height (font size unchanged).
          const h = Math.max(minBoxHeight(), node.height() * sy)
          node.height(h)
          node.offsetY(h / 2)
          heightEstablished.current = true
        }
        if (kind !== 'vertical') {
          // Resize box width — text reflows at fixed fontSize.
          const w = Math.max(80, node.width() * sx)
          node.width(w)
          node.offsetX(w / 2)
          widthEstablished.current = true
        }
      }}
      // layer.x/y are the box top-left; the handler persists node position minus offset.
      onTransformEnd={handlePlainTransformEnd}
      onDblClick={handleDblClick}
    />
  )
}
