import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditorStore } from '@/store'
import { useAssetStore } from '@/store/assets'
import type {
  GroupLayer,
  ImageLayer,
  Layer,
  LocaleLayerPatch,
  PhoneLayer,
  SlideGroup,
  TextLayer,
} from '@/types'
import { getLocalizableLayers } from '@/utils/locale'

interface LocalizationViewProps {
  onBack: () => void
  embedded?: boolean
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
      rows.push(...collectLocalizableRows(slideGroup, layer.children, depth + 1, layer.id))
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
      defaultText: layer.type === 'text' ? layer.text : undefined,
      defaultImageRef:
        layer.type === 'phone'
          ? layer.screenshotPath ?? layer.screenshotDataUrl
          : layer.type === 'image'
            ? layer.src
            : undefined,
      layer,
    })
  }

  return rows
}

function getLayerIcon(type: LocalizableRow['layerType']): string {
  if (type === 'text') return 'T'
  if (type === 'phone') return '📱'
  return '🖼'
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

function isOverrideComplete(row: LocalizableRow, locale: string, defaultLocale: string): boolean {
  if (locale === defaultLocale) return true

  const override = row.layer.localeOverrides?.[locale]
  if (!override) return false

  if (row.layerType === 'text') return typeof override.text === 'string' && override.text.trim().length > 0
  if (row.layerType === 'phone') {
    return Boolean((override.screenshotPath && override.screenshotPath.trim()) || override.screenshotDataUrl)
  }
  return Boolean(override.src && override.src.trim())
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

function TextOverrideCell({
  row,
  locale,
  defaultLocale,
  activeLocale,
  setLocaleOverride,
  clearLocaleOverride,
}: {
  row: LocalizableRow
  locale: string
  defaultLocale: string
  activeLocale: string
  setLocaleOverride: (slideGroupId: string, layerId: string, locale: string, patch: LocaleLayerPatch) => void
  clearLocaleOverride: (slideGroupId: string, layerId: string, locale: string) => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const override = row.layer.localeOverrides?.[locale]
  const hasOverride = typeof override?.text === 'string'
  const [draft, setDraft] = useState(override?.text ?? '')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(override?.text ?? '')
  }, [override?.text])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }, [draft])

  const isActiveColumn = locale === activeLocale

  if (locale === defaultLocale) {
    return (
      <div
        className="min-h-[72px] rounded-xl border px-4 py-3 text-sm leading-6 text-[#d9d9e6]"
        style={{
          borderColor: isActiveColumn ? 'rgba(124,110,246,0.45)' : 'rgba(255,255,255,0.08)',
          background: isActiveColumn ? 'rgba(124,110,246,0.08)' : 'rgba(255,255,255,0.02)',
        }}
      >
        “{truncate(row.defaultText ?? '')}”
      </div>
    )
  }

  if (!hasOverride) {
    return (
      <div
        className="min-h-[72px] rounded-xl border border-dashed px-4 py-3"
        style={{
          borderColor: isActiveColumn ? 'rgba(124,110,246,0.4)' : 'rgba(255,255,255,0.14)',
          background: isActiveColumn ? 'rgba(124,110,246,0.06)' : 'rgba(255,255,255,0.015)',
        }}
      >
        <div className="mb-3 text-xs leading-5 text-[#6b6b7a]">
          Inherits: {truncate(row.defaultText ?? '', 72)}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLocaleOverride(row.slideGroupId, row.layerId, locale, { ...(override ?? {}), text: '' })}
            className="rounded-lg border border-[#7c6ef6] bg-[#7c6ef6]/14 px-3 py-1.5 text-xs font-medium text-[#c5befd] transition hover:bg-[#7c6ef6]/22"
          >
            + Add text
          </button>
          <span className="text-xs text-amber-400">⚠ Missing</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-[72px] rounded-xl border px-3 py-3"
      style={{
        borderColor: locale === activeLocale ? '#7c6ef6' : 'rgba(124,110,246,0.66)',
        background: locale === activeLocale ? 'rgba(124,110,246,0.12)' : 'rgba(124,110,246,0.06)',
      }}
    >
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setLocaleOverride(row.slideGroupId, row.layerId, locale, { ...(override ?? {}), text: draft })
        }}
        placeholder="Enter localized text"
        className="w-full resize-none overflow-hidden border-0 bg-transparent text-sm leading-6 text-[#f3f2ff] outline-none placeholder:text-[#9a95c8]"
        rows={1}
      />
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => clearLocaleOverride(row.slideGroupId, row.layerId, locale)}
          className="text-xs font-medium text-[#b9b6c9] transition hover:text-white"
        >
          × Clear
        </button>
      </div>
    </div>
  )
}

export function LocalizationView({ onBack, embedded = false }: LocalizationViewProps) {
  const {
    project,
    activeLocale,
    addLocale,
    setActiveLocale,
    setLocaleOverride,
    clearLocaleOverride,
  } = useEditorStore()
  const { addAsset, getAsset } = useAssetStore()

  const defaultLocale = project.settings.defaultLocale
  const locales = useMemo(() => {
    const defined = project.settings.locales ?? [defaultLocale]
    return [defaultLocale, ...defined.filter((locale) => locale !== defaultLocale)]
  }, [defaultLocale, project.settings.locales])

  const allLocalizableLayers = useMemo(() => getLocalizableLayers(project), [project])

  const groups = useMemo(
    () =>
      project.slideGroups.map((slideGroup) => ({
        slideGroup,
        rows: collectLocalizableRows(slideGroup, slideGroup.layers),
      })),
    [project],
  )

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
  const [addingLocale, setAddingLocale] = useState(false)
  const [localeInput, setLocaleInput] = useState('')
  const [localeError, setLocaleError] = useState('')
  const [uploadTarget, setUploadTarget] = useState<UploadTarget | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const addLocaleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsedSections((prev) => {
      const next = { ...prev }
      for (const { slideGroup } of groups) {
        if (!(slideGroup.id in next)) next[slideGroup.id] = false
      }
      return next
    })
  }, [groups])

  useEffect(() => {
    if (addingLocale) addLocaleInputRef.current?.focus()
  }, [addingLocale])

  const progressByLocale = useMemo(() => {
    const progress = new Map<string, { complete: number; total: number }>()
    for (const locale of locales) {
      const total = allLocalizableLayers.length
      const complete = groups
        .flatMap((group) => group.rows)
        .filter((row) => isOverrideComplete(row, locale, defaultLocale)).length
      progress.set(locale, { complete, total })
    }
    return progress
  }, [allLocalizableLayers.length, defaultLocale, groups, locales])

  const gridTemplateColumns = useMemo(
    () => `200px 240px ${locales.slice(1).map(() => '240px').join(' ')}`.trim(),
    [locales],
  )

  const commitNewLocale = () => {
    const nextLocale = localeInput.trim().toLowerCase()

    if (!nextLocale) {
      setLocaleError('Enter a locale code')
      return
    }
    if (nextLocale === defaultLocale) {
      setLocaleError(`${defaultLocale} is already the default locale`)
      return
    }
    if (locales.includes(nextLocale)) {
      setLocaleError('Locale already exists')
      setActiveLocale(nextLocale)
      return
    }

    addLocale(nextLocale)
    setLocaleInput('')
    setLocaleError('')
    setAddingLocale(false)
  }

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

  return (
    <div className={`relative overflow-hidden bg-[#0f0f13] text-[#e8e8f0] ${embedded ? 'h-full w-full' : 'h-screen w-screen'}`}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-10%] top-[-18%] h-[28rem] w-[28rem] rounded-full bg-[#7c6ef6]/16 blur-3xl" />
        <div className="absolute bottom-[-18%] right-[-8%] h-[24rem] w-[24rem] rounded-full bg-[#ec4899]/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_45%)]" />
      </div>

      <div className="relative flex h-full flex-col">
        <header className="border-b border-white/8 bg-[#111118]/92 px-8 py-6 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-[0.28em] text-[#7c6ef6]">Global content matrix</div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">🌐</span>
                <h1
                  className="m-0 text-[32px] leading-none text-[#f7f4ff]"
                  style={{ fontFamily: 'Iowan Old Style, Palatino Linotype, serif' }}
                >
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

        <section className="border-b border-white/8 bg-[#18181f]/86 px-8 py-4 backdrop-blur-xl">
          <div className="flex flex-wrap items-start gap-3">
            <div className="pt-2 text-xs font-medium uppercase tracking-[0.22em] text-[#6b6b7a]">Locales</div>
            <div className="flex flex-1 flex-wrap gap-2">
              {locales.map((locale) => {
                const progress = progressByLocale.get(locale) ?? { complete: 0, total: 0 }
                const ratio = progress.total === 0 ? 1 : progress.complete / progress.total
                const selected = locale === activeLocale
                const isDefault = locale === defaultLocale

                return (
                  <button
                    key={locale}
                    type="button"
                    onClick={() => setActiveLocale(locale)}
                    className="group rounded-full border px-4 py-2 text-sm transition"
                    style={{
                      borderColor: selected ? 'rgba(124,110,246,0.7)' : 'rgba(255,255,255,0.08)',
                      background: selected ? 'rgba(124,110,246,0.14)' : 'rgba(255,255,255,0.03)',
                      color: selected ? '#f3f1ff' : '#c6c6d2',
                      boxShadow: selected ? '0 0 0 1px rgba(124,110,246,0.18) inset' : 'none',
                    }}
                  >
                    <span className="font-semibold uppercase">{locale}</span>
                    {isDefault ? (
                      <span className="ml-2 text-xs text-[#9f98dc]">default</span>
                    ) : (
                      <span className="ml-2 text-xs text-[#8f90a3] group-hover:text-[#cfcfe1]">
                        <span style={{ color: ratio >= 0.5 ? '#7c6ef6' : '#f59e0b' }}>{ratio >= 0.5 ? '●' : '○'}</span>{' '}
                        {progress.complete}/{progress.total}
                      </span>
                    )}
                  </button>
                )
              })}

              {addingLocale ? (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/4 px-3 py-2">
                  <input
                    ref={addLocaleInputRef}
                    value={localeInput}
                    onChange={(e) => {
                      setLocaleInput(e.target.value)
                      if (localeError) setLocaleError('')
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitNewLocale()
                      if (e.key === 'Escape') {
                        setAddingLocale(false)
                        setLocaleInput('')
                        setLocaleError('')
                      }
                    }}
                    placeholder="e.g. de"
                    className="w-28 rounded-lg border border-white/10 bg-[#0f0f13] px-3 py-1.5 text-sm text-white outline-none placeholder:text-[#6b6b7a] focus:border-[#7c6ef6]"
                  />
                  <button
                    type="button"
                    onClick={commitNewLocale}
                    className="rounded-lg bg-[#7c6ef6] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#8a7df7]"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingLocale(false)
                      setLocaleInput('')
                      setLocaleError('')
                    }}
                    className="rounded-lg px-2 py-1.5 text-xs text-[#8f90a3] transition hover:text-white"
                  >
                    Cancel
                  </button>
                  {localeError ? <div className="text-xs text-amber-400">{localeError}</div> : null}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingLocale(true)}
                  className="rounded-full border border-dashed border-white/12 bg-white/2 px-4 py-2 text-sm font-medium text-[#b7b7c7] transition hover:border-[#7c6ef6]/50 hover:bg-[#7c6ef6]/10 hover:text-white"
                >
                  + Add locale
                </button>
              )}
            </div>
          </div>
        </section>

        <main className="flex-1 overflow-auto px-8 py-7">
          <div className="space-y-6 pb-12">
            {groups.map(({ slideGroup, rows }) => {
              const collapsed = collapsedSections[slideGroup.id] ?? false
              const activeProgress = rows.filter((row) => isOverrideComplete(row, activeLocale, defaultLocale)).length

              return (
                <section
                  key={slideGroup.id}
                  className="overflow-hidden rounded-[24px] border border-white/8 bg-[#18181f]/78 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsedSections((prev) => ({
                        ...prev,
                        [slideGroup.id]: !collapsed,
                      }))
                    }
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-white/[0.03]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-[#d5d2eb]">{collapsed ? '▸' : '▾'}</span>
                      <div>
                        <div
                          className="text-xl text-[#f2efff]"
                          style={{ fontFamily: 'Iowan Old Style, Palatino Linotype, serif' }}
                        >
                          {slideGroup.name}
                        </div>
                        <div className="mt-1 text-sm text-[#7f8094]">
                          {rows.length} localizable {rows.length === 1 ? 'layer' : 'layers'} · {activeProgress}/{rows.length} complete for{' '}
                          <span className="font-medium uppercase text-[#bdb7f6]">{activeLocale}</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-full border border-white/8 bg-white/4 px-3 py-1 text-xs uppercase tracking-[0.18em] text-[#8d8ea3]">
                      {slideGroup.slideWidth} × {slideGroup.slideHeight}
                    </div>
                  </button>

                  {!collapsed ? (
                    <div className="overflow-x-auto border-t border-white/8 px-4 py-4">
                      <div style={{ minWidth: 200 + 240 + Math.max(locales.length - 1, 0) * 240 }}>
                        <div
                          className="grid gap-3 px-2 pb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#78798b]"
                          style={{ gridTemplateColumns }}
                        >
                          <div className="px-3 py-2">Layer</div>
                          <div className="px-3 py-2">{defaultLocale} (default)</div>
                          {locales.slice(1).map((locale) => (
                            <div key={locale} className="px-3 py-2">
                              {locale}
                            </div>
                          ))}
                        </div>

                        <div className="space-y-3 px-2">
                          {rows.map((row) => (
                            <div
                              key={row.layerId}
                              className="grid gap-3"
                              style={{ gridTemplateColumns }}
                            >
                              <div className="flex min-h-[72px] items-center rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 text-sm text-[#a6a7b9]">
                                <div className="flex w-full items-center gap-3" style={{ paddingLeft: row.depth * 18 }}>
                                  <div
                                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-[#111118] text-sm font-semibold"
                                    style={{ color: row.layerType === 'text' ? '#c9c3ff' : '#d9d9e6' }}
                                  >
                                    {getLayerIcon(row.layerType)}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="truncate font-medium text-[#d5d5df]">{row.layerName}</div>
                                    <div className="mt-1 text-xs uppercase tracking-[0.16em] text-[#6b6b7a]">
                                      {row.layerType}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => navigateToLayer(row)}
                                className="min-h-[72px] rounded-xl border px-4 py-3 text-left transition hover:border-[#7c6ef6]/45 hover:bg-[#7c6ef6]/6"
                                style={{
                                  borderColor:
                                    activeLocale === defaultLocale ? 'rgba(124,110,246,0.4)' : 'rgba(255,255,255,0.08)',
                                  background:
                                    activeLocale === defaultLocale ? 'rgba(124,110,246,0.08)' : 'rgba(255,255,255,0.02)',
                                }}
                              >
                                {row.layerType === 'text' ? (
                                  <div className="text-sm leading-6 text-[#dbdbe6]">“{truncate(row.defaultText ?? '', 90)}”</div>
                                ) : (
                                  <div className="flex h-full items-center text-sm text-[#dbdbe6]">
                                    {row.defaultImageRef ? getFileLabel(row.defaultImageRef) : <span className="text-[#6b6b7a]">No image</span>}
                                  </div>
                                )}
                              </button>

                              {locales.slice(1).map((locale) => {
                                const override = row.layer.localeOverrides?.[locale]
                                const isActiveColumn = locale === activeLocale

                                if (row.layerType === 'text') {
                                  return (
                                    <TextOverrideCell
                                      key={`${row.layerId}-${locale}`}
                                      row={row}
                                      locale={locale}
                                      defaultLocale={defaultLocale}
                                      activeLocale={activeLocale}
                                      setLocaleOverride={setLocaleOverride}
                                      clearLocaleOverride={clearLocaleOverride}
                                    />
                                  )
                                }

                                const previewSrc =
                                  row.layerType === 'phone'
                                    ? (override?.screenshotPath ? getAsset(override.screenshotPath) : undefined) ?? override?.screenshotDataUrl
                                    : (override?.src ? getAsset(override.src) : undefined) ?? override?.src

                                return (
                                  <div
                                    key={`${row.layerId}-${locale}`}
                                    className="min-h-[72px] rounded-xl border px-3 py-3"
                                    style={{
                                      borderColor: previewSrc
                                        ? isActiveColumn
                                          ? '#7c6ef6'
                                          : 'rgba(124,110,246,0.45)'
                                        : isActiveColumn
                                          ? 'rgba(124,110,246,0.4)'
                                          : 'rgba(255,255,255,0.14)',
                                      background: previewSrc
                                        ? isActiveColumn
                                          ? 'rgba(124,110,246,0.12)'
                                          : 'rgba(124,110,246,0.06)'
                                        : isActiveColumn
                                          ? 'rgba(124,110,246,0.06)'
                                          : 'rgba(255,255,255,0.015)',
                                    }}
                                  >
                                    {previewSrc ? (
                                      <div className="flex items-center gap-3">
                                        <img
                                          src={previewSrc}
                                          alt={`${row.layerName} ${locale}`}
                                          className="h-12 w-12 rounded-lg border border-white/10 object-cover"
                                        />
                                        <div className="min-w-0 flex-1">
                                          <div className="truncate text-sm text-[#ecebfa]">
                                            {row.layerType === 'phone'
                                              ? getFileLabel(override?.screenshotPath ?? override?.screenshotDataUrl)
                                              : getFileLabel(override?.src)}
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => clearLocaleOverride(row.slideGroupId, row.layerId, locale)}
                                            className="mt-2 text-xs font-medium text-[#b9b6c9] transition hover:text-white"
                                          >
                                            × Clear
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex h-full items-center justify-between gap-3">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openUploadPicker({
                                              slideGroupId: row.slideGroupId,
                                              layerId: row.layerId,
                                              locale,
                                              layerType: row.layerType === 'phone' ? 'phone' : 'image',
                                            })
                                          }
                                          className="rounded-lg border border-[#7c6ef6] bg-[#7c6ef6]/14 px-3 py-1.5 text-xs font-medium text-[#c5befd] transition hover:bg-[#7c6ef6]/22"
                                        >
                                          + Upload
                                        </button>
                                        <span className="text-xs text-amber-400">⚠ Missing</span>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </section>
              )
            })}
          </div>
        </main>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void handleUpload(event)
        }}
      />
    </div>
  )
}
