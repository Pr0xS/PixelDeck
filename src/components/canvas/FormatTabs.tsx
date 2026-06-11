import { useRef, useState, useEffect } from 'react'
import { useEditorStore } from '@/store'
import {
  BASE_CANVAS_FORMAT,
  CANVAS_FORMAT_PRESETS,
  countFormatAdjustments,
  getProjectActiveFormats,
  getProjectBaseFormat,
} from '@/utils/canvasFormats'
import type { CanvasFormatId } from '@/types'

/** Short human label for a CanvasFormatId. */
function shortFormatLabel(id: CanvasFormatId): string {
  const map: Record<CanvasFormatId, string> = {
    'base': 'Base',
    'iphone-69': 'iPhone',
    'android-phone': 'Android',
    'ipad-13': 'iPad',
    'android-tablet': 'Android Tab',
  }
  return map[id] ?? id
}

export function FormatTabs() {
  const project = useEditorStore((s) => s.project)
  const activeCanvasFormat = useEditorStore((s) => s.activeCanvasFormat)
  const setActiveCanvasFormat = useEditorStore((s) => s.setActiveCanvasFormat)
  const activeSlideGroupId = useEditorStore((s) => s.activeSlideGroupId)
  const toggleActiveFormat = useEditorStore((s) => s.toggleActiveFormat)
  const updateSlideGroup = useEditorStore((s) => s.updateSlideGroup)

  const baseFormat = getProjectBaseFormat(project)

  // activeFormats may not be in project.settings yet — fall back to base + defaults
  const activeFormats: CanvasFormatId[] = getProjectActiveFormats(project)

  // Platform tabs = activeFormats excluding base
  const platformFormats = activeFormats.filter((f) => f !== BASE_CANVAS_FORMAT)

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [showCustomInput, setShowCustomInput] = useState(false)
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
    toggleActiveFormat(id)
    // If we removed the currently active format, switch back to base
    if (activeCanvasFormat === id) {
      setActiveCanvasFormat(baseFormat)
    }
  }

  // Raw group for badge counts
  const rawGroup = project.slideGroups.find((g) => g.id === activeSlideGroupId)

  return (
    <div className="shrink-0 bg-[#18181f] border-b border-[rgba(255,255,255,0.06)]">
      {/* Tab row */}
      <div className="flex items-end px-3 h-9 gap-0.5">

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
                title={`${shortFormatLabel(fmtId)} format · ${count} layout adjustment${count !== 1 ? 's' : ''}`}
              >
                {shortFormatLabel(fmtId)}
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
                title={`Remove ${shortFormatLabel(fmtId)} tab`}
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
                <p className="px-3 py-2 text-xs text-[#6b6b7a]">All formats active</p>
              ) : (
                inactiveFormats.map((fmt) => (
                  <button
                    key={fmt.id}
                    onClick={() => handleToggleAdd(fmt.id as CanvasFormatId)}
                    className="w-full text-left px-3 py-2 text-xs text-[#a0a0b0] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#e8e8f0] transition-colors"
                  >
                    {shortFormatLabel(fmt.id as CanvasFormatId)}
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
              <p className="text-[10px] text-[#6b6b7a] mb-2">Custom canvas size (base)</p>
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
                    if (w >= 100 && w <= 9999 && h >= 100 && h <= 9999 && activeSlideGroupId) {
                      updateSlideGroup(activeSlideGroupId, { slideWidth: w, slideHeight: h })
                    }
                    setShowCustomInput(false)
                    setCustomW('')
                    setCustomH('')
                  }}
                  className="flex-1 text-xs bg-[#7c6ef6] text-white rounded px-2 py-1 hover:bg-[#6c5ed6]"
                >
                  Apply
                </button>
                <button
                  onClick={() => { setShowCustomInput(false); setCustomW(''); setCustomH('') }}
                  className="text-xs text-[#6b6b7a] hover:text-[#e8e8f0] px-2 py-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info / warning bar below tabs */}
      {isBase ? (
        /* Subtle info bar on Base tab */
        <div
          className="flex items-center px-3 py-[3px]"
          style={{ background: 'rgba(255,255,255,0.02)' }}
        >
          <span className="text-[10px]" style={{ color: '#6b6b7a' }}>
            Base · Layers added here appear in all formats
          </span>
        </div>
      ) : (
        /* Amber warning banner on platform tabs */
        <div
          className="flex items-center justify-between px-3 py-1"
          style={{
            background: 'rgba(245,158,11,0.08)',
            borderBottom: '1px solid rgba(245,158,11,0.25)',
          }}
        >
          <span className="text-xs" style={{ color: '#fbbf24' }}>
            ⚠ <strong>{shortFormatLabel(activeCanvasFormat)}</strong> tab · Layers added here belong only to{' '}
            <strong>{shortFormatLabel(activeCanvasFormat)}</strong> · Layout adjustments only affect{' '}
            <strong>{shortFormatLabel(activeCanvasFormat)}</strong> · Content (text, colors) is shared
          </span>
          <button
            onClick={() => setActiveCanvasFormat(baseFormat)}
            className="ml-4 shrink-0 text-xs transition-opacity hover:opacity-100"
            style={{ color: '#fbbf24', opacity: 0.7 }}
          >
            ← Base
          </button>
        </div>
      )}
    </div>
  )
}
