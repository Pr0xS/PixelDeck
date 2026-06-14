import { useState, useRef, useEffect } from 'react'
import { useEditorStore } from '@/store'
import { BrandColorList } from '@/components/common/BrandColorList'
import type { BrandColor } from '@/types'

export function BrandKitButton() {
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const brandColors = useEditorStore((s) => s.project.settings.brandColors) ?? []

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
          <div className="mb-2">
            <p className="text-[11px] text-[#4a4a5a] leading-relaxed">
              Reusable colors for this project. Apply them in any color field — edit one here and every layer updates automatically.
            </p>
          </div>
          <BrandColorList compact />
        </div>
      )}
    </div>
  )
}
