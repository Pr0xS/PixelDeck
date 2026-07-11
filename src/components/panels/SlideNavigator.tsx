import { Fragment, useState, useEffect, useRef } from 'react'
import type Konva from 'konva'
import { useShallow } from 'zustand/react/shallow'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEditorStore } from '@/store'
import { fillToCss } from '@/utils/gradients'
import { applyCanvasFormat, getExportTargets } from '@/utils/canvasFormats'
import { MAX_PANO_COMPENSATION_PX } from '@/utils/panoGeometry'
import type { BackgroundLayer, SlideGroup } from '@/types'
import type { ThumbnailMap } from '@/hooks/useThumbnails'
import { ExportModal } from './ExportModal'

interface ContextMenu {
  groupId: string
  x: number
  y: number
}

interface SlideNavigatorProps {
  thumbnails: ThumbnailMap
  stageRef: React.RefObject<Konva.Stage | null>
  onOpenPreview: () => void
}

const NUM_SLIDES_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Single' },
  { value: 2, label: 'Pano (×2)' },
  { value: 3, label: 'Strip (×3)' },
]

type FlatSlide = {
  group: SlideGroup
  slideIdx: number
  globalNum: number
  bgCss: string
}

interface SortableGroupItemProps {
  group: SlideGroup
  groupSlides: FlatSlide[]
  isActive: boolean
  isFirst: boolean
  renamingId: string | null
  renameValue: string
  renameInputRef: React.RefObject<HTMLInputElement | null>
  thumbnails: ThumbnailMap
  THUMB_H: number
  handleContextMenu: (e: React.MouseEvent, groupId: string) => void
  startRename: (groupId: string, currentName: string) => void
  setActiveSlideGroup: (id: string) => void
  commitRename: () => void
  setRenamingId: (id: string | null) => void
  setRenameValue: (v: string) => void
}

function SortableGroupItem({
  group,
  groupSlides,
  isActive,
  isFirst,
  renamingId,
  renameValue,
  renameInputRef,
  thumbnails,
  THUMB_H,
  handleContextMenu,
  startRename,
  setActiveSlideGroup,
  commitRename,
  setRenamingId,
  setRenameValue,
}: SortableGroupItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: group.id })

  const wrapperStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  }

  return (
    <div ref={setNodeRef} style={wrapperStyle} {...attributes} {...listeners}>
      {/* Visual divider between groups */}
      {!isFirst && (
        <div
          style={{
            width: 1,
            height: 32,
            background: 'rgba(255,255,255,0.1)',
            flexShrink: 0,
            alignSelf: 'center',
          }}
        />
      )}

      {groupSlides.map(({ slideIdx, globalNum: num, bgCss }) => {
        const isFirstInGroup = slideIdx === 0
        const thumb = thumbnails[group.id]?.[slideIdx]
        const thumbW = Math.min(50, Math.round((group.slideWidth / group.slideHeight) * THUMB_H))

        return (
          <Fragment key={`${group.id}-${slideIdx}`}>
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}
              className="relative shrink-0 group"
              onContextMenu={(e) => handleContextMenu(e, group.id)}
              onDoubleClick={() => startRename(group.id, group.name)}
            >
              {/* Group name — editable label on first slide, spacer on subsequent slides for alignment */}
              {isFirstInGroup ? (
                renamingId === group.id ? (
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename()
                      if (e.key === 'Escape') { setRenamingId(null); setRenameValue('') }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: Math.max(thumbW, 52), height: 14, fontSize: 9 }}
                    className="px-1 rounded border border-[#7c6ef6] bg-[#0f0f13] text-[#e8e8f0] focus:outline-none"
                  />
                ) : (
                  <span
                    style={{
                      fontSize: 10,
                      color: isActive ? '#9b8fff' : '#8b8b9e',
                      lineHeight: '14px',
                      height: 14,
                      cursor: 'default',
                      maxWidth: Math.max(thumbW, 52),
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'block',
                    }}
                    title={group.name}
                  >
                    {group.name}
                  </span>
                )
              ) : (
                <div style={{ height: 14 }} />
              )}

              <div
                style={{
                  width: thumbW,
                  height: THUMB_H,
                  background: bgCss,
                  border: `1px solid ${isActive ? '#7c6ef6' : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: 4,
                  cursor: isDragging ? 'grabbing' : 'grab',
                  position: 'relative',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
                onClick={() => setActiveSlideGroup(group.id)}
              >
                {thumb ? (
                  <img
                    src={thumb}
                    alt={`Slide ${num}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                    }}
                  >
                    📱
                  </div>
                )}
              </div>

              <span style={{ fontSize: 9, color: isActive ? '#7c6ef6' : '#6b6b7a', lineHeight: 1 }}>
                {num}
              </span>
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}

export function SlideNavigator({ thumbnails, stageRef, onOpenPreview }: SlideNavigatorProps) {
  const {
    project,
    activeSlideGroupId,
    setActiveSlideGroup,
    addSlideGroup,
    removeSlideGroup,
    duplicateSlideGroup,
    updateSlideGroup,
    reorderSlideGroups,
    activeCanvasFormat,
    panoSettings,
    updatePanoSettings,
  } = useEditorStore(useShallow((s) => ({
    project: s.project,
    activeSlideGroupId: s.activeSlideGroupId,
    setActiveSlideGroup: s.setActiveSlideGroup,
    addSlideGroup: s.addSlideGroup,
    removeSlideGroup: s.removeSlideGroup,
    duplicateSlideGroup: s.duplicateSlideGroup,
    updateSlideGroup: s.updateSlideGroup,
    reorderSlideGroups: s.reorderSlideGroups,
    activeCanvasFormat: s.activeCanvasFormat,
    panoSettings: s.project.settings.pano ?? { gapPx: 24, compensate: false },
    updatePanoSettings: s.updatePanoSettings,
  })))

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  const viewProject = applyCanvasFormat(project, activeCanvasFormat)
  const activeGroup = viewProject.slideGroups.find((g) => g.id === activeSlideGroupId)

  // The formats currently active for this project
  // Export targets — Base is used when no platform or custom formats are active.
  const exportableFormats = getExportTargets(project)

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [contextMenu])

  // Focus rename input
  useEffect(() => {
    if (renamingId) setTimeout(() => renameInputRef.current?.focus(), 30)
  }, [renamingId])

  const startRename = (groupId: string, currentName: string) => {
    setContextMenu(null)
    setRenamingId(groupId)
    setRenameValue(currentName)
  }

  const commitRename = () => {
    if (renamingId && renameValue.trim()) updateSlideGroup(renamingId, { name: renameValue.trim() })
    setRenamingId(null)
    setRenameValue('')
  }

  const handleContextMenu = (e: React.MouseEvent, groupId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const MENU_HEIGHT = 100 // 3 items × ~32px
    const y = e.clientY + MENU_HEIGHT > window.innerHeight ? e.clientY - MENU_HEIGHT : e.clientY
    setContextMenu({ groupId, x: e.clientX, y })
  }

  const handleMenuAction = (action: string, groupId: string) => {
    setContextMenu(null)
    switch (action) {
      case 'rename': {
        const group = project.slideGroups.find((g) => g.id === groupId)
        if (group) startRename(groupId, group.name)
        break
      }
      case 'duplicate': duplicateSlideGroup(groupId); break
      case 'delete':
        if (project.slideGroups.length > 1) removeSlideGroup(groupId)
        break
    }
  }

  // Build flat slide list with global sequential numbers (used for globalNum lookup)
  const flatSlides: FlatSlide[] = []
  let globalNum = 0
  for (const group of viewProject.slideGroups) {
    const bgLayer = group.layers.find((l) => l.type === 'background') as BackgroundLayer | undefined
    const bgFill = bgLayer?.fill ?? group.background?.fill
    const bgCss = bgFill ? fillToCss(bgFill) : '#1a1a2e'
    for (let i = 0; i < group.numSlides; i++) {
      globalNum++
      flatSlides.push({ group, slideIdx: i, globalNum, bgCss })
    }
  }

  const THUMB_H = 44
  const borderColor = 'rgba(255,255,255,0.06)'

  // ─── Drag-and-drop ───────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = viewProject.slideGroups.map((g) => g.id)
    const oldIndex = ids.indexOf(active.id as string)
    const newIndex = ids.indexOf(over.id as string)
    reorderSlideGroups(arrayMove(ids, oldIndex, newIndex))
  }

  return (
    <footer
      className="h-20 flex items-center gap-3 px-3 shrink-0 border-t"
      style={{ background: '#18181f', borderColor }}
    >
      <div className="flex flex-col gap-1.5 shrink-0 pr-3 border-r border-[rgba(255,255,255,0.06)]">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6b6b7a]">Slides</div>
        {activeGroup && (
          <div className="flex items-center gap-1.5">
            {NUM_SLIDES_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => updateSlideGroup(activeGroup.id, { numSlides: value })}
                className={`text-[11px] px-2 py-1 rounded border transition-colors ${
                  activeGroup.numSlides === value
                    ? 'bg-[#7c6ef6] border-[#7c6ef6] text-white'
                    : 'border-[rgba(255,255,255,0.08)] text-[#8f90a3] hover:text-[#e8e8f0] hover:border-[rgba(255,255,255,0.15)]'
                }`}
              >
                {label.replace('Pano ', '').replace('Strip ', '')}
              </button>
            ))}
          </div>
        )}
        {activeGroup && activeGroup.numSlides > 1 && (
          <label className="flex items-center gap-1.5 text-[10px] text-[#6b6b7a]">
            <input
              type="checkbox"
              checked={panoSettings.compensate}
              onChange={(e) => updatePanoSettings({ compensate: e.target.checked })}
              className="h-3 w-3 accent-[#7c6ef6]"
              title="When enabled, export/preview skip this gap between slides"
            />
            <span>Compensate</span>
            <span className="ml-1">Gap</span>
            <input
              type="number"
              min={0}
              max={MAX_PANO_COMPENSATION_PX}
              value={panoSettings.gapPx}
              onChange={(e) => updatePanoSettings({ gapPx: parseInt(e.target.value, 10) || 0 })}
              className="w-12 rounded border border-[rgba(255,255,255,0.1)] bg-[#0f0f13] px-1 py-0.5 text-right text-[#e8e8f0] focus:outline-none"
              title="Store preview gap shown in editor and preview"
            />
            <span>px</span>
          </label>
        )}
      </div>

      <div className="flex items-center gap-2 flex-1 overflow-x-auto min-w-0">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={viewProject.slideGroups.map((g) => g.id)} strategy={horizontalListSortingStrategy}>
            {viewProject.slideGroups.map((group, groupIdx) => {
              const groupSlides = flatSlides.filter((fs) => fs.group.id === group.id)
              return (
                <SortableGroupItem
                  key={group.id}
                  group={group}
                  groupSlides={groupSlides}
                  isActive={group.id === activeSlideGroupId}
                  isFirst={groupIdx === 0}
                  renamingId={renamingId}
                  renameValue={renameValue}
                  renameInputRef={renameInputRef}
                  thumbnails={thumbnails}
                  THUMB_H={THUMB_H}
                  handleContextMenu={handleContextMenu}
                  startRename={startRename}
                  setActiveSlideGroup={setActiveSlideGroup}
                  commitRename={commitRename}
                  setRenamingId={setRenamingId}
                  setRenameValue={setRenameValue}
                />
              )
            })}
          </SortableContext>
        </DndContext>

        {/* Add slide group button — kept outside SortableContext so it's not draggable */}
        <button
          onClick={addSlideGroup}
          title="Add slide group"
          className="shrink-0 w-8 h-8 flex items-center justify-center text-[#6b6b7a] hover:text-[#e8e8f0] rounded border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.2)] text-base transition-colors ml-1"
        >
          ＋
        </button>
      </div>

      <div className="flex items-center gap-2 shrink-0 border-l border-[rgba(255,255,255,0.06)] pl-3">
        <button
          onClick={onOpenPreview}
          className="text-xs text-[#e8e8f0] px-3 py-2 rounded border border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.05)] transition-colors"
        >
          Preview Slides
        </button>

        <button
          onClick={() => setExportOpen(true)}
          disabled={exportableFormats.length === 0}
          className="text-xs text-white px-3 py-2 rounded bg-[#7c6ef6] hover:bg-[#6c5ed6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Export
        </button>
      </div>

      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} stageRef={stageRef} />

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 py-1 rounded shadow-2xl border"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            background: '#18181f',
            borderColor: 'rgba(255,255,255,0.08)',
            minWidth: 140,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {[
            { action: 'rename', label: 'Rename' },
            { action: 'duplicate', label: 'Duplicate' },
            { action: 'delete', label: 'Delete', danger: true },
          ].map(({ action, label, danger }) => (
            <button
              key={action}
              className="w-full text-left px-3 py-2 text-xs hover:bg-[rgba(255,255,255,0.06)] transition-colors"
              style={{ color: danger ? '#f87171' : '#e8e8f0' }}
              onClick={() => handleMenuAction(action, contextMenu.groupId)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </footer>
  )
}
