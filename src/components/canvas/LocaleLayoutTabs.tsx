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
      <div className="flex items-end px-3 h-9 gap-0.5">
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

      {activeLocale !== defaultLocale && (
        <div
          className="flex items-center justify-between px-3 py-1"
          style={{
            background: 'rgba(34,211,238,0.08)',
            borderBottom: '1px solid rgba(34,211,238,0.25)',
          }}
        >
          <span className="text-xs" style={{ color: '#22d3ee' }}>
            {isBaseFormat ? (
              <>🌐 <strong>{localeLabel}</strong> layout · switch to a platform tab to edit locale layout</>
            ) : (
              <>🌐 Editing <strong>{localeLabel}</strong> layout · <strong>{formatLabel}</strong> only — position &amp; size apply to {localeLabel}+{formatLabel}. Content &amp; style are shared.</>
            )}
          </span>
          {!isBaseFormat && (
            <div className="ml-4 flex shrink-0 items-center gap-2">
              <button
                onClick={() => setActiveLocale(defaultLocale)}
                className="text-xs transition-opacity hover:opacity-100"
                style={{ color: '#22d3ee', opacity: 0.7 }}
              >
                ↩ Default
              </button>
              <div className="relative" ref={actionsRef}>
                <button
                  onClick={() => setActionsOpen((open) => !open)}
                  className="rounded border border-[rgba(34,211,238,0.25)] px-2 py-0.5 text-xs transition-colors hover:bg-[rgba(34,211,238,0.12)]"
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
  )
}
