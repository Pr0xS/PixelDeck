import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '@/store'
import { getProjectBaseFormat, LOCALE_DELTA_FIELDS } from '@/utils/canvasFormats'
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
    activeLocale,
    activeSlideGroupId,
    clearLayerFormatOverrideKey,
    clearLayerLocaleFormatOverrideKey,
    clearLayerLocaleBaseDeltaKey,
    applyLayerFormatKeyToShared,
  } = useEditorStore(
    useShallow((s) => ({
      project: s.project,
      activeCanvasFormat: s.activeCanvasFormat,
      activeLocale: s.activeLocale,
      activeSlideGroupId: s.activeSlideGroupId,
      clearLayerFormatOverrideKey: s.clearLayerFormatOverrideKey,
      clearLayerLocaleFormatOverrideKey: s.clearLayerLocaleFormatOverrideKey,
      clearLayerLocaleBaseDeltaKey: s.clearLayerLocaleBaseDeltaKey,
      applyLayerFormatKeyToShared: s.applyLayerFormatKeyToShared,
    }))
  )

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const baseFormat = getProjectBaseFormat(project)
  const isBaseFormat = activeCanvasFormat === baseFormat
  const isDefaultLocale = activeLocale === project.settings.defaultLocale

  const rawGroup = project.slideGroups.find((g) => g.id === activeSlideGroupId)
  const rawLayer = rawGroup ? findLayerById(rawGroup.layers, layerId) : null

  const patch = rawLayer?.formatOverrides?.[activeCanvasFormat] as Record<string, unknown> | undefined
  const hasOverride = patch !== undefined && propKey in patch
  const localePatch = rawLayer?.localeLayoutOverrides?.[activeLocale]?.[activeCanvasFormat] as Record<string, unknown> | undefined
  const hasLocaleOverride = localePatch !== undefined && propKey in localePatch
  const deltaKey = LOCALE_DELTA_FIELDS[propKey as keyof typeof LOCALE_DELTA_FIELDS]
  const hasLocaleBaseDelta = deltaKey !== undefined && rawLayer?.localeBaseDelta?.[activeLocale]?.[deltaKey] !== undefined

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

  const showLocaleOverride = !isBaseFormat && !isDefaultLocale && hasLocaleOverride
  const showLocaleBaseDelta = isBaseFormat && !isDefaultLocale && hasLocaleBaseDelta
  const localeOverrideShadowsBaseDelta = showLocaleOverride && hasLocaleBaseDelta

  if ((!isBaseFormat && !hasOverride && !showLocaleOverride) || (isBaseFormat && !showLocaleBaseDelta)) return null

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        title={showLocaleBaseDelta ? 'Locale layout adjustment — click to manage' : showLocaleOverride ? 'Locale layout override — click to manage' : 'Format override — click to manage'}
        className={`text-[10px] cursor-pointer ml-1 leading-none transition-colors ${
          showLocaleBaseDelta
            ? 'text-[#7c6ef6] hover:text-[#9d90f8]'
            : showLocaleOverride
              ? 'text-[#22d3ee] hover:text-[#67e8f9]'
              : 'text-[#f59e0b] hover:text-[#fbbf24]'
        } ${
          localeOverrideShadowsBaseDelta ? 'rounded-full ring-1 ring-[#7c6ef6]' : ''
        }`}
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
          {showLocaleBaseDelta ? (
            <button
              type="button"
              className="w-full text-left px-3 py-1.5 text-[11px] text-[#e8e8f0] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
              onClick={() => {
                clearLayerLocaleBaseDeltaKey(layerId, propKey, activeLocale)
                setMenuOpen(false)
              }}
            >
              Reset locale adjustment
            </button>
          ) : showLocaleOverride ? (
            <>
            <button
              type="button"
              className="w-full text-left px-3 py-1.5 text-[11px] text-[#e8e8f0] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
              onClick={() => {
                clearLayerLocaleFormatOverrideKey(layerId, propKey)
                setMenuOpen(false)
              }}
            >
              Reset locale adjustment
            </button>
            {localeOverrideShadowsBaseDelta && (
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 text-[11px] text-[#e8e8f0] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
                onClick={() => {
                  clearLayerLocaleBaseDeltaKey(layerId, propKey, activeLocale)
                  setMenuOpen(false)
                }}
              >
                Clear base locale adjustment
              </button>
            )}
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      )}
    </div>
  )
}
