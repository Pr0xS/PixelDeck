import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '@/store'
import { BASE_CANVAS_FORMAT, getProjectBaseFormat, LOCALE_DELTA_FIELDS } from '@/utils/canvasFormats'
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

/**
 * Small per-property indicator + menu. P3: 3 independent visual states,
 * each resetting exactly its own cell — no more shadow/"which one wins"
 * ambiguity, since base-scoped and format-scoped `localeAdjust` cells now
 * COMPOSE instead of one shadowing the other:
 *  - amber:  `formatOverrides[activeCanvasFormat]` — a genuinely different,
 *    absolute-pin concept, unchanged from before.
 *  - violet: `localeAdjust[locale][BASE_CANVAS_FORMAT]` — shows on ANY
 *    format tab (not just Base), since it contributes to every format's
 *    resolved value via the format's scale factor.
 *  - cyan:   `localeAdjust[locale][activeCanvasFormat]` — only shown on a
 *    non-base format tab (at Base, this cell IS the violet cell).
 */
export function OverrideDot({ layerId, propKey }: OverrideDotProps) {
  const {
    project,
    activeCanvasFormat,
    activeLocale,
    activeSlideGroupId,
    clearLayerFormatOverrideKey,
    clearLayerLocaleAdjustKey,
    applyLayerFormatKeyToShared,
  } = useEditorStore(
    useShallow((s) => ({
      project: s.project,
      activeCanvasFormat: s.activeCanvasFormat,
      activeLocale: s.activeLocale,
      activeSlideGroupId: s.activeSlideGroupId,
      clearLayerFormatOverrideKey: s.clearLayerFormatOverrideKey,
      clearLayerLocaleAdjustKey: s.clearLayerLocaleAdjustKey,
      applyLayerFormatKeyToShared: s.applyLayerFormatKeyToShared,
    }))
  )

  const baseFormat = getProjectBaseFormat(project)
  const isBaseFormat = activeCanvasFormat === baseFormat
  const isDefaultLocale = activeLocale === project.settings.defaultLocale

  const rawGroup = project.slideGroups.find((g) => g.id === activeSlideGroupId)
  const rawLayer = rawGroup ? findLayerById(rawGroup.layers, layerId) : null

  const patch = rawLayer?.formatOverrides?.[activeCanvasFormat] as Record<string, unknown> | undefined
  const hasFormatOverride = !isBaseFormat && patch !== undefined && propKey in patch

  const deltaKey = LOCALE_DELTA_FIELDS[propKey as keyof typeof LOCALE_DELTA_FIELDS]
  const hasBaseAdjust = !isDefaultLocale && deltaKey !== undefined
    && rawLayer?.localeAdjust?.[activeLocale]?.[BASE_CANVAS_FORMAT]?.[deltaKey] !== undefined
  const hasFormatAdjust = !isDefaultLocale && !isBaseFormat && deltaKey !== undefined
    && rawLayer?.localeAdjust?.[activeLocale]?.[activeCanvasFormat]?.[deltaKey] !== undefined

  if (!hasFormatOverride && !hasBaseAdjust && !hasFormatAdjust) return null

  return (
    <div className="inline-flex items-center">
      {hasBaseAdjust && (
        <Dot
          color="#7c6ef6"
          hoverColor="#9d90f8"
          title="Locale base layout adjustment — click to manage"
          label="Reset base locale adjustment"
          onReset={() => {
            clearLayerLocaleAdjustKey(layerId, propKey, activeLocale, BASE_CANVAS_FORMAT)
          }}
        />
      )}
      {hasFormatAdjust && (
        <Dot
          color="#22d3ee"
          hoverColor="#67e8f9"
          title="Locale format layout adjustment — click to manage"
          label="Reset locale adjustment"
          onReset={() => {
            clearLayerLocaleAdjustKey(layerId, propKey, activeLocale, activeCanvasFormat)
          }}
        />
      )}
      {hasFormatOverride && (
        <FormatOverrideDot
          onResetToAuto={() => clearLayerFormatOverrideKey(layerId, propKey)}
          onUseAsShared={() => applyLayerFormatKeyToShared(layerId, propKey)}
        />
      )}
    </div>
  )
}

/** One clickable indicator dot with a single-action menu. */
function Dot({
  color,
  hoverColor,
  title,
  label,
  onReset,
}: {
  color: string
  hoverColor: string
  title: string
  label: string
  onReset: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        title={title}
        className="text-[10px] cursor-pointer ml-1 leading-none transition-colors"
        style={{ color }}
        onMouseEnter={(e) => { e.currentTarget.style.color = hoverColor }}
        onMouseLeave={(e) => { e.currentTarget.style.color = color }}
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
              onReset()
              setMenuOpen(false)
            }}
          >
            {label}
          </button>
        </div>
      )}
    </div>
  )
}

/** The amber format-override dot — unchanged concept, kept as its own menu shape. */
function FormatOverrideDot({
  onResetToAuto,
  onUseAsShared,
}: {
  onResetToAuto: () => void
  onUseAsShared: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        title="Format override — click to manage"
        className="text-[10px] cursor-pointer ml-1 leading-none text-[#f59e0b] hover:text-[#fbbf24] transition-colors"
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
              onResetToAuto()
              setMenuOpen(false)
            }}
          >
            Reset to auto
          </button>
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 text-[11px] text-[#e8e8f0] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
            onClick={() => {
              onUseAsShared()
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
