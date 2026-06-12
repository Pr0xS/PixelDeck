import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { RefObject } from 'react'
import { useEditorStore } from '@/store'
import { useAssetStore } from '@/store/assets'
import { useApiKeysStore } from '@/store/apiKeys'
import type {
  GroupLayer,
  ImageLayer,
  Layer,
  LocaleLayerPatch,
  LocalizationMode,
  PhoneLayer,
  SlideGroup,
  TextLayer,
} from '@/types'
import { effectiveLocalizationMode, getLanguageName, LANGUAGES } from '@/utils/locale'
import { translateLayerText, translateGroupTexts } from '@/ai/features/translateText'
import type { AiAuth } from '@/ai/features/translateText'
import { suggestImageLocalization } from '@/ai/features/localizeImage'
import { LocaleRichTextEditor } from '@/components/text/LocaleRichTextEditor'
import { CANVAS_FORMAT_PRESETS } from '@/utils/canvasFormats'
import type { CanvasFormatId } from '@/types'

const ApiKeysModal = lazy(() =>
  import('@/components/panels/ApiKeysModal').then((m) => ({ default: m.ApiKeysModal })),
)

// ─── Types ────────────────────────────────────────────────────────────────────

interface LocalizationViewProps {
  onBack: () => void
  embedded?: boolean
  /** Opens the slide preview pre-set to the given locale (provided by App). */
  onPreview?: (locale: string) => void
}

type LocalizableDisplayLayer = TextLayer | PhoneLayer | ImageLayer

interface LocalizableRow {
  slideGroupId: string
  slideGroupName: string
  layerId: string
  layerName: string
  layerType: 'text' | 'phone' | 'image'
  depth: number
  containerGroupId: string | null
  defaultText?: string
  defaultImageRef?: string
  layer: LocalizableDisplayLayer
}

interface UploadTarget {
  slideGroupId: string
  layerId: string
  locale: string
  layerType: 'phone' | 'image'
}

type CellStatus = 'idle' | 'queued' | 'translating' | 'done' | 'error'
type CellKey = string // `${layerId}:${locale}`

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cellKey(layerId: string, locale: string): CellKey {
  return `${layerId}:${locale}`
}

function findLayerById(
  layers: Layer[],
  layerId: string,
  containerGroupId: string | null = null,
): { layer: Layer; containerGroupId: string | null } | null {
  for (const layer of layers) {
    if (layer.id === layerId) return { layer, containerGroupId }
    if (layer.type === 'group') {
      const found = findLayerById((layer as GroupLayer).children, layerId, layer.id)
      if (found) return found
    }
  }
  return null
}

function collectLocalizableRows(
  slideGroup: SlideGroup,
  layers: Layer[],
  depth = 0,
  containerGroupId: string | null = null,
): LocalizableRow[] {
  const rows: LocalizableRow[] = []
  for (const layer of layers) {
    if (layer.type === 'group') {
      rows.push(...collectLocalizableRows(slideGroup, (layer as GroupLayer).children, depth + 1, layer.id))
      continue
    }
    if (layer.type !== 'text' && layer.type !== 'phone' && layer.type !== 'image') continue
    rows.push({
      slideGroupId: slideGroup.id,
      slideGroupName: slideGroup.name,
      layerId: layer.id,
      layerName: layer.name,
      layerType: layer.type,
      depth,
      containerGroupId,
      defaultText: layer.type === 'text' ? (layer as TextLayer).text : undefined,
      defaultImageRef:
        layer.type === 'phone'
          ? (layer as PhoneLayer).screenshotPath ?? (layer as PhoneLayer).screenshotDataUrl
          : layer.type === 'image'
            ? (layer as ImageLayer).src
            : undefined,
      layer: layer as LocalizableDisplayLayer,
    })
  }
  // Sort: texts first, then images/phone
  return rows.sort((a, b) => {
    if (a.layerType === 'text' && b.layerType !== 'text') return -1
    if (a.layerType !== 'text' && b.layerType === 'text') return 1
    return 0
  })
}

function isOverrideComplete(row: LocalizableRow, locale: string, defaultLocale: string): boolean {
  if (locale === defaultLocale) return true
  if (effectiveLocalizationMode(row.layer) === 'skip') return true // skipped = not counted
  const override = row.layer.localeOverrides?.[locale]
  if (!override) return false
  if (row.layerType === 'text') return typeof override.text === 'string' && override.text.trim().length > 0
  if (row.layerType === 'phone') return Boolean((override.screenshotPath?.trim()) || override.screenshotDataUrl)
  return Boolean(override.src?.trim())
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Failed to read file'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

function buildLocaleAssetKey(locale: string, slideGroupId: string, layerId: string, fileName: string): string {
  return `locale-${locale}-${slideGroupId}-${layerId}-${fileName}`
}

function truncate(value: string, length = 120): string {
  if (value.length <= length) return value
  return `${value.slice(0, length - 1)}…`
}

function getFileLabel(value?: string): string {
  if (!value) return 'No image'
  if (value.startsWith('data:')) return 'Embedded image'
  const parts = value.split('/')
  return parts[parts.length - 1] || value
}

function getPlatformBadge(ownerFormat?: CanvasFormatId): { label: string; color: string } | null {
  if (!ownerFormat) return null
  const preset = CANVAS_FORMAT_PRESETS.find((f) => f.id === ownerFormat)
  if (!preset) return null
  const isIos = ownerFormat === 'iphone-69' || ownerFormat === 'ipad-13'
  return {
    label: preset.label,
    color: isIos ? '#5ac8fa' : '#a4c639',
  }
}

// ─── Language Combobox ────────────────────────────────────────────────────────

function LanguageCombobox({
  existingLocales,
  onAdd,
  onCancel,
}: {
  existingLocales: string[]
  onAdd: (code: string) => void
  onCancel: () => void
}) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return LANGUAGES.slice(0, 20)
    return LANGUAGES.filter(
      (l) => l.name.toLowerCase().includes(q) || l.code.includes(q),
    ).slice(0, 20)
  }, [query])

  const customCodeValid = useMemo(() => {
    const q = query.trim().toLowerCase().replace('_', '-')
    if (!q) return null
    if (!/^[a-z]{2,3}(-[a-z0-9]{2,4})?$/.test(q)) return null
    if (LANGUAGES.some((l) => l.code === q)) return null // already in list
    return q
  }, [query])

  const handleSelect = (code: string) => {
    const normalized = code.trim().toLowerCase().replace('_', '-')
    if (existingLocales.includes(normalized)) return
    onAdd(normalized)
  }

  return (
    <div className="relative z-50 w-72 rounded-2xl border border-white/12 bg-[#1a1a24] shadow-2xl">
      <div className="p-2 border-b border-white/8">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onCancel()
            if (e.key === 'Enter' && filtered.length > 0) handleSelect(filtered[0].code)
            if (e.key === 'Enter' && filtered.length === 0 && customCodeValid) handleSelect(customCodeValid)
          }}
          placeholder="Search language or type code…"
          className="w-full rounded-lg border border-white/10 bg-[#0f0f13] px-3 py-2 text-sm text-white outline-none placeholder:text-[#6b6b7a] focus:border-[#7c6ef6]"
        />
      </div>
      <div className="max-h-56 overflow-y-auto py-1">
        {filtered.map((lang) => {
          const already = existingLocales.includes(lang.code)
          return (
            <button
              key={lang.code}
              type="button"
              disabled={already}
              onClick={() => handleSelect(lang.code)}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition ${
                already
                  ? 'cursor-default text-[#4a4a5a]'
                  : 'text-[#d9d9e6] hover:bg-white/6 hover:text-white'
              }`}
            >
              <span>{lang.name}</span>
              <span className={`text-xs font-mono ${already ? 'text-[#3a3a4a]' : 'text-[#6b6b7a]'}`}>
                {already ? '✓ ' : ''}{lang.code}
              </span>
            </button>
          )
        })}
        {customCodeValid && (
          <button
            type="button"
            onClick={() => handleSelect(customCodeValid)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#9d90f8] hover:bg-[#7c6ef6]/10 hover:text-white transition"
          >
            <span className="text-[#7c6ef6]">＋</span>
            Use custom code: <span className="font-mono">{customCodeValid}</span>
          </button>
        )}
        {filtered.length === 0 && !customCodeValid && (
          <div className="px-3 py-4 text-center text-xs text-[#6b6b7a]">
            No languages found. Type a valid locale code (e.g. <span className="font-mono">xx</span> or <span className="font-mono">xx-yy</span>).
          </div>
        )}
      </div>
      <div className="border-t border-white/8 p-2">
        <button
          type="button"
          onClick={onCancel}
          className="w-full rounded-lg px-3 py-1.5 text-xs text-[#6b6b7a] hover:text-white transition"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function LanguagePopover({
  open,
  anchorRef,
  existingLocales,
  note,
  onAdd,
  onCancel,
}: {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  existingLocales: string[]
  note?: string
  onAdd: (code: string) => void
  onCancel: () => void
}) {
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => {
    if (!open) return

    const updatePosition = () => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (!rect) return

      const width = 288 // w-72
      const estimatedHeight = note ? 430 : 360
      const margin = 12
      const left = Math.min(
        Math.max(margin, rect.left),
        Math.max(margin, window.innerWidth - width - margin),
      )
      const below = rect.bottom + 8
      const top = below + estimatedHeight > window.innerHeight - margin
        ? Math.max(margin, rect.top - estimatedHeight - 8)
        : below

      setPosition({ left, top })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [anchorRef, note, open])

  if (!open || !position || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[100]" onMouseDown={onCancel}>
      <div
        className="fixed"
        style={{ left: position.left, top: position.top }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <LanguageCombobox existingLocales={existingLocales} onAdd={onAdd} onCancel={onCancel} />
        {note && (
          <div className="mt-2 w-72 rounded-xl border border-white/8 bg-[#111118] px-3 py-2 text-[10px] leading-relaxed text-[#7f8094] shadow-xl">
            {note}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

// ─── Mode Selector ────────────────────────────────────────────────────────────

const MODE_OPTIONS: { value: LocalizationMode; label: string; title: string }[] = [
  { value: 'auto',   label: 'Auto',   title: 'Eligible for bulk AI translation' },
  { value: 'manual', label: 'Manual', title: 'Human-entered only; skipped by bulk AI translate' },
  { value: 'skip',   label: 'Skip',   title: 'Not localized; excluded from progress' },
]

function ModeSelector({
  layer,
  onUpdate,
}: {
  layer: Layer
  onUpdate: (mode: LocalizationMode | undefined) => void
}) {
  const effective = effectiveLocalizationMode(layer)
  const isImageType = layer.type === 'image' || layer.type === 'phone'

  return (
    <div className="flex gap-0.5 mt-1.5">
      {MODE_OPTIONS.map((opt) => {
        const active = effective === opt.value
        const disabled = isImageType && opt.value === 'auto'
        return (
          <button
            key={opt.value}
            type="button"
            title={disabled ? 'AI image generation not available yet' : opt.title}
            disabled={disabled}
            onClick={() => onUpdate(opt.value === 'auto' ? undefined : opt.value)}
            className={`rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide transition ${
              disabled
                ? 'cursor-not-allowed text-[#3a3a4a] border border-[rgba(255,255,255,0.04)]'
                : active
                  ? opt.value === 'skip'
                    ? 'bg-[rgba(239,68,68,0.18)] border border-[rgba(239,68,68,0.4)] text-[#fca5a5]'
                    : opt.value === 'manual'
                      ? 'bg-[rgba(245,158,11,0.18)] border border-[rgba(245,158,11,0.4)] text-[#fbbf24]'
                      : 'bg-[rgba(124,110,246,0.2)] border border-[rgba(124,110,246,0.5)] text-[#c4b5fd]'
                  : 'border border-[rgba(255,255,255,0.08)] text-[#555665] hover:text-[#9a9ab0] hover:border-[rgba(255,255,255,0.14)]'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Text Override Cell ───────────────────────────────────────────────────────

function TextOverrideCell({
  row,
  locale,
  defaultLocale,
  activeLocale,
  cellStatus,
  cellError,
  formattingLostByAi,
  toolbarSlot,
  onEditingChange,
  updateBaseLayer,
  setLocaleOverride,
  clearLocaleOverride,
  onAiTranslate,
}: {
  row: LocalizableRow
  locale: string
  defaultLocale: string
  activeLocale: string
  cellStatus: CellStatus
  cellError?: string
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
}) {
  const override = row.layer.localeOverrides?.[locale]
  const isDefaultLocale = locale === defaultLocale
  const hasOverride = isDefaultLocale || typeof override?.text === 'string'
  const mode = effectiveLocalizationMode(row.layer)

  const isActiveColumn = locale === activeLocale
  const isSkipped = mode === 'skip'

  const baseLayer = row.layer as TextLayer
  const effectiveText = isDefaultLocale ? row.defaultText ?? '' : override?.text ?? ''
  const effectiveMarks = isDefaultLocale ? baseLayer.marks : override?.marks
  const baseHasMarks = (baseLayer.marks?.length ?? 0) > 0
  const overrideHasMarks = (override?.marks?.length ?? 0) > 0
  // Problem visibility: the source has styled words but this locale doesn't.
  const formattingMissing = !isDefaultLocale && hasOverride && Boolean(override?.text?.trim()) && baseHasMarks && !overrideHasMarks

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
        {cellError && <div className="text-[10px] text-[#f87171]/70 truncate">{cellError}</div>}
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
      className="min-h-[80px] rounded-xl border px-3 py-3"
      style={{
        borderColor: cellStatus === 'done'
          ? 'rgba(52,211,153,0.5)'
          : isActiveColumn ? '#7c6ef6' : 'rgba(124,110,246,0.45)',
        background: cellStatus === 'done'
          ? 'rgba(52,211,153,0.06)'
          : isActiveColumn ? 'rgba(124,110,246,0.12)' : 'rgba(124,110,246,0.06)',
      }}
    >
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
            setLocaleOverride(row.slideGroupId, row.layerId, locale, { ...(override ?? {}), text, marks })
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

      <div className="mt-2 flex justify-between items-center">
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
  )
}

// ─── Image Override Cell ──────────────────────────────────────────────────────

function ImageOverrideCell({
  row,
  locale,
  defaultLocale,
  activeLocale,
  getAsset,
  onUpload,
  onClear,
  onAiSuggest,
  aiStatus,
  aiError,
  suggestion,
  onDismissSuggestion,
}: {
  row: LocalizableRow
  locale: string
  defaultLocale: string
  activeLocale: string
  getAsset: (key: string) => string | undefined
  onUpload: () => void
  onClear: () => void
  onAiSuggest: () => void
  aiStatus: CellStatus
  aiError?: string
  suggestion?: string
  onDismissSuggestion: () => void
}) {
  const override = row.layer.localeOverrides?.[locale]
  const isDefaultLocale = locale === defaultLocale
  const isActiveColumn = locale === activeLocale
  const mode = effectiveLocalizationMode(row.layer)
  const isSkipped = mode === 'skip'

  const basePreviewSrc =
    row.layerType === 'phone'
      ? (row.defaultImageRef ? getAsset(row.defaultImageRef) : undefined) ?? row.defaultImageRef
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
      className="min-h-[80px] rounded-xl border px-3 py-3"
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
        <div className="flex h-full items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onUpload}
              className="rounded-lg border border-[rgba(124,110,246,0.4)] bg-[rgba(124,110,246,0.1)] px-3 py-1.5 text-xs font-medium text-[#c5befd] transition hover:bg-[rgba(124,110,246,0.2)]"
            >
              + Upload
            </button>
            <button
              type="button"
              onClick={onAiSuggest}
              disabled={aiStatus === 'translating'}
              title="AI analyzes the source image, detects text and suggests translations"
              className="rounded-lg border border-[rgba(255,255,255,0.12)] px-2.5 py-1.5 text-xs text-[#a0a0b0] transition hover:border-[rgba(124,110,246,0.4)] hover:text-[#c5befd] disabled:cursor-wait disabled:opacity-60"
            >
              {aiStatus === 'translating' ? '⟳ Analyzing…' : '✦ AI brief'}
            </button>
          </div>
          <span className="text-xs text-amber-400/70">⚠ Missing</span>
        </div>
      )}

      {aiStatus === 'error' && aiError && (
        <div className="mt-2 text-[10px] text-[#f87171]/80 truncate" title={aiError}>⚠ {aiError}</div>
      )}

      {suggestion && (
        <div className="mt-2 rounded-lg border border-[rgba(124,110,246,0.3)] bg-[rgba(124,110,246,0.06)] p-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] uppercase tracking-wide text-[#9d90f8]">✦ AI localization brief</span>
            <button type="button" onClick={onDismissSuggestion} className="text-[10px] text-[#6b6b7a] hover:text-white transition">
              ✕
            </button>
          </div>
          <div className="whitespace-pre-wrap text-[11px] leading-relaxed text-[#c9c6e0] max-h-36 overflow-y-auto">
            {suggestion}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LocalizationView({ onBack, embedded = false, onPreview }: LocalizationViewProps) {
  const {
    project,
    activeLocale,
    addLocale,
    removeLocale,
    renameDefaultLocale,
    setActiveLocale,
    setLocaleOverride,
    clearLocaleOverride,
    setLocaleOverridesBatch,
    updateLayerInSlideGroup,
  } = useEditorStore()
  const { addAsset, getAsset } = useAssetStore()
  const { provider, getActiveKey, getActiveModel } = useApiKeysStore()

  const defaultLocale = project.settings.defaultLocale
  const locales = useMemo(() => {
    const defined = project.settings.locales ?? [defaultLocale]
    return [defaultLocale, ...defined.filter((l) => l !== defaultLocale)]
  }, [defaultLocale, project.settings.locales])

  const groups = useMemo(
    () =>
      project.slideGroups.map((slideGroup) => ({
        slideGroup,
        rows: collectLocalizableRows(slideGroup, slideGroup.layers),
      })),
    [project],
  )

  const allRows = useMemo(() => groups.flatMap((g) => g.rows), [groups])

  // ─ Progress per locale (excludes 'skip' layers)
  const progressByLocale = useMemo(() => {
    const progress = new Map<string, { complete: number; total: number }>()
    for (const locale of locales) {
      const eligible = allRows.filter((r) => effectiveLocalizationMode(r.layer) !== 'skip')
      const total = eligible.length
      const complete = eligible.filter((row) => isOverrideComplete(row, locale, defaultLocale)).length
      progress.set(locale, { complete, total })
    }
    return progress
  }, [allRows, defaultLocale, locales])

  // ─ UI state
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
  const [showAddLocale, setShowAddLocale] = useState(false)
  const [showDefaultLocalePicker, setShowDefaultLocalePicker] = useState(false)
  const [uploadTarget, setUploadTarget] = useState<UploadTarget | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const defaultLocaleAnchorRef = useRef<HTMLDivElement>(null)
  const addLocaleAnchorRef = useRef<HTMLDivElement>(null)

  // ─ Bulk translate state (component-local, never in undo store)
  const [cellStatus, setCellStatus] = useState<Map<CellKey, CellStatus>>(new Map())
  const [cellError, setCellError] = useState<Map<CellKey, string>>(new Map())
  const [isBulkRunning, setIsBulkRunning] = useState(false)
  const [overwriteExisting, setOverwriteExisting] = useState(false)
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false)
  // Cancellation flag for the bulk worker pool — a ref so in-flight workers see it
  const bulkCancelRef = useRef(false)
  // AI localization briefs for image/phone cells (transient, advisory)
  const [imageSuggestions, setImageSuggestions] = useState<Map<CellKey, string>>(new Map())
  // Cells where the last AI translation could not preserve rich-text formatting
  const [lostFormattingCells, setLostFormattingCells] = useState<Set<CellKey>>(new Set())
  // Active text-cell editing session → drives the floating styling toolbar
  const [editingTextCell, setEditingTextCell] = useState<{ layerName: string; locale: string } | null>(null)
  const [toolbarSlotEl, setToolbarSlotEl] = useState<HTMLElement | null>(null)

  const markFormattingLost = useCallback((key: CellKey, lost: boolean) => {
    setLostFormattingCells((prev) => {
      if (prev.has(key) === lost) return prev
      const next = new Set(prev)
      if (lost) next.add(key)
      else next.delete(key)
      return next
    })
  }, [])

  useEffect(() => {
    setCollapsedSections((prev) => {
      const next = { ...prev }
      for (const { slideGroup } of groups) {
        if (!(slideGroup.id in next)) next[slideGroup.id] = false
      }
      return next
    })
  }, [groups])

  // ─ Upload handler
  const openUploadPicker = (target: UploadTarget) => {
    setUploadTarget(target)
    fileInputRef.current?.click()
  }

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !uploadTarget) return
    const dataUrl = await readFileAsDataUrl(file)
    const group = project.slideGroups.find((item) => item.id === uploadTarget.slideGroupId)
    const found = group ? findLayerById(group.layers, uploadTarget.layerId) : null
    const layer = found?.layer
    const existingOverride = layer?.localeOverrides?.[uploadTarget.locale] ?? {}
    const assetKey = buildLocaleAssetKey(uploadTarget.locale, uploadTarget.slideGroupId, uploadTarget.layerId, file.name)
    addAsset(assetKey, dataUrl)
    if (uploadTarget.locale === project.settings.defaultLocale) {
      if (uploadTarget.layerType === 'phone') {
        updateLayerInSlideGroup(uploadTarget.slideGroupId, uploadTarget.layerId, {
          screenshotPath: assetKey,
          screenshotDataUrl: undefined,
        } as Partial<Layer>)
      } else {
        updateLayerInSlideGroup(uploadTarget.slideGroupId, uploadTarget.layerId, { src: assetKey } as Partial<Layer>)
      }
      event.target.value = ''
      setUploadTarget(null)
      return
    }
    if (uploadTarget.layerType === 'phone') {
      setLocaleOverride(uploadTarget.slideGroupId, uploadTarget.layerId, uploadTarget.locale, {
        ...existingOverride,
        screenshotPath: assetKey,
        screenshotDataUrl: undefined,
      })
    } else {
      setLocaleOverride(uploadTarget.slideGroupId, uploadTarget.layerId, uploadTarget.locale, {
        ...existingOverride,
        src: assetKey,
      })
    }
    event.target.value = ''
    setUploadTarget(null)
  }

  // ─ Navigate to layer in editor
  const navigateToLayer = (row: LocalizableRow) => {
    const store = useEditorStore.getState()
    store.setActiveSlideGroup(row.slideGroupId)
    if (row.containerGroupId) {
      store.enterGroupEdit(row.containerGroupId)
      store.selectChild(row.containerGroupId, row.layerId)
    } else {
      store.select(row.layerId)
    }
    onBack()
  }

  // ─ Single cell AI translate (full design context: all slides + texts + roles)
  const handleSingleAiTranslate = useCallback(async (row: LocalizableRow, locale: string) => {
    const key = cellKey(row.layerId, locale)
    const apiKey = getActiveKey()
    const model = getActiveModel()
    if (!apiKey) {
      setAiSettingsOpen(true)
      return
    }
    if (!row.defaultText) return
    const slideGroup = project.slideGroups.find((g) => g.id === row.slideGroupId)
    if (!slideGroup) return
    const auth: AiAuth = { provider, apiKey, model }
    setCellStatus((m) => new Map(m).set(key, 'translating'))
    try {
      const result = await translateLayerText({
        auth,
        project,
        slideGroup,
        layerId: row.layerId,
        text: row.defaultText,
        marks: (row.layer as TextLayer).marks,
        targetLocale: locale,
      })
      setLocaleOverride(row.slideGroupId, row.layerId, locale, { text: result.text, marks: result.marks })
      markFormattingLost(key, Boolean(result.formattingLost))
      setCellStatus((m) => new Map(m).set(key, 'done'))
    } catch (e) {
      setCellError((m) => new Map(m).set(key, String(e)))
      setCellStatus((m) => new Map(m).set(key, 'error'))
    }
  }, [getActiveKey, getActiveModel, markFormattingLost, project, provider, setLocaleOverride])

  // ─ Image cell AI localization brief (vision: detect text, suggest translations)
  const handleImageAiSuggest = useCallback(async (row: LocalizableRow, locale: string) => {
    const key = cellKey(row.layerId, locale)
    const apiKey = getActiveKey()
    const model = getActiveModel()
    if (!apiKey) {
      setAiSettingsOpen(true)
      return
    }
    const slideGroup = project.slideGroups.find((g) => g.id === row.slideGroupId)
    if (!slideGroup) return
    // Resolve the default image to a data URL (vision input)
    const ref = row.defaultImageRef
    const imageDataUrl = ref?.startsWith('data:') ? ref : ref ? getAsset(ref) : undefined
    if (!imageDataUrl) {
      setCellError((m) => new Map(m).set(key, 'No source image available to analyze.'))
      setCellStatus((m) => new Map(m).set(key, 'error'))
      return
    }
    setCellStatus((m) => new Map(m).set(key, 'translating'))
    try {
      const brief = await suggestImageLocalization({
        auth: { provider, apiKey, model },
        project,
        slideGroup,
        imageDataUrl,
        layerName: row.layerName,
        targetLocale: locale,
      })
      setImageSuggestions((m) => new Map(m).set(key, brief))
      setCellStatus((m) => new Map(m).set(key, 'idle'))
    } catch (e) {
      setCellError((m) => new Map(m).set(key, String(e)))
      setCellStatus((m) => new Map(m).set(key, 'error'))
    }
  }, [getActiveKey, getActiveModel, getAsset, project, provider])

  // ─ Bulk AI translate
  // One request per (slide group × locale) with ALL the group's texts and the
  // full design context — the model sees the whole narrative and keeps
  // terminology consistent. Falls back to per-item calls if the batch fails.
  const handleBulkTranslate = useCallback(async () => {
    const apiKey = getActiveKey()
    const model = getActiveModel()
    if (!apiKey || isBulkRunning) return

    const nonDefaultLocales = locales.filter((l) => l !== defaultLocale)
    const auth: AiAuth = { provider, apiKey, model }

    // Build batch jobs: one per (slide group × locale)
    interface BatchJob {
      slideGroup: SlideGroup
      locale: string
      rows: LocalizableRow[]
    }
    const batches: BatchJob[] = []
    for (const { slideGroup, rows } of groups) {
      const eligibleRows = rows.filter(
        (row) =>
          row.layerType === 'text' &&
          effectiveLocalizationMode(row.layer) === 'auto' &&
          row.defaultText,
      )
      if (eligibleRows.length === 0) continue
      for (const locale of nonDefaultLocales) {
        const pending = eligibleRows.filter((row) => {
          const hasOverride = typeof row.layer.localeOverrides?.[locale]?.text === 'string'
          return !hasOverride || overwriteExisting
        })
        if (pending.length > 0) batches.push({ slideGroup, locale, rows: pending })
      }
    }

    if (batches.length === 0) return

    setIsBulkRunning(true)
    bulkCancelRef.current = false

    // Mark all cells as queued
    setCellStatus((m) => {
      const next = new Map(m)
      for (const batch of batches) {
        for (const row of batch.rows) next.set(cellKey(row.layerId, batch.locale), 'queued')
      }
      return next
    })

    const staged: Array<{ slideGroupId: string; layerId: string; locale: string; patch: LocaleLayerPatch }> = []
    let cursor = 0

    async function worker() {
      while (cursor < batches.length && !bulkCancelRef.current) {
        const batch = batches[cursor++]
        const markBatch = (status: CellStatus) =>
          setCellStatus((m) => {
            const next = new Map(m)
            for (const row of batch.rows) next.set(cellKey(row.layerId, batch.locale), status)
            return next
          })

        markBatch('translating')
        try {
          const translations = await translateGroupTexts({
            auth,
            project,
            slideGroup: batch.slideGroup,
            items: batch.rows.map((row) => ({
              id: row.layerId,
              text: row.defaultText!,
              marks: (row.layer as TextLayer).marks,
            })),
            targetLocale: batch.locale,
          })
          for (const row of batch.rows) {
            const key = cellKey(row.layerId, batch.locale)
            const result = translations[row.layerId]
            if (result) {
              staged.push({
                slideGroupId: row.slideGroupId,
                layerId: row.layerId,
                locale: batch.locale,
                patch: { text: result.text, marks: result.marks },
              })
              markFormattingLost(key, Boolean(result.formattingLost))
              setCellStatus((m) => new Map(m).set(key, 'done'))
            } else {
              setCellError((m) => new Map(m).set(key, 'Missing from batch response'))
              setCellStatus((m) => new Map(m).set(key, 'error'))
            }
          }
        } catch {
          // Batch failed (bad JSON / API error) — fall back to per-item calls
          for (const row of batch.rows) {
            if (bulkCancelRef.current) break
            const key = cellKey(row.layerId, batch.locale)
            try {
              const result = await translateLayerText({
                auth,
                project,
                slideGroup: batch.slideGroup,
                layerId: row.layerId,
                text: row.defaultText!,
                marks: (row.layer as TextLayer).marks,
                targetLocale: batch.locale,
              })
              staged.push({
                slideGroupId: row.slideGroupId,
                layerId: row.layerId,
                locale: batch.locale,
                patch: { text: result.text, marks: result.marks },
              })
              markFormattingLost(key, Boolean(result.formattingLost))
              setCellStatus((m) => new Map(m).set(key, 'done'))
            } catch (e) {
              setCellError((m) => new Map(m).set(key, String(e)))
              setCellStatus((m) => new Map(m).set(key, 'error'))
            }
          }
        }
      }
    }

    // 2 parallel workers — each batch is already a large request
    await Promise.all(Array.from({ length: 2 }, worker))

    // Reset cells still queued after a cancellation
    if (bulkCancelRef.current) {
      setCellStatus((m) => {
        const next = new Map(m)
        for (const [key, status] of next) {
          if (status === 'queued') next.set(key, 'idle')
        }
        return next
      })
    }

    // Single undo step for the whole batch (includes work finished before Stop)
    if (staged.length > 0) setLocaleOverridesBatch(staged)

    setIsBulkRunning(false)
  }, [defaultLocale, getActiveKey, getActiveModel, groups, isBulkRunning, locales, markFormattingLost, overwriteExisting, project, provider, setLocaleOverridesBatch])

  // ─ Mode update
  const handleModeUpdate = useCallback((row: LocalizableRow, mode: LocalizationMode | undefined) => {
    updateLayerInSlideGroup(row.slideGroupId, row.layerId, { localizationMode: mode } as Partial<Layer>)
  }, [updateLayerInSlideGroup])

  // ─ Remove locale
  const handleRemoveLocale = (locale: string) => {
    if (locale === defaultLocale) return
    if (!confirm(`Remove locale "${getLanguageName(locale)}" and all its overrides?`)) return
    removeLocale(locale)
    if (activeLocale === locale) setActiveLocale(defaultLocale)
  }

  const handleDefaultLocaleChange = (locale: string) => {
    if (locale === defaultLocale) {
      setShowDefaultLocalePicker(false)
      return
    }
    const nonDefault = locales.filter((l) => l !== defaultLocale)
    if (nonDefault.includes(locale)) return
    renameDefaultLocale(locale)
    setShowDefaultLocalePicker(false)
  }

  const nonDefaultLocales = locales.filter((l) => l !== defaultLocale)
  const hasApiKey = Boolean(getActiveKey())

  // Bulk translate eligibility count
  const bulkEligibleCount = useMemo(() => {
    return allRows.filter((r) => {
      if (r.layerType !== 'text') return false
      if (effectiveLocalizationMode(r.layer) !== 'auto') return false
      if (!r.defaultText) return false
      return nonDefaultLocales.some((locale) => {
        const hasOverride = typeof r.layer.localeOverrides?.[locale]?.text === 'string'
        return !hasOverride || overwriteExisting
      })
    }).length * nonDefaultLocales.length
  }, [allRows, nonDefaultLocales, overwriteExisting])

  const gridTemplateColumns = `300px ${locales.map(() => '260px').join(' ')}`

  return (
    <div className={`relative overflow-hidden bg-[#0f0f13] text-[#e8e8f0] ${embedded ? 'h-full w-full' : 'h-screen w-screen'}`}>
      {/* AI Settings modal — reachable from no-key states without leaving the view */}
      <Suspense>
        <ApiKeysModal open={aiSettingsOpen} onClose={() => setAiSettingsOpen(false)} />
      </Suspense>

      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-10%] top-[-18%] h-[28rem] w-[28rem] rounded-full bg-[#7c6ef6]/16 blur-3xl" />
        <div className="absolute bottom-[-18%] right-[-8%] h-[24rem] w-[24rem] rounded-full bg-[#ec4899]/10 blur-3xl" />
      </div>

      <div className="relative flex h-full flex-col">
        {/* ── Header ── */}
        <header className="border-b border-white/8 bg-[#111118]/92 px-8 py-5 backdrop-blur-xl shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-[0.28em] text-[#7c6ef6]">Global content matrix</div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">🌐</span>
                <h1 className="m-0 text-[28px] leading-none text-[#f7f4ff]" style={{ fontFamily: 'Iowan Old Style, Palatino Linotype, serif' }}>
                  Localization
                </h1>
              </div>
            </div>
            <button
              type="button"
              onClick={onBack}
              className="rounded-full border border-white/10 bg-white/4 px-5 py-2.5 text-sm font-medium text-[#d7d7e3] transition hover:border-[#7c6ef6]/50 hover:bg-[#7c6ef6]/10 hover:text-white"
            >
              ← Back to Editor
            </button>
          </div>
        </header>

        {/* ── Locale bar ── */}
        <section className="border-b border-white/8 bg-[#18181f]/86 px-8 py-4 backdrop-blur-xl shrink-0">
          <div className="flex flex-wrap items-start gap-3">
            <div className="pt-2 text-xs font-medium uppercase tracking-[0.22em] text-[#6b6b7a] shrink-0">Languages</div>
            <div className="flex flex-1 flex-wrap gap-2 items-center">
              {locales.map((locale) => {
                const progress = progressByLocale.get(locale) ?? { complete: 0, total: 0 }
                const ratio = progress.total === 0 ? 1 : progress.complete / progress.total
                const selected = locale === activeLocale
                const isDefault = locale === defaultLocale
                return (
                  <div key={locale} ref={isDefault ? defaultLocaleAnchorRef : undefined} className="relative group">
                    <button
                      type="button"
                      onClick={() => setActiveLocale(locale)}
                      className="rounded-full border px-4 py-2 text-sm transition"
                      style={{
                        borderColor: selected ? 'rgba(124,110,246,0.7)' : 'rgba(255,255,255,0.08)',
                        background: selected ? 'rgba(124,110,246,0.14)' : 'rgba(255,255,255,0.03)',
                        color: selected ? '#f3f1ff' : '#c6c6d2',
                      }}
                    >
                      <span className="font-semibold">{getLanguageName(locale)}</span>
                      <span className="ml-1.5 text-xs font-mono opacity-60">{locale}</span>
                      {isDefault ? (
                        <span className="ml-2 text-xs text-[#9f98dc]">default</span>
                      ) : (
                        <span className="ml-2 text-xs" style={{ color: ratio >= 0.5 ? '#7c6ef6' : '#f59e0b' }}>
                          {progress.complete}/{progress.total}
                        </span>
                      )}
                    </button>
                    {isDefault ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddLocale(false)
                            setShowDefaultLocalePicker((open) => !open)
                          }}
                          className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[#1a1a24] border border-white/10 text-[9px] text-[#6b6b7a] hover:text-[#c4b5fd] hover:border-[rgba(124,110,246,0.45)] opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
                          title="Change base language label"
                        >
                          ✎
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRemoveLocale(locale)}
                        className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[#1a1a24] border border-white/10 text-[9px] text-[#6b6b7a] hover:text-[#f87171] hover:border-[rgba(239,68,68,0.4)] opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
                        title={`Remove ${getLanguageName(locale)}`}
                      >
                        ×
                      </button>
                    )}
                  </div>
                )
              })}

              {/* Add locale */}
              <div ref={addLocaleAnchorRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowDefaultLocalePicker(false)
                    setShowAddLocale((open) => !open)
                  }}
                  className="rounded-full border border-dashed border-white/12 bg-white/2 px-4 py-2 text-sm font-medium text-[#b7b7c7] transition hover:border-[#7c6ef6]/50 hover:bg-[#7c6ef6]/10 hover:text-white"
                >
                  + Add language
                </button>
              </div>

              {/* Preview the selected language (opens the shared preview modal) */}
              {onPreview && (
                <button
                  type="button"
                  onClick={() => onPreview(activeLocale)}
                  title={`Preview slides in ${getLanguageName(activeLocale)}`}
                  className="ml-auto rounded-full border border-[#7c6ef6]/40 bg-[#7c6ef6]/10 px-4 py-2 text-sm font-medium text-[#cbbfff] transition hover:border-[#7c6ef6]/70 hover:bg-[#7c6ef6]/20 hover:text-white shrink-0"
                >
                  ▶ Preview
                </button>
              )}
            </div>
          </div>
        </section>

        <LanguagePopover
          open={showDefaultLocalePicker}
          anchorRef={defaultLocaleAnchorRef}
          existingLocales={locales.filter((l) => l !== defaultLocale)}
          note="This only changes the language label for the source content. Existing translated languages cannot be promoted to default."
          onAdd={handleDefaultLocaleChange}
          onCancel={() => setShowDefaultLocalePicker(false)}
        />

        <LanguagePopover
          open={showAddLocale}
          anchorRef={addLocaleAnchorRef}
          existingLocales={locales}
          onAdd={(code) => {
            addLocale(code)
            setActiveLocale(code)
            setShowAddLocale(false)
          }}
          onCancel={() => setShowAddLocale(false)}
        />

        {/* ── Bulk translate toolbar ── */}
        {nonDefaultLocales.length > 0 && (
          <section className="border-b border-white/6 bg-[#111118]/70 px-8 py-3 backdrop-blur-xl shrink-0">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#6b6b7a]">Bulk AI translate:</span>
                <span className="text-xs text-[#9d90f8]">{bulkEligibleCount} cells</span>
              </div>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={overwriteExisting}
                  onChange={(e) => setOverwriteExisting(e.target.checked)}
                  className="accent-[#7c6ef6] w-3 h-3"
                />
                <span className="text-xs text-[#8f90a3]">Overwrite existing</span>
              </label>

              <button
                type="button"
                onClick={handleBulkTranslate}
                disabled={!hasApiKey || isBulkRunning || bulkEligibleCount === 0}
                className={`rounded-lg border px-4 py-1.5 text-xs font-medium transition ${
                  !hasApiKey
                    ? 'border-white/8 text-[#4a4a5a] cursor-not-allowed'
                    : isBulkRunning
                      ? 'border-[rgba(124,110,246,0.3)] text-[#9d90f8] cursor-wait'
                      : bulkEligibleCount === 0
                        ? 'border-white/8 text-[#4a4a5a] cursor-not-allowed'
                        : 'border-[rgba(124,110,246,0.5)] bg-[rgba(124,110,246,0.12)] text-[#c5befd] hover:bg-[rgba(124,110,246,0.22)] hover:text-white'
                }`}
                title={!hasApiKey ? 'Configure an AI API key in AI Settings' : undefined}
              >
                {isBulkRunning ? '⟳ Translating…' : `✦ Translate all (${nonDefaultLocales.length} lang${nonDefaultLocales.length > 1 ? 's' : ''})`}
              </button>

              {!hasApiKey && (
                <button
                  type="button"
                  onClick={() => setAiSettingsOpen(true)}
                  className="text-xs text-[#f59e0b] hover:text-white underline underline-offset-2 transition"
                >
                  No API key — open AI Settings
                </button>
              )}

              {isBulkRunning && (
                <button
                  type="button"
                  onClick={() => { bulkCancelRef.current = true }}
                  className="text-xs text-[#f87171] hover:text-white transition"
                >
                  Stop
                </button>
              )}
            </div>
          </section>
        )}

        {/* ── Table ── */}
        <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-auto px-8 py-7">
          <div className="space-y-6 pb-12">
            {groups.map(({ slideGroup, rows }) => {
              const collapsed = collapsedSections[slideGroup.id] ?? false
              const activeProgress = rows.filter((row) => isOverrideComplete(row, activeLocale, defaultLocale)).length
              const eligibleRows = rows.filter((r) => effectiveLocalizationMode(r.layer) !== 'skip')

              return (
                <section
                  key={slideGroup.id}
                  className="overflow-hidden rounded-[24px] border border-white/8 bg-[#18181f]/78 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl"
                >
                  {/* Section header */}
                  <button
                    type="button"
                    onClick={() => setCollapsedSections((prev) => ({ ...prev, [slideGroup.id]: !collapsed }))}
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
                                        onClick={() => navigateToLayer(row)}
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
                                    onUpdate={(newMode) => handleModeUpdate(row, newMode)}
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
                                        cellStatus={cellStatus.get(cellKey(row.layerId, locale)) ?? 'idle'}
                                        cellError={cellError.get(cellKey(row.layerId, locale))}
                                        formattingLostByAi={lostFormattingCells.has(cellKey(row.layerId, locale))}
                                        toolbarSlot={toolbarSlotEl}
                                        onEditingChange={(editing) =>
                                          setEditingTextCell(editing ? { layerName: row.layerName, locale } : null)
                                        }
                                        updateBaseLayer={updateLayerInSlideGroup}
                                        setLocaleOverride={setLocaleOverride}
                                        clearLocaleOverride={clearLocaleOverride}
                                        onAiTranslate={() => void handleSingleAiTranslate(row, locale)}
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
                                      onClear={() => clearLocaleOverride(row.slideGroupId, row.layerId, locale)}
                                      onAiSuggest={() => void handleImageAiSuggest(row, locale)}
                                      aiStatus={cellStatus.get(cellKey(row.layerId, locale)) ?? 'idle'}
                                      aiError={cellError.get(cellKey(row.layerId, locale))}
                                      suggestion={imageSuggestions.get(cellKey(row.layerId, locale))}
                                      onDismissSuggestion={() =>
                                        setImageSuggestions((m) => {
                                          const next = new Map(m)
                                          next.delete(cellKey(row.layerId, locale))
                                          return next
                                        })
                                      }
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
            })}

            {groups.every((g) => g.rows.length === 0) && (
              <div className="rounded-2xl border border-white/8 bg-[#18181f]/78 px-8 py-16 text-center">
                <div className="text-4xl mb-4">🌐</div>
                <div className="text-lg text-[#d5d5df] mb-2">No localizable content</div>
                <div className="text-sm text-[#6b6b7a]">Add text, phone, or image layers to your slides to start localizing.</div>
              </div>
            )}
          </div>
        </main>

        {/* ── Text styling side panel — docked like the editor's properties
              panel, but only takes space while a text cell is being edited.
              Cells portal their RichTextToolbar into the slot below. ── */}
        {editingTextCell && (
          <aside
            data-locale-toolbar-panel
            className="w-72 shrink-0 overflow-y-auto border-l border-[rgba(255,255,255,0.06)] bg-[#18181f] px-4 py-4"
          >
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#6b6b7a]">
              Text Styling
            </div>
            <div className="mb-3 truncate text-xs text-[#c4b5fd]" title={editingTextCell.layerName}>
              ✏️ {editingTextCell.layerName}
              <span className="ml-1.5 text-[#8f90a3]">· {getLanguageName(editingTextCell.locale)}</span>
            </div>
            <div ref={setToolbarSlotEl} />
            <p className="mt-3 text-[10px] leading-relaxed text-[#6b6b7a]">
              Select text in the cell, then apply styles here.
              <br />Enter confirms · the panel closes when you finish.
            </p>
          </aside>
        )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => { void handleUpload(event) }}
      />
    </div>
  )
}
