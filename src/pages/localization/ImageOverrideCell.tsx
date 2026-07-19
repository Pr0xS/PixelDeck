import { effectiveLocalizationMode } from '@/utils/locale'
import type { LocalizableRow } from './types'
import { getFileLabel } from './helpers'

export interface ImageOverrideCellProps {
  row: LocalizableRow
  locale: string
  defaultLocale: string
  activeLocale: string
  getAsset: (key: string) => string | undefined
  onUpload: () => void
  onClear: () => void
}

export function ImageOverrideCell({
  row,
  locale,
  defaultLocale,
  activeLocale,
  getAsset,
  onUpload,
  onClear,
}: ImageOverrideCellProps) {
  const override = row.layer.localeContent?.[locale]
  const isDefaultLocale = locale === defaultLocale
  const isActiveColumn = locale === activeLocale
  const mode = effectiveLocalizationMode(row.layer)
  const isSkipped = mode === 'skip'
  const basePreviewSrc = row.defaultImageRef
    ? (getAsset(row.defaultImageRef) ?? row.defaultImageRef)
    : row.defaultImageRef

  const previewSrc =
    isDefaultLocale
      ? basePreviewSrc
      : row.layerType === 'phone'
      ? (override?.screenshotPath ? getAsset(override.screenshotPath) : undefined) ?? override?.screenshotDataUrl
      : (override?.src ? getAsset(override.src) : undefined) ?? override?.src

  if (isDefaultLocale) {
    return (
      <div
        className="min-h-[80px] rounded-xl border px-3 py-3"
        style={{
          borderColor: isActiveColumn ? 'rgba(124,110,246,0.45)' : 'rgba(255,255,255,0.08)',
          background: isActiveColumn ? 'rgba(124,110,246,0.08)' : 'rgba(255,255,255,0.02)',
        }}
      >
        {previewSrc ? (
          <div className="flex items-center gap-3">
            <img src={previewSrc} alt="base" className="h-12 w-9 rounded-lg border border-white/10 object-cover shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs text-[#ecebfa]">{getFileLabel(row.defaultImageRef)}</div>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <button type="button" onClick={onUpload} className="text-[10px] text-[#9d90f8] hover:text-white transition">
                  Change
                </button>
                <span className="text-[10px] text-[#6b6b7a]">Base image</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-between gap-3">
            <button
              type="button"
              onClick={onUpload}
              className="rounded-lg border border-[rgba(124,110,246,0.4)] bg-[rgba(124,110,246,0.1)] px-3 py-1.5 text-xs font-medium text-[#c5befd] transition hover:bg-[rgba(124,110,246,0.2)]"
            >
              + Upload
            </button>
            <span className="text-[10px] text-[#6b6b7a]">Base image</span>
          </div>
        )}
      </div>
    )
  }

  if (isSkipped) {
    return (
      <div className="min-h-[80px] rounded-xl border border-dashed border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.04)] px-4 py-3 flex items-center justify-center">
        <span className="text-xs text-[#f87171]">— skipped —</span>
      </div>
    )
  }

  return (
    <div
      className="min-h-[128px] rounded-xl border px-3 py-3"
      style={{
        borderColor: previewSrc
          ? isActiveColumn ? '#7c6ef6' : 'rgba(124,110,246,0.45)'
          : isActiveColumn ? 'rgba(124,110,246,0.4)' : 'rgba(255,255,255,0.14)',
        background: previewSrc
          ? isActiveColumn ? 'rgba(124,110,246,0.12)' : 'rgba(124,110,246,0.06)'
          : isActiveColumn ? 'rgba(124,110,246,0.06)' : 'rgba(255,255,255,0.015)',
      }}
    >
      {previewSrc ? (
        <div className="flex items-center gap-3">
          <img
            src={previewSrc}
            alt={`${row.layerName} ${locale}`}
            className="h-12 w-9 rounded-lg border border-white/10 object-cover shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs text-[#ecebfa]">
              {row.layerType === 'phone'
                ? getFileLabel(override?.screenshotPath ?? override?.screenshotDataUrl)
                : getFileLabel(override?.src)}
            </div>
            <div className="flex gap-2 mt-1.5">
              <button type="button" onClick={onUpload} className="text-[10px] text-[#9d90f8] hover:text-white transition">
                Change
              </button>
              <button type="button" onClick={onClear} className="text-[10px] text-[#f87171] hover:text-white transition">
                × Clear
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onUpload}
            className="rounded-lg border border-[rgba(124,110,246,0.4)] bg-[rgba(124,110,246,0.1)] px-3 py-1.5 text-xs font-medium text-[#c5befd] transition hover:bg-[rgba(124,110,246,0.2)]"
          >
            + Upload
          </button>
          <span className="text-xs text-amber-400/70">⚠ Missing</span>
        </div>
      )}
    </div>
  )
}
