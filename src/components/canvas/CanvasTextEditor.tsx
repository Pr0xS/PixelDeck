import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type Konva from 'konva'
import { useEditorStore } from '@/store'
import type { GroupLayer, Layer, TextLayer } from '@/types'
import { useRichTextEditor } from '@/components/text/useRichTextEditor'
import { RichTextToolbar } from '@/components/text/RichTextToolbar'
import { resolveFill } from '@/utils/brandColors'
import { applyCanvasFormatToGroup, getProjectBaseFormat } from '@/utils/canvasFormats'

// ─────────────────────────────────────────────────────────────────────────────
// In-canvas WYSIWYG text editor. Mounted by StageCanvas when editingTextId is
// set (canvas double-click or the panel's "Edit text" button). Renders a
// contentEditable overlay aligned with the hidden Konva node (position / scale
// / rotation aware) plus the style toolbar. This is THE text editor — the
// properties panel only offers a button that opens it.
// ─────────────────────────────────────────────────────────────────────────────

interface CanvasTextEditorProps {
  stageRef: React.RefObject<Konva.Stage | null>
}

interface Placement {
  x: number
  y: number
  scale: number
  rotation: number
}

/** Find a text layer (top-level or group child) and its parent group, if any */
function findTextLayer(
  layers: Layer[],
  layerId: string,
): { layer: TextLayer; parentGroup: GroupLayer | null } | null {
  for (const layer of layers) {
    if (layer.id === layerId) {
      return layer.type === 'text' ? { layer, parentGroup: null } : null
    }
    if (layer.type === 'group') {
      const child = layer.children.find((c) => c.id === layerId)
      if (child) {
        return child.type === 'text' ? { layer: child, parentGroup: layer } : null
      }
    }
  }
  return null
}

export function CanvasTextEditor({ stageRef }: CanvasTextEditorProps) {
  const editingTextId = useEditorStore((s) => s.editingTextId)
  const stopTextEdit = useEditorStore((s) => s.stopTextEdit)
  const project = useEditorStore((s) => s.project)
  const activeSlideGroupId = useEditorStore((s) => s.activeSlideGroupId)
  const activeCanvasFormat = useEditorStore((s) => s.activeCanvasFormat)
  // Subscribe to viewport so the overlay follows zoom / pan
  const zoom = useEditorStore((s) => s.zoom)
  const viewportX = useEditorStore((s) => s.viewportX)
  const viewportY = useEditorStore((s) => s.viewportY)

  // Resolve the active format so the overlay aligns with what the canvas renders.
  // Content edits still flow to the shared base via updateLayer's format routing.
  const rawGroup = project.slideGroups.find((g) => g.id === activeSlideGroupId)
  const group = rawGroup
    ? applyCanvasFormatToGroup(rawGroup, activeCanvasFormat, getProjectBaseFormat(project))
    : undefined
  const found = editingTextId && group ? findTextLayer(group.layers, editingTextId) : null
  const layerId = found?.layer.id

  // Stop editing if the layer disappeared (undo, slide switch, deletion)
  useEffect(() => {
    if (editingTextId && !found) stopTextEdit()
  }, [editingTextId, found, stopTextEdit])

  // ── Overlay placement from the Konva node's absolute transform ────────────
  // Local (0,0) maps to the box top-left (offsetX/offsetY shift the origin),
  // already in stage-container pixel space (stage scale + position applied).
  // Computed in a layout effect (refs must not be read during render). The
  // editor box is only mounted once the placement is known, so the editor's
  // own mount effects (content sync, focus) run with the DOM in place.
  const [placement, setPlacement] = useState<Placement | null>(null)
  const layerX = found?.layer.x
  const layerY = found?.layer.y
  const layerRotation = found?.layer.rotation
  useLayoutEffect(() => {
    let next: Placement | null = null
    const node = layerId ? stageRef.current?.findOne(`#layer-${layerId}`) : null
    if (node) {
      const d = node.getAbsoluteTransform().decompose()
      const p = node.getAbsoluteTransform().point({ x: 0, y: 0 })
      next = { x: p.x, y: p.y, scale: d.scaleX, rotation: d.rotation }
    }
    setPlacement(next)
  }, [stageRef, layerId, layerX, layerY, layerRotation, zoom, viewportX, viewportY])

  if (!found || !placement) return null
  return (
    <CanvasTextEditorBox
      key={found.layer.id}
      layer={found.layer}
      parentGroup={found.parentGroup}
      placement={placement}
    />
  )
}

function CanvasTextEditorBox({
  layer,
  parentGroup,
  placement,
}: {
  layer: TextLayer
  parentGroup: GroupLayer | null
  placement: Placement
}) {
  const stopTextEdit = useEditorStore((s) => s.stopTextEdit)
  const updateLayer = useEditorStore((s) => s.updateLayer)
  const updateChildLayer = useEditorStore((s) => s.updateChildLayer)
  const brandColors = useEditorStore((s) => s.project.settings.brandColors) ?? []
  const wrapperRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const baseFill = resolveFill(layer.fill, brandColors)

  const api = useRichTextEditor(layer, editorRef, {
    commitLayer: (patch) => {
      if (parentGroup) updateChildLayer(parentGroup.id, layer.id, patch as Partial<Layer>)
      else updateLayer(layer.id, patch as Partial<Layer>)
    },
    onConfirm: stopTextEdit,
  })

  // Focus + select all once on mount (after the hook's sync effect filled the DOM)
  const focusedOnce = useRef(false)
  useEffect(() => {
    if (focusedOnce.current) return
    focusedOnce.current = true
    api.focusAndSelectAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Click outside the overlay → confirm & close.
  // Clicks inside the properties panel do NOT close the editor: the styling
  // toolbar is docked there and the user adjusts font/size/position mid-edit.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      const el = target instanceof Element ? target : target.parentElement
      if (wrapperRef.current?.contains(target)) return
      if (el?.closest('[data-properties-panel]')) return
      stopTextEdit()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [stopTextEdit])

  // ── Toolbar portal target: the slot rendered by the panel's Content tab ───
  // The slot mounts after this component (the panel switches tabs in an
  // effect), so watch the DOM until it appears.
  const [toolbarSlot, setToolbarSlot] = useState<HTMLElement | null>(null)
  useEffect(() => {
    const update = () => setToolbarSlot(document.getElementById('rich-text-toolbar-slot'))
    const raf = requestAnimationFrame(update)
    const mo = new MutationObserver(update)
    mo.observe(document.body, { childList: true, subtree: true })
    return () => {
      cancelAnimationFrame(raf)
      mo.disconnect()
    }
  }, [])

  const scale = placement.scale
  const boxW = (layer.width ?? 1000) * scale
  const boxH = layer.height != null ? layer.height * scale : undefined
  const minH = layer.fontSize * layer.lineHeight * scale
  const justify =
    (layer.verticalAlign ?? 'top') === 'middle'
      ? 'center'
      : (layer.verticalAlign ?? 'top') === 'bottom'
        ? 'flex-end'
        : 'flex-start'

  return (
    <div
      ref={wrapperRef}
      style={{
        position: 'absolute',
        left: placement.x,
        top: placement.y,
        width: boxW,
        transform: `rotate(${placement.rotation}deg)`,
        transformOrigin: 'top left',
        zIndex: 80,
      }}
    >
      {/* Style toolbar — docked in the properties panel (Content tab) via portal */}
      {toolbarSlot && createPortal(<RichTextToolbar api={api} fillPopoverClassName="mt-2" />, toolbarSlot)}

      {/* Editable box aligned with the hidden Konva node */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: justify,
          height: boxH,
          minHeight: minH,
          outline: '2px solid rgba(124,110,246,0.8)',
          outlineOffset: 2,
          borderRadius: 2,
          background: 'rgba(0,0,0,0.25)',
        }}
      >
        <div
          ref={editorRef}
          {...api.editableProps}
          style={{
            width: '100%',
            outline: 'none',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: layer.fontFamily,
            fontSize: layer.fontSize * scale,
            fontWeight: layer.fontWeight,
            fontStyle: layer.italic ? 'italic' : 'normal',
            lineHeight: String(layer.lineHeight),
            letterSpacing: `${layer.letterSpacing * scale}px`,
            textAlign: layer.align,
            textDecoration:
              [layer.underline ? 'underline' : '', layer.strikethrough ? 'line-through' : '']
                .filter(Boolean)
                .join(' ') || undefined,
            color: typeof baseFill === 'string' ? baseFill : '#ffffff',
            caretColor: '#7c6ef6',
          }}
        />
      </div>
    </div>
  )
}
