import type { Layer, LocaleLayerPatch, TextLayer } from '@/types'
import { effectiveLocalizationMode } from '@/utils/locale'
import { LocaleRichTextEditor } from '@/components/text/LocaleRichTextEditor'
import type { CellStatus, LocalizableRow } from './types'
import type { SlideBackgroundPreview } from './helpers'
import { truncate } from './helpers'

export interface TextOverrideCellProps {
  row: LocalizableRow
  locale: string
  defaultLocale: string
  activeLocale: string
  backgroundPreview: SlideBackgroundPreview
  cellStatus: CellStatus
  cellError?: string
  /** Optimistic AI result shown before the bulk translation is committed. */
  previewOverride?: LocaleLayerPatch
  /** True when the last AI translation could not preserve the source formatting. */
  formattingLostByAi?: boolean
  /** Floating styling-toolbar slot (viewport-fixed panel owned by the view). */
  toolbarSlot: HTMLElement | null
  /** Reports editing sessions so the view can show/hide the floating toolbar. */
  onEditingChange: (editing: boolean) => void
  updateBaseLayer: (slideGroupId: string, layerId: string, patch: Partial<Layer>) => void
  setLocaleOverride: (slideGroupId: string, layerId: string, locale: string, patch: LocaleLayerPatch) => void
  clearLocaleOverride: (slideGroupId: string, layerId: string, locale: string) => void
  onAiTranslate: () => void
}

export function TextOverrideCell({
  row,
  locale,
  defaultLocale,
  activeLocale,
  backgroundPreview,
  cellStatus,
  cellError,
  previewOverride,
  formattingLostByAi,
  toolbarSlot,
  onEditingChange,
  updateBaseLayer,
  setLocaleOverride,
  clearLocaleOverride,
  onAiTranslate,
}: TextOverrideCellProps) {
  const override = row.layer.localeOverrides?.[locale]
  const displayOverride = previewOverride ?? override
  const isDefaultLocale = locale === defaultLocale
  const hasOverride = isDefaultLocale || typeof displayOverride?.text === 'string'
  const mode = effectiveLocalizationMode(row.layer)

  const isActiveColumn = locale === activeLocale
  const isSkipped = mode === 'skip'

  const baseLayer = row.layer as TextLayer
  const effectiveText = isDefaultLocale ? row.defaultText ?? '' : displayOverride?.text ?? ''
  const effectiveMarks = isDefaultLocale ? baseLayer.marks : displayOverride?.marks
  const baseHasMarks = (baseLayer.marks?.length ?? 0) > 0
  const overrideHasMarks = (displayOverride?.marks?.length ?? 0) > 0
  // Problem visibility: the source has styled words but this locale doesn't.
  const formattingMissing = !isDefaultLocale && hasOverride && Boolean(displayOverride?.text?.trim()) && baseHasMarks && !overrideHasMarks

  if (!isDefaultLocale && isSkipped) {
    return (
      <div className="min-h-[80px] rounded-xl border border-dashed border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.04)] px-4 py-3 flex items-center justify-center">
        <span className="text-xs text-[#f87171]">— skipped —</span>
      </div>
    )
  }

  // Translating / queued state
  if (!isDefaultLocale && (cellStatus === 'translating' || cellStatus === 'queued')) {
    return (
      <div className="min-h-[80px] rounded-xl border border-[rgba(124,110,246,0.3)] bg-[rgba(124,110,246,0.06)] px-4 py-3 flex items-center justify-center gap-2">
        <span className="text-[#7c6ef6] animate-spin text-sm">⟳</span>
        <span className="text-xs text-[#9d90f8]">{cellStatus === 'queued' ? 'Queued…' : 'Translating…'}</span>
      </div>
    )
  }

  // Error state
  if (!isDefaultLocale && cellStatus === 'error') {
    return (
      <div className="min-h-[80px] rounded-xl border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.06)] px-4 py-3 space-y-2">
        <div className="text-xs text-[#f87171]">⚠ Translation failed</div>
        {cellError && (
          <div className="text-[10px] text-[#f87171]/70 truncate" title={cellError}>
            {cellError}
          </div>
        )}
        <button
          type="button"
          onClick={onAiTranslate}
          className="text-xs text-[#f87171] hover:text-white border border-[rgba(239,68,68,0.3)] rounded px-2 py-0.5 transition"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!hasOverride) {
    return (
      <div
        className="min-h-[80px] rounded-xl border border-dashed px-4 py-3"
        style={{
          borderColor: isActiveColumn ? 'rgba(124,110,246,0.4)' : 'rgba(255,255,255,0.14)',
          background: isActiveColumn ? 'rgba(124,110,246,0.06)' : 'rgba(255,255,255,0.015)',
        }}
      >
        <div className="mb-2 text-xs leading-5 text-[#6b6b7a]">
          Inherits: {truncate(row.defaultText ?? '', 60)}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setLocaleOverride(row.slideGroupId, row.layerId, locale, { text: '' })}
            className="rounded-lg border border-[rgba(255,255,255,0.12)] px-2.5 py-1 text-xs text-[#a0a0b0] hover:border-[rgba(255,255,255,0.22)] hover:text-white transition"
          >
            + Manual
          </button>
          {mode === 'auto' && (
            <button
              type="button"
              onClick={onAiTranslate}
              className="rounded-lg border border-[rgba(124,110,246,0.4)] bg-[rgba(124,110,246,0.1)] px-2.5 py-1 text-xs text-[#c5befd] hover:bg-[rgba(124,110,246,0.2)] transition"
            >
              ✦ AI
            </button>
          )}
          <span className="text-xs text-amber-400/70">⚠ Missing</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative min-h-[80px] overflow-hidden rounded-xl border px-3 py-3"
      style={{
        borderColor: cellStatus === 'done'
          ? 'rgba(52,211,153,0.5)'
          : isActiveColumn ? '#7c6ef6' : 'rgba(124,110,246,0.45)',
        ...backgroundPreview.style,
      }}
    >
      {backgroundPreview.overlayColor && (backgroundPreview.overlayOpacity ?? 0) > 0 && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundColor: backgroundPreview.overlayColor, opacity: backgroundPreview.overlayOpacity }}
        />
      )}
      <div className="relative">
        {cellStatus === 'done' && (
          <div className="text-[10px] text-emerald-400 mb-1">✓ AI translated</div>
        )}
        <LocaleRichTextEditor
          baseLayer={baseLayer}
          text={effectiveText}
          marks={effectiveMarks}
          placeholder={isDefaultLocale ? 'Enter base text' : 'Enter localized text'}
          toolbarSlot={toolbarSlot}
          onEditingChange={onEditingChange}
          onCommit={({ text, marks }) => {
            if (isDefaultLocale) {
              updateBaseLayer(row.slideGroupId, row.layerId, { text, marks } as Partial<Layer>)
            } else {
              setLocaleOverride(row.slideGroupId, row.layerId, locale, { ...(displayOverride ?? {}), text, marks })
            }
          }}
        />

        {/* Problem visibility: formatting state */}
        {(formattingLostByAi || formattingMissing) && (
          <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.07)] px-2 py-1.5">
            <span className="text-[10px] leading-relaxed text-[#fbbf24]">
              {formattingLostByAi
                ? '⚠ AI could not preserve the source formatting — click the text and re-apply it'
                : '⚠ The source has styled words not applied here — click the text to style it'}
            </span>
          </div>
        )}

        {/* Backdrop plate: the row above sits on the real slide background (by design),
            but these controls are UI chrome, not part of the contrast test — keep them legible. */}
        <div className="mt-2 flex items-center justify-between rounded-md bg-[#18181f]/70 px-1.5 py-1 backdrop-blur-sm">
          {isDefaultLocale ? (
            <span className="text-[10px] text-[#6b6b7a]">Base content</span>
          ) : mode === 'auto' && (
            <button
              type="button"
              onClick={onAiTranslate}
              className="text-[10px] text-[#9d90f8] hover:text-white transition"
              title="Re-translate with AI"
            >
              ✦ Re-translate
            </button>
          )}
          {!isDefaultLocale && (
            <button
              type="button"
              onClick={() => clearLocaleOverride(row.slideGroupId, row.layerId, locale)}
              className="ml-auto text-xs font-medium text-[#b9b6c9] transition hover:text-white"
            >
              × Clear
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
