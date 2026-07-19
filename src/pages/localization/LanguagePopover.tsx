import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { RefObject } from 'react'
import { LANGUAGES } from '@/utils/locale'

// ─── Language Combobox ────────────────────────────────────────────────────────

function LanguageCombobox({
  existingLocales,
  allowSelectingExisting = false,
  onAdd,
  onCancel,
}: {
  existingLocales: string[]
  allowSelectingExisting?: boolean
  onAdd: (code: string) => void
  onCancel: () => void
}) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return LANGUAGES.slice(0, 20)
    return LANGUAGES.filter(
      (l) => l.name.toLowerCase().includes(q) || l.code.includes(q),
    ).slice(0, 20)
  }, [query])

  const customCodeValid = useMemo(() => {
    const q = query.trim().toLowerCase().replace('_', '-')
    if (!q) return null
    if (!/^[a-z]{2,3}(-[a-z0-9]{2,4})?$/.test(q)) return null
    if (LANGUAGES.some((l) => l.code === q)) return null // already in list
    return q
  }, [query])

  const handleSelect = (code: string) => {
    const normalized = code.trim().toLowerCase().replace('_', '-')
    if (existingLocales.includes(normalized) && !allowSelectingExisting) return
    onAdd(normalized)
  }

  return (
    <div className="relative z-50 w-72 rounded-2xl border border-white/12 bg-[#1a1a24] shadow-2xl">
      <div className="p-2 border-b border-white/8">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onCancel()
            if (e.key === 'Enter' && filtered.length > 0) handleSelect(filtered[0].code)
            if (e.key === 'Enter' && filtered.length === 0 && customCodeValid) handleSelect(customCodeValid)
          }}
          placeholder="Search language or type code…"
          className="w-full rounded-lg border border-white/10 bg-[#0f0f13] px-3 py-2 text-sm text-white outline-none placeholder:text-[#6b6b7a] focus:border-[#7c6ef6]"
        />
      </div>
      <div className="max-h-56 overflow-y-auto py-1">
        {filtered.map((lang) => {
          const already = existingLocales.includes(lang.code)
          const disabled = already && !allowSelectingExisting
          return (
            <button
              key={lang.code}
              type="button"
              disabled={disabled}
              onClick={() => handleSelect(lang.code)}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition ${
                disabled
                  ? 'cursor-default text-[#4a4a5a]'
                  : already
                    ? 'text-[#d9d9e6] hover:bg-[#7c6ef6]/10 hover:text-white'
                  : 'text-[#d9d9e6] hover:bg-white/6 hover:text-white'
              }`}
            >
              <span>{lang.name}</span>
              <span className={`text-xs font-mono ${disabled ? 'text-[#3a3a4a]' : already ? 'text-[#9d90f8]' : 'text-[#6b6b7a]'}`}>
                {already ? '✓ ' : ''}{lang.code}
              </span>
            </button>
          )
        })}
        {customCodeValid && (
          <button
            type="button"
            onClick={() => handleSelect(customCodeValid)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#9d90f8] hover:bg-[#7c6ef6]/10 hover:text-white transition"
          >
            <span className="text-[#7c6ef6]">＋</span>
            Use custom code: <span className="font-mono">{customCodeValid}</span>
          </button>
        )}
        {filtered.length === 0 && !customCodeValid && (
          <div className="px-3 py-4 text-center text-xs text-[#6b6b7a]">
            No languages found. Type a valid locale code (e.g. <span className="font-mono">xx</span> or <span className="font-mono">xx-yy</span>).
          </div>
        )}
      </div>
      <div className="border-t border-white/8 p-2">
        <button
          type="button"
          onClick={onCancel}
          className="w-full rounded-lg px-3 py-1.5 text-xs text-[#6b6b7a] hover:text-white transition"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Language Popover ────────────────────────────────────────────────────────

export interface LanguagePopoverProps {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  existingLocales: string[]
  note?: string
  allowSelectingExisting?: boolean
  onAdd: (code: string) => void
  onCancel: () => void
}

export function LanguagePopover({
  open,
  anchorRef,
  existingLocales,
  note,
  allowSelectingExisting = false,
  onAdd,
  onCancel,
}: LanguagePopoverProps) {
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => {
    if (!open) return

    const updatePosition = () => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (!rect) return

      const width = 288 // w-72
      const estimatedHeight = note ? 430 : 360
      const margin = 12
      const left = Math.min(
        Math.max(margin, rect.left),
        Math.max(margin, window.innerWidth - width - margin),
      )
      const below = rect.bottom + 8
      const top = below + estimatedHeight > window.innerHeight - margin
        ? Math.max(margin, rect.top - estimatedHeight - 8)
        : below

      setPosition({ left, top })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [anchorRef, note, open])

  if (!open || !position || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[100]" onMouseDown={onCancel}>
      <div
        className="fixed"
        style={{ left: position.left, top: position.top }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <LanguageCombobox
          existingLocales={existingLocales}
          allowSelectingExisting={allowSelectingExisting}
          onAdd={onAdd}
          onCancel={onCancel}
        />
        {note && (
          <div className="mt-2 w-72 rounded-xl border border-white/8 bg-[#111118] px-3 py-2 text-[10px] leading-relaxed text-[#7f8094] shadow-xl">
            {note}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
