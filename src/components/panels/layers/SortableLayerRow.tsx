import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Layer, GroupLayer } from '@/types'
import { InlineEditableLabel } from '@/components/ui/InlineEditableLabel'
import { LAYER_ICON, type ItemData } from './constants'

// ─── SortableLayer (regular top-level layers) ────────────────────────────────

export interface SortableLayerProps {
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

export function SortableLayer({
  layer, isSelected, isMultiSelected,
  onSelect, onCtrlSelect, onContextMenu, onVisibilityToggle, onLockToggle, onMenuOpen, onRename,
}: SortableLayerProps) {
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

      <InlineEditableLabel
        value={layer.name}
        onCommit={onRename}
        className="flex-1 text-xs truncate"
        style={{ color: isSelected ? '#e8e8f0' : '#b0b0c4', cursor: 'text' }}
      />

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

export interface SortableChildProps {
  child: Layer
  groupId: string
  isSelected: boolean
  onSelect: () => void
  onRename: (name: string) => void
}

export function SortableChild({ child, groupId, isSelected, onSelect, onRename }: SortableChildProps) {
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
      <InlineEditableLabel
        value={child.name}
        onCommit={onRename}
        className="flex-1 text-xs truncate"
        style={{ color: isSelected ? '#e8e8f0' : '#6b6b7a', cursor: 'text' }}
      />
    </div>
  )
}

// ─── SortableGroup ────────────────────────────────────────────────────────────

export interface SortableGroupProps {
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

export function SortableGroup({
  layer, isSelected, isMultiSelected, isCollapsed,
  isEditingThisGroup, selectedChildId,
  onToggleCollapse, onSelect, onCtrlSelect, onContextMenu,
  onVisibilityToggle, onLockToggle, onMenuOpen, onSelectChild,
  onRename, onRenameChild,
}: SortableGroupProps) {
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

        <InlineEditableLabel
          value={layer.name}
          onCommit={onRename}
          className="flex-1 text-xs truncate font-semibold"
          style={{ color: isSelected ? '#e8e8f0' : '#d8d2ff', cursor: 'text' }}
        />

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

export function DragPreview({ label, icon }: { label: string; icon: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg shadow-2xl border text-xs"
      style={{ background: '#1e1e2a', borderColor: 'rgba(124,110,246,0.4)', color: '#e8e8f0', pointerEvents: 'none', minWidth: 120 }}>
      <span style={{ color: '#7c6ef6' }}>{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  )
}
