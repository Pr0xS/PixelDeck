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
import { Stage, Layer, Rect, Ellipse } from 'react-konva'
import type Konva from 'konva'
import { useEditorStore } from '@/store'
import { useAssetStore } from '@/store/assets'
import { fillToKonvaProps } from '@/utils/gradients'
import { applyLocale } from '@/utils/locale'
import { LayerNode } from '@/components/canvas/LayerNode'
import type { Layer as AppLayer, Project, SlideGroup } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExportConfig {
  project: Project
  assets: Record<string, string>  // filename → dataUrl
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
  const { updateLayer } = useEditorStore()

  const totalWidth = group.slideWidth * group.numSlides
  const totalHeight = group.slideHeight
  // Legacy background field (deprecated — BackgroundLayer is now in layers[0])
  const bg = group.background

  const handleDragEnd = (layerId: string, x: number, y: number) => {
    updateLayer(layerId, { x, y } as Partial<AppLayer>)
  }

  return (
    <Stage ref={stageRef} width={totalWidth} height={totalHeight}>
      {/* Legacy background (only rendered when no BackgroundLayer in layers) */}
      {bg && (
      <Layer listening={false}>
        <Rect
          x={0} y={0}
          width={totalWidth} height={totalHeight}
          {...fillToKonvaProps(bg.fill, totalWidth, totalHeight)}
        />
        {bg.accents?.map((accent, i) => (
            <Ellipse
              key={i}
              x={(accent.cx / 100) * totalWidth}
              y={(accent.cy / 100) * totalHeight}
              radiusX={accent.rx}
              radiusY={accent.ry}
              fill={accent.color}
              listening={false}
            />
          ))}
      </Layer>
      )}

      {/* Content */}
      <Layer>
        {group.layers.map((layer) => (
          <LayerNode
            key={layer.id}
            layer={layer as AppLayer}
            isSelected={false}
            onSelect={() => {}}
            onDragEnd={(x, y) => handleDragEnd(layer.id, x, y)}
            onTransformEnd={() => {}}
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

  const { importProject, project, setActiveSlideGroup } = useEditorStore()
  const activeLocale = useEditorStore((s) => s.activeLocale)
  const { addAsset } = useAssetStore()
  // useMemo prevents a new object reference on every render, which would cause
  // the Phase 2 effect to re-run in an infinite loop for non-default locales.
  const localizedProject = useMemo(
    () => applyLocale(project, activeLocale),
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

    // Load project
    importProject(JSON.stringify(config.project))

    // Apply locale if specified
    const locale = config.locale ?? config.project.settings?.defaultLocale ?? 'en'
    useEditorStore.getState().setActiveLocale(locale)

    // Start with first group
    const firstId = config.project.slideGroups?.[0]?.id
    if (firstId) setActiveSlideGroup(firstId)

    // Brief settle before rendering
    setTimeout(() => setPhase('rendering'), 300)
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

    // Wait for React + Konva to render the new group (images settle in ~1.5s)
    const captureDelay = currentGroupIndex === 0 ? 2500 : 1500
    const timer = setTimeout(async () => {
      captureGroup(group)

      const next = currentGroupIndex + 1
      if (next < groups.length) {
        setCurrentGroupIndex(next)
      } else {
        finalize()
      }
    }, captureDelay)

    return () => clearTimeout(timer)
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
