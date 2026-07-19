import { useRef, useState, useEffect } from 'react'
import { useEditorStore } from '@/store'
import {
  BASE_CANVAS_FORMAT,
  CANVAS_FORMAT_PRESETS,
  countFormatAdjustments,
  getFormatLabel,
  getProjectActiveFormats,
  getProjectBaseFormat,
  isCustomFormatId,
} from '@/utils/canvasFormats'
import type { CanvasFormatId } from '@/types'

export function FormatTabs() {
  const settings = useEditorStore((s) => s.project.settings)
  const slideGroups = useEditorStore((s) => s.project.slideGroups)
  const activeCanvasFormat = useEditorStore((s) => s.activeCanvasFormat)
  const setActiveCanvasFormat = useEditorStore((s) => s.setActiveCanvasFormat)
  const activeSlideGroupId = useEditorStore((s) => s.activeSlideGroupId)
  const toggleActiveFormat = useEditorStore((s) => s.toggleActiveFormat)
  const addCustomFormat = useEditorStore((s) => s.addCustomFormat)
  const removeCustomFormat = useEditorStore((s) => s.removeCustomFormat)
  const resetActiveFormatLayout = useEditorStore((s) => s.resetActiveFormatLayout)
  const shareActiveFormatOwnedLayers = useEditorStore((s) => s.shareActiveFormatOwnedLayers)
  const resetActiveFormatVisibility = useEditorStore((s) => s.resetActiveFormatVisibility)
  const promoteActiveFormatLayoutToShared = useEditorStore((s) => s.promoteActiveFormatLayoutToShared)

  const baseFormat = getProjectBaseFormat({ settings })

  // activeFormats may not be in project.settings yet — fall back to base + defaults
  const activeFormats: CanvasFormatId[] = getProjectActiveFormats({ settings })

  // Platform tabs = activeFormats excluding base
  const platformFormats = activeFormats.filter((f) => f !== BASE_CANVAS_FORMAT)

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [actionsOpen, setActionsOpen] = useState(false)
  const actionsRef = useRef<HTMLDivElement>(null)
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customLabel, setCustomLabel] = useState('')
  const [customW, setCustomW] = useState('')
  const [customH, setCustomH] = useState('')

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!dropdownOpen) return
    const handlePointerDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [dropdownOpen])

  useEffect(() => {
    if (!actionsOpen) return
    const handlePointerDown = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setActionsOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [actionsOpen])

  // Formats not yet added (excluding base)
  const inactiveFormats = CANVAS_FORMAT_PRESETS.filter(
    (f) => f.id !== baseFormat && !activeFormats.includes(f.id as CanvasFormatId),
  )

  const isBase = activeCanvasFormat === baseFormat

  const handleToggleAdd = (id: CanvasFormatId) => {
    toggleActiveFormat(id)
    // Switch to the newly added format
    setActiveCanvasFormat(id)
    setDropdownOpen(false)
  }

  const handleRemoveFormat = (id: CanvasFormatId, e: React.MouseEvent) => {
    e.stopPropagation()
    if (isCustomFormatId(id)) {
      removeCustomFormat(id)
    } else {
      toggleActiveFormat(id)
    }
    // If we removed the currently active format, switch back to base
    if (activeCanvasFormat === id) {
      setActiveCanvasFormat(baseFormat)
    }
  }

  // Raw group for badge counts
  const rawGroup = slideGroups.find((g) => g.id === activeSlideGroupId)
  const activeAdjustmentCount = rawGroup && !isBase
    ? countFormatAdjustments(rawGroup, activeCanvasFormat, baseFormat)
    : 0

  const runFormatAction = (fn: (format: CanvasFormatId) => void) => {
    fn(activeCanvasFormat)
    setActionsOpen(false)
  }

  const handlePromoteLayout = () => {
    const label = getFormatLabel(activeCanvasFormat, settings.customFormats)
    const ok = window.confirm(
      `Use ${label} layout as shared for this slide?\n\n` +
      'This promotes all layout/model overrides from this platform into Base, so other platforms may move. Content stays shared.',
    )
    if (!ok) return
    runFormatAction(promoteActiveFormatLayoutToShared)
  }

  const actionItemCls = 'w-full text-left px-3 py-2 text-[11px] text-[#e8e8f0] hover:bg-[rgba(255,255,255,0.06)] transition-colors'

  return (
    <div className="shrink-0 bg-[#18181f] border-b border-[rgba(255,255,255,0.06)]">
      <div className="flex h-10 min-w-0 items-stretch pl-3">
        {/* Format axis and tabs */}
        <div className="flex min-w-0 flex-1 items-end gap-0.5">
          <span className="mr-1 self-center text-[9px] font-semibold uppercase tracking-[0.16em] text-[#565664]">
            Format
          </span>

          {/* Base tab — always first, never removable */}
          <button
            onClick={() => setActiveCanvasFormat(baseFormat)}
            style={{
              borderBottom: isBase ? '2px solid #7c6ef6' : '2px solid transparent',
              color: isBase ? '#ffffff' : undefined,
            }}
            className={`flex items-center gap-1 px-3 h-full text-xs font-medium transition-colors whitespace-nowrap ${
              isBase ? '' : 'text-[#6b6b7a] hover:text-[#e8e8f0]'
            }`}
            title="Base canvas — shared content, always exported"
          >
            Base
          </button>

          {/* Platform tabs */}
          {platformFormats.map((fmtId) => {
            const isActive = activeCanvasFormat === fmtId
            const count = rawGroup ? countFormatAdjustments(rawGroup, fmtId, baseFormat) : 0

            return (
              <div key={fmtId} className="relative flex items-end h-full group/tab">
                <button
                  onClick={() => setActiveCanvasFormat(fmtId)}
                  style={{
                    borderBottom: isActive ? '2px solid #7c6ef6' : '2px solid transparent',
                    color: isActive ? '#ffffff' : undefined,
                  }}
                  className={`flex items-center gap-1 pl-3 pr-1 h-full text-xs font-medium transition-colors whitespace-nowrap ${
                    isActive ? '' : 'text-[#6b6b7a] hover:text-[#e8e8f0]'
                  }`}
                  title={`${getFormatLabel(fmtId, settings.customFormats)} format · ${count} layout adjustment${count !== 1 ? 's' : ''}`}
                >
                  {getFormatLabel(fmtId, settings.customFormats)}
                  {count > 0 && (
                    <span
                      className="ml-0.5 text-[10px] font-semibold"
                      style={{ color: isActive ? '#a78bfa' : '#7c6ef6' }}
                    >
                      ●{count}
                    </span>
                  )}
                </button>

                {/* Remove button — visible on hover */}
                <button
                  onClick={(e) => handleRemoveFormat(fmtId, e)}
                  className="self-center mb-[2px] mr-0.5 w-4 h-4 flex items-center justify-center rounded text-[#6b6b7a] hover:text-[#e8e8f0] hover:bg-[rgba(255,255,255,0.08)] opacity-0 group-hover/tab:opacity-100 transition-opacity text-[10px] leading-none"
                  title={`Remove ${getFormatLabel(fmtId, settings.customFormats)} tab`}
                >
                  ×
                </button>
              </div>
            )
          })}

          {/* [+] Add format dropdown */}
          <div className="relative ml-1 self-center" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              className="flex items-center justify-center w-7 h-7 rounded text-[#6b6b7a] hover:text-[#e8e8f0] hover:bg-[rgba(255,255,255,0.06)] text-sm transition-colors"
              title="Add platform format"
            >
              +
            </button>

          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-[#1e1e2a] border border-[rgba(255,255,255,0.1)] rounded-lg shadow-xl overflow-hidden min-w-[176px]">
              {inactiveFormats.length === 0 ? (
                <p className="px-3 py-2 text-xs text-[#6b6b7a]">All presets active</p>
              ) : (
                inactiveFormats.map((fmt) => (
                  <button
                    key={fmt.id}
                    onClick={() => handleToggleAdd(fmt.id as CanvasFormatId)}
                    className="w-full text-left px-3 py-2 text-xs text-[#a0a0b0] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#e8e8f0] transition-colors"
                  >
                    {getFormatLabel(fmt.id as CanvasFormatId, settings.customFormats)}
                    <span className="ml-1.5 text-[10px] opacity-50">
                      {fmt.width}×{fmt.height}
                    </span>
                  </button>
                ))
              )}
              <div className="h-px mx-2 my-1 bg-[rgba(255,255,255,0.08)]" />
              <button
                onClick={() => { setShowCustomInput(true); setDropdownOpen(false) }}
                className="w-full text-left px-3 py-2 text-xs text-[#a0a0b0] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#e8e8f0] transition-colors"
              >
                Custom size…
              </button>
            </div>
          )}

          {showCustomInput && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-[#1e1e2a] border border-[rgba(255,255,255,0.1)] rounded-lg shadow-xl p-3 min-w-[200px]">
              <p className="text-[10px] text-[#6b6b7a] mb-2">Custom canvas format</p>
              <input
                type="text"
                placeholder="Label (optional)"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                className="w-full mb-2 bg-[#0f0f13] border border-[rgba(255,255,255,0.1)] rounded px-2 py-1 text-xs text-[#e8e8f0] focus:outline-none"
              />
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="number"
                  placeholder="W"
                  value={customW}
                  onChange={(e) => setCustomW(e.target.value)}
                  className="w-20 bg-[#0f0f13] border border-[rgba(255,255,255,0.1)] rounded px-2 py-1 text-xs text-[#e8e8f0] focus:outline-none [appearance:textfield]"
                />
                <span className="text-[#6b6b7a] text-xs">×</span>
                <input
                  type="number"
                  placeholder="H"
                  value={customH}
                  onChange={(e) => setCustomH(e.target.value)}
                  className="w-20 bg-[#0f0f13] border border-[rgba(255,255,255,0.1)] rounded px-2 py-1 text-xs text-[#e8e8f0] focus:outline-none [appearance:textfield]"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const w = parseInt(customW)
                    const h = parseInt(customH)
                    if (w >= 100 && w <= 9999 && h >= 100 && h <= 9999) {
                      addCustomFormat(customLabel.trim() || `Custom ${w}×${h}`, w, h)
                    }
                    setShowCustomInput(false)
                    setCustomLabel('')
                    setCustomW('')
                    setCustomH('')
                  }}
                  className="flex-1 text-xs bg-[#7c6ef6] text-white rounded px-2 py-1 hover:bg-[#6c5ed6]"
                >
                  Apply
                </button>
                <button
                  onClick={() => { setShowCustomInput(false); setCustomLabel(''); setCustomW(''); setCustomH('') }}
                  className="text-xs text-[#6b6b7a] hover:text-[#e8e8f0] px-2 py-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Persistent scope summary, compacted into the tab row. */}
        {isBase ? (
          <div className="ml-auto flex shrink-0 items-center border-l border-[rgba(255,255,255,0.06)] px-3 text-[10px] text-[#6b6b7a]">
            <span className="mr-2 h-1.5 w-1.5 rounded-full bg-[#7c6ef6] opacity-70" />
            Shared base · New layers appear in every format
          </div>
        ) : (
          <div
            className="ml-auto flex shrink-0 items-center gap-3 border-l px-3"
            style={{
              background: 'rgba(245,158,11,0.08)',
              borderColor: 'rgba(245,158,11,0.25)',
            }}
            title={`${getFormatLabel(activeCanvasFormat, settings.customFormats)} only — new layers and layout adjustments affect only ${getFormatLabel(activeCanvasFormat, settings.customFormats)}. Text and colors are shared.`}
          >
            <div className="flex items-center gap-2 whitespace-nowrap text-[11px]" style={{ color: '#fbbf24' }}>
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#f59e0b] shadow-[0_0_8px_rgba(245,158,11,0.55)]" />
              <strong>{getFormatLabel(activeCanvasFormat, settings.customFormats)} only</strong>
              <span className="text-[rgba(251,191,36,0.68)]">·</span>
              <span>New layers + layout scoped</span>
              <span className="text-[rgba(251,191,36,0.68)]">·</span>
              <span>Text &amp; colors shared</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => setActiveCanvasFormat(baseFormat)}
                className="whitespace-nowrap text-[11px] transition-opacity hover:opacity-100"
                style={{ color: '#fbbf24', opacity: 0.7 }}
                title="Return to the shared base format"
              >
                ↩ Base
              </button>
              <div className="relative" ref={actionsRef}>
                <button
                  onClick={() => setActionsOpen((v) => !v)}
                  className="rounded border border-[rgba(245,158,11,0.25)] px-2 py-0.5 text-[11px] transition-colors hover:bg-[rgba(245,158,11,0.12)]"
                  style={{ color: '#fbbf24' }}
                  title={`Global actions for this ${getFormatLabel(activeCanvasFormat, settings.customFormats)} slide`}
                >
                  Actions ▾
                </button>
                {actionsOpen && (
                  <div className="absolute right-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-lg border border-[rgba(255,255,255,0.12)] bg-[#1c1c26] shadow-xl">
                  <div className="border-b border-[rgba(255,255,255,0.08)] px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#fbbf24]">
                      {getFormatLabel(activeCanvasFormat, settings.customFormats)} slide actions
                    </p>
                    <p className="mt-0.5 text-[10px] text-[#6b6b7a]">
                      {activeAdjustmentCount} platform adjustment{activeAdjustmentCount !== 1 ? 's' : ''} on this slide
                    </p>
                  </div>
                  <button className={actionItemCls} onClick={() => runFormatAction(resetActiveFormatLayout)}>
                    Reset platform layout
                    <span className="mt-0.5 block text-[10px] text-[#6b6b7a]">Remove all layout/model overrides for this platform.</span>
                  </button>
                  <button className={actionItemCls} onClick={() => runFormatAction(shareActiveFormatOwnedLayers)}>
                    Make platform layers shared
                    <span className="mt-0.5 block text-[10px] text-[#6b6b7a]">Convert layers created only in this platform into shared layers.</span>
                  </button>
                  <button className={actionItemCls} onClick={() => runFormatAction(resetActiveFormatVisibility)}>
                    Reset platform visibility
                    <span className="mt-0.5 block text-[10px] text-[#6b6b7a]">Clear hide/show decisions for this platform.</span>
                  </button>
                  <div className="h-px bg-[rgba(255,255,255,0.08)]" />
                  <button className={actionItemCls} onClick={handlePromoteLayout}>
                    Use platform layout as shared…
                    <span className="mt-0.5 block text-[10px] text-[#f59e0b]">Promotes this platform layout into Base. Affects other platforms.</span>
                  </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
