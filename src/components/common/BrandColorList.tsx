import { useState } from 'react'
import { useEditorStore } from '@/store'
import { useBrandColors } from '@/hooks/useBrandColors'
import type { BrandColor } from '@/types'

const inputCls = 'bg-[#0f0f13] border border-[rgba(255,255,255,0.1)] rounded px-2 py-1 text-sm text-[#e8e8f0] w-full focus:outline-none focus:border-[rgba(124,110,246,0.5)]'

interface BrandColorListProps {
  /** If true, shows a compact layout suitable for popovers/toolbars */
  compact?: boolean
}

export function BrandColorList({ compact = false }: BrandColorListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newValue, setNewValue] = useState('#FF5A5F')
  const [adding, setAdding] = useState(false)

  const brandColors = useBrandColors()
  const addBrandColor = useEditorStore((s) => s.addBrandColor)
  const updateBrandColor = useEditorStore((s) => s.updateBrandColor)
  const removeBrandColor = useEditorStore((s) => s.removeBrandColor)

  const handleAdd = () => {
    if (!newName.trim()) return
    addBrandColor(newName.trim(), newValue)
    setNewName('')
    setNewValue('#FF5A5F')
    setAdding(false)
  }

  return (
    <div>
      {/* Header with Add button */}
      <div className="flex items-center justify-between mb-2">
        {!compact && (
          <span className={`text-xs font-semibold uppercase tracking-wider text-[#6b6b7a]`}>
            Brand Colors
          </span>
        )}
        <button
          type="button"
          onClick={() => { setAdding((v) => !v); setEditingId(null) }}
          className={`text-xs text-[#7c6ef6] hover:text-[#9d90f8] transition-colors ${compact ? '' : 'ml-auto'}`}
        >
          {adding ? '✕' : '＋ Add'}
        </button>
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

      {/* Empty state */}
      {brandColors.length === 0 && !adding && (
        <p className="text-xs text-[#4a4a5a] py-1">
          No colors yet. Click ＋ Add to create your first brand color.
        </p>
      )}

      {/* Color list */}
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
  )
}
