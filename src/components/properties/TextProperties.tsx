import { useState, useRef, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '@/store'
import type { TextLayer, Layer, CustomFontRef } from '@/types'
import { SliderField } from '@/components/properties/PropertyControls'
import { FONT_LIST, WEB_SAFE_FONTS, getFontWeights, generateCustomFontFamily, loadCustomFont, unregisterCustomFont } from '@/utils/fonts'
import { useFontStore } from '@/store/fontStore'
import {
  inputCls,
  labelCls,
  fieldCls,
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
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Auto-focus search when opening
  useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])

  const filteredCustom = customFonts.filter(
    (f) => !search || f.label.toLowerCase().includes(search.toLowerCase()) || f.family === value,
  )
  const filteredWebSafe = WEB_SAFE_FONTS.filter(
    (f) => !search || f.label.toLowerCase().includes(search.toLowerCase()) || f.family === value,
  )
  const filteredGoogle = FONT_LIST.filter(
    (f) => !search || f.label.toLowerCase().includes(search.toLowerCase()) || f.family === value,
  )

  const allFontsList = [...customFonts, ...FONT_LIST, ...WEB_SAFE_FONTS]
  const selectedLabel = allFontsList.find((f) => f.family === value)?.label ?? value

  const handleSelect = (family: string) => {
    onChange(family)
    setOpen(false)
    setSearch('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false)
      setSearch('')
    }
  }

  const sectionLabelCls =
    'text-[10px] text-[#4a4a5a] uppercase tracking-wider px-2 py-1 select-none'
  const itemBaseCls =
    'w-full text-left px-3 py-1.5 text-sm text-[#e8e8f0] hover:bg-[rgba(255,255,255,0.05)] transition-colors rounded'
  const itemSelectedCls = 'bg-[rgba(124,110,246,0.15)] !text-[#c4b5fd]'

  const noResults =
    filteredCustom.length === 0 && filteredWebSafe.length === 0 && filteredGoogle.length === 0

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
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search fonts…"
              className={`${inputCls} text-xs`}
            />
          </div>

          {/* Scrollable font list */}
          <div className="max-h-60 overflow-y-auto py-1">
            {/* My Fonts */}
            {filteredCustom.length > 0 && (
              <>
                <div className={sectionLabelCls}>My Fonts</div>
                {filteredCustom.map((f) => (
                  <button
                    key={f.family}
                    type="button"
                    onClick={() => handleSelect(f.family)}
                    className={`${itemBaseCls} ${f.family === value ? itemSelectedCls : ''}`}
                    style={{ fontFamily: f.family }}
                  >
                    {f.label}
                  </button>
                ))}
              </>
            )}

            {/* Web Safe */}
            {filteredWebSafe.length > 0 && (
              <>
                <div className={sectionLabelCls}>Web Safe</div>
                {filteredWebSafe.map((f) => (
                  <button
                    key={f.family}
                    type="button"
                    onClick={() => handleSelect(f.family)}
                    className={`${itemBaseCls} ${f.family === value ? itemSelectedCls : ''}`}
                    style={{ fontFamily: f.family }}
                  >
                    {f.label}
                  </button>
                ))}
              </>
            )}

            {/* Google Fonts */}
            {filteredGoogle.length > 0 && (
              <>
                <div className={sectionLabelCls}>Google Fonts</div>
                {filteredGoogle.map((f) => (
                  <button
                    key={f.family}
                    type="button"
                    onClick={() => handleSelect(f.family)}
                    className={`${itemBaseCls} ${f.family === value ? itemSelectedCls : ''}`}
                    style={{ fontFamily: f.family }}
                  >
                    {f.label}
                  </button>
                ))}
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
  const { updateLayer, project, activeSlideGroupId, updateProject } = useEditorStore(
    useShallow((s) => ({
      updateLayer: s.updateLayer,
      project: s.project,
      activeSlideGroupId: s.activeSlideGroupId,
      updateProject: s.updateProject,
    }))
  )
  const upd = (patch: Partial<TextLayer>) => updateLayer(layer.id, patch as Partial<Layer>)
  const editingThis = useEditorStore((s) => s.editingTextId === layer.id)

  const addFont = useFontStore((s) => s.addFont)
  const removeFont = useFontStore((s) => s.removeFont)
  const customFonts = project.customFonts ?? []

  const availableWeights = getFontWeights(layer.fontFamily)

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

        {/* Size + Weight */}
        <div className="mt-3">
          <SliderField label="Size" value={layer.fontSize} min={6} max={300} unit="px" onChange={(v) => upd({ fontSize: v })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />
          <div className={fieldCls}>
            <label className={labelCls}>Weight</label>
            <select
              value={layer.fontWeight}
              onChange={(e) => upd({ fontWeight: Number(e.target.value) })}
              className={inputCls}
            >
              {availableWeights.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>
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

      {/* ── Placement presets ── */}
      {(() => {
        const activeGroup = project.slideGroups.find((g) => g.id === activeSlideGroupId)
        if (!activeGroup) return null
        const { slideWidth, slideHeight, numSlides } = activeGroup

        const lineCount = layer.text.split('\n').length
        const blockHeight = layer.height ?? lineCount * layer.fontSize * layer.lineHeight

        const centerX = layer.x + (layer.width ?? 0) / 2
        const slideIndex = Math.min(Math.max(Math.floor(centerX / slideWidth), 0), numSlides - 1)
        const slideOffsetX = slideIndex * slideWidth

        const margin = Math.round(slideHeight * 0.06)
        const xPatch = layer.width != null
          ? { x: slideOffsetX + (slideWidth - layer.width) / 2 }
          : {}

        const presets = [
          { label: '⤒ Top',    patch: { ...xPatch, y: margin } },
          { label: '☰ Middle', patch: { ...xPatch, y: Math.round((slideHeight - blockHeight) / 2) } },
          { label: '⤓ Bottom', patch: { ...xPatch, y: Math.round(slideHeight - margin - blockHeight) } },
        ]

        return (
          <div className={panelSectionCls}>
            <label className={labelCls}>Placement</label>
            <div className="grid grid-cols-3 gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => upd(preset.patch as Partial<TextLayer>)}
                  className="rounded-lg border border-[rgba(255,255,255,0.1)] px-2 py-2 text-xs text-[#6b6b7a] hover:border-[rgba(124,110,246,0.5)] hover:text-[#e8e8f0] hover:bg-[rgba(255,255,255,0.04)] transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {layer.width == null && (
              <p className="mt-2 text-[10px] text-[#525261]">Auto-width text: presets adjust vertical position only.</p>
            )}
          </div>
        )
      })()}

    </div>
  )
}
