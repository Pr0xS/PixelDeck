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
import { applyLocale } from '@/utils/locale'
import { applyCanvasFormat, getProjectBaseFormat } from '@/utils/canvasFormats'
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

// ─── Deterministic capture readiness ─────────────────────────────────────────

/** Consecutive identical frames required before the stage counts as settled. */
const SETTLE_QUIET_FRAMES = 10
/** Hard ceiling per group — capture proceeds (with a warning) if exceeded. */
const SETTLE_TIMEOUT_MS = 15000

const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve))

/** Wait until the Konva stage ref is mounted (it appears a frame after phase flips). */
async function waitForStage(stageRef: React.RefObject<Konva.Stage | null>): Promise<Konva.Stage | null> {
  const start = performance.now()
  while (performance.now() - start < SETTLE_TIMEOUT_MS) {
    if (stageRef.current) return stageRef.current
    await nextFrame()
  }
  return stageRef.current
}

/**
 * Wait until every Konva.Image in the stage holds a fully decoded image and
 * the image set has been stable for SETTLE_QUIET_FRAMES consecutive frames.
 *
 * This replaces the old fixed setTimeout delays: async image loads (use-image)
 * mount Konva.Image nodes only after load, so we poll until the node count
 * stops changing AND every present image reports complete. Fast machines
 * capture in a few frames; slow CI boxes wait exactly as long as needed.
 */
async function waitForStageSettled(stage: Konva.Stage): Promise<void> {
  const start = performance.now()
  let stableFrames = 0
  let lastCount = -1

  while (performance.now() - start < SETTLE_TIMEOUT_MS) {
    await nextFrame()
    const images = stage.find('Image')
    const allLoaded = images.every((node) => {
      const img = (node as Konva.Image).image()
      if (!img) return false
      if (img instanceof HTMLImageElement) return img.complete && img.naturalWidth > 0
      return true
    })

    if (allLoaded && images.length === lastCount) {
      stableFrames += 1
      if (stableFrames >= SETTLE_QUIET_FRAMES) return
    } else {
      stableFrames = 0
    }
    lastCount = images.length
  }
  console.warn('[ExportApp] stage did not settle within timeout — capturing anyway')
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
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0)
  const [phase, setPhase] = useState<'loading' | 'rendering' | 'done'>('loading')
  const resultsRef = useRef<ExportResult[]>([])

  const importProject = useEditorStore((s) => s.importProject)
  const project = useEditorStore((s) => s.project)
  const setActiveSlideGroup = useEditorStore((s) => s.setActiveSlideGroup)
  const activeLocale = useEditorStore((s) => s.activeLocale)
  const addAsset = useAssetStore((s) => s.addAsset)
  const addFont = useFontStore((s) => s.addFont)
  const getFont = useFontStore((s) => s.getFont)
  // useMemo prevents a new object reference on every render, which would cause
  // the Phase 2 effect to re-run in an infinite loop for non-default locales.
  // Apply locale + base format projection. The base format pass is a no-op for
  // scaling but filters layers hidden in the base format ("only Android" etc.),
  // keeping CLI output consistent with the editor's base view.
  const localizedProject = useMemo(
    () => applyCanvasFormat(applyLocale(project, activeLocale), getProjectBaseFormat(project)),
    [project, activeLocale],
  )

  const config = window.__EXPORT_CONFIG__ as ExportConfig | undefined

  const captureGroup = (group: SlideGroup) => {
    const stage = stageRef.current
    if (!stage) {
      console.error('[ExportApp] Stage not ready for group', group.id)
      return
    }

    for (let i = 0; i < group.numSlides; i++) {
      const name = group.slideNames[i] ?? `slide-${i + 1}`
      try {
        const dataUrl = stage.toDataURL({
          x: i * group.slideWidth,
          y: 0,
          width: group.slideWidth,
          height: group.slideHeight,
          pixelRatio: 1,
          mimeType: 'image/png',
        })
        resultsRef.current.push({ name, dataUrl })
        console.log(`[ExportApp] captured ${name}`)
      } catch (err) {
        console.error(`[ExportApp] failed to capture ${name}:`, err)
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

    // Populate asset store
    for (const [filename, dataUrl] of Object.entries(config.assets ?? {})) {
      addAsset(filename, dataUrl)
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

    const groups = localizedProject.slideGroups
    if (groups.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      finalize()
      return
    }

    const group = groups[currentGroupIndex]
    if (!group) {
      finalize()
      return
    }

    setActiveSlideGroup(group.id)

    let cancelled = false
    const run = async () => {
      // Secondary font-readiness guard — fonts are already loaded in Phase 1,
      // but this covers any late-injected webfonts triggered by first render.
      try {
        await document.fonts.ready
      } catch {
        // FontFaceSet unavailable — rely on the settle polling below
      }
      // Deterministic readiness: wait for the stage to mount and for all
      // Konva images to be decoded and stable, then paint two final frames.
      const stage = await waitForStage(stageRef)
      if (stage) await waitForStageSettled(stage)
      await nextFrame()
      await nextFrame()
      if (cancelled) return

      captureGroup(group)

      const next = currentGroupIndex + 1
      if (next < groups.length) {
        setCurrentGroupIndex(next)
      } else {
        finalize()
      }
    }
    void run()

    return () => { cancelled = true }
  }, [phase, currentGroupIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ────────────────────────────────────────────────────────────────
  if (!config) {
    return <div style={{ color: 'red' }}>No export config</div>
  }

  const group = localizedProject.slideGroups[currentGroupIndex]

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
