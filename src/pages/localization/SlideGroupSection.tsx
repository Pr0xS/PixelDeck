import { useMemo } from 'react'
import type { BrandColor, Layer, LocaleLayerPatch, LocalizationMode, SlideGroup } from '@/types'
import { effectiveLocalizationMode, getLanguageName } from '@/utils/locale'
import { ModeSelector } from './ModeSelector'
import { TextOverrideCell } from './TextOverrideCell'
import { ImageOverrideCell } from './ImageOverrideCell'
import { isOverrideComplete, getPlatformBadge, getSlideBackgroundPreview } from './helpers'
import type { CellKey, CellStatus, LocalizableRow } from './types'
import { cellKey } from './types'

export interface SlideGroupSectionProps {
  slideGroup: SlideGroup
  rows: LocalizableRow[]
  collapsed: boolean
  onToggleCollapse: () => void
  activeLocale: string
  defaultLocale: string
  brandColors: BrandColor[]
  locales: string[]
  gridTemplateColumns: string
  cellStatus: Map<CellKey, CellStatus>
  cellError: Map<CellKey, string>
  previewOverrides: Map<CellKey, LocaleLayerPatch>
  lostFormattingCells: Set<CellKey>
  toolbarSlotEl: HTMLElement | null
  onSingleAiTranslate: (row: LocalizableRow, locale: string) => void
  onNavigateToLayer: (row: LocalizableRow) => void
  onModeUpdate: (row: LocalizableRow, mode: LocalizationMode | undefined) => void
  updateLayerInSlideGroup: (slideGroupId: string, layerId: string, patch: Partial<Layer>) => void
  setLocaleContent: (slideGroupId: string, layerId: string, locale: string, patch: LocaleLayerPatch) => void
  clearLocaleContent: (slideGroupId: string, layerId: string, locale: string) => void
  getAsset: (key: string) => string | undefined
  openUploadPicker: (target: { slideGroupId: string; layerId: string; locale: string; layerType: 'phone' | 'image' }) => void
  setEditingTextCell: (value: { layerName: string; locale: string } | null) => void
}

export function SlideGroupSection({
  slideGroup,
  rows,
  collapsed,
  onToggleCollapse,
  activeLocale,
  defaultLocale,
  brandColors,
  locales,
  gridTemplateColumns,
  cellStatus,
  cellError,
  previewOverrides,
  lostFormattingCells,
  toolbarSlotEl,
  onSingleAiTranslate,
  onNavigateToLayer,
  onModeUpdate,
  updateLayerInSlideGroup,
  setLocaleContent,
  clearLocaleContent,
  getAsset,
  openUploadPicker,
  setEditingTextCell,
}: SlideGroupSectionProps) {
  const activeProgress = rows.filter((row) => isOverrideComplete(row, activeLocale, defaultLocale)).length
  const eligibleRows = rows.filter((r) => effectiveLocalizationMode(r.layer) !== 'skip')
  const backgroundPreview = useMemo(
    () => getSlideBackgroundPreview(slideGroup, brandColors),
    [slideGroup, brandColors],
  )

  return (
    <section
      className="overflow-hidden rounded-[24px] border border-white/8 bg-[#18181f]/78 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl"
    >
      {/* Section header */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-white/[0.03]"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm text-[#d5d2eb]">{collapsed ? '▸' : '▾'}</span>
          <div>
            <div className="text-xl text-[#f2efff]" style={{ fontFamily: 'Iowan Old Style, Palatino Linotype, serif' }}>
              {slideGroup.name}
            </div>
            <div className="mt-1 text-sm text-[#7f8094]">
              {eligibleRows.length} localizable · {activeProgress}/{eligibleRows.length} complete for{' '}
              <span className="font-medium text-[#bdb7f6]">{getLanguageName(activeLocale)}</span>
            </div>
          </div>
        </div>
        <div className="rounded-full border border-white/8 bg-white/4 px-3 py-1 text-xs uppercase tracking-[0.18em] text-[#8d8ea3]">
          {slideGroup.slideWidth} × {slideGroup.slideHeight}
        </div>
      </button>

      {!collapsed && (
        <div className="overflow-x-auto border-t border-white/8 px-4 py-4">
          <div style={{ minWidth: 300 + locales.length * 260 }}>
            {/* Column headers */}
            <div
              className="grid gap-3 px-2 pb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#78798b]"
              style={{ gridTemplateColumns }}
            >
              <div className="px-3 py-2 sticky left-0 bg-[#18181f]/95">Layer</div>
              {locales.map((locale) => (
                <div
                  key={locale}
                  className="px-3 py-2 flex items-center gap-2"
                  style={{
                    color: locale === activeLocale ? '#bdb7f6' : undefined,
                  }}
                >
                  <span>{getLanguageName(locale)}</span>
                  <span className="font-mono text-[10px] opacity-60">{locale}</span>
                  {locale === defaultLocale && <span className="text-[9px] text-[#6b6b7a]">(default)</span>}
                </div>
              ))}
            </div>

            {/* Rows */}
            <div className="space-y-3 px-2">
              {rows.map((row) => {
                const platformBadge = getPlatformBadge(row.layer.ownerFormat)
                const mode = effectiveLocalizationMode(row.layer)

                return (
                  <div
                    key={row.layerId}
                    className="grid gap-3"
                    style={{ gridTemplateColumns }}
                  >
                    {/* Layer column — sticky left */}
                    <div
                      className="flex min-h-[80px] flex-col justify-between rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 sticky left-0"
                      style={{ background: '#18181f' }}
                    >
                      <div className="flex items-start gap-3" style={{ paddingLeft: row.depth * 16 }}>
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#111118] text-sm font-semibold mt-0.5"
                          style={{ color: row.layerType === 'text' ? '#c9c3ff' : '#d9d9e6' }}
                        >
                          {row.layerType === 'text' ? 'T' : row.layerType === 'phone' ? '📱' : '🖼'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => onNavigateToLayer(row)}
                            className="truncate font-medium text-[#d5d5df] text-sm hover:text-white transition text-left w-full"
                            title="Go to layer in editor"
                          >
                            {row.layerName}
                          </button>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-[10px] uppercase tracking-[0.14em] text-[#6b6b7a]">{row.layerType}</span>
                            {platformBadge && (
                              <span
                                className="text-[9px] px-1.5 py-0.5 rounded border font-medium"
                                style={{
                                  color: platformBadge.color,
                                  borderColor: `${platformBadge.color}40`,
                                  background: `${platformBadge.color}12`,
                                }}
                              >
                                {platformBadge.label} only
                              </span>
                            )}
                            {mode === 'skip' && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] text-[#fca5a5]">
                                skip
                              </span>
                            )}
                            {mode === 'manual' && row.layerType === 'text' && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.08)] text-[#fbbf24]">
                                manual
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Mode selector */}
                      <ModeSelector
                        layer={row.layer}
                        onUpdate={(newMode) => onModeUpdate(row, newMode)}
                      />
                    </div>

                    {/* Locale cells */}
                    {locales.map((locale) => {
                      if (row.layerType === 'text') {
                        return (
                          <TextOverrideCell
                            key={`${row.layerId}-${locale}`}
                            row={row}
                            locale={locale}
                            defaultLocale={defaultLocale}
                            activeLocale={activeLocale}
                            backgroundPreview={backgroundPreview}
                            cellStatus={cellStatus.get(cellKey(row.layerId, locale)) ?? 'idle'}
                            cellError={cellError.get(cellKey(row.layerId, locale))}
                            previewOverride={previewOverrides.get(cellKey(row.layerId, locale))}
                            formattingLostByAi={lostFormattingCells.has(cellKey(row.layerId, locale))}
                            toolbarSlot={toolbarSlotEl}
                            onEditingChange={(editing) =>
                              setEditingTextCell(editing ? { layerName: row.layerName, locale } : null)
                            }
                            updateBaseLayer={updateLayerInSlideGroup}
                            setLocaleContent={setLocaleContent}
                            clearLocaleContent={clearLocaleContent}
                            onAiTranslate={() => onSingleAiTranslate(row, locale)}
                          />
                        )
                      }
                      return (
                        <ImageOverrideCell
                          key={`${row.layerId}-${locale}`}
                          row={row}
                          locale={locale}
                          defaultLocale={defaultLocale}
                          activeLocale={activeLocale}
                          getAsset={getAsset}
                          onUpload={() => openUploadPicker({
                            slideGroupId: row.slideGroupId,
                            layerId: row.layerId,
                            locale,
                            layerType: row.layerType === 'phone' ? 'phone' : 'image',
                          })}
                          onClear={() => clearLocaleContent(row.slideGroupId, row.layerId, locale)}
                        />
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
