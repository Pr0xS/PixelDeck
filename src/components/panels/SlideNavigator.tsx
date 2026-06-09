import { Fragment, useState, useEffect, useRef } from 'react'
import type Konva from 'konva'
import { useEditorStore } from '@/store'
import { fillToCss } from '@/utils/gradients'
import { downloadSlide, downloadSlideGroup, saveToDirectory } from '@/utils/export'
import type { BackgroundLayer } from '@/types'
import type { ThumbnailMap } from '@/hooks/useThumbnails'

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

export function SlideNavigator({ thumbnails, stageRef, onOpenPreview }: SlideNavigatorProps) {
  const {
    project,
    activeSlideGroupId,
    setActiveSlideGroup,
    addSlideGroup,
    removeSlideGroup,
    duplicateSlideGroup,
    updateSlideGroup,
  } = useEditorStore()

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)
  const exportRef = useRef<HTMLDivElement>(null)

  const activeGroup = project.slideGroups.find((g) => g.id === activeSlideGroupId)

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [contextMenu])

  useEffect(() => {
    if (!exportOpen) return
    const close = (e: MouseEvent) => {
      if (!exportRef.current?.contains(e.target as Node)) setExportOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [exportOpen])

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
    setContextMenu({ groupId, x: e.clientX, y: e.clientY })
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

  const handleExportCurrent = async () => {
    if (!stageRef.current || !activeGroup) return
    await downloadSlide(stageRef.current, 0, activeGroup)
    setExportOpen(false)
  }

  const handleExportAll = async () => {
    if (!stageRef.current || !activeGroup) return
    await downloadSlideGroup(stageRef.current, activeGroup)
    setExportOpen(false)
  }

  const handleExportFolder = async () => {
    if (!stageRef.current || !activeGroup) return
    await saveToDirectory(stageRef.current, activeGroup)
    setExportOpen(false)
  }

  // Build flat slide list with global sequential numbers
  type FlatSlide = {
    group: (typeof project.slideGroups)[number]
    slideIdx: number
    globalNum: number
    bgCss: string
  }
  const flatSlides: FlatSlide[] = []
  let globalNum = 0
  for (const group of project.slideGroups) {
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

  return (
    <footer
      className="h-20 flex items-center gap-3 px-3 shrink-0 border-t"
      style={{ background: '#18181f', borderColor }}
    >
      <div className="flex min-w-[190px] flex-col gap-1.5 shrink-0 pr-3 border-r border-[rgba(255,255,255,0.06)]">
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
      </div>

      <div className="flex items-center gap-2 flex-1 overflow-x-auto min-w-0">
        {flatSlides.map(({ group, slideIdx, globalNum: num, bgCss }, idx) => {
          const isActive = group.id === activeSlideGroupId
          const isFirstInGroup = slideIdx === 0

          // Rename mode: show input in place of this group's first slide, skip the rest
          if (renamingId === group.id) {
            if (slideIdx === 0) {
              return (
                <div key={`${group.id}-rename`} className="relative shrink-0">
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
                    className="text-xs px-2 py-1 rounded border border-[#7c6ef6] bg-[#0f0f13] text-[#e8e8f0] w-28 focus:outline-none"
                  />
                </div>
              )
            }
            return null // hide other slides of this group during rename
          }

          const thumb = thumbnails[group.id]?.[slideIdx]
          const thumbW = Math.min(50, Math.round((group.slideWidth / group.slideHeight) * THUMB_H))

          return (
            <Fragment key={`${group.id}-${slideIdx}`}>
              {/* Visual divider between groups — no extra margin, sits in the natural gap */}
              {isFirstInGroup && idx > 0 && (
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

              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}
                className="relative shrink-0 group"
                onContextMenu={(e) => handleContextMenu(e, group.id)}
                onDoubleClick={() => startRename(group.id, group.name)}
              >
                <div
                  style={{
                    width: thumbW,
                    height: THUMB_H,
                    background: bgCss,
                    border: `1px solid ${isActive ? '#7c6ef6' : 'rgba(255,255,255,0.12)'}`,
                    borderRadius: 4,
                    cursor: 'pointer',
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

        {/* Add slide group button */}
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

        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setExportOpen((o) => !o)}
            disabled={!activeGroup}
            className="text-xs text-white px-3 py-2 rounded bg-[#7c6ef6] hover:bg-[#6c5ed6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Export PNG
          </button>
          {exportOpen && (
            <div
              className="absolute bottom-full right-0 mb-2 rounded shadow-2xl z-50 min-w-[210px] py-1 border"
              style={{ background: '#18181f', borderColor: 'rgba(255,255,255,0.08)' }}
            >
              <button className="w-full text-left px-3 py-2 text-sm text-[#e8e8f0] hover:bg-[rgba(255,255,255,0.06)]" onClick={handleExportCurrent}>
                Export current slide
              </button>
              <button className="w-full text-left px-3 py-2 text-sm text-[#e8e8f0] hover:bg-[rgba(255,255,255,0.06)]" onClick={handleExportAll}>
                Export all slides in group
              </button>
              <button className="w-full text-left px-3 py-2 text-sm text-[#e8e8f0] hover:bg-[rgba(255,255,255,0.06)]" onClick={handleExportFolder}>
                Export PNGs to folder
              </button>
            </div>
          )}
        </div>
      </div>

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
