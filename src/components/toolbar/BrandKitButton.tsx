import { useState, useRef, useEffect } from 'react'
import { useEditorStore } from '@/store'
import type { BrandColor } from '@/types'

const inputCls = 'bg-[#0f0f13] border border-[rgba(255,255,255,0.1)] rounded px-2 py-1 text-sm text-[#e8e8f0] w-full focus:outline-none focus:border-[rgba(124,110,246,0.5)]'

export function BrandKitButton() {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newValue, setNewValue] = useState('#FF5A5F')
  const [adding, setAdding] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const brandColors = useEditorStore((s) => s.project.settings.brandColors) ?? []
  const { addBrandColor, updateBrandColor, removeBrandColor } = useEditorStore()

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        !popoverRef.current?.contains(e.target as Node) &&
        !buttonRef.current?.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleAdd = () => {
    if (!newName.trim()) return
    addBrandColor(newName.trim(), newValue)
    setNewName('')
    setNewValue('#FF5A5F')
    setAdding(false)
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Brand Kit — manage project colors"
        style={{
          background: open ? 'rgba(124,110,246,0.15)' : 'none',
          border: open ? '1px solid rgba(124,110,246,0.5)' : '1px solid rgba(255,255,255,0.1)',
          borderRadius: 6,
          color: open ? '#c4b5fd' : '#a0a0b0',
          cursor: 'pointer',
          fontSize: 12,
          padding: '3px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          whiteSpace: 'nowrap',
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => {
          if (open) return
          ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.25)'
          ;(e.currentTarget as HTMLButtonElement).style.color = '#e8e8f0'
        }}
        onMouseLeave={(e) => {
          if (open) return
          ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.1)'
          ;(e.currentTarget as HTMLButtonElement).style.color = '#a0a0b0'
        }}
      >
        {/* Palette indicator — up to 3 color dots */}
        {brandColors.length > 0 ? (
          <span className="flex gap-0.5">
            {brandColors.slice(0, 3).map((c: BrandColor) => (
              <span
                key={c.id}
                className="w-3 h-3 rounded-full border border-[rgba(255,255,255,0.2)]"
                style={{ background: c.value }}
              />
            ))}
          </span>
        ) : (
          <span>🎨</span>
        )}
        Brand Kit
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute top-full left-0 mt-1 z-50 w-72 rounded-xl border border-[rgba(255,255,255,0.1)] bg-[#18181f] shadow-2xl p-3"
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}
        >
          {/* Header */}
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#6b6b7a]">Brand Colors</span>
              <button
                type="button"
                onClick={() => { setAdding((v) => !v); setEditingId(null) }}
                className="text-xs text-[#7c6ef6] hover:text-[#9d90f8] transition-colors"
              >
                {adding ? '✕' : '＋ Add'}
              </button>
            </div>
            <p className="text-[11px] text-[#4a4a5a] leading-relaxed">
              Reusable colors for this project. Apply them in any color field — edit one here and every layer updates automatically.
            </p>
          </div>

          {/* Add form */}
          {adding && (
            <div className="mb-3 space-y-2 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#0f0f13] p-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
                placeholder="Name (e.g. Primary)"
                autoFocus
                className={inputCls}
              />
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="h-8 w-8 rounded-md cursor-pointer border border-[rgba(255,255,255,0.1)] bg-transparent shrink-0"
                />
                <input
                  type="text"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className={`${inputCls} flex-1`}
                />
              </div>
              <button
                type="button"
                onClick={handleAdd}
                className="w-full text-xs text-[#7c6ef6] border border-[rgba(124,110,246,0.4)] rounded py-1.5 hover:bg-[rgba(124,110,246,0.15)] transition-colors"
              >
                Add Color
              </button>
            </div>
          )}

          {/* Color list */}
          {brandColors.length === 0 && !adding && (
            <p className="text-xs text-[#4a4a5a] py-1">No colors yet. Click ＋ Add to create your first brand color.</p>
          )}

          <div className="space-y-1">
            {brandColors.map((bc: BrandColor) => (
              <div key={bc.id}>
                <div
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[rgba(255,255,255,0.04)] cursor-pointer transition-colors"
                  onClick={() => setEditingId(editingId === bc.id ? null : bc.id)}
                >
                  <div
                    className="w-5 h-5 rounded-full border border-[rgba(255,255,255,0.2)] shrink-0"
                    style={{ background: bc.value }}
                  />
                  <span className="text-xs text-[#e8e8f0] flex-1 truncate">{bc.name}</span>
                  <span className="text-[10px] text-[#4a4a5a] font-mono">{bc.value.toUpperCase()}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeBrandColor(bc.id) }}
                    className="text-xs text-[#4a4a5a] hover:text-[#f87171] transition-colors shrink-0 ml-1"
                    aria-label={`Delete brand color ${bc.name}`}
                  >
                    ✕
                  </button>
                </div>
                {editingId === bc.id && (
                  <div className="mb-1 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#0f0f13] p-2 space-y-2">
                    <input
                      type="text"
                      value={bc.name}
                      onChange={(e) => updateBrandColor(bc.id, { name: e.target.value })}
                      placeholder="Name"
                      autoFocus
                      className={inputCls}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={bc.value}
                        onChange={(e) => updateBrandColor(bc.id, { value: e.target.value })}
                        className="h-8 w-8 rounded-md cursor-pointer border border-[rgba(255,255,255,0.1)] bg-transparent shrink-0"
                      />
                      <input
                        type="text"
                        value={bc.value}
                        onChange={(e) => updateBrandColor(bc.id, { value: e.target.value })}
                        className={`${inputCls} flex-1`}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
