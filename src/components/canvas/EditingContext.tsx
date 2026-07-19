import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '@/store'
import type { CanvasFormatId } from '@/types'
import {
  BASE_CANVAS_FORMAT,
  CANVAS_FORMAT_PRESETS,
  countFormatAdjustments,
  countLocaleFormatAdjustments,
  getFormatLabel,
  getProjectActiveFormats,
  getProjectBaseFormat,
  isCustomFormatId,
} from '@/utils/canvasFormats'
import { getLanguageName } from '@/utils/locale'

function useDismissOnOutsideClick(
  open: boolean,
  ref: React.RefObject<HTMLDivElement | null>,
  close: () => void,
) {
  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) close()
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open, ref, close])
}

/** The two editing axes share one piece of persistent editor chrome. */
export function EditingContextBar() {
  const {
    settings,
    slideGroups,
    activeSlideGroupId,
    activeCanvasFormat,
    activeLocale,
    setActiveCanvasFormat,
    setActiveLocale,
    toggleActiveFormat,
    addCustomFormat,
    removeCustomFormat,
  } = useEditorStore(
    useShallow((state) => ({
      settings: state.project.settings,
      slideGroups: state.project.slideGroups,
      activeSlideGroupId: state.activeSlideGroupId,
      activeCanvasFormat: state.activeCanvasFormat,
      activeLocale: state.activeLocale,
      setActiveCanvasFormat: state.setActiveCanvasFormat,
      setActiveLocale: state.setActiveLocale,
      toggleActiveFormat: state.toggleActiveFormat,
      addCustomFormat: state.addCustomFormat,
      removeCustomFormat: state.removeCustomFormat,
    })),
  )
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customLabel, setCustomLabel] = useState('')
  const [customW, setCustomW] = useState('')
  const [customH, setCustomH] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  useDismissOnOutsideClick(dropdownOpen, dropdownRef, () => setDropdownOpen(false))

  const baseFormat = getProjectBaseFormat({ settings })
  const activeFormats: CanvasFormatId[] = getProjectActiveFormats({ settings })
  const platformFormats = activeFormats.filter((format) => format !== BASE_CANVAS_FORMAT)
  const inactiveFormats = CANVAS_FORMAT_PRESETS.filter(
    (format) => format.id !== baseFormat && !activeFormats.includes(format.id as CanvasFormatId),
  )
  const rawGroup = slideGroups.find((group) => group.id === activeSlideGroupId)
  const defaultLocale = settings.defaultLocale
  const locales = settings.locales ?? [defaultLocale]
  const hasMultipleLocales = locales.length > 1

  const handleToggleAdd = (id: CanvasFormatId) => {
    toggleActiveFormat(id)
    setActiveCanvasFormat(id)
    setDropdownOpen(false)
  }

  const handleRemoveFormat = (id: CanvasFormatId, event: React.MouseEvent) => {
    event.stopPropagation()
    if (isCustomFormatId(id)) removeCustomFormat(id)
    else toggleActiveFormat(id)
    if (activeCanvasFormat === id) setActiveCanvasFormat(baseFormat)
  }

  const clearCustomForm = () => {
    setShowCustomInput(false)
    setCustomLabel('')
    setCustomW('')
    setCustomH('')
  }

  const tabClass = (active: boolean) =>
    `flex h-full shrink-0 items-center gap-1 whitespace-nowrap px-2.5 text-[11px] font-medium transition-colors ${
      active ? 'text-white' : 'text-[#6b6b7a] hover:text-[#e8e8f0]'
    }`

  return (
    <div className="relative z-20 h-11 shrink-0 border-b border-[rgba(255,255,255,0.07)] bg-[#18181f] px-3">
      <div className="flex h-full min-w-0 items-stretch">
        <section className="flex min-w-0 flex-1 items-stretch" aria-label="Canvas format">
          <div className="mr-1.5 flex shrink-0 items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b] shadow-[0_0_7px_rgba(245,158,11,0.35)]" />
            <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#6b6254]">Format</span>
          </div>
          <div className="flex min-w-0 items-stretch">
            <button
              onClick={() => setActiveCanvasFormat(baseFormat)}
              className={tabClass(activeCanvasFormat === baseFormat)}
              style={{ borderBottom: activeCanvasFormat === baseFormat ? '2px solid #f59e0b' : '2px solid transparent' }}
              title="Base canvas — shared content, always exported"
            >
              Base
            </button>
            {platformFormats.map((formatId) => {
              const isActive = activeCanvasFormat === formatId
              const count = rawGroup ? countFormatAdjustments(rawGroup, formatId, baseFormat) : 0
              const label = getFormatLabel(formatId, settings.customFormats)
              return (
                <div key={formatId} className="group/tab flex h-full shrink-0 items-stretch">
                  <button
                    onClick={() => setActiveCanvasFormat(formatId)}
                    className={`${tabClass(isActive)} pr-1`}
                    style={{ borderBottom: isActive ? '2px solid #f59e0b' : '2px solid transparent' }}
                    title={`${label} format · ${count} layout adjustment${count !== 1 ? 's' : ''}`}
                  >
                    {label}
                    {count > 0 && <span className="text-[9px] font-bold text-[#fbbf24]">●{count}</span>}
                  </button>
                  <button
                    onClick={(event) => handleRemoveFormat(formatId, event)}
                    className="my-auto mr-0.5 flex h-4 w-4 items-center justify-center rounded text-[10px] leading-none text-[#6b6b7a] opacity-0 transition-all hover:bg-[rgba(255,255,255,0.08)] hover:text-[#e8e8f0] group-hover/tab:opacity-100"
                    title={`Remove ${label} tab`}
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>

          <div className="relative ml-1 self-center" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((open) => !open)}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-sm text-[#6b6b7a] transition-colors hover:border-[rgba(245,158,11,0.18)] hover:bg-[rgba(245,158,11,0.07)] hover:text-[#fbbf24]"
              title="Add platform format"
            >
              +
            </button>
            {dropdownOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 min-w-[176px] overflow-hidden rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#1e1e2a] shadow-xl">
                {inactiveFormats.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-[#6b6b7a]">All presets active</p>
                ) : inactiveFormats.map((format) => (
                  <button
                    key={format.id}
                    onClick={() => handleToggleAdd(format.id as CanvasFormatId)}
                    className="w-full px-3 py-2 text-left text-xs text-[#a0a0b0] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[#e8e8f0]"
                  >
                    {getFormatLabel(format.id as CanvasFormatId, settings.customFormats)}
                    <span className="ml-1.5 text-[10px] opacity-50">{format.width}×{format.height}</span>
                  </button>
                ))}
                <div className="mx-2 my-1 h-px bg-[rgba(255,255,255,0.08)]" />
                <button
                  onClick={() => { setShowCustomInput(true); setDropdownOpen(false) }}
                  className="w-full px-3 py-2 text-left text-xs text-[#a0a0b0] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[#e8e8f0]"
                >
                  Custom size…
                </button>
              </div>
            )}
            {showCustomInput && (
              <div className="absolute left-0 top-full z-50 mt-1 min-w-[210px] rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#1e1e2a] p-3 shadow-xl">
                <p className="mb-2 text-[10px] text-[#6b6b7a]">Custom canvas format</p>
                <input
                  type="text"
                  placeholder="Label (optional)"
                  value={customLabel}
                  onChange={(event) => setCustomLabel(event.target.value)}
                  className="mb-2 w-full rounded border border-[rgba(255,255,255,0.1)] bg-[#0f0f13] px-2 py-1 text-xs text-[#e8e8f0] focus:outline-none"
                />
                <div className="mb-2 flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="W"
                    value={customW}
                    onChange={(event) => setCustomW(event.target.value)}
                    className="w-20 rounded border border-[rgba(255,255,255,0.1)] bg-[#0f0f13] px-2 py-1 text-xs text-[#e8e8f0] [appearance:textfield] focus:outline-none"
                  />
                  <span className="text-xs text-[#6b6b7a]">×</span>
                  <input
                    type="number"
                    placeholder="H"
                    value={customH}
                    onChange={(event) => setCustomH(event.target.value)}
                    className="w-20 rounded border border-[rgba(255,255,255,0.1)] bg-[#0f0f13] px-2 py-1 text-xs text-[#e8e8f0] [appearance:textfield] focus:outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const width = parseInt(customW)
                      const height = parseInt(customH)
                      if (width >= 100 && width <= 9999 && height >= 100 && height <= 9999) {
                        addCustomFormat(customLabel.trim() || `Custom ${width}×${height}`, width, height)
                      }
                      clearCustomForm()
                    }}
                    className="flex-1 rounded bg-[#7c6ef6] px-2 py-1 text-xs text-white hover:bg-[#6c5ed6]"
                  >
                    Apply
                  </button>
                  <button onClick={clearCustomForm} className="px-2 py-1 text-xs text-[#6b6b7a] hover:text-[#e8e8f0]">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </section>

        {hasMultipleLocales && (
          <section className="ml-3 flex min-w-0 flex-1 items-stretch border-l border-[rgba(255,255,255,0.08)] pl-3" aria-label="Editing locale">
            <div className="mr-1.5 flex shrink-0 items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#22d3c5] shadow-[0_0_7px_rgba(34,211,197,0.35)]" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#526d69]">Locale</span>
            </div>
            <div className="flex min-w-0 items-stretch">
              <button
                onClick={() => setActiveLocale(defaultLocale)}
                className={tabClass(activeLocale === defaultLocale)}
                style={{ borderBottom: activeLocale === defaultLocale ? '2px solid #22d3c5' : '2px solid transparent' }}
                title={`Default locale · ${getLanguageName(defaultLocale)}`}
              >
                Default
              </button>
              {locales.filter((locale) => locale !== defaultLocale).map((locale) => {
                const isActive = activeLocale === locale
                const count = rawGroup && activeCanvasFormat !== baseFormat
                  ? countLocaleFormatAdjustments(rawGroup, locale, activeCanvasFormat, defaultLocale, baseFormat)
                  : 0
                const label = getLanguageName(locale)
                return (
                  <button
                    key={locale}
                    onClick={() => setActiveLocale(locale)}
                    className={tabClass(isActive)}
                    style={{ borderBottom: isActive ? '2px solid #22d3c5' : '2px solid transparent' }}
                    title={`${label} locale · ${count} locale layout adjustment${count !== 1 ? 's' : ''}`}
                  >
                    {label}
                    {count > 0 && <span className="text-[9px] font-bold text-[#22d3c5]">●{count}</span>}
                  </button>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

/** A transient-feeling but persistent warning over the canvas when edits are scoped. */
export function EditingContextAlert() {
  const {
    project,
    activeSlideGroupId,
    activeLocale,
    activeCanvasFormat,
    setActiveLocale,
    setActiveCanvasFormat,
    resetActiveFormatLayout,
    shareActiveFormatOwnedLayers,
    resetActiveFormatVisibility,
    promoteActiveFormatLayoutToShared,
    resetActiveLocaleFormatLayout,
  } = useEditorStore(
    useShallow((state) => ({
      project: state.project,
      activeSlideGroupId: state.activeSlideGroupId,
      activeLocale: state.activeLocale,
      activeCanvasFormat: state.activeCanvasFormat,
      setActiveLocale: state.setActiveLocale,
      setActiveCanvasFormat: state.setActiveCanvasFormat,
      resetActiveFormatLayout: state.resetActiveFormatLayout,
      shareActiveFormatOwnedLayers: state.shareActiveFormatOwnedLayers,
      resetActiveFormatVisibility: state.resetActiveFormatVisibility,
      promoteActiveFormatLayoutToShared: state.promoteActiveFormatLayoutToShared,
      resetActiveLocaleFormatLayout: state.resetActiveLocaleFormatLayout,
    })),
  )
  const [actionsOpen, setActionsOpen] = useState(false)
  const actionsRef = useRef<HTMLDivElement>(null)
  useDismissOnOutsideClick(actionsOpen, actionsRef, () => setActionsOpen(false))

  const baseFormat = getProjectBaseFormat(project)
  const defaultLocale = project.settings.defaultLocale
  const isFormatScoped = activeCanvasFormat !== baseFormat
  const isLocaleScoped = activeLocale !== defaultLocale
  if (!isFormatScoped && !isLocaleScoped) return null

  const formatLabel = getFormatLabel(activeCanvasFormat, project.settings.customFormats)
  const localeLabel = getLanguageName(activeLocale)
  const activeGroup = project.slideGroups.find((group) => group.id === activeSlideGroupId)
  const formatCount = activeGroup && isFormatScoped
    ? countFormatAdjustments(activeGroup, activeCanvasFormat, baseFormat)
    : 0
  const localeCount = activeGroup && isFormatScoped && isLocaleScoped
    ? countLocaleFormatAdjustments(activeGroup, activeLocale, activeCanvasFormat, defaultLocale, baseFormat)
    : 0

  const runFormatAction = (action: (format: CanvasFormatId) => void) => {
    action(activeCanvasFormat)
    setActionsOpen(false)
  }

  const handlePromoteLayout = () => {
    const ok = window.confirm(
      `Use ${formatLabel} layout as shared for this slide?\n\n` +
      'This promotes all layout/model overrides from this platform into Base, so other platforms may move. Content stays shared.',
    )
    if (ok) runFormatAction(promoteActiveFormatLayoutToShared)
  }

  const handleLocaleReset = () => {
    const ok = window.confirm(
      `Reset all locale-specific layout adjustments for ${localeLabel} on ${formatLabel}? This cannot be undone.`,
    )
    if (!ok) return
    resetActiveLocaleFormatLayout()
    setActionsOpen(false)
  }

  const actionItemClass = 'w-full px-3 py-2 text-left text-[11px] text-[#e8e8f0] transition-colors hover:bg-[rgba(255,255,255,0.06)]'
  const accentBar = isFormatScoped && isLocaleScoped
    ? 'linear-gradient(90deg, #f59e0b 0%, #f59e0b 42%, #22d3c5 58%, #22d3c5 100%)'
    : isFormatScoped ? '#f59e0b' : '#22d3c5'

  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-30 w-[min(760px,calc(100%-32px))] -translate-x-1/2">
      <div className="pointer-events-auto relative flex min-h-11 items-center gap-3 rounded-xl border border-[rgba(255,255,255,0.13)] bg-[rgba(24,24,31,0.94)] px-3.5 py-2 shadow-[0_14px_40px_rgba(0,0,0,0.42),0_2px_10px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="absolute inset-x-3 top-0 h-px opacity-90" style={{ background: accentBar }} />
        <div className="flex shrink-0 items-center gap-1.5" aria-hidden="true">
          {isFormatScoped && <span className="h-2 w-2 rounded-full bg-[#f59e0b] shadow-[0_0_10px_rgba(245,158,11,0.75)]" />}
          {isLocaleScoped && <span className="h-2 w-2 rounded-full bg-[#22d3c5] shadow-[0_0_10px_rgba(34,211,197,0.7)]" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] leading-4 text-[#b7b7c5]">
            <strong className="font-semibold text-[#f4f4f7]">
              {isFormatScoped && isLocaleScoped ? `${formatLabel} × ${localeLabel}` : isFormatScoped ? formatLabel : localeLabel}
            </strong>
            <span className="mx-1.5 text-[#565664]">—</span>
            {isFormatScoped && isLocaleScoped
              ? 'Position & size scoped to this pairing · New layers stay format-only · Content & style shared'
              : isFormatScoped
                ? 'Layout and new layers scoped to this format · Text & colors shared'
                : `Layout edits do not apply in Base for ${localeLabel} · Switch to a platform tab to adjust position & size · Content & style remain shared`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {isFormatScoped && (
            <button
              onClick={() => setActiveCanvasFormat(baseFormat)}
              className="rounded-md px-2 py-1 text-[10px] text-[#d9a52a] transition-colors hover:bg-[rgba(245,158,11,0.1)] hover:text-[#fbbf24]"
              title="Return to the shared base format"
            >
              ↩ Base
            </button>
          )}
          {isLocaleScoped && (
            <button
              onClick={() => setActiveLocale(defaultLocale)}
              className="rounded-md px-2 py-1 text-[10px] text-[#24aaa2] transition-colors hover:bg-[rgba(34,211,197,0.1)] hover:text-[#5eead4]"
              title="Return to the default locale"
            >
              ↩ Default
            </button>
          )}
          {isFormatScoped && (
            <div className="relative" ref={actionsRef}>
              <button
                onClick={() => setActionsOpen((open) => !open)}
                className="rounded-md border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.035)] px-2 py-1 text-[10px] text-[#c9c9d4] transition-colors hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.07)] hover:text-white"
              >
                Actions ▾
              </button>
              {actionsOpen && (
                <div className="absolute right-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-lg border border-[rgba(255,255,255,0.12)] bg-[#1c1c26] shadow-2xl">
                  <div className="border-b border-[rgba(255,255,255,0.08)] px-3 py-2">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[#fbbf24]">{formatLabel} format actions</p>
                    <p className="mt-0.5 text-[10px] text-[#6b6b7a]">{formatCount} format adjustment{formatCount !== 1 ? 's' : ''} on this slide</p>
                  </div>
                  <button className={actionItemClass} onClick={() => runFormatAction(resetActiveFormatLayout)}>
                    Reset format layout
                    <span className="mt-0.5 block text-[10px] text-[#6b6b7a]">Remove all layout/model overrides for this format.</span>
                  </button>
                  <button className={actionItemClass} onClick={() => runFormatAction(shareActiveFormatOwnedLayers)}>
                    Make format layers shared
                    <span className="mt-0.5 block text-[10px] text-[#6b6b7a]">Convert layers created only in this format into shared layers.</span>
                  </button>
                  <button className={actionItemClass} onClick={() => runFormatAction(resetActiveFormatVisibility)}>
                    Reset format visibility
                    <span className="mt-0.5 block text-[10px] text-[#6b6b7a]">Clear hide/show decisions for this format.</span>
                  </button>
                  <div className="h-px bg-[rgba(255,255,255,0.08)]" />
                  <button className={actionItemClass} onClick={handlePromoteLayout}>
                    Use format layout as shared…
                    <span className="mt-0.5 block text-[10px] text-[#f59e0b]">Promotes this format layout into Base. Affects other formats.</span>
                  </button>
                  {isLocaleScoped && (
                    <section className="mt-1 border-t border-[rgba(255,255,255,0.12)]" aria-label={`${formatLabel} and ${localeLabel} actions`}>
                      <div className="border-b border-[rgba(255,255,255,0.08)] px-3 py-2">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[#22d3c5]">{formatLabel} × {localeLabel}</p>
                        <p className="mt-0.5 text-[10px] text-[#6b6b7a]">
                          {localeCount} position and size adjustment{localeCount !== 1 ? 's' : ''} for this pairing
                        </p>
                      </div>
                      <button className={actionItemClass} onClick={handleLocaleReset}>
                        Reset pairing layout
                        <span className="mt-0.5 block text-[10px] text-[#22d3c5]">Remove all position and size adjustments for this pairing.</span>
                      </button>
                    </section>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
