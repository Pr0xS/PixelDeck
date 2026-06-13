import { Fragment, useState, useEffect, useRef } from 'react'
import type Konva from 'konva'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '@/store'
import { fillToCss } from '@/utils/gradients'
import { downloadDataUrl, downloadSlide, downloadSlideGroup, saveToDirectory, exportGroupAsZip } from '@/utils/export'
import { applyCanvasFormat, CANVAS_FORMAT_PRESETS, countFormatAdjustments, getProjectActiveFormats, getProjectBaseFormat } from '@/utils/canvasFormats'
import { exportAllFormats } from '@/utils/multiFormatExport'
import type { BackgroundLayer, CanvasFormatId } from '@/types'
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
    activeCanvasFormat,
  } = useEditorStore(useShallow((s) => ({
    project: s.project,
    activeSlideGroupId: s.activeSlideGroupId,
    setActiveSlideGroup: s.setActiveSlideGroup,
    addSlideGroup: s.addSlideGroup,
    removeSlideGroup: s.removeSlideGroup,
    duplicateSlideGroup: s.duplicateSlideGroup,
    updateSlideGroup: s.updateSlideGroup,
    activeCanvasFormat: s.activeCanvasFormat,
  })))

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [stageReady, setStageReady] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [selectedExportFormats, setSelectedExportFormats] = useState<CanvasFormatId[]>([])
  const renameInputRef = useRef<HTMLInputElement>(null)
  const exportRef = useRef<HTMLDivElement>(null)

  const viewProject = applyCanvasFormat(project, activeCanvasFormat)
  const activeGroup = viewProject.slideGroups.find((g) => g.id === activeSlideGroupId)

  // The formats currently active for this project
  const baseFormat = getProjectBaseFormat(project)
  const activeFormats: CanvasFormatId[] = getProjectActiveFormats(project)
  // Non-base (exportable) formats — these are the ones shown in the export checklist
  const exportableFormats = activeFormats.filter((f) => f !== baseFormat)

  // Initialize selectedExportFormats when export menu opens (adjust-state-during-render pattern)
  const [lastExportOpen, setLastExportOpen] = useState(false)
  if (exportOpen && !lastExportOpen) {
    setLastExportOpen(true)
    setSelectedExportFormats(exportableFormats)
  } else if (!exportOpen && lastExportOpen) {
    setLastExportOpen(false)
  }

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

  useEffect(() => {
    if (!exportError) return
    const timeout = window.setTimeout(() => setExportError(null), 4000)
    return () => window.clearTimeout(timeout)
  }, [exportError])

  useEffect(() => {
    setStageReady(Boolean(stageRef.current))
  }, [stageRef, activeGroup])

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

  const getStage = () => {
    if (!stageRef.current || !activeGroup) {
      setExportError('Export unavailable. Try again.')
      return null
    }
    return stageRef.current
  }

  const toggleExportFormat = (formatId: CanvasFormatId) => {
    setSelectedExportFormats((prev) => {
      if (prev.includes(formatId)) {
        // Can't uncheck the last selected format
        if (prev.length <= 1) return prev
        return prev.filter((f) => f !== formatId)
      }
      return [...prev, formatId]
    })
  }

  // ─── Export handlers ──────────────────────────────────────────────────────

  const handleExportCurrent = async () => {
    const stage = getStage()
    if (!stage || !activeGroup) return

    try {
      setIsExporting(true)

      if (selectedExportFormats.length <= 1) {
        // Single format — legacy path
        await downloadSlide(stage, 0, activeGroup)
      } else {
        // Multi-format: export slide 0 from each selected format
        const results = await exportAllFormats(stage, selectedExportFormats)
        for (const result of results) {
          const slide = result.slides[0]
          if (slide) {
            downloadDataUrl(slide.dataUrl, slide.name)
            await new Promise((r) => setTimeout(r, 80))
          }
        }
      }
      setExportOpen(false)
    } catch {
      setExportError('Export failed. Try again.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportAll = async () => {
    const stage = getStage()
    if (!stage || !activeGroup) return

    try {
      setIsExporting(true)

      if (selectedExportFormats.length <= 1) {
        // Single format — legacy path
        await downloadSlideGroup(stage, activeGroup)
      } else {
        const results = await exportAllFormats(stage, selectedExportFormats)
        for (const result of results) {
          for (const slide of result.slides) {
            downloadDataUrl(slide.dataUrl, slide.name)
            await new Promise((r) => setTimeout(r, 80))
          }
        }
      }
      setExportOpen(false)
    } catch {
      setExportError('Export failed. Try again.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportFolder = async () => {
    const stage = getStage()
    if (!stage || !activeGroup) return

    try {
      setIsExporting(true)

      if (selectedExportFormats.length <= 1) {
        // Single format — legacy path
        await saveToDirectory(stage, activeGroup)
      } else {
        const results = await exportAllFormats(stage, selectedExportFormats)

        if (!window.showDirectoryPicker) {
          // Fallback: download individually with format prefix
          for (const result of results) {
            for (const slide of result.slides) {
              downloadDataUrl(slide.dataUrl, slide.name)
              await new Promise((r) => setTimeout(r, 80))
            }
          }
        } else {
          try {
            const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' })
            for (const result of results) {
              // Create a subfolder per format
              const subDir = await (dirHandle as unknown as {
                getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<typeof dirHandle>
              }).getDirectoryHandle(result.formatId, { create: true })
              for (const slide of result.slides) {
                const filename = slide.name.endsWith('.png') ? slide.name : `${slide.name}.png`
                const fileHandle = await subDir.getFileHandle(filename, { create: true })
                const writable = await fileHandle.createWritable()
                const res = await fetch(slide.dataUrl)
                const blob = await res.blob()
                await writable.write(blob)
                await writable.close()
              }
            }
          } catch (err: unknown) {
            if (!(err instanceof DOMException && err.name === 'AbortError')) throw err
          }
        }
      }
      setExportOpen(false)
    } catch {
      setExportError('Export failed. Try again.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportZip = async () => {
    const stage = getStage()
    if (!stage || !activeGroup) return

    try {
      setIsExporting(true)

      if (selectedExportFormats.length <= 1) {
        // Single format — legacy path
        const blob = await exportGroupAsZip(stage, activeGroup)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const zipName = activeGroup.name.replace(/[^a-z0-9_-]/gi, '-').toLowerCase() || 'slides'
        a.download = `${zipName}.zip`
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
      } else {
        const { default: JSZip } = await import('jszip')
        const results = await exportAllFormats(stage, selectedExportFormats)
        const zip = new JSZip()

        for (const result of results) {
          // Create a subfolder per format in the ZIP
          const folder = zip.folder(result.formatId)
          if (!folder) continue
          for (const slide of result.slides) {
            const filename = slide.name.endsWith('.png') ? slide.name : `${slide.name}.png`
            const res = await fetch(slide.dataUrl)
            const blob = await res.blob()
            folder.file(filename, blob)
          }
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' })
        const url = URL.createObjectURL(zipBlob)
        const a = document.createElement('a')
        a.href = url
        const zipName = activeGroup.name.replace(/[^a-z0-9_-]/gi, '-').toLowerCase() || 'slides'
        a.download = `${zipName}-multi.zip`
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
      }
      setExportOpen(false)
    } catch {
      setExportError('Export failed. Try again.')
    } finally {
      setIsExporting(false)
    }
  }

  // Build flat slide list with global sequential numbers
  type FlatSlide = {
    group: (typeof viewProject.slideGroups)[number]
    slideIdx: number
    globalNum: number
    bgCss: string
  }
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
  const exportReady = Boolean(stageReady && activeGroup) && !isExporting
  const exportItemClass = `w-full text-left px-3 py-2 text-sm transition-colors ${
    exportReady
      ? 'text-[#e8e8f0] hover:bg-[rgba(255,255,255,0.06)]'
      : 'text-[#6b6b7a] cursor-not-allowed opacity-50'
  }`

  // Raw (unresolved) active group for countFormatAdjustments
  const rawActiveGroup = project.slideGroups.find((g) => g.id === activeSlideGroupId)

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
      </div>

      <div className="flex items-center gap-2 flex-1 overflow-x-auto min-w-0">
        {flatSlides.map(({ group, slideIdx, globalNum: num, bgCss }, idx) => {
          const isActive = group.id === activeSlideGroupId
          const isFirstInGroup = slideIdx === 0

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
            disabled={!exportReady && !isExporting}
            className="text-xs text-white px-3 py-2 rounded bg-[#7c6ef6] hover:bg-[#6c5ed6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isExporting ? 'Exporting…' : 'Export PNG'}
          </button>
          {exportOpen && (
            <div
              className="absolute bottom-full right-0 mb-2 rounded shadow-2xl z-50 min-w-[280px] border"
              style={{ background: '#18181f', borderColor: 'rgba(255,255,255,0.08)' }}
            >
              {/* ── Section 1: Format checklist ── */}
              <div className="px-3 pt-3 pb-2 border-b border-[rgba(255,255,255,0.06)]">
                {exportableFormats.length === 0 ? (
                  <p className="text-[10px] leading-snug text-[#6b6b7a]">
                    No export formats added yet. Use the{' '}
                    <span className="text-[#bdb7f6]">[+]</span> button above the canvas to add iPhone or Android.
                  </p>
                ) : (
                  <>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#6b6b7a] mb-2">
                      Export formats
                    </p>
                    <div className="flex flex-col gap-1">
                      {exportableFormats.map((formatId) => {
                        const preset = CANVAS_FORMAT_PRESETS.find((p) => p.id === formatId)
                        if (!preset) return null
                        const isChecked = selectedExportFormats.includes(formatId)
                        const adjustments = rawActiveGroup
                          ? countFormatAdjustments(rawActiveGroup, formatId, baseFormat)
                          : 0

                        return (
                          <label
                            key={formatId}
                            className="flex items-center gap-2 px-1 py-0.5 rounded cursor-pointer transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                            onClick={(e) => {
                              e.preventDefault()
                              toggleExportFormat(formatId)
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleExportFormat(formatId)}
                              className="accent-[#7c6ef6] w-3 h-3 shrink-0"
                            />
                            <span className="text-[11px] text-[#e8e8f0] flex-1 truncate">
                              {preset.label}
                            </span>
                            <span className="text-[10px] text-[#6b6b7a] shrink-0">
                              {preset.width}×{preset.height}
                            </span>
                            {adjustments > 0 ? (
                              <span className="text-[9px] text-[#f59e0b] bg-[rgba(245,158,11,0.1)] rounded px-1 py-px shrink-0">
                                adjusted ({adjustments})
                              </span>
                            ) : (
                              <span className="text-[9px] text-[#6b6b7a] bg-[rgba(255,255,255,0.05)] rounded px-1 py-px shrink-0">
                                auto
                              </span>
                            )}
                          </label>
                        )
                      })}
                    </div>
                    <p className="text-[10px] leading-snug text-[#6b6b7a] mt-2">
                      Exports the selected formats. Switch format tabs above the canvas to preview each one.
                    </p>
                  </>
                )}
              </div>

              <div className="py-1">
                <button disabled={!exportReady} className={exportItemClass} onClick={handleExportCurrent}>
                  Export current slide
                </button>
                <button disabled={!exportReady} className={exportItemClass} onClick={handleExportAll}>
                  Export all slides in group
                </button>
                <button disabled={!exportReady} className={exportItemClass} onClick={handleExportFolder}>
                  Export PNGs to folder
                </button>
                <div className="h-px mx-2 my-1 bg-[rgba(255,255,255,0.06)]" />
                <button disabled={!exportReady} className={exportItemClass} onClick={handleExportZip}>
                  Export all slides as ZIP
                </button>
              </div>
            </div>
          )}
          {exportError && (
            <div className="absolute bottom-full right-0 mb-2 w-48 rounded border border-[rgba(248,113,113,0.35)] bg-[#18181f] px-3 py-2 text-xs text-[#f87171] shadow-xl">
              {exportError}
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
