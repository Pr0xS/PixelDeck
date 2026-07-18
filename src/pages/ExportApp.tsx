/**
 * ExportApp — headless render mode for the CLI pipeline.
 *
 * Flow:
 *  1. CLI injects window.__EXPORT_CONFIG__ via Playwright addInitScript
 *  2. main.tsx detects it and mounts ExportApp instead of App
 *  3. ExportApp loads project + assets into stores, renders each SlideGroup
 *  4. After images settle, captures every slide via stage.toDataURL
 *  5. Writes results to window.__EXPORT_RESULTS__ and sets window.__EXPORT_DONE__ = true
 *  6. CLI reads results, saves PNGs, exits
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer } from 'react-konva'
import type Konva from 'konva'
import { useEditorStore } from '@/store'
import { useAssetStore } from '@/store/assets'
import { useFontStore } from '@/store/fontStore'
import { getProjectBaseFormat } from '@/utils/canvasFormats'
import { buildExportPlan, type ExportPlanBatch } from '@/utils/exportPlan'
import { acquireCaptureLock, waitForStage, waitForStageCaptureReady } from '@/utils/stageCapture'
import { loadGoogleFonts, registerCustomFonts } from '@/utils/fonts'
import { LayerNode } from '@/components/canvas/LayerNode'
import type { Layer as AppLayer, Project, SlideGroup } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExportConfig {
  project: Project
  assets: Record<string, string>   // filename → dataUrl (images)
  fonts?: Record<string, string>   // filename → dataUrl (custom fonts)
  /** Locale to export. Defaults to project.settings.defaultLocale if omitted. */
  locale?: string
}

export interface ExportResult {
  name: string      // slide filename (without .png)
  dataUrl: string   // PNG data URL
}

declare global {
  interface Window {
    __EXPORT_CONFIG__?: unknown
    __EXPORT_RESULTS__?: ExportResult[]
    __EXPORT_DONE__?: boolean
    __EXPORT_ERROR__?: string
  }
}

// ─── Single-group headless canvas ────────────────────────────────────────────

interface HeadlessCanvasProps {
  group: SlideGroup
  stageRef: React.RefObject<Konva.Stage | null>
}

function HeadlessCanvas({ group, stageRef }: HeadlessCanvasProps) {
  const totalWidth = group.slideWidth * group.numSlides
  const totalHeight = group.slideHeight
  const noop = () => {}

  return (
    <Stage ref={stageRef} width={totalWidth} height={totalHeight}>
      <Layer>
        {group.layers.map((layer) => (
          <LayerNode
            key={layer.id}
            layer={layer as AppLayer}
            isSelected={false}
            onSelect={noop}
            onDragEnd={noop}
            onTransformEnd={noop}
            canvasWidth={totalWidth}
            canvasHeight={totalHeight}
          />
        ))}
      </Layer>
    </Stage>
  )
}

// ─── Main ExportApp ───────────────────────────────────────────────────────────

export function ExportApp() {
  const stageRef = useRef<Konva.Stage | null>(null)
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0)
  const [phase, setPhase] = useState<'loading' | 'rendering' | 'done'>('loading')
  const resultsRef = useRef<ExportResult[]>([])

  const importProject = useEditorStore((s) => s.importProject)
  const project = useEditorStore((s) => s.project)
  const setActiveSlideGroup = useEditorStore((s) => s.setActiveSlideGroup)
  const activeLocale = useEditorStore((s) => s.activeLocale)
  const addAsset = useAssetStore((s) => s.addAsset)
  const addFont = useFontStore((s) => s.addFont)
  const getFont = useFontStore((s) => s.getFont)
  // The CLI explicitly targets base (single-format headless export); browser
  // exports use the same planner with the configured active formats.
  // NOTE (v0.4.x): CLI output filenames use the shared planner naming —
  // `<group>__<slide>.png`, sanitized and collision-safe. This intentionally
  // replaced the old raw `<slide>.png` naming, which let two groups with the
  // same slide names overwrite each other's files. See cli/README.md.
  const exportPlan = useMemo(
    () => buildExportPlan(project, {
      formatIds: [getProjectBaseFormat(project)],
      locales: [activeLocale],
      scope: 'project',
    }),
    [project, activeLocale],
  )

  const config = window.__EXPORT_CONFIG__ as ExportConfig | undefined

  const captureBatch = (batch: ExportPlanBatch) => {
    const stage = stageRef.current
    if (!stage) {
      console.error('[ExportApp] Stage not ready for group', batch.group.id)
      return
    }

    for (const entry of batch.entries) {
      if (entry.slideIndex === null) continue
      try {
        const dataUrl = stage.toDataURL({
          x: entry.slideIndex * batch.group.slideWidth,
          y: 0,
          width: batch.group.slideWidth,
          height: batch.group.slideHeight,
          pixelRatio: 1,
          mimeType: 'image/png',
        })
        resultsRef.current.push({ name: entry.name, dataUrl })
        console.log(`[ExportApp] captured ${entry.name}`)
      } catch (err) {
        console.error(`[ExportApp] failed to capture ${entry.name}:`, err)
      }
    }
  }

  const finalize = () => {
    window.__EXPORT_RESULTS__ = resultsRef.current
    window.__EXPORT_DONE__ = true
    console.log(`[ExportApp] done — ${resultsRef.current.length} slides exported`)
    setPhase('done')
  }

  // ── Phase 1: Load config into stores ────────────────────────────────────────
  useEffect(() => {
    if (!config) {
      window.__EXPORT_ERROR__ = 'window.__EXPORT_CONFIG__ not found'
      window.__EXPORT_DONE__ = true
      return
    }

    // Load project — surface malformed project files to the CLI instead of hanging
    try {
      importProject(JSON.stringify(config.project))
    } catch (err) {
      window.__EXPORT_ERROR__ = err instanceof Error ? err.message : String(err)
      window.__EXPORT_DONE__ = true
      return
    }

    // Apply locale if specified
    const locale = config.locale ?? config.project.settings?.defaultLocale ?? 'en'
    useEditorStore.getState().setActiveLocale(locale)

    // Start with first group
    const firstId = config.project.slideGroups?.[0]?.id
    if (firstId) setActiveSlideGroup(firstId)

    // Populate font store with custom fonts from config
    for (const [filename, dataUrl] of Object.entries(config.fonts ?? {})) {
      addFont(filename, dataUrl)
    }

    // Pre-decode all asset images so use-image resolves from cache during render.
    const preload = async () => {
      // Headless mode still uses an explicit project scope. Wait for hydration
      // before adding CLI-provided assets so an async scope load cannot replace them.
      await useAssetStore.getState().setActiveProject(config.project.id)
      for (const [filename, dataUrl] of Object.entries(config.assets ?? {})) {
        addAsset(filename, dataUrl)
      }

      await Promise.all(
        Object.values(config.assets ?? {}).map(
          (dataUrl) =>
            new Promise<void>((resolve) => {
              const img = new Image()
              img.onload = () => resolve()
              img.onerror = () => resolve()
              img.src = dataUrl
            }),
        ),
      )

      // Load Google Fonts stylesheet
      loadGoogleFonts()

      // Load custom fonts from project registry
      if (config.project.customFonts?.length) {
        await registerCustomFonts(config.project.customFonts, getFont)
      }

      // Wait for all fonts (Google + custom) to be parsed and available
      try {
        await document.fonts.ready
      } catch {
        // FontFaceSet unavailable in this environment — continue
      }

      setPhase('rendering')
    }
    void preload()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Phase 2: Iterate groups, render + capture ────────────────────────────────
  useEffect(() => {
    if (phase !== 'rendering') return

    const batches = exportPlan.batches
    if (batches.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      finalize()
      return
    }

    const batch = batches[currentBatchIndex]
    if (!batch) {
      finalize()
      return
    }

    let cancelled = false
    const run = async () => {
      // Secondary font-readiness guard — fonts are already loaded in Phase 1,
      // but this covers any late-injected webfonts triggered by first render.
      try {
        await document.fonts.ready
      } catch {
        // FontFaceSet unavailable — rely on the settle polling below
      }
      const release = await acquireCaptureLock()
      try {
        if (cancelled) return
        useEditorStore.getState().setActiveLocale(batch.locale)
        useEditorStore.getState().setActiveCanvasFormat(batch.formatId)
        setActiveSlideGroup(batch.group.id)

        const stage = await waitForStage(stageRef)
        if (stage) await waitForStageCaptureReady(stage)
        if (cancelled) return

        captureBatch(batch)

        const next = currentBatchIndex + 1
        if (next < batches.length) {
          setCurrentBatchIndex(next)
        } else {
          finalize()
        }
      } finally {
        release()
      }
    }
    void run()

    return () => { cancelled = true }
  }, [phase, currentBatchIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ────────────────────────────────────────────────────────────────
  if (!config) {
    return <div style={{ color: 'red' }}>No export config</div>
  }

  const group = exportPlan.batches[currentBatchIndex]?.group

  if (phase === 'loading' || !group) {
    return <div style={{ color: '#888', padding: 20 }}>Loading…</div>
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0,
        // Render at full resolution but out of sight — Chromium still renders it
        pointerEvents: 'none',
        background: '#000',
      }}
    >
      <HeadlessCanvas group={group} stageRef={stageRef} />
    </div>
  )
}
