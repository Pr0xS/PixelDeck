import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '@/store'
import { getProjectBaseFormat } from '@/utils/canvasFormats'
import type { Layer, GroupLayer } from '@/types'

function findLayerById(layers: Layer[], id: string): Layer | null {
  for (const layer of layers) {
    if (layer.id === id) return layer
    if (layer.type === 'group') {
      const found = findLayerById((layer as GroupLayer).children, id)
      if (found) return found
    }
  }
  return null
}

interface OverrideDotProps {
  layerId: string
  propKey: string
}

export function OverrideDot({ layerId, propKey }: OverrideDotProps) {
  const {
    project,
    activeCanvasFormat,
    activeSlideGroupId,
    clearLayerFormatOverrideKey,
    applyLayerFormatKeyToShared,
  } = useEditorStore(
    useShallow((s) => ({
      project: s.project,
      activeCanvasFormat: s.activeCanvasFormat,
      activeSlideGroupId: s.activeSlideGroupId,
      clearLayerFormatOverrideKey: s.clearLayerFormatOverrideKey,
      applyLayerFormatKeyToShared: s.applyLayerFormatKeyToShared,
    }))
  )

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const baseFormat = getProjectBaseFormat(project)
  const isBaseFormat = activeCanvasFormat === baseFormat

  const rawGroup = project.slideGroups.find((g) => g.id === activeSlideGroupId)
  const rawLayer = rawGroup ? findLayerById(rawGroup.layers, layerId) : null

  const patch = rawLayer?.formatOverrides?.[activeCanvasFormat] as Record<string, unknown> | undefined
  const hasOverride = patch !== undefined && propKey in patch

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [menuOpen])

  if (isBaseFormat || !hasOverride) return null

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        title="Format override — click to manage"
        className="text-[10px] text-[#f59e0b] cursor-pointer ml-1 leading-none hover:text-[#fbbf24] transition-colors"
        onClick={(e) => {
          e.stopPropagation()
          setMenuOpen((prev) => !prev)
        }}
      >
        ●
      </button>
      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute left-0 top-5 z-50 rounded-lg border border-[rgba(255,255,255,0.12)] bg-[#1c1c26] shadow-xl py-1 min-w-[130px]"
        >
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 text-[11px] text-[#e8e8f0] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
            onClick={() => {
              clearLayerFormatOverrideKey(layerId, propKey)
              setMenuOpen(false)
            }}
          >
            Reset to auto
          </button>
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 text-[11px] text-[#e8e8f0] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
            onClick={() => {
              applyLayerFormatKeyToShared(layerId, propKey)
              setMenuOpen(false)
            }}
          >
            Use as shared
          </button>
        </div>
      )}
    </div>
  )
}
