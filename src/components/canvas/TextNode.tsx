import { useEffect, useRef, useMemo } from 'react'
import { Text, Image as KonvaImage } from 'react-konva'
import type Konva from 'konva'
import type { TextLayer } from '@/types'
import { fillToKonvaProps } from '@/utils/gradients'
import { renderSpansToCanvas, spansRenderKey } from '@/utils/textRendering'
import { useEditorStore } from '@/store'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TextNodeProps {
  layer: TextLayer
  isSelected: boolean
  onSelect: () => void
  onDragEnd: (x: number, y: number) => void
  onTransformEnd: (attrs: Partial<TextLayer>) => void
  forceNotDraggable?: boolean
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TextNode({ layer, onSelect, onDragEnd, onTransformEnd, forceNotDraggable }: TextNodeProps) {
  const textRef = useRef<Konva.Text>(null)
  const imageRef = useRef<Konva.Image>(null)
  const currentWidth = useRef(layer.width ?? 1000)
  useEffect(() => { currentWidth.current = layer.width ?? 1000 }, [layer.width])

  const hasSpans = (layer.spans?.length ?? 0) > 0
  const estimateTextHeight = () => {
    if (spanCanvas) return spanCanvas.height
    const lines = (layer.text || '').split('\n').length || 1
    return Math.max(layer.fontSize * layer.lineHeight, lines * layer.fontSize * layer.lineHeight)
  }

  // Render spans to an offscreen canvas — recomputed only when rendering-relevant
  // props change (via stable cache key).
  const renderKey = spansRenderKey(layer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const spanCanvas = useMemo(() => hasSpans ? renderSpansToCanvas(layer) : null, [renderKey])

  // ── Shared transform handler ───────────────────────────────────────────────
  const handleTransformEnd = (node: Konva.Node | null) => {
    if (!node) return
    node.scaleX(1)
    node.scaleY(1)
    const h = estimateTextHeight()
    onTransformEnd({ width: currentWidth.current, x: node.x() - currentWidth.current / 2, y: node.y() - h / 2, rotation: node.rotation() })
  }

  // ── Double-click inline text editor (plain text only) ────────────────────
  const handleDblClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (layer.locked || hasSpans) return
    e.cancelBubble = true

    const node = textRef.current
    const stage = node?.getStage()
    if (!node || !stage) return

    const container = stage.container()
    const containerRect = container.getBoundingClientRect()
    const absPos = node.absolutePosition()
    const zoom = useEditorStore.getState().zoom

    const screenX = containerRect.left + (absPos.x - (layer.width ?? 1000) / 2) * zoom
    const screenY = containerRect.top + (absPos.y - estimateTextHeight() / 2) * zoom

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
      color: typeof layer.fill === 'string' ? layer.fill : '#ffffff',
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
    textarea.value = layer.text
    textarea.select()

    const cleanup = () => {
      const newText = textarea.value
      onTransformEnd({ text: newText })
      node.show()
      stage.batchDraw()
      if (document.body.contains(textarea)) document.body.removeChild(textarea)
      textarea.removeEventListener('blur', cleanup)
    }

    textarea.addEventListener('blur', cleanup)
    textarea.addEventListener('keydown', (ke) => {
      if (ke.key === 'Escape') {
        node.show()
        stage.batchDraw()
        if (document.body.contains(textarea)) document.body.removeChild(textarea)
      }
      ke.stopPropagation()
    })

    setTimeout(() => textarea.focus(), 0)
  }

  // ── Spans mode: render offscreen canvas as Konva Image ───────────────────
  if (hasSpans && spanCanvas) {
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
        onClick={() => { if (!layer.locked) onSelect() }}
        onTap={() => { if (!layer.locked) onSelect() }}
        onDragStart={() => { if (!layer.locked) onSelect() }}
        onDragEnd={() => {
          const node = imageRef.current
          if (!node) return
          onDragEnd(node.x() - (layer.width ?? 1000) / 2, node.y() - spanCanvas.height / 2)
        }}
        onTransform={() => {
          const node = imageRef.current
          if (!node) return
          const scaleX = node.scaleX()
          currentWidth.current = Math.max(80, node.width() * scaleX)
          node.scaleX(1)
          node.scaleY(1)
          node.width(currentWidth.current)
          node.offsetX(currentWidth.current / 2)
        }}
        onTransformEnd={() => handleTransformEnd(imageRef.current)}
      />
    )
  }

  // ── Plain text mode (no spans, or spans canvas not ready) ────────────────
  const fontStyle = layer.italic
    ? `italic ${layer.fontWeight}`
    : String(layer.fontWeight)

  const fillProps = fillToKonvaProps(
    layer.fill,
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
      onClick={() => { if (!layer.locked) onSelect() }}
      onTap={() => { if (!layer.locked) onSelect() }}
      onDragStart={() => { if (!layer.locked) onSelect() }}
      onDragEnd={() => {
        const node = textRef.current
        if (!node) return
        onDragEnd(node.x() - (layer.width ?? 1000) / 2, node.y() - estimateTextHeight() / 2)
      }}
      onTransform={() => {
        const node = textRef.current
        if (!node) return
        const scaleX = node.scaleX()
        currentWidth.current = Math.max(80, node.width() * scaleX)
        node.scaleX(1)
        node.scaleY(1)
        node.width(currentWidth.current)
        node.offsetX(currentWidth.current / 2)
      }}
      onTransformEnd={() => handleTransformEnd(textRef.current)}
      onDblClick={handleDblClick}
    />
  )
}
