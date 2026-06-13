import { useState, useEffect, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '@/store'
import type { GroupLayer } from '@/types'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, KeyboardSensor,
  DragOverlay,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { LAYER_ICON, type ContextMenu } from './layers/constants'
import { SortableLayer, SortableGroup, DragPreview } from './layers/SortableLayerRow'
import { AssetsSection } from './layers/AssetsSection'
import { LayerContextMenu } from './layers/LayerContextMenu'

// ─── LayersPanel ──────────────────────────────────────────────────────────────

export function LayersPanel() {
  const {
    project, activeSlideGroupId, selection, select,
    addPhone, addText, addShape, addChipGroup, addBrand, addImage,
    removeLayer, duplicateLayer, moveLayerUp, moveLayerDown, updateLayer,
    setLayerVisibility, setLayerLocked, reorderLayers, dissolveGroup,
    selectedLayerIds, toggleLayerSelection, setMultiSelection, clearMultiSelection,
    editingGroupId, copyLayers, cutLayers, pasteLayers, clipboard,
    reorderGroupChildren, moveLayerIntoGroup, moveChildToTopLevel, moveChildBetweenGroups,
    updateChildLayer,
  } = useEditorStore(useShallow((s) => ({
    project: s.project,
    activeSlideGroupId: s.activeSlideGroupId,
    selection: s.selection,
    select: s.select,
    addPhone: s.addPhone,
    addText: s.addText,
    addShape: s.addShape,
    addChipGroup: s.addChipGroup,
    addBrand: s.addBrand,
    addImage: s.addImage,
    removeLayer: s.removeLayer,
    duplicateLayer: s.duplicateLayer,
    moveLayerUp: s.moveLayerUp,
    moveLayerDown: s.moveLayerDown,
    updateLayer: s.updateLayer,
    setLayerVisibility: s.setLayerVisibility,
    setLayerLocked: s.setLayerLocked,
    reorderLayers: s.reorderLayers,
    dissolveGroup: s.dissolveGroup,
    selectedLayerIds: s.selectedLayerIds,
    toggleLayerSelection: s.toggleLayerSelection,
    setMultiSelection: s.setMultiSelection,
    clearMultiSelection: s.clearMultiSelection,
    editingGroupId: s.editingGroupId,
    copyLayers: s.copyLayers,
    cutLayers: s.cutLayers,
    pasteLayers: s.pasteLayers,
    clipboard: s.clipboard,
    reorderGroupChildren: s.reorderGroupChildren,
    moveLayerIntoGroup: s.moveLayerIntoGroup,
    moveChildToTopLevel: s.moveChildToTopLevel,
    moveChildBetweenGroups: s.moveChildBetweenGroups,
    updateChildLayer: s.updateChildLayer,
  })))

  const activeGroup = project.slideGroups.find((g) => g.id === activeSlideGroupId)
  const layers = activeGroup?.layers ?? []

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const toggleGroupCollapse = (id: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const selectedLayer = (() => {
    if (!selection?.layerId) return null
    for (const layer of layers) {
      if (layer.id === selection.layerId) return layer
      if (layer.type === 'group') {
        const child = (layer as GroupLayer).children.find((item) => item.id === selection.layerId)
        if (child) return child
      }
    }
    return null
  })()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [contextMenu])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const tag = (document.activeElement as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (selection?.layerId) removeLayer(selection.layerId)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selection, removeLayer])

  const handleContextMenu = (e: React.MouseEvent, layerId: string) => {
    const layer = layers.find((l) => l.id === layerId)
    if (layer?.type === 'background') return
    e.preventDefault(); e.stopPropagation()
    setContextMenu({ layerId, x: e.clientX, y: e.clientY })
  }

  const handleMenuOpen = (e: React.MouseEvent, layerId: string) => {
    const layer = layers.find((l) => l.id === layerId)
    if (layer?.type === 'background') return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setContextMenu({ layerId, x: rect.right, y: rect.bottom })
  }

  const handleMenuAction = (action: string, layerId: string) => {
    setContextMenu(null)
    switch (action) {
      case 'copy': copyLayers([layerId]); break
      case 'cut': cutLayers([layerId]); break
      case 'paste': pasteLayers(); break
      case 'duplicate': duplicateLayer(layerId); break
      case 'delete': removeLayer(layerId); break
      case 'up': moveLayerUp(layerId); break
      case 'down': moveLayerDown(layerId); break
      case 'dissolve': dissolveGroup(layerId); break
    }
  }

  const handleCtrlSelect = (layerId: string) => {
    const state = useEditorStore.getState()
    if (state.selectedLayerIds.length === 0 && state.selection?.layerId && state.selection.layerId !== layerId) {
      setMultiSelection([state.selection.layerId, layerId])
    } else {
      toggleLayerSelection(layerId)
    }
  }

  // ── DnD helpers ──────────────────────────────────────────────────────────────

  const backgroundLayer = layers.find((l) => l.type === 'background')
  const contentLayers = layers.filter((l) => l.type !== 'background')
  const reversedContentLayers = [...contentLayers].reverse()
  const reversedContentIds = reversedContentLayers.map((l) => l.id)

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeData = (active.data.current ?? {}) as Partial<{ container: string; groupId: string; isGroup: boolean }>
    const overData = (over.data.current ?? {}) as Partial<{ container: string; groupId: string }>

    const fromContainer = activeData.container ?? 'root'
    const toContainer = overData.container ?? 'root'
    const fromGroupId = fromContainer === 'group' ? (activeData as { groupId: string }).groupId : undefined
    const toGroupId = toContainer === 'group' ? (overData as { groupId: string }).groupId : undefined

    // Is the "over" target a group header (a root item of type group)?
    const overLayerIsGroup =
      toContainer === 'root' &&
      contentLayers.find((l) => l.id === (over.id as string))?.type === 'group'

    // ── 1. Root ↔ Root reorder (not onto a group header) ────────────────────
    if (fromContainer === 'root' && toContainer === 'root' && !overLayerIsGroup) {
      const revIds = reversedContentLayers.map((l) => l.id)
      const oldIdx = revIds.indexOf(active.id as string)
      const newIdx = revIds.indexOf(over.id as string)
      if (oldIdx < 0 || newIdx < 0) return
      const newRevIds = arrayMove(revIds, oldIdx, newIdx)
      reorderLayers([...(backgroundLayer ? [backgroundLayer.id] : []), ...[...newRevIds].reverse()])
      return
    }

    // ── 2. Root layer dropped onto a group header → add to group ────────────
    if (fromContainer === 'root' && overLayerIsGroup) {
      const activeLayer = contentLayers.find((l) => l.id === (active.id as string))
      if (!activeLayer || activeLayer.type === 'group') return  // no nested groups
      moveLayerIntoGroup(active.id as string, over.id as string, null)
      // Auto-expand the target group so user sees the result
      setCollapsedGroups((prev) => { const next = new Set(prev); next.delete(over.id as string); return next })
      return
    }

    // ── 3. Child ↔ Child reorder within the same group ──────────────────────
    if (fromContainer === 'group' && toContainer === 'group' && fromGroupId === toGroupId && fromGroupId) {
      const grp = contentLayers.find((l) => l.id === fromGroupId) as GroupLayer | undefined
      if (!grp) return
      // Panel shows reversed children; use reversed IDs for arrayMove, then re-reverse for store
      const revIds = [...grp.children].reverse().map((c) => c.id)
      const oldIdx = revIds.indexOf(active.id as string)
      const newIdx = revIds.indexOf(over.id as string)
      if (oldIdx < 0 || newIdx < 0) return
      reorderGroupChildren(fromGroupId, [...arrayMove(revIds, oldIdx, newIdx)].reverse())
      return
    }

    // ── 4. Root layer dropped onto a child → add to that group (append) ─────
    if (fromContainer === 'root' && toContainer === 'group' && toGroupId) {
      const activeLayer = contentLayers.find((l) => l.id === (active.id as string))
      if (!activeLayer || activeLayer.type === 'group') return  // no nested groups
      // Append at end; user can reorder within group afterwards
      moveLayerIntoGroup(active.id as string, toGroupId, null)
      setCollapsedGroups((prev) => { const next = new Set(prev); next.delete(toGroupId); return next })
      return
    }

    // ── 5. Child ejected to root (dropped on a root item) ───────────────────
    if (fromContainer === 'group' && fromGroupId && toContainer === 'root' && !overLayerIsGroup) {
      moveChildToTopLevel(fromGroupId, active.id as string, over.id as string)
      return
    }

    // ── 6. Child → different group header ───────────────────────────────────
    if (fromContainer === 'group' && fromGroupId && overLayerIsGroup && (over.id as string) !== fromGroupId) {
      moveChildBetweenGroups(fromGroupId, active.id as string, over.id as string, null)
      setCollapsedGroups((prev) => { const next = new Set(prev); next.delete(over.id as string); return next })
      return
    }

    // ── 7. Child → child in a different group ───────────────────────────────
    if (fromContainer === 'group' && fromGroupId && toContainer === 'group' && toGroupId && toGroupId !== fromGroupId) {
      moveChildBetweenGroups(fromGroupId, active.id as string, toGroupId, over.id as string)
      setCollapsedGroups((prev) => { const next = new Set(prev); next.delete(toGroupId); return next })
    }
  }

  // DragOverlay: find the label + icon for the item being dragged
  const dragOverlayInfo = (() => {
    if (!activeDragId) return null
    // Check top-level
    const topLevel = contentLayers.find((l) => l.id === activeDragId)
    if (topLevel) return { label: topLevel.name, icon: LAYER_ICON[topLevel.type] }
    // Check children
    for (const l of contentLayers) {
      if (l.type === 'group') {
        const child = (l as GroupLayer).children.find((c) => c.id === activeDragId)
        if (child) return { label: child.name, icon: LAYER_ICON[child.type] }
      }
    }
    return null
  })()

  // ── Insert toolbar ───────────────────────────────────────────────────────────

  const panelBg = '#18181f'
  const borderColor = 'rgba(255,255,255,0.06)'
  const handleInsertToolClick = (key: string) => {
    if (key === 'phone') addPhone()
    else if (key === 'text') addText()
    else if (key === 'shape') addShape()
    else if (key === 'chip') addChipGroup()
    else if (key === 'brand') addBrand()
    else if (key === 'image') imageInputRef.current?.click()
  }
  const insertTools = [
    { key: 'phone', icon: '📱', label: 'Phone' },
    { key: 'text', icon: 'T', label: 'Text' },
    { key: 'shape', icon: '▭', label: 'Shape' },
    { key: 'chip', icon: '◉', label: 'Chip' },
    { key: 'brand', icon: '🏷', label: 'Brand' },
    { key: 'image', icon: '🖼', label: 'Image' },
  ]

  return (
    <aside
      className="w-56 h-full flex flex-col overflow-hidden shrink-0"
      style={{ background: panelBg, borderRight: `1px solid ${borderColor}` }}
    >
      {/* Insert toolbar */}
      <div className="px-3 pt-3 pb-2 shrink-0 border-b" style={{ borderColor }}>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6b6b7a]">Insert</span>
        </div>

        {selectedLayerIds.length > 0 && (
          <div className="mb-2 flex items-center justify-between rounded-md bg-[rgba(124,110,246,0.12)] border border-[rgba(124,110,246,0.3)] px-2 py-1">
            <span className="text-[10px] text-[#a89cf6]">{selectedLayerIds.length} selected</span>
            <button onClick={() => clearMultiSelection()} className="text-[10px] text-[#a89cf6] hover:text-[#e8e8f0] transition-colors">Clear</button>
          </div>
        )}

        <div className="grid grid-cols-4 gap-2">
          {insertTools.map((tool) => (
            <button
              key={tool.key}
              onClick={() => handleInsertToolClick(tool.key)}
              className="flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2 text-center transition-colors hover:border-[rgba(124,110,246,0.35)] hover:bg-[rgba(124,110,246,0.15)]"
              style={{ borderColor: 'rgba(255,255,255,0.08)' }}
              title={`Add ${tool.label}`}
            >
              <span className="flex h-6 items-center justify-center text-base text-[#e8e8f0]">{tool.icon}</span>
              <span className="text-[10px] leading-none text-[#b0b0c4]">{tool.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-3 h-px w-full bg-[rgba(255,255,255,0.06)]" />

        <AssetsSection
          imageInputRef={imageInputRef}
          selectedLayer={selectedLayer}
          addImage={addImage}
          updateLayer={updateLayer}
        />

        <div className="mt-3 h-px w-full bg-[rgba(255,255,255,0.06)]" />
        <div className="pt-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6b6b7a]">Layers</span>
        </div>
      </div>

      {/* Layer list */}
      <div className="flex-1 overflow-y-auto">
        {layers.length === 0 && (
          <p className="text-xs text-[#6b6b7a] px-3 py-4 text-center">No layers yet</p>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={reversedContentIds} strategy={verticalListSortingStrategy}>
            {reversedContentLayers.map((layer) =>
              layer.type === 'group' ? (
                <SortableGroup
                  key={layer.id}
                  layer={layer as GroupLayer}
                  isSelected={selection?.layerId === layer.id && !editingGroupId}
                  isMultiSelected={selectedLayerIds.includes(layer.id)}
                  isCollapsed={collapsedGroups.has(layer.id)}
                  isEditingThisGroup={editingGroupId === layer.id}
                  selectedChildId={editingGroupId === layer.id ? (selection?.layerId ?? null) : null}
                  onToggleCollapse={() => toggleGroupCollapse(layer.id)}
                  onSelect={select}
                  onCtrlSelect={handleCtrlSelect}
                  onContextMenu={handleContextMenu}
                  onVisibilityToggle={setLayerVisibility}
                  onLockToggle={setLayerLocked}
                  onMenuOpen={handleMenuOpen}
                  onSelectChild={(childId) => {
                    const store = useEditorStore.getState()
                    store.enterGroupEdit(layer.id)
                    store.selectChild(layer.id, childId)
                  }}
                  onRename={(name) => updateLayer(layer.id, { name })}
                  onRenameChild={(childId, name) => updateChildLayer(layer.id, childId, { name })}
                />
              ) : (
                <SortableLayer
                  key={layer.id}
                  layer={layer}
                  isSelected={selection?.layerId === layer.id}
                  isMultiSelected={selectedLayerIds.includes(layer.id)}
                  onSelect={select}
                  onCtrlSelect={handleCtrlSelect}
                  onContextMenu={handleContextMenu}
                  onVisibilityToggle={setLayerVisibility}
                  onLockToggle={setLayerLocked}
                  onMenuOpen={handleMenuOpen}
                  onRename={(name) => updateLayer(layer.id, { name })}
                />
              )
            )}
          </SortableContext>

          <DragOverlay dropAnimation={null}>
            {dragOverlayInfo && (
              <DragPreview label={dragOverlayInfo.label} icon={dragOverlayInfo.icon} />
            )}
          </DragOverlay>
        </DndContext>

        {/* Background — fixed, non-sortable */}
        {backgroundLayer && (
          <div
            className={`relative flex items-center gap-1 px-2 py-1.5 border-l-2 transition-colors ${
              selection?.layerId === backgroundLayer.id
                ? 'bg-[rgba(124,110,246,0.15)] border-[#7c6ef6]'
                : 'border-transparent hover:bg-[rgba(255,255,255,0.04)]'
            }`}
            onClick={() => select(backgroundLayer.id)}
          >
            <div className="w-4 h-5 shrink-0" />
            <button
              aria-label={backgroundLayer.visible ? 'Hide Background' : 'Show Background'}
              onClick={(e) => { e.stopPropagation(); setLayerVisibility(backgroundLayer.id, !backgroundLayer.visible) }}
              className="w-5 h-5 flex items-center justify-center text-xs rounded hover:bg-[rgba(255,255,255,0.08)] shrink-0"
              style={{ color: backgroundLayer.visible ? '#e8e8f0' : '#3a3a4a' }}
            >{backgroundLayer.visible ? '◉' : '○'}</button>
            <span className="text-xs shrink-0" style={{ color: '#6b6b7a' }}>🎨</span>
            <span className="flex-1 text-xs truncate" style={{ color: selection?.layerId === backgroundLayer.id ? '#e8e8f0' : '#b0b0c4' }}>
              {backgroundLayer.name}
            </span>
            <span className="shrink-0 text-xs" style={{ color: '#3a3a4a' }} title="Background cannot be moved">🔒</span>
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <LayerContextMenu
          contextMenu={contextMenu}
          layers={layers}
          clipboard={clipboard}
          onMenuAction={handleMenuAction}
        />
      )}
    </aside>
  )
}
