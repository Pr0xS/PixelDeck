import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '@/store'
import { useAssetStore } from '@/store/assets'
import { useApiKeysStore } from '@/store/apiKeys'
import type { Layer, LocaleLayerPatch, LocalizationMode, SlideGroup, TextLayer } from '@/types'
import { effectiveLocalizationMode, getLanguageName } from '@/utils/locale'
import { translateLayerText, translateGroupTexts } from '@/ai/features/translateText'
import type { AiAuth } from '@/ai/features/translateText'
// import { generateLocalizedImage } from '@/ai/features/localizeImage' // TODO: re-enable when AI image generation is ready
import { collectLocalizableRows, isOverrideComplete, readFileAsDataUrl, buildLocaleAssetKey, findLayerById } from './localization/helpers'
import { cellKey, type CellKey, type CellStatus, type LocalizableRow, type UploadTarget } from './localization/types'
import { LocaleBar } from './localization/LocaleBar'
import { BulkTranslateBar } from './localization/BulkTranslateBar'
import { SlideGroupSection } from './localization/SlideGroupSection'

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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LocalizationView({ onBack, embedded = false, onPreview }: LocalizationViewProps) {
  const {
    project,
    activeLocale,
    addLocale,
    removeLocale,
    relabelDefaultLocale,
    setActiveLocale,
    setLocaleOverride,
    clearLocaleOverride,
    setLocaleOverridesBatch,
    updateLayerInSlideGroup,
  } = useEditorStore(useShallow((s) => ({
    project: s.project,
    activeLocale: s.activeLocale,
    addLocale: s.addLocale,
    removeLocale: s.removeLocale,
    relabelDefaultLocale: s.relabelDefaultLocale,
    setActiveLocale: s.setActiveLocale,
    setLocaleOverride: s.setLocaleOverride,
    clearLocaleOverride: s.clearLocaleOverride,
    setLocaleOverridesBatch: s.setLocaleOverridesBatch,
    updateLayerInSlideGroup: s.updateLayerInSlideGroup,
  })))
  const { addAsset, getAsset } = useAssetStore(useShallow((s) => ({ addAsset: s.addAsset, getAsset: s.getAsset })))
  const { provider, getActiveKey, getActiveModel, getActiveBaseUrl } = useApiKeysStore()

  const defaultLocale = project.settings.defaultLocale
  const brandColors = useMemo(() => project.settings.brandColors ?? [], [project.settings.brandColors])
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
  // Optimistic bulk AI results: displayed immediately, then committed once at
  // the end via setLocaleOverridesBatch so the operation remains one undo step.
  const [bulkPreviewOverrides, setBulkPreviewOverrides] = useState<Map<CellKey, LocaleLayerPatch>>(new Map())
  const [isBulkRunning, setIsBulkRunning] = useState(false)
  const [overwriteExisting, setOverwriteExisting] = useState(false)
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false)
  // Cancellation flag for the bulk worker pool — a ref so in-flight workers see it
  const bulkCancelRef = useRef(false)
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
    const auth: AiAuth = { provider, apiKey, model, baseUrl: getActiveBaseUrl() }
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
      setCellError((m) => new Map(m).set(key, getErrorMessage(e)))
      setCellStatus((m) => new Map(m).set(key, 'error'))
    }
  }, [getActiveBaseUrl, getActiveKey, getActiveModel, markFormattingLost, project, provider, setLocaleOverride])

  // TODO: AI image generation disabled temporarily — re-enable when ready.
  // Handler and import are preserved in git history. See localizeImage.ts + editImage() in client.ts.

  // ─ Bulk AI translate
  // One request per (slide group × locale) with ALL the group's texts and the
  // full design context — the model sees the whole narrative and keeps
  // terminology consistent. Falls back to per-item calls if the batch fails.
  const handleBulkTranslate = useCallback(async () => {
    const apiKey = getActiveKey()
    const model = getActiveModel()
    if (!apiKey || isBulkRunning) return

    const nonDefaultLocales = locales.filter((l) => l !== defaultLocale)
    const auth: AiAuth = { provider, apiKey, model, baseUrl: getActiveBaseUrl() }

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
    setBulkPreviewOverrides(new Map())

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

    function recordBulkTranslation(row: LocalizableRow, locale: string, result: { text: string; marks?: TextLayer['marks'] }) {
      const patch: LocaleLayerPatch = { text: result.text, marks: result.marks }
      staged.push({
        slideGroupId: row.slideGroupId,
        layerId: row.layerId,
        locale,
        patch,
      })
      setBulkPreviewOverrides((m) => new Map(m).set(cellKey(row.layerId, locale), patch))
    }

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
              recordBulkTranslation(row, batch.locale, result)
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
              recordBulkTranslation(row, batch.locale, result)
              markFormattingLost(key, Boolean(result.formattingLost))
              setCellStatus((m) => new Map(m).set(key, 'done'))
            } catch (e) {
              setCellError((m) => new Map(m).set(key, getErrorMessage(e)))
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
    setBulkPreviewOverrides(new Map())

    setIsBulkRunning(false)
  }, [defaultLocale, getActiveBaseUrl, getActiveKey, getActiveModel, groups, isBulkRunning, locales, markFormattingLost, overwriteExisting, project, provider, setLocaleOverridesBatch])

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
    relabelDefaultLocale(locale)
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
        {/* ── Locale bar ── */}
        <LocaleBar
          locales={locales}
          defaultLocale={defaultLocale}
          activeLocale={activeLocale}
          progressByLocale={progressByLocale}
          showDefaultLocalePicker={showDefaultLocalePicker}
          showAddLocale={showAddLocale}
          defaultLocaleAnchorRef={defaultLocaleAnchorRef}
          addLocaleAnchorRef={addLocaleAnchorRef}
          onPreview={onPreview}
          onBack={onBack}
          setActiveLocale={setActiveLocale}
          setShowDefaultLocalePicker={setShowDefaultLocalePicker}
          setShowAddLocale={setShowAddLocale}
          handleRemoveLocale={handleRemoveLocale}
          handleDefaultLocaleChange={handleDefaultLocaleChange}
          addLocale={addLocale}
          setAddLocaleOpen={setShowAddLocale}
        />

        {/* ── Bulk translate toolbar ── */}
        <BulkTranslateBar
          nonDefaultLocales={nonDefaultLocales}
          bulkEligibleCount={bulkEligibleCount}
          hasApiKey={hasApiKey}
          isBulkRunning={isBulkRunning}
          overwriteExisting={overwriteExisting}
          setOverwriteExisting={setOverwriteExisting}
          onBulkTranslate={handleBulkTranslate}
          bulkCancelRef={bulkCancelRef}
          onOpenAiSettings={() => setAiSettingsOpen(true)}
        />

        {/* ── Table ── */}
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-auto px-8 py-7">
            <div className="space-y-6 pb-12">
              {groups.map(({ slideGroup, rows }) => (
                <SlideGroupSection
                  key={slideGroup.id}
                  slideGroup={slideGroup}
                  rows={rows}
                  collapsed={collapsedSections[slideGroup.id] ?? false}
                  onToggleCollapse={() => setCollapsedSections((prev) => ({ ...prev, [slideGroup.id]: !(prev[slideGroup.id] ?? false) }))}
                  activeLocale={activeLocale}
                  defaultLocale={defaultLocale}
                  brandColors={brandColors}
                  locales={locales}
                  gridTemplateColumns={gridTemplateColumns}
                  cellStatus={cellStatus}
                  cellError={cellError}
                  previewOverrides={bulkPreviewOverrides}
                  lostFormattingCells={lostFormattingCells}
                  toolbarSlotEl={toolbarSlotEl}
                  onSingleAiTranslate={(row, locale) => void handleSingleAiTranslate(row, locale)}
                  onNavigateToLayer={navigateToLayer}
                  onModeUpdate={handleModeUpdate}
                  updateLayerInSlideGroup={updateLayerInSlideGroup}
                  setLocaleOverride={setLocaleOverride}
                  clearLocaleOverride={clearLocaleOverride}
                  getAsset={getAsset}
                  openUploadPicker={openUploadPicker}
                  setEditingTextCell={setEditingTextCell}
                />
              ))}

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
