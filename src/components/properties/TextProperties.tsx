import { useState, useRef, useEffect, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '@/store'
import type { TextLayer, Layer, CustomFontRef } from '@/types'
import { SliderField } from '@/components/properties/PropertyControls'
import { FONT_LIST, WEB_SAFE_FONTS, getFontWeights, generateCustomFontFamily, loadCustomFont, unregisterCustomFont, preloadFont, ensureFontReady } from '@/utils/fonts'
import { useFontStore } from '@/store/fontStore'
import {
  inputCls,
  labelCls,
  panelSectionCls,
  pauseTemporal,
  resumeTemporal,
} from '@/components/properties/panelConstants'
import { LayerTextToolbar } from '@/components/text/LayerTextToolbar'

// ─── FontPicker ───────────────────────────────────────────────────────────────

interface FontPickerProps {
  value: string
  customFonts: CustomFontRef[]
  onChange: (family: string) => void
}

function FontPicker({ value, customFonts, onChange }: FontPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  // Index into the flat filtered list for keyboard navigation (-1 = none)
  const [activeIdx, setActiveIdx] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  // Track the value before keyboard navigation so we can restore on Escape
  const valueBeforeNav = useRef<string>(value)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // Restore original value if navigating without confirming
        onChange(valueBeforeNav.current)
        setOpen(false)
        setSearch('')
        setActiveIdx(-1)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onChange])

  // Auto-focus search when opening; snapshot current value for Escape restore
  useEffect(() => {
    if (open) {
      valueBeforeNav.current = value
      searchRef.current?.focus()
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredCustom = customFonts.filter(
    (f) => !search || f.label.toLowerCase().includes(search.toLowerCase()) || f.family === value,
  )
  const filteredWebSafe = WEB_SAFE_FONTS.filter(
    (f) => !search || f.label.toLowerCase().includes(search.toLowerCase()) || f.family === value,
  )
  const filteredGoogle = FONT_LIST.filter(
    (f) => !search || f.label.toLowerCase().includes(search.toLowerCase()) || f.family === value,
  )

  // Flat ordered list for keyboard navigation
  const flatList = [
    ...filteredCustom.map((f) => f.family),
    ...filteredWebSafe.map((f) => f.family),
    ...filteredGoogle.map((f) => f.family),
  ]

  const allFontsList = [...customFonts, ...FONT_LIST, ...WEB_SAFE_FONTS]
  const selectedLabel = allFontsList.find((f) => f.family === value)?.label ?? value

  const handleSelect = useCallback((family: string) => {
    valueBeforeNav.current = family
    void ensureFontReady(family)
    onChange(family)
    setOpen(false)
    setSearch('')
    setActiveIdx(-1)
  }, [onChange])

  // Scroll the active item into view
  const scrollActiveIntoView = useCallback((idx: number) => {
    if (!listRef.current) return
    const items = listRef.current.querySelectorAll<HTMLElement>('[data-font-item]')
    items[idx]?.scrollIntoView({ block: 'nearest' })
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return

    if (e.key === 'Escape') {
      // Restore value before navigation
      onChange(valueBeforeNav.current)
      setOpen(false)
      setSearch('')
      setActiveIdx(-1)
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = activeIdx < flatList.length - 1 ? activeIdx + 1 : 0
      setActiveIdx(next)
      const family = flatList[next]
      if (family) {
        void ensureFontReady(family)
        onChange(family)
        scrollActiveIntoView(next)
      }
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = activeIdx > 0 ? activeIdx - 1 : flatList.length - 1
      setActiveIdx(prev)
      const family = flatList[prev]
      if (family) {
        void ensureFontReady(family)
        onChange(family)
        scrollActiveIntoView(prev)
      }
      return
    }

    if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault()
      const family = flatList[activeIdx]
      if (family) handleSelect(family)
      return
    }
  }

  const sectionLabelCls =
    'text-[10px] text-[#4a4a5a] uppercase tracking-wider px-2 py-1 select-none'
  const itemBaseCls =
    'w-full text-left px-3 py-1.5 text-sm text-[#e8e8f0] hover:bg-[rgba(255,255,255,0.05)] transition-colors rounded'
  const itemSelectedCls = 'bg-[rgba(124,110,246,0.15)] !text-[#c4b5fd]'
  const itemActiveCls = 'bg-[rgba(255,255,255,0.08)] outline-none'

  const noResults =
    filteredCustom.length === 0 && filteredWebSafe.length === 0 && filteredGoogle.length === 0

  // Compute per-section start indices for keyboard highlight mapping
  const customStart = 0
  const webSafeStart = filteredCustom.length
  const googleStart = filteredCustom.length + filteredWebSafe.length

  return (
    <div className="relative" ref={containerRef} onKeyDown={handleKeyDown}>
      {/* Trigger button — identical height/border to inputCls */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${inputCls} flex items-center justify-between cursor-pointer`}
        style={{ fontFamily: value }}
      >
        <span className="truncate">{selectedLabel}</span>
        <svg
          className={`ml-2 w-3 h-3 flex-shrink-0 text-[#6b6b7a] transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 12 12"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M2 4l4 4 4-4" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#0f0f1a] shadow-xl shadow-black/50 overflow-hidden">
          {/* Sticky search input */}
          <div className="sticky top-0 bg-[#0f0f1a] border-b border-[rgba(255,255,255,0.08)] p-1.5">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setActiveIdx(-1) }}
              placeholder="Search fonts… (↑↓ to preview)"
              className={`${inputCls} text-xs`}
            />
          </div>

          {/* Scrollable font list */}
          <div ref={listRef} className="max-h-60 overflow-y-auto py-1">
            {/* My Fonts */}
            {filteredCustom.length > 0 && (
              <>
                <div className={sectionLabelCls}>My Fonts</div>
                {filteredCustom.map((f, i) => {
                  const flatIdx = customStart + i
                  return (
                    <button
                      key={f.family}
                      data-font-item
                      type="button"
                      onClick={() => handleSelect(f.family)}
                      onMouseEnter={() => preloadFont(f.family)}
                      className={`${itemBaseCls} ${f.family === value ? itemSelectedCls : ''} ${flatIdx === activeIdx ? itemActiveCls : ''}`}
                      style={{ fontFamily: f.family }}
                    >
                      {f.label}
                    </button>
                  )
                })}
              </>
            )}

            {/* Web Safe */}
            {filteredWebSafe.length > 0 && (
              <>
                <div className={sectionLabelCls}>Web Safe</div>
                {filteredWebSafe.map((f, i) => {
                  const flatIdx = webSafeStart + i
                  return (
                    <button
                      key={f.family}
                      data-font-item
                      type="button"
                      onClick={() => handleSelect(f.family)}
                      className={`${itemBaseCls} ${f.family === value ? itemSelectedCls : ''} ${flatIdx === activeIdx ? itemActiveCls : ''}`}
                      style={{ fontFamily: f.family }}
                    >
                      {f.label}
                    </button>
                  )
                })}
              </>
            )}

            {/* Google Fonts */}
            {filteredGoogle.length > 0 && (
              <>
                <div className={sectionLabelCls}>Google Fonts</div>
                {filteredGoogle.map((f, i) => {
                  const flatIdx = googleStart + i
                  return (
                    <button
                      key={f.family}
                      data-font-item
                      type="button"
                      onClick={() => handleSelect(f.family)}
                      onMouseEnter={() => preloadFont(f.family)}
                      className={`${itemBaseCls} ${f.family === value ? itemSelectedCls : ''} ${flatIdx === activeIdx ? itemActiveCls : ''}`}
                      style={{ fontFamily: f.family }}
                    >
                      {f.label}
                    </button>
                  )
                })}
              </>
            )}

            {/* Empty state */}
            {noResults && (
              <div className="px-3 py-4 text-sm text-[#4a4a5a] text-center">
                No fonts match &ldquo;{search}&rdquo;
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── TextProperties ───────────────────────────────────────────────────────────

export function TextProperties({ layer }: { layer: TextLayer }) {
  const { updateLayer, project, updateProject } = useEditorStore(
    useShallow((s) => ({
      updateLayer: s.updateLayer,
      project: s.project,
      updateProject: s.updateProject,
    }))
  )
  const upd = (patch: Partial<TextLayer>) => updateLayer(layer.id, patch as Partial<Layer>)
  const editingThis = useEditorStore((s) => s.editingTextId === layer.id)

  const addFont = useFontStore((s) => s.addFont)
  const removeFont = useFontStore((s) => s.removeFont)
  const customFonts = project.customFonts ?? []

  return (
    <div className="space-y-4">

      {/* ── Text styling toolbar — always visible ── */}
      <div className={`${panelSectionCls} !border-[rgba(124,110,246,0.35)]`}>
        <label className={labelCls}>✏️ Text Styling</label>
        {editingThis ? (
          // Canvas editor is active: it portals RichTextToolbar into this slot
          <div id="rich-text-toolbar-slot" />
        ) : (
          // No canvas editor: show always-functional toolbar that applies to the whole text
          <LayerTextToolbar layer={layer} />
        )}
      </div>

      {/* ── Font ── */}
      <div className={panelSectionCls}>
        <label className={labelCls}>Font</label>
        <FontPicker
          value={layer.fontFamily}
          customFonts={customFonts}
          onChange={(family) => {
            const weights = getFontWeights(family)
            const newWeight = weights.includes(layer.fontWeight)
              ? layer.fontWeight
              : weights.reduce((prev, curr) =>
                  Math.abs(curr - layer.fontWeight) < Math.abs(prev - layer.fontWeight) ? curr : prev
                )
            void ensureFontReady(family, newWeight)
            upd({ fontFamily: family, fontWeight: newWeight })
          }}
        />

        {/* Custom font upload */}
        <div className="mt-2 flex items-center gap-2">
          <label
            className="cursor-pointer text-xs px-3 py-1.5 rounded-lg border border-[rgba(255,255,255,0.1)] text-[#6b6b7a] hover:text-[#e8e8f0] hover:border-[rgba(255,255,255,0.2)] transition-colors"
            title="Upload a .ttf, .otf, or .woff2 font file"
          >
            + Upload Font
            <input
              type="file"
              accept=".ttf,.otf,.woff,.woff2"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = async () => {
                  const dataUrl = reader.result as string
                  const cssFamily = generateCustomFontFamily(file.name)
                  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'ttf'
                  const format = (['ttf', 'otf', 'woff', 'woff2'].includes(ext) ? ext : 'ttf') as CustomFontRef['format']
                  const label = file.name.replace(/\.[^.]+$/, '')
                  await loadCustomFont(cssFamily, dataUrl, format)
                  addFont(file.name, dataUrl)
                  const newRef: CustomFontRef = { family: cssFamily, label, filename: file.name, format }
                  updateProject({ customFonts: [...(project.customFonts ?? []), newRef] })
                  upd({ fontFamily: cssFamily, fontWeight: 400 })
                }
                reader.readAsDataURL(file)
                e.target.value = ''
              }}
            />
          </label>
          {customFonts.length > 0 && (
            <span className="text-xs text-[#6b6b7a]">{customFonts.length} custom</span>
          )}
        </div>

        {/* Remove custom font button — shown when a custom font is selected */}
        {customFonts.some(f => f.family === layer.fontFamily) && (
          <button
            type="button"
            className="mt-1 text-xs text-[#f87171] hover:text-[#fca5a5] transition-colors"
            onClick={() => {
              const ref = customFonts.find(f => f.family === layer.fontFamily)
              if (!ref) return
              unregisterCustomFont(ref.family)
              removeFont(ref.filename)
              updateProject({ customFonts: (project.customFonts ?? []).filter(f => f.family !== ref.family) })
              upd({ fontFamily: 'Inter', fontWeight: 400 })
            }}
          >
            Remove &ldquo;{customFonts.find(f => f.family === layer.fontFamily)?.label}&rdquo;
          </button>
        )}

        {/* Size */}
        <div className="mt-3">
          <SliderField label="Size" value={layer.fontSize} min={6} max={300} unit="px" onChange={(v) => upd({ fontSize: v })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />
        </div>

        {/* Spacing */}
        <SliderField label="Letter Spacing" value={layer.letterSpacing} min={-20} max={100} step={1} onChange={(v) => upd({ letterSpacing: v })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />
        <SliderField label="Line Height" value={layer.lineHeight} min={0.5} max={4} step={0.05} unit="×" onChange={(v) => upd({ lineHeight: v })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} className="!mb-0" />
      </div>

      {/* ── Align ── */}
      <div className={panelSectionCls}>
        <label className={labelCls}>Alignment</label>
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: 'left',   label: '⬱ Left' },
            { value: 'center', label: '≡ Center' },
            { value: 'right',  label: '⬲ Right' },
          ] as const).map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => upd({ align: item.value })}
              className={`rounded-lg border px-2 py-2 text-xs transition-colors ${
                layer.align === item.value
                  ? 'border-[#7c6ef6] bg-[#7c6ef6] text-white'
                  : 'border-[rgba(255,255,255,0.1)] text-[#6b6b7a] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#e8e8f0]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Vertical alignment — meaningful when the box has an explicit height */}
        {layer.height != null && (
          <div className="mt-3">
            <label className={labelCls}>Vertical Align</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'top',    label: '⤒ Top' },
                { value: 'middle', label: '☰ Middle' },
                { value: 'bottom', label: '⤓ Bottom' },
              ] as const).map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => upd({ verticalAlign: item.value })}
                  className={`rounded-lg border px-2 py-2 text-xs transition-colors ${
                    (layer.verticalAlign ?? 'top') === item.value
                      ? 'border-[#7c6ef6] bg-[#7c6ef6] text-white'
                      : 'border-[rgba(255,255,255,0.1)] text-[#6b6b7a] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#e8e8f0]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>


    </div>
  )
}
