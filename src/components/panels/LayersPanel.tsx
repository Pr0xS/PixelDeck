import { useState, useEffect, useRef } from 'react'
import { useEditorStore } from '@/store'
import type { Layer, GroupLayer } from '@/types'
import { fileToDataUrl } from '@/utils/svgToImage'
import { useAssetStore } from '@/store/assets'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, KeyboardSensor,
  DragOverlay,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ─── Types ────────────────────────────────────────────────────────────────────

type LayerTypeKey = Layer['type']

const LAYER_ICON: Record<LayerTypeKey, string> = {
  background: '🎨',
  phone: '📱',
  text: 'T',
  image: '🖼',
  shape: '▭',
  chips: '◉',
  brand: '🏷',
  group: '▥',
}

interface ContextMenu { layerId: string; x: number; y: number }

/** Data attached to every useSortable item so handleDragEnd knows the source/dest container */
type ItemData =
  | { container: 'root'; isGroup?: boolean }
  | { container: 'group'; groupId: string }

// ─── SortableLayer (regular top-level layers) ────────────────────────────────

interface SortableLayerProps {
  layer: Layer
  isSelected: boolean
  isMultiSelected: boolean
  onSelect: (id: string) => void
  onCtrlSelect: (id: string) => void
  onContextMenu: (e: React.MouseEvent, id: string) => void
  onVisibilityToggle: (id: string, visible: boolean) => void
  onLockToggle: (id: string, locked: boolean) => void
  onMenuOpen: (e: React.MouseEvent, id: string) => void
  onRename: (name: string) => void
}

function SortableLayer({
  layer, isSelected, isMultiSelected,
  onSelect, onCtrlSelect, onContextMenu, onVisibilityToggle, onLockToggle, onMenuOpen, onRename,
}: SortableLayerProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const commit = () => {
    const v = draft.trim()
    if (v) onRename(v)
    setEditing(false)
    setDraft('')
  }
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: layer.id,
    data: { container: 'root' } satisfies ItemData,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      onContextMenu={(e) => onContextMenu(e, layer.id)}
      className={`group relative flex items-center gap-1 px-2 py-1.5 border-l-2 transition-colors ${
        isSelected
          ? 'bg-[rgba(124,110,246,0.15)] border-[#7c6ef6]'
          : isMultiSelected
            ? 'bg-[rgba(124,110,246,0.06)] border-[rgba(124,110,246,0.4)]'
            : 'border-transparent hover:bg-[rgba(255,255,255,0.04)]'
      }`}
      onClick={(e) => { if (e.ctrlKey || e.metaKey) onCtrlSelect(layer.id); else onSelect(layer.id) }}
    >
      <button
        {...attributes} {...listeners}
        aria-label={`Drag ${layer.name}`}
        style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none', color: '#6b6b7a' }}
        className="w-4 h-5 flex items-center justify-center text-xs rounded hover:bg-[rgba(255,255,255,0.08)] shrink-0 opacity-0 group-hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >⠿</button>

      <button
        aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
        onClick={(e) => { e.stopPropagation(); onVisibilityToggle(layer.id, !layer.visible) }}
        className="w-5 h-5 flex items-center justify-center text-xs rounded hover:bg-[rgba(255,255,255,0.08)] shrink-0"
        style={{ color: layer.visible ? '#e8e8f0' : '#3a3a4a' }}
      >{layer.visible ? '◉' : '○'}</button>

      <span className="text-xs shrink-0" style={{ color: '#6b6b7a' }}>{LAYER_ICON[layer.type]}</span>

      {editing ? (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
          onFocus={(e) => e.target.select()}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') { setEditing(false); setDraft('') }
          }}
          className="flex-1 text-xs px-1 rounded border border-[#7c6ef6] bg-[#0f0f13] text-[#e8e8f0] focus:outline-none min-w-0"
        />
      ) : (
        <span
          className="flex-1 text-xs truncate"
          style={{ color: isSelected ? '#e8e8f0' : '#b0b0c4', cursor: 'text' }}
          onDoubleClick={(e) => { e.stopPropagation(); setDraft(layer.name); setEditing(true) }}
        >
          {layer.name}
        </span>
      )}

      <button
        aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
        onClick={(e) => { e.stopPropagation(); onLockToggle(layer.id, !layer.locked) }}
        className="w-5 h-5 flex items-center justify-center text-xs rounded hover:bg-[rgba(255,255,255,0.08)] shrink-0 opacity-0 group-hover:opacity-100"
        style={{ color: layer.locked ? '#e8e8f0' : '#6b6b7a' }}
      >{layer.locked ? '🔒' : '🔓'}</button>

      <button
        aria-label={`Open ${layer.name} layer menu`}
        onClick={(e) => { e.stopPropagation(); onMenuOpen(e, layer.id) }}
        className="w-5 h-5 flex items-center justify-center text-xs rounded hover:bg-[rgba(255,255,255,0.08)] shrink-0 opacity-0 group-hover:opacity-100 text-[#6b6b7a] hover:text-[#e8e8f0]"
      >⋮</button>
    </div>
  )
}

// ─── SortableChild (layer inside a group) ────────────────────────────────────

interface SortableChildProps {
  child: Layer
  groupId: string
  isSelected: boolean
  onSelect: () => void
  onRename: (name: string) => void
}

function SortableChild({ child, groupId, isSelected, onSelect, onRename }: SortableChildProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const commit = () => {
    const v = draft.trim()
    if (v) onRename(v)
    setEditing(false)
    setDraft('')
  }
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: child.id,
    data: { container: 'group', groupId } satisfies ItemData,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={`group/child relative flex items-center gap-1 py-1.5 pr-2 rounded-md transition-colors ${
        isSelected ? 'bg-[rgba(124,110,246,0.15)]' : 'hover:bg-[rgba(255,255,255,0.04)]'
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      {/* Horizontal connector tick */}
      <span className="absolute -left-[11px] top-1/2 h-px w-[11px] -translate-y-1/2 bg-[rgba(124,110,246,0.22)]" />

      {/* Drag handle */}
      <button
        {...attributes} {...listeners}
        aria-label={`Drag ${child.name}`}
        style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none', color: '#6b6b7a' }}
        className="w-3 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover/child:opacity-100 shrink-0 ml-0.5 rounded hover:bg-[rgba(255,255,255,0.08)]"
        onClick={(e) => e.stopPropagation()}
      >⠿</button>

      <span className="text-xs shrink-0 w-4 text-center text-[#7d7898]">
        {LAYER_ICON[child.type] ?? '◯'}
      </span>
      {editing ? (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
          onFocus={(e) => e.target.select()}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') { setEditing(false); setDraft('') }
          }}
          className="flex-1 text-xs px-1 rounded border border-[#7c6ef6] bg-[#0f0f13] text-[#e8e8f0] focus:outline-none min-w-0"
        />
      ) : (
        <span
          className="flex-1 text-xs truncate"
          style={{ color: isSelected ? '#e8e8f0' : '#6b6b7a', cursor: 'text' }}
          onDoubleClick={(e) => { e.stopPropagation(); setDraft(child.name); setEditing(true) }}
        >
          {child.name}
        </span>
      )}
    </div>
  )
}

// ─── SortableGroup ────────────────────────────────────────────────────────────

interface SortableGroupProps {
  layer: GroupLayer
  isSelected: boolean
  isMultiSelected: boolean
  isCollapsed: boolean
  isEditingThisGroup: boolean
  selectedChildId: string | null
  onToggleCollapse: () => void
  onSelect: (id: string) => void
  onCtrlSelect: (id: string) => void
  onContextMenu: (e: React.MouseEvent, id: string) => void
  onVisibilityToggle: (id: string, visible: boolean) => void
  onLockToggle: (id: string, locked: boolean) => void
  onMenuOpen: (e: React.MouseEvent, id: string) => void
  onSelectChild: (childId: string) => void
  onRename: (name: string) => void
  onRenameChild: (childId: string, name: string) => void
}

function SortableGroup({
  layer, isSelected, isMultiSelected, isCollapsed,
  isEditingThisGroup, selectedChildId,
  onToggleCollapse, onSelect, onCtrlSelect, onContextMenu,
  onVisibilityToggle, onLockToggle, onMenuOpen, onSelectChild,
  onRename, onRenameChild,
}: SortableGroupProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const commit = () => {
    const v = draft.trim()
    if (v) onRename(v)
    setEditing(false)
    setDraft('')
  }
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: layer.id,
    data: { container: 'root', isGroup: true } satisfies ItemData,
  })

  // Reverse children so panel-top = frontmost (consistent with top-level layers)
  const reversedChildren = [...layer.children].reverse()
  const reversedChildIds = reversedChildren.map((c) => c.id)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      onContextMenu={(e) => onContextMenu(e, layer.id)}
      className={`relative border-l-2 transition-colors ${
        isSelected
          ? 'bg-[rgba(124,110,246,0.15)] border-[#7c6ef6]'
          : isMultiSelected
            ? 'bg-[rgba(124,110,246,0.06)] border-[rgba(124,110,246,0.4)]'
            : 'bg-[rgba(124,110,246,0.06)] border-[rgba(124,110,246,0.28)] hover:bg-[rgba(124,110,246,0.1)]'
      }`}
    >
      {/* Group header */}
      <div
        className="group flex items-center gap-1 px-2 py-1.5"
        onClick={(e) => { if (e.ctrlKey || e.metaKey) onCtrlSelect(layer.id); else onSelect(layer.id) }}
      >
        <button
          {...attributes} {...listeners}
          aria-label={`Drag ${layer.name}`}
          style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none', color: '#8d84f8' }}
          className="w-4 h-5 flex items-center justify-center text-xs rounded hover:bg-[rgba(255,255,255,0.08)] shrink-0 opacity-0 group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >⠿</button>

        <button
          aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
          onClick={(e) => { e.stopPropagation(); onVisibilityToggle(layer.id, !layer.visible) }}
          className="w-5 h-5 flex items-center justify-center text-xs rounded hover:bg-[rgba(255,255,255,0.08)] shrink-0"
          style={{ color: layer.visible ? '#e8e8f0' : '#3a3a4a' }}
        >{layer.visible ? '◉' : '○'}</button>

        <button
          aria-label={isCollapsed ? `Expand ${layer.name}` : `Collapse ${layer.name}`}
          onClick={(e) => { e.stopPropagation(); onToggleCollapse() }}
          title={isCollapsed ? 'Expand group' : 'Collapse group'}
          className="w-5 h-5 flex items-center justify-center text-[10px] rounded hover:bg-[rgba(255,255,255,0.08)] shrink-0 text-[#d8d2ff]"
          style={{ transition: 'transform 0.15s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
        >▼</button>

        <span className="text-xs shrink-0 text-[#b6adff]">▥</span>

        {editing ? (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            onFocus={(e) => e.target.select()}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') { setEditing(false); setDraft('') }
            }}
            className="flex-1 text-xs px-1 rounded border border-[#7c6ef6] bg-[#0f0f13] text-[#e8e8f0] focus:outline-none min-w-0"
          />
        ) : (
          <span
            className="flex-1 text-xs truncate font-semibold"
            style={{ color: isSelected ? '#e8e8f0' : '#d8d2ff', cursor: 'text' }}
            onDoubleClick={(e) => { e.stopPropagation(); setDraft(layer.name); setEditing(true) }}
          >
            {layer.name}
          </span>
        )}

        <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] leading-none border border-[rgba(124,110,246,0.28)] bg-[rgba(124,110,246,0.12)] text-[#b6adff]">
          {layer.children.length}
        </span>

        <button
          aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
          onClick={(e) => { e.stopPropagation(); onLockToggle(layer.id, !layer.locked) }}
          className="w-5 h-5 flex items-center justify-center text-xs rounded hover:bg-[rgba(255,255,255,0.08)] shrink-0 opacity-0 group-hover:opacity-100"
          style={{ color: layer.locked ? '#e8e8f0' : '#8a84b6' }}
        >{layer.locked ? '🔒' : '🔓'}</button>

        <button
          aria-label={`Open ${layer.name} layer menu`}
          onClick={(e) => { e.stopPropagation(); onMenuOpen(e, layer.id) }}
          className="w-5 h-5 flex items-center justify-center text-xs rounded hover:bg-[rgba(255,255,255,0.08)] shrink-0 opacity-0 group-hover:opacity-100 text-[#8a84b6] hover:text-[#e8e8f0]"
        >⋮</button>
      </div>

      {/* Children — nested SortableContext for intra-group reordering */}
      {!isCollapsed && (
        <div className="relative ml-8 mr-2 mb-2 pl-4">
          {/* Vertical connecting line */}
          <div className="absolute left-[3px] top-1 bottom-1 w-px bg-[rgba(124,110,246,0.28)]" />
          <SortableContext items={reversedChildIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-0.5">
              {reversedChildren.map((child) => (
                <SortableChild
                  key={child.id}
                  child={child}
                  groupId={layer.id}
                  isSelected={isEditingThisGroup && selectedChildId === child.id}
                  onSelect={() => {
                    // Single click always enters group edit mode for this child
                    onSelectChild(child.id)
                  }}
                  onRename={(name) => onRenameChild(child.id, name)}
                />
              ))}
            </div>
          </SortableContext>
        </div>
      )}
    </div>
  )
}

// ─── Drag preview (shown in DragOverlay) ─────────────────────────────────────

function DragPreview({ label, icon }: { label: string; icon: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg shadow-2xl border text-xs"
      style={{ background: '#1e1e2a', borderColor: 'rgba(124,110,246,0.4)', color: '#e8e8f0', pointerEvents: 'none', minWidth: 120 }}>
      <span style={{ color: '#7c6ef6' }}>{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  )
}

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
  } = useEditorStore()
  const addAsset = useAssetStore((s) => s.addAsset)
  const loadFolder = useAssetStore((s) => s.loadFolder)
  const loadFiles = useAssetStore((s) => s.loadFiles)
  const removeAsset = useAssetStore((s) => s.removeAsset)
  const assets = useAssetStore((s) => s.assets)
  const assetCount = useAssetStore((s) => Object.keys(s.assets).length)

  const activeGroup = project.slideGroups.find((g) => g.id === activeSlideGroupId)
  const layers = activeGroup?.layers ?? []
  const assetEntries = Object.values(assets).sort((a, b) => a.filename.localeCompare(b.filename))

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [assetsCollapsed, setAssetsCollapsed] = useState(false)
  const [assetsModalOpen, setAssetsModalOpen] = useState(false)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const screenshotsInputRef = useRef<HTMLInputElement>(null)

  const toggleGroupCollapse = (id: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const dataUrl = await fileToDataUrl(file)
    addAsset(file.name, dataUrl)
    const img = new Image()
    img.onload = () => addImage(file.name, img.width, img.height)
    img.src = dataUrl
    e.target.value = ''
  }

  const handleScreenshotFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((file) => file.type.startsWith('image/'))
    if (files.length > 0) await loadFiles(files)
    e.target.value = ''
  }

  const handleImportScreenshotFolder = async () => {
    try {
      const count = await loadFolder()
      alert(`Imported ${count} screenshot asset(s).`)
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string }
      if (err?.name === 'AbortError') return
      screenshotsInputRef.current?.click()
    }
  }

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

  const getImageSize = (dataUrl: string) =>
    new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve({ width: img.width, height: img.height })
      img.onerror = () => reject(new Error('Could not load asset image'))
      img.src = dataUrl
    })

  const addAssetToCanvas = async (filename: string, dataUrl: string) => {
    const { width, height } = await getImageSize(dataUrl)
    addImage(filename, width, height)
  }

  const handleUseAssetForSelection = async (filename: string, dataUrl: string) => {
    if (!selectedLayer) {
      await addAssetToCanvas(filename, dataUrl)
      return
    }

    if (selectedLayer.type === 'phone') {
      updateLayer(selectedLayer.id, { screenshotPath: filename, screenshotDataUrl: undefined } as Partial<Layer>)
      return
    }

    if (selectedLayer.type === 'image') {
      const { width, height } = await getImageSize(dataUrl)
      updateLayer(selectedLayer.id, { src: filename, width, height } as Partial<Layer>)
      return
    }

    await addAssetToCanvas(filename, dataUrl)
  }

  const getAssetPrimaryAction = () => (
    selectedLayer?.type === 'phone'
      ? 'Use as phone screenshot'
      : selectedLayer?.type === 'image'
        ? 'Replace selected image'
        : 'Add image to canvas'
  )

  const handleAssetDragStart = (event: React.DragEvent, filename: string) => {
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData('application/x-pixeldeck-asset', filename)
    event.dataTransfer.setData('text/plain', filename)
  }

  const renderAssetCard = (asset: (typeof assetEntries)[number], large = false) => {
    const primaryAction = getAssetPrimaryAction()
    return (
      <div
        key={asset.filename}
        draggable
        onDragStart={(event) => handleAssetDragStart(event, asset.filename)}
        className="group overflow-hidden rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#111118] transition-colors hover:border-[rgba(124,110,246,0.45)]"
        title={`${asset.filename} — drag to canvas or click to use`}
      >
        <button
          type="button"
          draggable
          aria-label={`${primaryAction}: ${asset.filename}`}
          onDragStart={(event) => handleAssetDragStart(event, asset.filename)}
          onClick={() => { void handleUseAssetForSelection(asset.filename, asset.dataUrl) }}
          className="block w-full"
          title={primaryAction}
        >
          <div className={`relative bg-black/25 ${large ? 'aspect-[9/16]' : 'aspect-[4/3]'}`}>
            <img
              src={asset.dataUrl}
              alt={asset.filename}
              draggable={false}
              className="h-full w-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-1.5 pb-1 pt-5 text-left text-[9px] text-white opacity-0 transition-opacity group-hover:opacity-100">
              Drag to canvas · {primaryAction}
            </div>
          </div>
        </button>
        <div className={`flex items-center gap-1 px-1.5 py-1 ${large ? 'py-2' : ''}`}>
          <span className={`min-w-0 flex-1 truncate text-[#9b9bad] ${large ? 'text-xs' : 'text-[9px]'}`}>{asset.filename}</span>
          <button
            type="button"
            aria-label={`Add ${asset.filename} to canvas`}
            onClick={() => { void addAssetToCanvas(asset.filename, asset.dataUrl) }}
            className="rounded px-1 text-[10px] text-[#a89cf6] hover:bg-[rgba(124,110,246,0.16)] hover:text-white"
            title="Add image to canvas"
          >
            +
          </button>
          <button
            type="button"
            aria-label={`Remove ${asset.filename}`}
            onClick={() => removeAsset(asset.filename)}
            className="rounded px-1 text-[10px] text-[#7f8094] hover:bg-[rgba(248,113,113,0.16)] hover:text-[#f87171]"
            title="Remove asset"
          >
            ×
          </button>
        </div>
      </div>
    )
  }

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

    const activeData = (active.data.current ?? {}) as Partial<ItemData>
    const overData = (over.data.current ?? {}) as Partial<ItemData>

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
    <>
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

        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />

        <div className="mt-3 h-px w-full bg-[rgba(255,255,255,0.06)]" />
        <div className="mt-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label={assetsCollapsed ? 'Show assets' : 'Minimize assets'}
              onClick={() => setAssetsCollapsed((value) => !value)}
              className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6b6b7a] hover:text-[#e8e8f0]"
              title={assetsCollapsed ? 'Show assets' : 'Minimize assets'}
            >
              <span className="tracking-normal">{assetsCollapsed ? '▸' : '▾'}</span>
              Assets
            </button>
            <div className="flex items-center gap-1">
              <span className="rounded-full bg-[rgba(124,110,246,0.16)] px-2 py-0.5 text-[10px] text-[#a89cf6]">{assetCount}</span>
              <button
                type="button"
                aria-label="Open large asset browser"
                onClick={() => setAssetsModalOpen(true)}
                disabled={assetEntries.length === 0}
                className="rounded px-1.5 py-0.5 text-[10px] text-[#8f90a3] hover:bg-[rgba(255,255,255,0.06)] hover:text-white disabled:opacity-35 disabled:cursor-not-allowed"
                title="Open large asset browser"
              >
                ⛶
              </button>
            </div>
          </div>
          {!assetsCollapsed && (
            <>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-label="Import screenshot files"
              onClick={() => screenshotsInputRef.current?.click()}
              className="rounded-lg border border-[rgba(255,255,255,0.08)] px-2 py-1.5 text-[10px] text-[#b0b0c4] transition-colors hover:border-[rgba(124,110,246,0.35)] hover:bg-[rgba(124,110,246,0.12)] hover:text-[#e8e8f0]"
              title="Import screenshot files into the asset library"
            >
              Import Files
            </button>
            <button
              type="button"
              aria-label="Import screenshot folder"
              onClick={handleImportScreenshotFolder}
              className="rounded-lg border border-[rgba(255,255,255,0.08)] px-2 py-1.5 text-[10px] text-[#b0b0c4] transition-colors hover:border-[rgba(124,110,246,0.35)] hover:bg-[rgba(124,110,246,0.12)] hover:text-[#e8e8f0]"
              title="Import a screenshots folder when the browser supports it; falls back to file import"
            >
              Import Folder
            </button>
          </div>
          <input ref={screenshotsInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleScreenshotFiles} />

          {assetEntries.length > 0 ? (
            <div className="mt-3 max-h-44 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-2">
                {assetEntries.map((asset) => renderAssetCard(asset))}
              </div>
            </div>
          ) : (
            <p className="mt-3 rounded-lg border border-dashed border-[rgba(255,255,255,0.08)] px-2 py-3 text-center text-[10px] leading-4 text-[#6b6b7a]">
              Imported screenshots will appear here.
            </p>
          )}
            </>
          )}
        </div>

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
      {contextMenu && (() => {
        const ctxLayer = layers.find((l) => l.id === contextMenu.layerId)
        const menuItems = [
          { action: 'copy', label: 'Copy' },
          { action: 'cut', label: 'Cut' },
          ...(clipboard ? [{ action: 'paste', label: 'Paste' }] : []),
          { action: 'duplicate', label: 'Duplicate' },
          { action: 'up', label: 'Move Up' },
          { action: 'down', label: 'Move Down' },
          ...(ctxLayer?.type === 'group' ? [{ action: 'dissolve', label: 'Dissolve Group' }] : []),
          { action: 'delete', label: 'Delete' },
        ]
        return (
          <div
            className="fixed z-50 py-1 rounded shadow-2xl border"
            style={{ left: contextMenu.x, top: contextMenu.y, background: '#18181f', borderColor: 'rgba(255,255,255,0.08)', minWidth: 140 }}
            onClick={(e) => e.stopPropagation()}
          >
            {menuItems.map(({ action, label }) => (
              <button
                key={action}
                className="w-full text-left px-3 py-2 text-xs text-[#e8e8f0] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
                style={action === 'delete' ? { color: '#f87171' } : undefined}
                onClick={() => handleMenuAction(action, contextMenu.layerId)}
              >{label}</button>
            ))}
          </div>
        )
      })()}
    </aside>

    {assetsModalOpen && (
      <div className="pointer-events-none fixed inset-0 z-[1000]">
        <div
          className="pointer-events-auto absolute bottom-24 left-60 top-14 flex w-[360px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#18181f]/96 shadow-2xl backdrop-blur-xl"
        >
          <div className="flex items-start justify-between gap-4 border-b border-white/8 px-4 py-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7c6ef6]">Asset Browser</div>
              <div className="mt-1 text-xs leading-5 text-[#9b9bad]">Drag to the visible canvas, or click to use with the current selection.</div>
            </div>
            <button
              type="button"
              aria-label="Close asset browser"
              onClick={() => setAssetsModalOpen(false)}
              className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-xs text-[#d7d7e3] hover:border-[#7c6ef6]/50 hover:bg-[#7c6ef6]/10 hover:text-white"
            >
              ×
            </button>
          </div>
          <div className="overflow-y-auto p-3">
            <div className="grid grid-cols-2 gap-3">
              {assetEntries.map((asset) => renderAssetCard(asset, true))}
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
