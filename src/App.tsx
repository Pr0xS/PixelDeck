import { useRef, useEffect, useState, lazy, Suspense } from 'react'
import type Konva from 'konva'
import { useShallow } from 'zustand/react/shallow'
import { Toolbar } from '@/components/toolbar/Toolbar'
import { LayersPanel } from '@/components/panels/LayersPanel'
import { PreviewModal } from '@/components/panels/PreviewModal'
import { PropertiesPanel } from '@/components/panels/PropertiesPanel'
import { SlideNavigator } from '@/components/panels/SlideNavigator'
import { StageCanvas } from '@/components/canvas/StageCanvas'
import { FormatTabs } from '@/components/canvas/FormatTabs'
import { LocaleLayoutTabs } from '@/components/canvas/LocaleLayoutTabs'
import { useThumbnails } from '@/hooks/useThumbnails'
import { useEditorStore, useUndoRedo } from '@/store'
import { applyCanvasFormat, resolveProjectView } from '@/utils/canvasFormats'
import { registerStage } from '@/utils/stageRegistry'

// Lazy-load the localization view — it's a separate mode and not needed on initial load.
const LocalizationView = lazy(() =>
  import('@/pages/LocalizationView').then((m) => ({ default: m.LocalizationView })),
)

export default function App() {
  const stageRef = useRef<Konva.Stage>(null)

  // Register the stage in the singleton registry so PropertiesPanel and other
  // non-canvas components can access it for bounding-box queries (alignment).
  useEffect(() => {
    registerStage(stageRef.current)
    return () => registerStage(null)
  })
  const { project, activeSlideGroupId, setActiveSlideGroup, exitGroupEdit, editingGroupId } =
    useEditorStore(useShallow((s) => ({
      project: s.project,
      activeSlideGroupId: s.activeSlideGroupId,
      setActiveSlideGroup: s.setActiveSlideGroup,
      exitGroupEdit: s.exitGroupEdit,
      editingGroupId: s.editingGroupId,
    })))
  const { undo, redo } = useUndoRedo()
  const [view, setView] = useState<'editor' | 'localization'>('editor')
  const [previewOpen, setPreviewOpen] = useState(false)
  // Locale the preview opens in + the view to return to when it closes.
  const [previewLocale, setPreviewLocale] = useState<string | undefined>(undefined)
  const [previewReturnTo, setPreviewReturnTo] = useState<'localization' | null>(null)
  const {
    thumbnails,
    previewThumbs,
    isCapturingPreview,
    captureAllHighRes,
    cancelPreviewCapture,
  } = useThumbnails(stageRef)



  useEffect(() => {
    if (project.slideGroups.length === 0) return
    const groupExists = project.slideGroups.some((g) => g.id === activeSlideGroupId)
    if (!activeSlideGroupId || !groupExists) {
      setActiveSlideGroup(project.slideGroups[0].id)
    }
  }, [project.slideGroups, activeSlideGroupId, setActiveSlideGroup])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't fire when user is typing in an input or rich text editor
      const active = document.activeElement as HTMLElement | null
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return

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
        } else if (e.key === 'c' && !e.altKey) {
          e.preventDefault()
          useEditorStore.getState().copyLayers()
        } else if (e.key === 'x') {
          e.preventDefault()
          useEditorStore.getState().cutLayers()
        } else if (e.key === 'v' && !e.altKey) {
          e.preventDefault()
          useEditorStore.getState().pasteLayers()
        } else if (e.key === 'c' && e.altKey) {
          e.preventDefault()
          const { selection: sel, copyLayerStyle: cls } = useEditorStore.getState()
          if (sel?.layerId) cls(sel.layerId)
        } else if (e.key === 'v' && e.altKey) {
          e.preventDefault()
          const { selection: sel, pasteLayerStyle: pls } = useEditorStore.getState()
          if (sel?.layerId) pls(sel.layerId)
        } else if (e.key === 'd') {
          e.preventDefault()
          const { selection, duplicateLayer } = useEditorStore.getState()
          if (selection?.layerId) duplicateLayer(selection.layerId)
        } else if (e.key === '0') {
          // Ctrl+0: fit — delegate to canvas by resetting centering flag
          e.preventDefault()
          const { project: p, activeSlideGroupId: gid, activeCanvasFormat, setZoom: sz, setViewportPosition: svp } = useEditorStore.getState()
          const viewProject = applyCanvasFormat(p, activeCanvasFormat)
          const grp = viewProject.slideGroups.find((g) => g.id === gid)
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
          const {
            selection,
            editingGroupId: egi,
            updateLayer,
            updateChildLayer,
            project: p,
            activeSlideGroupId: gid,
            activeLocale,
            activeCanvasFormat,
          } = useEditorStore.getState()
          if (!selection?.layerId) return
          const resolvedProject = resolveProjectView(p, activeLocale, activeCanvasFormat)
          const grp = resolvedProject.slideGroups.find((g) => g.id === gid)
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

  // Returning from localization starts the editor on the default locale.
  const handleSetMode = (mode: 'editor' | 'localization') => {
    if (mode === 'editor') {
      const s = useEditorStore.getState()
      s.setActiveLocale(s.project.settings.defaultLocale ?? 'en')
    }
    setView(mode)
  }

  // Preview from the Localization view: the Konva stage only exists in editor
  // view, so switch to it underneath the fullscreen modal and return on close.
  const handlePreviewLocale = (locale: string) => {
    setPreviewLocale(locale)
    setPreviewReturnTo('localization')
    setView('editor')
    setPreviewOpen(true)
  }

  const handleClosePreview = () => {
    setPreviewOpen(false)
    if (previewReturnTo === 'localization') setView('localization')
    setPreviewReturnTo(null)
    setPreviewLocale(undefined)
  }

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-[#0f0f13]">
      <Toolbar
        mode={view}
        onSetMode={handleSetMode}
      />
      <div className="relative flex flex-1 overflow-hidden">
        {/* Localization view — absolutely covers the editor when active */}
        {view === 'localization' && (
          <main className="absolute inset-0 z-10 overflow-hidden bg-[#111118]">
            <Suspense>
              <LocalizationView embedded onBack={() => handleSetMode('editor')} onPreview={handlePreviewLocale} />
            </Suspense>
          </main>
        )}

        {/* Editor view — always mounted so the Konva stage + ResizeObserver are always alive.
            Hidden (pointer-events-none, invisible) when the localization view is on top. */}
        <div
          className="flex flex-1 overflow-hidden"
          style={view === 'localization' ? { visibility: 'hidden', pointerEvents: 'none' } : undefined}
        >
          {/* Layers panel — always visible */}
          <LayersPanel />

          {/* Canvas area — fills remaining space */}
          <main
            className="flex-1 overflow-hidden bg-[#111118] flex flex-col"
            style={{ minWidth: 0 }}
          >
            {/* Compact format + locale context rows above the canvas */}
            <FormatTabs />
            <LocaleLayoutTabs />

            {/* Canvas fills remaining height — StageCanvas takes full space */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              <StageCanvas stageRef={stageRef} />
            </div>
          </main>

          {/* Properties panel — always visible */}
          <PropertiesPanel />
        </div>
      </div>
      <SlideNavigator thumbnails={thumbnails} stageRef={stageRef} onOpenPreview={() => setPreviewOpen(true)} />

      <PreviewModal
        open={previewOpen}
        onClose={handleClosePreview}
        thumbnails={thumbnails}
        previewThumbs={previewThumbs}
        isCapturingPreview={isCapturingPreview}
        captureAllHighRes={captureAllHighRes}
        cancelCapture={cancelPreviewCapture}
        initialLocale={previewLocale}
      />
    </div>
  )
}
