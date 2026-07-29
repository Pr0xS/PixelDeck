import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '@/store'
import type { BuiltInFormatId, CanvasFormatId, CustomFormatId } from '@/types'
import {
  CANVAS_FORMAT_PRESETS,
  countFormatAdjustments,
  countLocaleAdjustments,
  FORMAT_FAMILY,
  getFormatLabel,
  getFormatFamilyKey,
  getGroupFamilyKey,
  getProjectActiveFormats,
  getProjectBaseFormat,
  groupTargetsFormat,
  isCustomFormatId,
  selectFamilyFormats,
  selectFamilyGroups,
  selectProjectFamilies,
} from '@/utils/canvasFormats'
import { getLanguageName } from '@/utils/locale'
import { getScopedEditingIndicator } from '@/utils/scopedEditingIndicator'
import { CreateFormatLayoutModal } from '@/components/panels/CreateFormatLayoutModal'
import { ContentSyncModal } from '@/components/panels/ContentSyncModal'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

const FORMAT_FAMILY_ORDER = ['phone', 'tablet', 'watch', 'desktop'] as const
const FORMAT_FAMILY_LABELS = { phone: 'Phone', tablet: 'Tablet', watch: 'Watch', desktop: 'TV & Desktop' } as const

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
    project,
    settings,
    slideGroups,
    activeSlideGroupId,
    activeCanvasFormat,
    activeFamily,
    activeLocale,
    setActiveCanvasFormat: setActiveCanvasFormatRaw,
    setActiveFamily,
    setActiveSlideGroup,
    setActiveLocale,
    addCustomFormat,
    addFormatToFamily,
    deleteFormatLayout,
    removeCustomFormat,
    resetActiveFormatLayout,
    shareActiveFormatOwnedLayers,
    resetActiveFormatVisibility,
    promoteActiveFormatLayoutToShared,
    resetActiveLocaleAdjust,
  } = useEditorStore(
    useShallow((state) => ({
      project: state.project,
      settings: state.project.settings,
      slideGroups: state.project.slideGroups,
      activeSlideGroupId: state.activeSlideGroupId,
      activeCanvasFormat: state.activeCanvasFormat,
      activeFamily: state.activeFamily,
      activeLocale: state.activeLocale,
      setActiveCanvasFormat: state.setActiveCanvasFormat,
      setActiveFamily: state.setActiveFamily,
      setActiveSlideGroup: state.setActiveSlideGroup,
      setActiveLocale: state.setActiveLocale,
      addCustomFormat: state.addCustomFormat,
      addFormatToFamily: state.addFormatToFamily,
      deleteFormatLayout: state.deleteFormatLayout,
      removeCustomFormat: state.removeCustomFormat,
      resetActiveFormatLayout: state.resetActiveFormatLayout,
      shareActiveFormatOwnedLayers: state.shareActiveFormatOwnedLayers,
      resetActiveFormatVisibility: state.resetActiveFormatVisibility,
      promoteActiveFormatLayoutToShared: state.promoteActiveFormatLayoutToShared,
      resetActiveLocaleAdjust: state.resetActiveLocaleAdjust,
    })),
  )
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [createTarget, setCreateTarget] = useState<CanvasFormatId | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BuiltInFormatId | null>(null)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [contentSyncOpen, setContentSyncOpen] = useState(false)
  const [customLabel, setCustomLabel] = useState('')
  const [customW, setCustomW] = useState('')
  const [customH, setCustomH] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  useDismissOnOutsideClick(dropdownOpen, dropdownRef, () => setDropdownOpen(false))
  useDismissOnOutsideClick(actionsOpen, actionsRef, () => setActionsOpen(false))

  const baseFormat = getProjectBaseFormat({ settings })
  const activeFormats: CanvasFormatId[] = getProjectActiveFormats({ settings })
  const families = selectProjectFamilies(project)
  const hasMultipleFamilies = families.length >= 2
  const activeFamilyFormats = selectFamilyFormats(project, activeFamily)
    .filter((formatId) => activeFormats.includes(formatId))
  const activeFamilyPresetFormats = activeFamilyFormats.filter((formatId): formatId is BuiltInFormatId => !isCustomFormatId(formatId))
  const activeFamilyCustomFormats = activeFamilyFormats.filter(isCustomFormatId)
  const familyEntries = families.map((family) => {
    const formats = selectFamilyFormats(project, family)
      .filter((formatId) => activeFormats.includes(formatId))
    return {
      family,
      presetFormats: formats.filter((formatId): formatId is BuiltInFormatId => !isCustomFormatId(formatId)),
      customFormats: formats.filter(isCustomFormatId),
    }
  })
  const rawGroup = slideGroups.find((group) => group.id === activeSlideGroupId)
  const defaultLocale = settings.defaultLocale
  const locales = settings.locales ?? [defaultLocale]
  const hasMultipleLocales = locales.length > 1
  const isFormatScoped = activeCanvasFormat !== baseFormat
  const isLocaleScoped = activeLocale !== defaultLocale
  const hasActions = isFormatScoped || isLocaleScoped || hasMultipleFamilies
  const formatLabel = getFormatLabel(activeCanvasFormat, settings.customFormats)
  const localeLabel = getLanguageName(activeLocale)
  const formatCount = rawGroup && isFormatScoped
    ? countFormatAdjustments(rawGroup, activeCanvasFormat, baseFormat)
    : 0
  const localeCount = rawGroup && isLocaleScoped
    ? countLocaleAdjustments(rawGroup, activeLocale, activeCanvasFormat)
    : 0
  const formatExists = (formatId: CanvasFormatId) => activeFormats.includes(formatId)
  const setActiveCanvasFormat = (formatId: CanvasFormatId) => {
    const targetFamily = getFormatFamilyKey(formatId)
    if (formatId !== baseFormat && targetFamily && targetFamily !== activeFamily) {
      setActiveFamily(targetFamily)
      setActiveCanvasFormatRaw(formatId)
      return
    }
    const activeGroup = slideGroups.find((group) => group.id === activeSlideGroupId)
    if (activeGroup && !groupTargetsFormat(activeGroup, formatId)) {
      const targetGroup = slideGroups.find((group) => groupTargetsFormat(group, formatId))
      if (targetGroup) setActiveSlideGroup(targetGroup.id)
    }
    setActiveCanvasFormatRaw(formatId)
  }
  const selectFormat = setActiveCanvasFormat
  const uncreatedFormats = CANVAS_FORMAT_PRESETS
    .map((format) => format.id)
    .filter((formatId) => !formatExists(formatId))
  // `group.formats` is canonical family membership, not "currently active"
  // (a fresh fork gets every built-in preset in its family up front). What
  // actually decides whether this deletion empties the family is whether any
  // OTHER member of that family remains in `activeFormats` — mirrors the
  // `deleteFormatLayout` store action's own family-emptiness check.
  const deleteTargetFamily = deleteTarget ? (getFormatFamilyKey(deleteTarget) ?? 'phone') : null
  const deleteTargetGroups = deleteTarget && deleteTargetFamily
    ? slideGroups.filter((group) => (getGroupFamilyKey(group) ?? 'phone') === deleteTargetFamily)
    : []
  const deleteTargetFamilyStillActive = deleteTarget && deleteTargetFamily
    ? selectFamilyFormats(project, deleteTargetFamily)
      .some((format) => format !== deleteTarget && activeFormats.includes(format))
    : true
  const deleteTargetOwnsAllGroups = deleteTargetGroups.length > 0
    && !deleteTargetFamilyStillActive
    && deleteTargetGroups.length === slideGroups.length
  const deleteTargetExclusiveGroups = deleteTargetFamilyStillActive ? [] : deleteTargetGroups
  const deleteTargetLabel = deleteTarget ? getFormatLabel(deleteTarget, settings.customFormats) : ''
  const deleteTargetMessage = deleteTargetOwnsAllGroups
    ? 'This is the only slide group in the project. Add another slide group before deleting this layout.'
    : deleteTargetGroups.length === 0
      ? 'This format has no dedicated layouts. It will just stop exporting.'
    : deleteTargetExclusiveGroups.length > 0
      ? `This removes ${deleteTargetExclusiveGroups.length === 1 ? 'its slides' : 'these slides'} permanently.`
      : 'This removes the format from its shared slides. The slides remain for their other formats.'

  const clearCustomForm = () => {
    setShowCustomInput(false)
    setCustomLabel('')
    setCustomW('')
    setCustomH('')
  }
  const runFormatAction = (action: (format: CanvasFormatId) => void) => {
    action(activeCanvasFormat)
    setActionsOpen(false)
  }
  const handlePromoteLayout = () => {
    runFormatAction(promoteActiveFormatLayoutToShared)
  }
  const handleLocaleAdjustReset = () => {
    resetActiveLocaleAdjust()
    setActionsOpen(false)
  }
  const actionItemClass = 'w-full px-3 py-2 text-left text-[11px] text-[#e8e8f0] transition-colors hover:bg-[rgba(255,255,255,0.06)]'

  const tabClass = (active: boolean) =>
    `flex h-full shrink-0 items-center gap-1 whitespace-nowrap px-2.5 text-[11px] font-medium transition-colors ${
      active ? 'text-white' : 'text-[#6b6b7a] hover:text-[#e8e8f0]'
    }`
  const renderPresetTab = (formatId: BuiltInFormatId) => {
    const isActive = activeCanvasFormat === formatId
    const count = rawGroup ? countFormatAdjustments(rawGroup, formatId, baseFormat) : 0
    const label = getFormatLabel(formatId, settings.customFormats)
    return <div key={formatId} className="group/tab flex h-full shrink-0 items-center">
      <button onClick={() => setActiveCanvasFormat(formatId)} className={tabClass(isActive)} style={{ borderBottom: isActive ? '2px solid #f59e0b' : '2px solid transparent' }} title={`${label} format · ${count} layout adjustment${count !== 1 ? 's' : ''}`}>
        {label}{count > 0 && <span className="text-[9px] font-bold text-[#fbbf24]">●{count}</span>}
      </button>
      <div className="pointer-events-none -ml-0.5 flex h-full w-4 shrink-0 items-center justify-center opacity-0 transition-opacity group-hover/tab:pointer-events-auto group-hover/tab:opacity-100">
        <button onClick={() => setDeleteTarget(formatId)} className="flex h-4 w-4 items-center justify-center rounded text-xs text-[#6b6b7a] transition-colors hover:bg-[rgba(248,113,113,0.1)] hover:text-[#f87171]" title={`Delete ${label} layout`} aria-label={`Delete ${label} layout`}>×</button>
      </div>
    </div>
  }
  const renderCustomTab = (formatId: CustomFormatId) => (
    <div key={formatId} className="group/tab flex h-full shrink-0 items-center">
      <button onClick={() => setActiveCanvasFormat(formatId)} className={tabClass(activeCanvasFormat === formatId)} style={{ borderBottom: activeCanvasFormat === formatId ? '2px solid #f59e0b' : '2px solid transparent' }}>
        {getFormatLabel(formatId, settings.customFormats)}
      </button>
      <button onClick={() => removeCustomFormat(formatId)} className="-ml-2 pr-1 text-xs text-[#6b6b7a] opacity-0 transition-opacity group-hover/tab:opacity-100 hover:text-[#f87171]" title="Remove format">×</button>
    </div>
  )
  const renderFormatMenuFamilies = (
    formats: readonly BuiltInFormatId[],
    onSelect: (formatId: BuiltInFormatId) => void,
  ) => FORMAT_FAMILY_ORDER.map((family) => {
    const familyFormats = formats.filter((formatId) => FORMAT_FAMILY[formatId] === family)
    if (familyFormats.length === 0) return null
    return (
      <div key={family} className="pb-1.5 last:pb-0">
        <p className="px-3 pb-1 pt-2 text-[8px] font-semibold uppercase tracking-[0.2em] text-[#575461]">{FORMAT_FAMILY_LABELS[family]}</p>
        {familyFormats.map((formatId) => (
          <button key={formatId} onClick={() => onSelect(formatId)} className="w-full px-3 py-1.5 text-left text-xs font-medium text-[#c2c2cf] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-white">
            {getFormatLabel(formatId, settings.customFormats)}
          </button>
        ))}
      </div>
    )
  })

  return (
    <div className={`relative ${actionsOpen ? 'z-40' : 'z-20'} h-11 shrink-0 border-b border-[rgba(255,255,255,0.07)] bg-[#18181f] px-3`}>
      <div className="flex h-full min-w-0 items-stretch">
        <section className="flex min-w-0 flex-1 items-stretch" aria-label="Canvas format">
          <div className="mr-1.5 flex shrink-0 items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b] shadow-[0_0_7px_rgba(245,158,11,0.35)]" />
            <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#6b6254]">Format</span>
          </div>
          {hasMultipleFamilies ? (
            <div className="flex min-w-0 items-stretch overflow-x-auto" aria-label="Format family">
              {familyEntries.map(({ family, presetFormats, customFormats }) => {
                const expanded = activeFamily === family
                return (
                  <div key={family} className="flex h-full shrink-0 items-stretch">
                    <button
                      onClick={() => setActiveFamily(family)}
                      className={`flex h-full shrink-0 items-center px-1.5 text-[8px] font-semibold uppercase tracking-[0.15em] transition-colors ${
                        expanded
                          ? 'bg-[rgba(245,158,11,0.1)] text-[#b68b3c]'
                          : 'text-[#575461] hover:text-[#a29daa]'
                      }`}
                      aria-expanded={expanded}
                    >
                      {FORMAT_FAMILY_LABELS[family]}{expanded && <span className="ml-1 text-[9px]">▾</span>}
                    </button>
                    <div
                      className={`flex h-full min-w-0 overflow-hidden transition-[max-width,opacity] duration-200 ease-out ${
                        expanded ? 'max-w-[34rem] opacity-100' : 'pointer-events-none max-w-0 opacity-0'
                      }`}
                      aria-hidden={!expanded}
                    >
                      <div className="flex h-full min-w-max items-stretch border-l border-[rgba(245,158,11,0.12)]">
                        <button
                          onClick={() => selectFormat(baseFormat)}
                          tabIndex={expanded ? 0 : -1}
                          className={tabClass(activeCanvasFormat === baseFormat)}
                          style={{ borderBottom: activeCanvasFormat === baseFormat ? '2px solid #f59e0b' : '2px solid transparent' }}
                          title="Base — shared authoring canvas. Not exported directly."
                        >
                          Base
                        </button>
                        {presetFormats.map((formatId) => {
                          const isActive = activeCanvasFormat === formatId
                          const count = rawGroup ? countFormatAdjustments(rawGroup, formatId, baseFormat) : 0
                          const label = getFormatLabel(formatId, settings.customFormats)
                          return <div key={formatId} className="group/tab flex h-full shrink-0 items-center">
                            <button onClick={() => setActiveCanvasFormat(formatId)} tabIndex={expanded ? 0 : -1} className={tabClass(isActive)} style={{ borderBottom: isActive ? '2px solid #f59e0b' : '2px solid transparent' }} title={`${label} format · ${count} layout adjustment${count !== 1 ? 's' : ''}`}>
                              {label}{count > 0 && <span className="text-[9px] font-bold text-[#fbbf24]">●{count}</span>}
                            </button>
                            <div className="pointer-events-none -ml-0.5 flex h-full w-4 shrink-0 items-center justify-center opacity-0 transition-opacity group-hover/tab:pointer-events-auto group-hover/tab:opacity-100">
                              <button onClick={() => setDeleteTarget(formatId)} tabIndex={expanded ? 0 : -1} className="flex h-4 w-4 items-center justify-center rounded text-xs text-[#6b6b7a] transition-colors hover:bg-[rgba(248,113,113,0.1)] hover:text-[#f87171]" title={`Delete ${label} layout`} aria-label={`Delete ${label} layout`}>×</button>
                            </div>
                          </div>
                        })}
                        {customFormats.map((formatId) => (
                          <div key={formatId} className="group/tab flex h-full shrink-0 items-center">
                            <button onClick={() => setActiveCanvasFormat(formatId)} tabIndex={expanded ? 0 : -1} className={tabClass(activeCanvasFormat === formatId)} style={{ borderBottom: activeCanvasFormat === formatId ? '2px solid #f59e0b' : '2px solid transparent' }}>
                              {getFormatLabel(formatId, settings.customFormats)}
                            </button>
                            <button onClick={() => removeCustomFormat(formatId)} tabIndex={expanded ? 0 : -1} className="-ml-2 pr-1 text-xs text-[#6b6b7a] opacity-0 transition-opacity group-hover/tab:opacity-100 hover:text-[#f87171]" title="Remove format">×</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex min-w-0 items-stretch overflow-x-auto">
              <button
                onClick={() => selectFormat(baseFormat)}
                className={tabClass(activeCanvasFormat === baseFormat)}
                style={{ borderBottom: activeCanvasFormat === baseFormat ? '2px solid #f59e0b' : '2px solid transparent' }}
                title="Base — shared authoring canvas. Not exported directly."
              >
                Base
              </button>
              {activeFamilyPresetFormats.map(renderPresetTab)}
              {activeFamilyCustomFormats.map(renderCustomTab)}
            </div>
          )}

          <div className="relative ml-1 self-center" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((open) => !open)}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-sm text-[#6b6b7a] transition-colors hover:border-[rgba(245,158,11,0.18)] hover:bg-[rgba(245,158,11,0.07)] hover:text-[#fbbf24]"
              title="Add a custom canvas size"
            >
              +
            </button>
            {dropdownOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 min-w-[220px] max-h-[min(30rem,calc(100vh-5rem))] overflow-y-auto rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#1e1e2a] py-1 shadow-xl">
                {uncreatedFormats.length > 0 && <section aria-label="Create new layout">
                  <p className="px-3 pb-1 pt-1 text-[9px] font-semibold uppercase tracking-[0.15em] text-[#fbbf24]">Create new layout</p>
                  {renderFormatMenuFamilies(uncreatedFormats, (formatId) => {
                    const family = getFormatFamilyKey(formatId) ?? 'phone'
                    if (selectFamilyGroups(project, family).length > 0) {
                      addFormatToFamily(formatId)
                      setActiveCanvasFormat(formatId)
                    } else {
                      setCreateTarget(formatId)
                    }
                    setDropdownOpen(false)
                  })}
                </section>}
                {uncreatedFormats.length > 0 && <div className="mx-2 my-1 h-px bg-[rgba(255,255,255,0.08)]" />}
                <section aria-label="Add a custom canvas size">
                  <p className="px-3 pb-1 pt-1 text-[9px] font-semibold uppercase tracking-[0.15em] text-[#b7b7c5]">Add a custom canvas size</p>
                  <button
                    onClick={() => { setShowCustomInput(true); setDropdownOpen(false) }}
                    className="w-full px-3 py-1.5 text-left text-xs text-[#a0a0b0] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[#e8e8f0]"
                  >
                    Custom size…
                  </button>
                </section>
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
                // `activeCanvasFormat` doubles as the `localeAdjust` scope: at
                // the Base tab it already equals BASE_CANVAS_FORMAT, so one
                // call covers both the base-scoped and format-scoped count.
                const count = rawGroup ? countLocaleAdjustments(rawGroup, locale, activeCanvasFormat) : 0
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
        {hasActions && (
          <div className="relative ml-3 flex shrink-0 items-center border-l border-[rgba(255,255,255,0.08)] pl-3" ref={actionsRef}>
            <button
              onClick={() => setActionsOpen((open) => !open)}
              className="rounded-md border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.035)] px-2 py-1 text-[10px] text-[#c9c9d4] transition-colors hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.07)] hover:text-white"
            >
              Actions ▾
            </button>
            {actionsOpen && (
              <div className="absolute right-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-lg border border-[rgba(255,255,255,0.12)] bg-[#1c1c26] shadow-2xl">
                {isFormatScoped && <>
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
                </>}
                {isLocaleScoped && (
                  <section className="mt-1 border-t border-[rgba(255,255,255,0.12)]" aria-label={`${formatLabel} and ${localeLabel} actions`}>
                    <div className="border-b border-[rgba(255,255,255,0.08)] px-3 py-2">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[#22d3c5]">{isFormatScoped ? `${formatLabel} × ${localeLabel}` : `${localeLabel} base layout`}</p>
                      <p className="mt-0.5 text-[10px] text-[#6b6b7a]">
                        {localeCount} position and size adjustment{localeCount !== 1 ? 's' : ''} for {isFormatScoped ? 'this pairing' : 'this locale'}
                      </p>
                    </div>
                    <button className={actionItemClass} onClick={handleLocaleAdjustReset}>
                      {isFormatScoped ? 'Reset pairing layout' : 'Reset locale base layout'}
                      <span className="mt-0.5 block text-[10px] text-[#22d3c5]">
                        {isFormatScoped ? 'Remove all position and size adjustments for this pairing.' : 'Remove all base-layout adjustments for this locale.'}
                      </span>
                    </button>
                  </section>
                )}
                {hasMultipleFamilies && (
                  <section className={`${isFormatScoped || isLocaleScoped ? 'mt-1 border-t border-[rgba(255,255,255,0.12)]' : ''}`} aria-label="Content actions">
                    <div className="border-b border-[rgba(255,255,255,0.08)] px-3 py-2">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[#7c6ef6]">Content</p>
                    </div>
                    <button className={actionItemClass} onClick={() => { setContentSyncOpen(true); setActionsOpen(false) }}>
                      Bring content from…
                      <span className="mt-0.5 block text-[10px] text-[#6b6b7a]">Copy text and images from another layout family into this screen. Layout is never changed.</span>
                    </button>
                  </section>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <CreateFormatLayoutModal key={createTarget} open={createTarget !== null} targetFormatId={createTarget} onClose={() => setCreateTarget(null)} />
      <ContentSyncModal open={contentSyncOpen} onClose={() => setContentSyncOpen(false)} />
      <ConfirmDialog
        open={deleteTarget !== null}
        title={deleteTargetOwnsAllGroups ? `Can't delete ${deleteTargetLabel} layout` : `Delete the ${deleteTargetLabel} layout?`}
        message={deleteTargetMessage}
        confirmLabel={deleteTargetOwnsAllGroups ? 'Close' : 'Delete layout'}
        danger={!deleteTargetOwnsAllGroups}
        onConfirm={() => {
          if (deleteTarget && !deleteTargetOwnsAllGroups) deleteFormatLayout(deleteTarget)
          setDeleteTarget(null)
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

/** A transient-feeling but persistent warning over the canvas when edits are scoped. */
export function EditingContextAlert() {
  const {
    project,
    activeLocale,
    activeCanvasFormat,
    setActiveLocale,
    setActiveCanvasFormat,
  } = useEditorStore(
    useShallow((state) => ({
      project: state.project,
      activeLocale: state.activeLocale,
      activeCanvasFormat: state.activeCanvasFormat,
      setActiveLocale: state.setActiveLocale,
      setActiveCanvasFormat: state.setActiveCanvasFormat,
    })),
  )

  const { baseFormat, defaultLocale, isFormatScoped, isLocaleScoped, accent } = getScopedEditingIndicator(
    project,
    activeLocale,
    activeCanvasFormat,
  )
  if (!isFormatScoped && !isLocaleScoped) return null

  const formatLabel = getFormatLabel(activeCanvasFormat, project.settings.customFormats)
  const localeLabel = getLanguageName(activeLocale)

  return (
    <div className="relative flex h-9 shrink-0 items-center gap-3 border-b border-[rgba(255,255,255,0.08)] bg-[#18181f] px-3">
      <div className="absolute inset-x-0 top-0 h-0.5 opacity-90" style={{ background: accent }} />
      <div className="flex shrink-0 items-center gap-1.5" aria-hidden="true">
        {isFormatScoped && <span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b] shadow-[0_0_7px_rgba(245,158,11,0.75)]" />}
        {isLocaleScoped && <span className="h-1.5 w-1.5 rounded-full bg-[#22d3c5] shadow-[0_0_7px_rgba(34,211,197,0.7)]" />}
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
              : `Layout changes apply only to ${localeLabel} · Content & style remain shared`}
        </p>
      </div>
      <button
        onClick={() => {
          setActiveCanvasFormat(baseFormat)
          setActiveLocale(defaultLocale)
        }}
        className="shrink-0 rounded-md px-2 py-1 text-[10px] text-[#c9c9d4] transition-colors hover:bg-[rgba(255,255,255,0.08)] hover:text-white"
        title="Return to the shared base format and default locale"
      >
        ↩ Base + Default
      </button>
    </div>
  )
}
