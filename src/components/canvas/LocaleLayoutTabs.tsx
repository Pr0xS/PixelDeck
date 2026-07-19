import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '@/store'
import {
  countLocaleFormatAdjustments,
  getFormatLabel,
  getProjectBaseFormat,
} from '@/utils/canvasFormats'
import { getLanguageName } from '@/utils/locale'

export function LocaleLayoutTabs() {
  const {
    project,
    activeSlideGroupId,
    activeLocale,
    activeCanvasFormat,
    setActiveLocale,
    resetActiveLocaleFormatLayout,
  } = useEditorStore(
    useShallow((s) => ({
      project: s.project,
      activeSlideGroupId: s.activeSlideGroupId,
      activeLocale: s.activeLocale,
      activeCanvasFormat: s.activeCanvasFormat,
      setActiveLocale: s.setActiveLocale,
      resetActiveLocaleFormatLayout: s.resetActiveLocaleFormatLayout,
    })),
  )
  const [actionsOpen, setActionsOpen] = useState(false)
  const actionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!actionsOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
        setActionsOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [actionsOpen])

  const defaultLocale = project.settings.defaultLocale
  const locales = project.settings.locales ?? [defaultLocale]
  if (locales.length <= 1) return null

  const baseFormat = getProjectBaseFormat(project)
  const isBaseFormat = activeCanvasFormat === baseFormat
  const activeGroup = project.slideGroups.find((group) => group.id === activeSlideGroupId)
  const localeLabel = getLanguageName(activeLocale)
  const formatLabel = getFormatLabel(activeCanvasFormat, project.settings.customFormats)

  const handleReset = () => {
    const ok = window.confirm(
      `Reset all locale-specific layout adjustments for ${localeLabel} on ${formatLabel}? This cannot be undone.`,
    )
    if (!ok) return
    resetActiveLocaleFormatLayout()
    setActionsOpen(false)
  }

  return (
    <div className="shrink-0 bg-[#18181f] border-b border-[rgba(255,255,255,0.06)]">
      <div className="flex h-10 min-w-0 items-stretch pl-3">
        {/* Locale axis and tabs */}
        <div className="flex min-w-0 flex-1 items-end gap-0.5">
          <span className="mr-1 self-center text-[9px] font-semibold uppercase tracking-[0.16em] text-[#565664]">
            Locale
          </span>
          <button
            onClick={() => setActiveLocale(defaultLocale)}
            style={{
              borderBottom: activeLocale === defaultLocale ? '2px solid #22d3ee' : '2px solid transparent',
              color: activeLocale === defaultLocale ? '#ffffff' : undefined,
            }}
            className={`flex items-center gap-1 px-3 h-full text-xs font-medium transition-colors whitespace-nowrap ${
              activeLocale === defaultLocale ? '' : 'text-[#6b6b7a] hover:text-[#e8e8f0]'
            }`}
            title={`Default locale · ${getLanguageName(defaultLocale)}`}
          >
            Default
          </button>

          {locales.filter((locale) => locale !== defaultLocale).map((locale) => {
            const isActive = activeLocale === locale
            const count = activeGroup && !isBaseFormat
              ? countLocaleFormatAdjustments(
                  activeGroup,
                  locale,
                  activeCanvasFormat,
                  defaultLocale,
                  baseFormat,
                )
              : 0
            const label = getLanguageName(locale)
            return (
              <button
                key={locale}
                onClick={() => setActiveLocale(locale)}
                style={{
                  borderBottom: isActive ? '2px solid #22d3ee' : '2px solid transparent',
                  color: isActive ? '#ffffff' : undefined,
                }}
                className={`flex items-center gap-1 px-3 h-full text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive ? '' : 'text-[#6b6b7a] hover:text-[#e8e8f0]'
                }`}
                title={`${label} locale · ${count} locale layout adjustment${count !== 1 ? 's' : ''}`}
              >
                {label}
                {count > 0 && (
                  <span className="ml-0.5 text-[10px] font-semibold" style={{ color: '#22d3ee' }}>
                    ●{count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Locale scope appears only outside the default locale, as before. */}
        {activeLocale !== defaultLocale && (
          <div
            className="ml-auto flex shrink-0 items-center gap-3 border-l px-3"
            style={{
              background: 'rgba(34,211,238,0.08)',
              borderColor: 'rgba(34,211,238,0.25)',
            }}
            title={isBaseFormat
              ? `${localeLabel} layout — switch to a platform tab to edit locale-specific layout.`
              : `${localeLabel} × ${formatLabel} — position and size apply only to this locale and format. Content and style are shared.`}
          >
            <div className="flex items-center gap-2 whitespace-nowrap text-[11px]" style={{ color: '#22d3ee' }}>
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#22d3ee] shadow-[0_0_8px_rgba(34,211,238,0.55)]" />
              {isBaseFormat ? (
                <>
                  <strong>{localeLabel} layout</strong>
                  <span className="text-[rgba(34,211,238,0.68)]">·</span>
                  <span>Choose a platform to edit locale layout</span>
                </>
              ) : (
                <>
                  <strong>{localeLabel} × {formatLabel}</strong>
                  <span className="text-[rgba(34,211,238,0.68)]">·</span>
                  <span>Position &amp; size scoped</span>
                  <span className="text-[rgba(34,211,238,0.68)]">·</span>
                  <span>Content &amp; style shared</span>
                </>
              )}
            </div>
            {!isBaseFormat && (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => setActiveLocale(defaultLocale)}
                  className="whitespace-nowrap text-[11px] transition-opacity hover:opacity-100"
                  style={{ color: '#22d3ee', opacity: 0.7 }}
                >
                  ↩ Default
                </button>
                <div className="relative" ref={actionsRef}>
                  <button
                    onClick={() => setActionsOpen((open) => !open)}
                    className="rounded border border-[rgba(34,211,238,0.25)] px-2 py-0.5 text-[11px] transition-colors hover:bg-[rgba(34,211,238,0.12)]"
                    style={{ color: '#22d3ee' }}
                  >
                    Actions ▾
                  </button>
                  {actionsOpen && (
                    <div className="absolute right-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-lg border border-[rgba(255,255,255,0.12)] bg-[#1c1c26] shadow-xl">
                      <button
                        className="w-full px-3 py-2 text-left text-[11px] text-[#e8e8f0] transition-colors hover:bg-[rgba(255,255,255,0.06)]"
                        onClick={handleReset}
                      >
                        Reset {localeLabel} {formatLabel} layout
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
