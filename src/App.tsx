import { useRef, useEffect, useState } from 'react'
import type Konva from 'konva'
import { Toolbar } from '@/components/toolbar/Toolbar'
import { LayersPanel } from '@/components/panels/LayersPanel'
import { PreviewModal } from '@/components/panels/PreviewModal'
import { PropertiesPanel } from '@/components/panels/PropertiesPanel'
import { SlideNavigator } from '@/components/panels/SlideNavigator'
import { StageCanvas } from '@/components/canvas/StageCanvas'
import { ContextualToolbar } from '@/components/canvas/ContextualToolbar'
import { useThumbnails } from '@/hooks/useThumbnails'
import { LocalizationView } from '@/pages/LocalizationView'
import { useEditorStore, useUndoRedo } from '@/store'

export default function App() {
  const stageRef = useRef<Konva.Stage>(null)
  const { project, activeSlideGroupId, setActiveSlideGroup } = useEditorStore()
  const { undo, redo } = useUndoRedo()
  const { exitGroupEdit, editingGroupId } = useEditorStore()
  const [view, setView] = useState<'editor' | 'localization'>('editor')
  const [previewOpen, setPreviewOpen] = useState(false)
  const {
    thumbnails,
    previewThumbs,
    isCapturingPreview,
    captureAllHighRes,
    cancelPreviewCapture,
  } = useThumbnails(stageRef)

  useEffect(() => {
    if (!activeSlideGroupId && project.slideGroups.length > 0) {
      setActiveSlideGroup(project.slideGroups[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't fire when user is typing in an input
      const tag = (document.activeElement as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.key === 'Escape') {
        if (editingGroupId) {
          e.preventDefault()
          exitGroupEdit()
        }
        return
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'g' && !e.shiftKey) {
          e.preventDefault()
          const { selectedLayerIds, createGroup } = useEditorStore.getState()
          if (selectedLayerIds.length >= 2) createGroup(selectedLayerIds)
        } else if (e.key === 'g' && e.shiftKey) {
          e.preventDefault()
          const { selection, editingGroupId, dissolveGroup } = useEditorStore.getState()
          // Only dissolve when a top-level group is selected (not when inside group edit mode)
          if (selection?.layerId && !editingGroupId) dissolveGroup(selection.layerId)
        } else if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault()
          undo()
        } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
          e.preventDefault()
          redo()
        } else if (e.key === 'c') {
          e.preventDefault()
          useEditorStore.getState().copyLayers()
        } else if (e.key === 'x') {
          e.preventDefault()
          useEditorStore.getState().cutLayers()
        } else if (e.key === 'v') {
          e.preventDefault()
          useEditorStore.getState().pasteLayers()
        } else if (e.key === 'd') {
          e.preventDefault()
          const { selection, duplicateLayer } = useEditorStore.getState()
          if (selection?.layerId) duplicateLayer(selection.layerId)
        } else if (e.key === '0') {
          // Ctrl+0: fit — delegate to canvas by resetting centering flag
          e.preventDefault()
          const { project: p, activeSlideGroupId: gid, setZoom: sz, setViewportPosition: svp } = useEditorStore.getState()
          const grp = p.slideGroups.find((g) => g.id === gid)
          if (grp) {
            const availW = window.innerWidth - 224 - 288 - 64
            const availH = window.innerHeight - 140
            const totalW = grp.slideWidth * grp.numSlides
            const fitScale = Math.max(0.05, Math.min(4, Math.min(availW / totalW, availH / grp.slideHeight)))
            sz(fitScale)
            svp((availW + 64 - totalW * fitScale) / 2, (availH - grp.slideHeight * fitScale) / 2 + 16)
          }
        } else if (e.key === '1') {
          e.preventDefault()
          useEditorStore.getState().setZoom(1)
        }
      }

      // Arrow keys — nudge selected layer 1px (Shift = 10px)
      if (!e.ctrlKey && !e.metaKey) {
        const { ArrowLeft, ArrowRight, ArrowUp, ArrowDown } = { ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown' }
        if (e.key === ArrowLeft || e.key === ArrowRight || e.key === ArrowUp || e.key === ArrowDown) {
          e.preventDefault()
          const step = e.shiftKey ? 10 : 1
          const dx = e.key === ArrowLeft ? -step : e.key === ArrowRight ? step : 0
          const dy = e.key === ArrowUp ? -step : e.key === ArrowDown ? step : 0
          const { selection, editingGroupId: egi, updateLayer, updateChildLayer, project: p, activeSlideGroupId: gid } = useEditorStore.getState()
          if (!selection?.layerId) return
          const grp = p.slideGroups.find((g) => g.id === gid)
          if (!grp) return
          if (egi) {
            const groupLayer = grp.layers.find((l) => l.id === egi)
            if (groupLayer?.type === 'group') {
              const child = groupLayer.children.find((c) => c.id === selection.layerId)
              if (child) updateChildLayer(egi, selection.layerId, { x: child.x + dx, y: child.y + dy } as Parameters<typeof updateLayer>[1])
            }
          } else {
            const layer = grp.layers.find((l) => l.id === selection.layerId)
            if (layer) updateLayer(selection.layerId, { x: layer.x + dx, y: layer.y + dy } as Parameters<typeof updateLayer>[1])
          }
        }

        // Delete / Backspace — remove selected layer
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault()
          const { selection, selectedLayerIds, removeLayer } = useEditorStore.getState()
          if (selectedLayerIds.length > 0) {
            selectedLayerIds.forEach((id) => removeLayer(id))
          } else if (selection?.layerId) {
            removeLayer(selection.layerId)
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, exitGroupEdit, editingGroupId])

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-[#0f0f13]">
      <Toolbar
        mode={view}
        onSetMode={setView}
      />
      <div className="flex flex-1 overflow-hidden">
        {view === 'localization' ? (
          <main className="flex-1 overflow-hidden bg-[#111118]" style={{ minWidth: 0 }}>
            <LocalizationView embedded onBack={() => setView('editor')} />
          </main>
        ) : (
          <>
        {/* Layers panel — always visible */}
        <LayersPanel />

        {/* Canvas area — fills remaining space */}
        <main
          className="flex-1 overflow-hidden bg-[#111118] flex flex-col"
          style={{ minWidth: 0 }}
        >
          {/* Contextual toolbar — only shows when element selected */}
          <ContextualToolbar />

          {/* Canvas fills remaining height — StageCanvas takes full space */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <StageCanvas stageRef={stageRef} />
          </div>
        </main>

        {/* Properties panel — always visible */}
        <PropertiesPanel />
          </>
        )}
      </div>
      <SlideNavigator thumbnails={thumbnails} stageRef={stageRef} onOpenPreview={() => setPreviewOpen(true)} />
      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        thumbnails={thumbnails}
        previewThumbs={previewThumbs}
        isCapturingPreview={isCapturingPreview}
        captureAllHighRes={captureAllHighRes}
        cancelCapture={cancelPreviewCapture}
      />
    </div>
  )
}
