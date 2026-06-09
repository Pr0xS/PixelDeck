import { useEffect, useRef, useState } from 'react'
import type { FocusEvent } from 'react'
import { useEditorStore } from '@/store'
import { useAssetStore } from '@/store/assets'
import type {
  Layer,
  BackgroundLayer,
  PhoneLayer,
  TextLayer,
  TextSpan,
  ImageLayer,
  ShapeLayer,
  ChipsLayer,
  BrandLayer,
  GroupLayer,
  SlideGroup,
  FillValue,
  ChipItem,
  ChipVariant,
} from '@/types'
import { fileToDataUrl } from '@/utils/svgToImage'
import { ColorField, FillControl, SliderField } from '@/components/properties/PropertyControls'
import { FONT_LIST, getFontWeights } from '@/utils/fonts'
import { PHONE_MODELS } from '@/assets/mockups/specs'

const pauseTemporal = () => useEditorStore.temporal.getState().pause()
const resumeTemporal = () => useEditorStore.temporal.getState().resume()

const inputCls =
  'bg-[#0f0f13] border border-[rgba(255,255,255,0.1)] rounded px-2 py-1 text-sm text-[#e8e8f0] w-full focus:outline-none focus:border-[rgba(124,110,246,0.5)]'
const labelCls = 'text-[11px] text-[#6b6b7a] mb-1 block uppercase tracking-[0.08em]'
const rowCls = 'flex gap-2 mb-3'
const fieldCls = 'flex-1 min-w-0'
const panelSectionCls = 'mb-4 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-3'
const subtleButtonCls =
  'text-xs text-[#e8e8f0] px-3 py-1.5 rounded-lg border border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.18)] hover:bg-[rgba(255,255,255,0.06)] transition-colors'

type PanelTab = 'layout' | 'style' | 'content'

function BackgroundProperties({ layer }: { layer: BackgroundLayer }) {
  const { updateLayer } = useEditorStore()
  const upd = (patch: Partial<BackgroundLayer>) => updateLayer(layer.id, patch as Partial<Layer>)

  return (
    <div className="mb-3">
      <label className={labelCls}>Fill</label>
      <FillControl
        key={layer.id}
        fill={layer.fill}
        onChange={(fill) => upd({ fill })}
        onInteractionStart={pauseTemporal}
        onInteractionEnd={resumeTemporal}
      />
    </div>
  )
}

function LayoutTab({ layer }: { layer: Layer }) {
  const { updateLayer, project, activeSlideGroupId } = useEditorStore()
  const upd = (patch: Partial<Layer>) => updateLayer(layer.id, patch)
  const isBackground = layer.type === 'background'
  const sizeLayer = layer.type === 'shape' || layer.type === 'image' ? layer : null

  // Dynamic ranges based on actual canvas dimensions
  const activeGroup = project.slideGroups.find((g) => g.id === activeSlideGroupId)
  const canvasW = activeGroup ? activeGroup.slideWidth * activeGroup.numSlides : 1080
  const canvasH = activeGroup ? activeGroup.slideHeight : 1920
  const xMin = -Math.round(canvasW * 0.25)
  const xMax = Math.round(canvasW * 1.25)
  const yMin = -Math.round(canvasH * 0.25)
  const yMax = Math.round(canvasH * 1.25)

  return (
    <div className="space-y-4">
      {/* Name + visibility/lock */}
      <div className={panelSectionCls}>
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <label className={labelCls}>Name</label>
            <input
              type="text"
              value={layer.name}
              onChange={(e) => upd({ name: e.target.value })}
              className={inputCls}
            />
          </div>
          {!isBackground && (
            <div className="flex gap-1 pt-[18px]">
              <button
                type="button"
                title={layer.visible ? 'Hide layer' : 'Show layer'}
                onClick={() => upd({ visible: !layer.visible })}
                className={`h-[30px] w-[30px] flex items-center justify-center rounded border text-sm transition-colors ${
                  layer.visible
                    ? 'border-[rgba(255,255,255,0.12)] text-[#e8e8f0]'
                    : 'border-[rgba(255,255,255,0.06)] text-[#3a3a4a]'
                } hover:border-[rgba(255,255,255,0.22)]`}
              >
                {layer.visible ? '●' : '○'}
              </button>
              <button
                type="button"
                title={layer.locked ? 'Unlock layer' : 'Lock layer'}
                onClick={() => upd({ locked: !layer.locked })}
                className={`h-[30px] w-[30px] flex items-center justify-center rounded border text-xs transition-colors ${
                  layer.locked
                    ? 'border-[#7c6ef6] text-[#7c6ef6] bg-[rgba(124,110,246,0.1)]'
                    : 'border-[rgba(255,255,255,0.1)] text-[#6b6b7a]'
                } hover:border-[rgba(255,255,255,0.22)]`}
              >
                {layer.locked ? '⚿' : '⚷'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Position / Size / Rotation — not applicable for background */}
      <div className={panelSectionCls}>
        {!isBackground && (
          <>
            <SliderField label="X" value={layer.x} min={xMin} max={xMax} unit="px" onChange={(v) => upd({ x: v })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />
            <SliderField label="Y" value={layer.y} min={yMin} max={yMax} unit="px" onChange={(v) => upd({ y: v })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />
            {sizeLayer && (
              <>
                <SliderField label="W" value={sizeLayer.width} min={1} max={canvasW} unit="px" onChange={(v) => upd({ width: v } as Partial<Layer>)} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />
                <SliderField label="H" value={sizeLayer.height} min={1} max={canvasH} unit="px" onChange={(v) => upd({ height: v } as Partial<Layer>)} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />
              </>
            )}
            <SliderField label="Rotation" value={layer.rotation} min={-180} max={180} unit="°" onChange={(v) => upd({ rotation: v })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />
          </>
        )}
        <SliderField label="Opacity" value={Math.round(layer.opacity * 100)} min={0} max={100} unit="%" onChange={(v) => upd({ opacity: v / 100 })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} className="!mb-0" />
      </div>
    </div>
  )
}

function ShadowControls({ layer }: { layer: Layer }) {
  const { updateLayer } = useEditorStore()
  const upd = (patch: Partial<Layer>) => updateLayer(layer.id, patch)

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className={labelCls + ' !mb-0'}>Shadow</label>
        <button
          type="button"
          onClick={() => {
            if (layer.shadow) {
              upd({ shadow: undefined })
            } else {
              upd({ shadow: { color: '#000000', blur: 20, offsetX: 0, offsetY: 4, opacity: 0.5 } })
            }
          }}
          className={`relative h-6 w-11 rounded-full border transition-colors ${layer.shadow ? 'border-[#7c6ef6] bg-[#7c6ef6]' : 'border-[rgba(255,255,255,0.12)] bg-[#0f0f13]'}`}
        >
          <span className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white transition-all ${layer.shadow ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>

      {layer.shadow && (
        <div className="space-y-3 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-3">
          <div>
            <label className={labelCls}>Color</label>
            <ColorField value={layer.shadow.color} onChange={(value) => upd({ shadow: { ...layer.shadow!, color: value } })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />
          </div>
          <SliderField label="Blur" value={layer.shadow.blur} min={0} max={100} unit="px" onChange={(v) => upd({ shadow: { ...layer.shadow!, blur: v } })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />
          <SliderField label="Opacity" value={Math.round(layer.shadow.opacity * 100)} min={0} max={100} unit="%" onChange={(v) => upd({ shadow: { ...layer.shadow!, opacity: v / 100 } })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />
          <SliderField label="Offset X" value={layer.shadow.offsetX} min={-100} max={100} unit="px" onChange={(v) => upd({ shadow: { ...layer.shadow!, offsetX: v } })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />
          <SliderField label="Offset Y" value={layer.shadow.offsetY} min={-100} max={100} unit="px" onChange={(v) => upd({ shadow: { ...layer.shadow!, offsetY: v } })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} className="!mb-0" />
        </div>
      )}
    </div>
  )
}

function StyleTab({ layer }: { layer: Layer }) {
  const { updateLayer } = useEditorStore()
  const upd = (patch: Partial<Layer>) => updateLayer(layer.id, patch)

  // Fill value for layers that have one
  const fillValue: FillValue | null =
    layer.type === 'text' ? layer.fill
    : layer.type === 'shape' ? layer.fill
    : layer.type === 'background' ? (layer as BackgroundLayer).fill
    : null

  return (
    <div className="space-y-4">
      {/* Fill — background, text, shape */}
      {fillValue !== null && (
        <div className={panelSectionCls}>
          <label className={labelCls}>Fill</label>
          {/* key=layer.id resets editor state (selected stop, drag) when switching layers */}
          <FillControl
            key={layer.id}
            fill={fillValue}
            onChange={(fill) => upd({ fill } as Partial<Layer>)}
            onInteractionStart={pauseTemporal}
            onInteractionEnd={resumeTemporal}
          />
        </div>
      )}

      {/* Shape: stroke */}
      {layer.type === 'shape' && (
        <div className={panelSectionCls}>
          <div className={rowCls + ' !mb-0'}>
            <div className={fieldCls}>
              <label className={labelCls}>Stroke</label>
              <ColorField value={layer.stroke ?? '#FFFFFF'} onChange={(value) => upd({ stroke: value } as Partial<Layer>)} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />
            </div>
            <div className={fieldCls}>
              <SliderField label="Width" value={layer.strokeWidth ?? 0} min={0} max={50} unit="px" onChange={(v) => upd({ strokeWidth: v } as Partial<Layer>)} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} className="!mb-0" />
            </div>
          </div>
        </div>
      )}

      {/* Blur + Shadow — all layers */}
      <div className={panelSectionCls}>
        <SliderField label="Blur" value={layer.blur ?? 0} min={0} max={100} unit="px" onChange={(v) => upd({ blur: v })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />
        <ShadowControls layer={layer} />
      </div>
    </div>
  )
}

function PhoneContent({ layer }: { layer: PhoneLayer }) {
  const { updateLayer } = useEditorStore()
  const upd = (patch: Partial<PhoneLayer>) => updateLayer(layer.id, patch as Partial<Layer>)
  const screenshotInputRef = useRef<HTMLInputElement>(null)
  const addAsset = useAssetStore((s) => s.addAsset)
  const assets = useAssetStore((s) => s.assets)  // reactive to IDB hydration

  const handleScreenshotFile = async (file: File) => {
    const dataUrl = await fileToDataUrl(file)
    addAsset(file.name, dataUrl)
    upd({ screenshotPath: file.name, screenshotDataUrl: undefined })
  }

  const previewSrc = layer.screenshotPath ? assets[layer.screenshotPath]?.dataUrl ?? layer.screenshotDataUrl : layer.screenshotDataUrl
  const screenshotLabel = layer.screenshotPath ? layer.screenshotPath : layer.screenshotDataUrl ? 'Inline (legacy)' : null

  return (
    <div className="space-y-4">
      <div className={panelSectionCls}>
        <label className={labelCls}>Phone Model</label>
        <select value={layer.model} onChange={(e) => upd({ model: e.target.value as PhoneLayer['model'] })} className={inputCls}>
          {PHONE_MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>

      <div className={panelSectionCls}>
        {/* Status bar toggle */}
        <div className="mb-3 flex items-center justify-between">
          <label className={labelCls + ' !mb-0'}>Status Bar</label>
          <button
            type="button"
            onClick={() => upd({ showStatusBar: !(layer.showStatusBar ?? true) })}
            className={`relative h-5 w-9 rounded-full transition-colors ${(layer.showStatusBar ?? true) ? 'bg-[#7c6ef6]' : 'bg-[rgba(255,255,255,0.12)]'}`}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${(layer.showStatusBar ?? true) ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </button>
        </div>
        {/* Controls — only shown when status bar is on */}
        {(layer.showStatusBar ?? true) && (
          <div className="space-y-3">
            {/* Background type */}
            <div>
              <label className={labelCls}>Background</label>
              <div className="grid grid-cols-2 gap-2">
                {(['transparent', 'solid'] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => upd({ statusBarBg: b })}
                    className={`rounded-lg border px-3 py-2 text-xs transition-colors ${(layer.statusBarBg ?? 'transparent') === b ? 'border-[#7c6ef6] bg-[#7c6ef6] text-white' : 'border-[rgba(255,255,255,0.1)] text-[#6b6b7a] hover:text-[#e8e8f0] hover:bg-[rgba(255,255,255,0.06)]'}`}
                  >
                    {b === 'transparent' ? 'Transparent' : 'Solid'}
                  </button>
                ))}
              </div>
            </div>

            {/* Colour picker — only for solid */}
            {(layer.statusBarBg ?? 'gradient') === 'solid' && (
              <div>
                <label className={labelCls}>Color</label>
                <ColorField
                  value={layer.statusBarColor ?? '#000000'}
                  onChange={(v) => upd({ statusBarColor: v })}
                  onInteractionStart={pauseTemporal}
                  onInteractionEnd={resumeTemporal}
                />
              </div>
            )}

            {/* Icon theme */}
            <div>
              <label className={labelCls}>Icons</label>
              <div className="grid grid-cols-2 gap-2">
                {(['dark', 'light'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => upd({ statusBarTheme: t })}
                    className={`rounded-lg border px-3 py-2 text-xs transition-colors ${(layer.statusBarTheme ?? 'dark') === t ? 'border-[#7c6ef6] bg-[#7c6ef6] text-white' : 'border-[rgba(255,255,255,0.1)] text-[#6b6b7a] hover:text-[#e8e8f0] hover:bg-[rgba(255,255,255,0.06)]'}`}
                  >
                    {t === 'dark' ? '🌙 Dark' : '☀️ Light'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={panelSectionCls}>
        <div className="mb-1 flex items-center justify-between">
          <label className={labelCls + ' !mb-0'}>Scale</label>
          <span className="text-xs text-[#e8e8f0]">{layer.scale.toFixed(2)}×</span>
        </div>
        <input type="range" min={0.5} max={4} step={0.05} value={layer.scale} onChange={(e) => upd({ scale: Number(e.target.value) })} onMouseDown={pauseTemporal} onMouseUp={resumeTemporal} className="w-full accent-[#7c6ef6]" />
      </div>

      <div className={panelSectionCls}>
        <label className={labelCls}>Screenshot</label>
        <div
          className="rounded-xl border border-dashed border-[rgba(255,255,255,0.14)] bg-[#0f0f13] p-4 text-center transition-colors hover:border-[rgba(124,110,246,0.55)] cursor-pointer"
          onClick={() => screenshotInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={async (e) => {
            e.preventDefault()
            const file = e.dataTransfer.files[0]
            if (!file) return
            await handleScreenshotFile(file)
          }}
        >
          {previewSrc ? <img src={previewSrc} alt="Screenshot" className="mx-auto max-h-24 rounded-lg object-contain" /> : <span className="text-xs text-[#6b6b7a]">Click or drag to upload screenshot</span>}
        </div>
        {screenshotLabel && <p className="mt-2 truncate text-[10px] text-[#6b6b7a]">{screenshotLabel}</p>}
        <input
          ref={screenshotInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            await handleScreenshotFile(file)
            e.target.value = ''
          }}
        />
      </div>

      <div className={panelSectionCls}>
        <label className={labelCls}>Fit</label>
        <div className="grid grid-cols-3 gap-2">
          {(['cover', 'contain', 'fill'] as const).map((fit) => (
            <button
              key={fit}
              type="button"
              onClick={() => upd({ screenshotFit: fit })}
              className={`rounded-lg border px-2 py-2 text-xs transition-colors ${layer.screenshotFit === fit ? 'border-[#7c6ef6] bg-[#7c6ef6] text-white' : 'border-[rgba(255,255,255,0.1)] text-[#6b6b7a] hover:text-[#e8e8f0] hover:bg-[rgba(255,255,255,0.06)]'}`}
            >
              {fit.charAt(0).toUpperCase() + fit.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className={panelSectionCls}>
        <SliderField label="Offset X" value={layer.screenshotOffsetX} min={-500} max={500} unit="px" onChange={(v) => upd({ screenshotOffsetX: v })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />
        <SliderField label="Offset Y" value={layer.screenshotOffsetY} min={-500} max={500} unit="px" onChange={(v) => upd({ screenshotOffsetY: v })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} className="!mb-0" />
      </div>
    </div>
  )
}

// ─── Span Fill Toggle (compact inline fill picker for spans) ─────────────────

function SpanFillEditor({
  span,
  layerFill,
  onChange,
}: {
  span: TextSpan
  layerFill: FillValue
  onChange: (patch: Partial<TextSpan>) => void
}) {
  const [open, setOpen] = useState(false)
  const hasCustomFill = span.fill !== undefined

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <label className={labelCls + ' !mb-0'}>Fill</label>
        <button
          type="button"
          onClick={() => {
            if (hasCustomFill) {
              onChange({ fill: undefined })
              setOpen(false)
            } else {
              onChange({ fill: layerFill })
              setOpen(true)
            }
          }}
          className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
            hasCustomFill
              ? 'border-[#7c6ef6] text-[#9d90f8] bg-[rgba(124,110,246,0.12)]'
              : 'border-[rgba(255,255,255,0.1)] text-[#6b6b7a] hover:text-[#e8e8f0]'
          }`}
        >
          {hasCustomFill ? '✦ Custom' : '○ Inherit'}
        </button>
        {hasCustomFill && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-[10px] text-[#6b6b7a] hover:text-[#e8e8f0] transition-colors"
          >
            {open ? '▲' : '▼'}
          </button>
        )}
      </div>
      {hasCustomFill && open && (
        <FillControl
          key={typeof span.fill === 'string' ? 'solid' : (span.fill?.type ?? 'solid')}
          fill={span.fill!}
          onChange={(fill) => onChange({ fill })}
          onInteractionStart={pauseTemporal}
          onInteractionEnd={resumeTemporal}
        />
      )}
    </div>
  )
}

// ─── Span Row ──────────────────────────────────────────────────────────────────

function SpanRow({
  span,
  layerFill,
  availableWeights,
  onChange,
  onRemove,
}: {
  span: TextSpan
  layerFill: FillValue
  availableWeights: number[]
  onChange: (patch: Partial<TextSpan>) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-lg border border-[rgba(255,255,255,0.07)] bg-[#0d0d12] p-2.5 space-y-2.5">
      {/* Text + delete */}
      <div className="flex gap-2 items-start">
        <textarea
          value={span.text}
          onChange={(e) => onChange({ text: e.target.value })}
          rows={2}
          placeholder="Texto del tramo…"
          className={`${inputCls} resize-none flex-1 text-[13px]`}
        />
        <button
          type="button"
          onClick={onRemove}
          className="mt-1 text-xs text-[#f87171] hover:text-[#fca5a5] transition-colors shrink-0"
        >
          ✕
        </button>
      </div>

      {/* Fill override */}
      <SpanFillEditor span={span} layerFill={layerFill} onChange={onChange} />

      {/* Weight override (optional) */}
      <div className="flex items-center gap-2">
        <label className={labelCls + ' !mb-0'}>Peso</label>
        <button
          type="button"
          onClick={() => onChange({ fontWeight: span.fontWeight !== undefined ? undefined : 700 })}
          className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
            span.fontWeight !== undefined
              ? 'border-[#7c6ef6] text-[#9d90f8] bg-[rgba(124,110,246,0.12)]'
              : 'border-[rgba(255,255,255,0.1)] text-[#6b6b7a] hover:text-[#e8e8f0]'
          }`}
        >
          {span.fontWeight !== undefined ? '✦ Custom' : '○ Inherit'}
        </button>
        {span.fontWeight !== undefined && (
          <select
            value={span.fontWeight}
            onChange={(e) => onChange({ fontWeight: Number(e.target.value) })}
            className={inputCls + ' !py-0.5 !text-xs flex-1'}
          >
            {availableWeights.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        )}
      </div>

      {/* Italic override */}
      <div className="flex items-center gap-2">
        <label className={labelCls + ' !mb-0'}>Itálica</label>
        <button
          type="button"
          onClick={() => onChange({ italic: span.italic !== undefined ? undefined : true })}
          className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
            span.italic !== undefined
              ? 'border-[#7c6ef6] text-[#9d90f8] bg-[rgba(124,110,246,0.12)]'
              : 'border-[rgba(255,255,255,0.1)] text-[#6b6b7a] hover:text-[#e8e8f0]'
          }`}
        >
          {span.italic !== undefined ? '✦ Custom' : '○ Inherit'}
        </button>
        {span.italic !== undefined && (
          <button
            type="button"
            onClick={() => onChange({ italic: !span.italic })}
            className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
              span.italic
                ? 'border-[#7c6ef6] text-[#9d90f8] bg-[rgba(124,110,246,0.12)]'
                : 'border-[rgba(255,255,255,0.1)] text-[#6b6b7a]'
            }`}
          >
            {span.italic ? 'On' : 'Off'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Text Content ────────────────────────────────────────────────────────────

function TextContent({ layer }: { layer: TextLayer }) {
  const { updateLayer } = useEditorStore()
  const upd = (patch: Partial<TextLayer>) => updateLayer(layer.id, patch as Partial<Layer>)

  const hasSpans = (layer.spans?.length ?? 0) > 0
  const availableWeights = getFontWeights(layer.fontFamily)

  const updateSpan = (index: number, patch: Partial<TextSpan>) => {
    const spans = [...(layer.spans ?? [])]
    spans[index] = { ...spans[index], ...patch }
    upd({ spans })
  }

  const removeSpan = (index: number) => {
    const spans = (layer.spans ?? []).filter((_, i) => i !== index)
    upd({ spans: spans.length ? spans : undefined })
  }

  const addSpan = () => {
    const newSpan: TextSpan = { text: 'nuevo tramo' }
    upd({ spans: [...(layer.spans ?? []), newSpan] })
  }

  const switchToRich = () => {
    // Convert current plain text to a single span
    upd({ spans: [{ text: layer.text }] })
  }

  const switchToSimple = () => {
    // Join all span texts into plain text, discard per-span styles
    const combined = (layer.spans ?? []).map((s) => s.text).join('')
    upd({ spans: undefined, text: combined || layer.text })
  }

  return (
    <div className="space-y-4">

      {/* ── Font ── */}
      <div className={panelSectionCls}>
        <label className={labelCls}>Fuente</label>
        <select
          value={layer.fontFamily}
          onChange={(e) => {
            const family = e.target.value
            const weights = getFontWeights(family)
            // Keep current weight if available, otherwise pick nearest
            const newWeight = weights.includes(layer.fontWeight)
              ? layer.fontWeight
              : weights.reduce((prev, curr) =>
                  Math.abs(curr - layer.fontWeight) < Math.abs(prev - layer.fontWeight) ? curr : prev
                )
            upd({ fontFamily: family, fontWeight: newWeight })
          }}
          className={inputCls}
          style={{ fontFamily: layer.fontFamily }}
        >
          {FONT_LIST.map((f) => (
            <option key={f.family} value={f.family} style={{ fontFamily: f.family }}>
              {f.label}
            </option>
          ))}
        </select>

        {/* Size + Weight */}
        <div className="mt-3">
          <SliderField label="Tamaño" value={layer.fontSize} min={6} max={300} unit="px" onChange={(v) => upd({ fontSize: v })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />
          <div className={fieldCls}>
            <label className={labelCls}>Peso</label>
            <select
              value={layer.fontWeight}
              onChange={(e) => upd({ fontWeight: Number(e.target.value) })}
              className={inputCls}
            >
              {availableWeights.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Italic toggle */}
        <div className="mb-3">
          <label className={labelCls}>Estilo</label>
          <button
            type="button"
            onClick={() => upd({ italic: !layer.italic })}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors italic font-medium ${
              layer.italic
                ? 'border-[#7c6ef6] bg-[rgba(124,110,246,0.18)] text-[#c4b5fd]'
                : 'border-[rgba(255,255,255,0.1)] text-[#6b6b7a] hover:text-[#e8e8f0]'
            }`}
          >
            I  Itálica
          </button>
        </div>

        {/* Spacing */}
        <SliderField label="Interletraje" value={layer.letterSpacing} min={-20} max={100} step={1} onChange={(v) => upd({ letterSpacing: v })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />
        <SliderField label="Interlineado" value={layer.lineHeight} min={0.5} max={4} step={0.05} unit="×" onChange={(v) => upd({ lineHeight: v })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} className="!mb-0" />
      </div>

      {/* ── Align ── */}
      <div className={panelSectionCls}>
        <label className={labelCls}>Alineación</label>
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: 'left',   label: '⬱ Izq' },
            { value: 'center', label: '≡ Cen' },
            { value: 'right',  label: '⬲ Der' },
          ] as const).map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => upd({ align: item.value })}
              className={`rounded-lg border px-2 py-2 text-xs transition-colors ${
                layer.align === item.value
                  ? 'border-[#7c6ef6] bg-[#7c6ef6] text-white'
                  : 'border-[rgba(255,255,255,0.1)] text-[#6b6b7a] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#e8e8f0]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Text / Spans ── */}
      <div className={panelSectionCls}>
        {/* Mode toggle */}
        <div className="flex items-center justify-between mb-3">
          <label className={labelCls + ' !mb-0'}>Contenido</label>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={switchToSimple}
              className={`text-[10px] px-2 py-0.5 rounded-l border transition-colors ${
                !hasSpans
                  ? 'border-[#7c6ef6] bg-[#7c6ef6] text-white'
                  : 'border-[rgba(255,255,255,0.1)] text-[#6b6b7a] hover:text-[#e8e8f0]'
              }`}
            >
              Simple
            </button>
            <button
              type="button"
              onClick={switchToRich}
              className={`text-[10px] px-2 py-0.5 rounded-r border-y border-r transition-colors ${
                hasSpans
                  ? 'border-[#7c6ef6] bg-[#7c6ef6] text-white'
                  : 'border-[rgba(255,255,255,0.1)] text-[#6b6b7a] hover:text-[#e8e8f0]'
              }`}
            >
              ✦ Rich
            </button>
          </div>
        </div>

        {/* Simple mode */}
        {!hasSpans && (
          <textarea
            value={layer.text}
            onChange={(e) => upd({ text: e.target.value })}
            rows={4}
            className={`${inputCls} resize-none`}
          />
        )}

        {/* Rich text mode — spans editor */}
        {hasSpans && (
          <div className="space-y-2">
            <p className="text-[10px] text-[#4a4a5a] mb-2 leading-relaxed">
              Cada tramo puede tener color/gradiente propio. Usa <code className="text-[#9d90f8]">\n</code> para saltos de línea.
            </p>
            {(layer.spans ?? []).map((span, i) => (
              <SpanRow
                key={i}
                span={span}
                layerFill={layer.fill}
                availableWeights={availableWeights}
                onChange={(patch) => updateSpan(i, patch)}
                onRemove={() => removeSpan(i)}
              />
            ))}
            <button
              type="button"
              onClick={addSpan}
              className={`${subtleButtonCls} w-full text-center text-[#7c6ef6] border-dashed hover:border-[#7c6ef6]`}
            >
              ＋ Añadir tramo
            </button>
          </div>
        )}
      </div>

    </div>
  )
}

function ImageContent({ layer }: { layer: ImageLayer }) {
  const { updateLayer } = useEditorStore()
  const upd = (patch: Partial<ImageLayer>) => updateLayer(layer.id, patch as Partial<Layer>)

  return (
    <div className="space-y-4">
      <div className={panelSectionCls}>
        <SliderField label="Corner Radius" value={layer.cornerRadius} min={0} max={500} unit="px" onChange={(v) => upd({ cornerRadius: v })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} className="!mb-0" />
      </div>
    </div>
  )
}

function ChipsContent({ layer }: { layer: ChipsLayer }) {
  const { updateLayer } = useEditorStore()
  const upd = (patch: Partial<ChipsLayer>) => updateLayer(layer.id, patch as Partial<Layer>)

  const updateItems = (items: ChipItem[]) => upd({ items })
  const updateChip = (index: number, patch: Partial<ChipItem>) => updateItems(layer.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)))

  return (
    <div className="space-y-4">
      <div className={panelSectionCls}>
        <div className="mb-2 flex items-center justify-between">
          <label className={labelCls + ' !mb-0'}>Chips</label>
          <button type="button" onClick={() => updateItems([...layer.items, { label: 'New Chip', primary: false, variant: 'plain' }])} className="text-xs text-[#7c6ef6] hover:text-[#9d90f8] transition-colors">
            ＋ Add
          </button>
        </div>
        <div className="space-y-2">
          {layer.items.map((chip, index) => {
            const currentVariant: ChipVariant = chip.variant ?? (chip.primary ? 'filled' : 'plain')
            const variants: Array<{ value: ChipVariant; label: string }> = [
              { value: 'filled', label: 'Filled' },
              { value: 'outlined', label: 'Outlined' },
              { value: 'soft', label: 'Soft' },
              { value: 'dark', label: 'Dark' },
              { value: 'plain', label: 'Plain' },
            ]
            return (
              <div key={`${chip.label}-${index}`} className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#101017] p-2 space-y-2">
                <div className="flex items-center gap-2">
                  <input type="text" value={chip.label} onChange={(e) => updateChip(index, { label: e.target.value })} className={`${inputCls} flex-1`} />
                  <button type="button" onClick={() => updateItems(layer.items.filter((_, i) => i !== index))} className="text-xs text-[#f87171] hover:text-[#fca5a5] transition-colors shrink-0">
                    ✕
                  </button>
                </div>
                <div>
                  <label className={labelCls}>Type</label>
                  <select
                    value={currentVariant}
                    onChange={(e) => {
                      const variant = e.target.value as ChipVariant
                      updateChip(index, { variant, primary: variant === 'filled' })
                    }}
                    className={inputCls}
                  >
                    {variants.map((v) => (
                      <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className={panelSectionCls}>
        <div className={rowCls}>
          <div className={fieldCls}>
            <label className={labelCls}>Primary From</label>
            <ColorField value={layer.primaryGradientFrom} onChange={(value) => upd({ primaryGradientFrom: value })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Primary To</label>
            <ColorField value={layer.primaryGradientTo} onChange={(value) => upd({ primaryGradientTo: value })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />
          </div>
        </div>

        <SliderField label="Font Size" value={layer.chipFontSize} min={6} max={100} unit="px" onChange={(v) => upd({ chipFontSize: v })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />
        <SliderField label="Gap" value={layer.gap} min={0} max={200} unit="px" onChange={(v) => upd({ gap: v })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} className="!mb-0" />
      </div>

      <div className={panelSectionCls}>
        <label className={labelCls}>Direction</label>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {(['row', 'column'] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              onClick={() => upd({ direction: dir })}
              className={`rounded-lg border px-3 py-2 text-xs transition-colors ${layer.direction === dir ? 'border-[#7c6ef6] bg-[#7c6ef6] text-white' : 'border-[rgba(255,255,255,0.1)] text-[#6b6b7a] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#e8e8f0]'}`}
            >
              {dir === 'row' ? 'Horizontal' : 'Vertical'}
            </button>
          ))}
        </div>

        <div className={rowCls}>
          <div className={fieldCls}>
            <label className={labelCls}>Primary Text</label>
            <ColorField value={layer.primaryTextColor} onChange={(value) => upd({ primaryTextColor: value })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Default Bg</label>
            <ColorField value={layer.defaultBg} onChange={(value) => upd({ defaultBg: value })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Default Text</label>
          <ColorField value={layer.defaultTextColor} onChange={(value) => upd({ defaultTextColor: value })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />
        </div>
      </div>
    </div>
  )
}

function BrandContent({ layer }: { layer: BrandLayer }) {
  const { updateLayer } = useEditorStore()
  const upd = (patch: Partial<BrandLayer>) => updateLayer(layer.id, patch as Partial<Layer>)
  const logoInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-4">
      <div className={panelSectionCls}>
        <label className={labelCls}>App Name</label>
        <input type="text" value={layer.appName} onChange={(e) => upd({ appName: e.target.value })} className={inputCls} />
      </div>

      <div className={panelSectionCls}>
        <label className={labelCls}>Logo</label>
        <div className="flex items-center gap-3">
          {layer.logoDataUrl && <img src={layer.logoDataUrl} alt="Logo" className="h-10 w-10 rounded-lg object-contain bg-[#0f0f13]" />}
          <button type="button" onClick={() => logoInputRef.current?.click()} className={subtleButtonCls}>
            {layer.logoDataUrl ? 'Change Logo' : 'Upload Logo'}
          </button>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const dataUrl = await fileToDataUrl(file)
              upd({ logoDataUrl: dataUrl })
              e.target.value = ''
            }}
          />
        </div>
      </div>

      <div className={panelSectionCls}>
        <label className={labelCls}>Name Color</label>
        <ColorField value={layer.nameColor} onChange={(value) => upd({ nameColor: value })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />

        <div className="mt-3">
          <SliderField label="Font Size" value={layer.nameFontSize} min={6} max={200} unit="px" onChange={(v) => upd({ nameFontSize: v })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />
          <div className={fieldCls}>
            <label className={labelCls}>Font Weight</label>
            <select value={layer.nameFontWeight} onChange={(e) => upd({ nameFontWeight: Number(e.target.value) })} className={inputCls}>
              <option value={400}>400</option>
              <option value={600}>600</option>
              <option value={700}>700</option>
              <option value={800}>800</option>
            </select>
          </div>
        </div>

        <div className="mt-3">
          <div className={fieldCls}>
            <label className={labelCls}>Font Family</label>
            <select value={layer.nameFontFamily} onChange={(e) => upd({ nameFontFamily: e.target.value })} className={inputCls}>
              <option value="Sora">Sora</option>
              <option value="Inter">Inter</option>
              <option value="system-ui">system-ui</option>
            </select>
          </div>
          <SliderField label="Logo Size" value={layer.logoSize} min={8} max={300} unit="px" onChange={(v) => upd({ logoSize: v })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} className="mt-3" />
        </div>
      </div>

      <div className={panelSectionCls}>
        <label className={labelCls}>Direction</label>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {(['row', 'column'] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              onClick={() => upd({ direction: dir })}
              className={`rounded-lg border px-3 py-2 text-xs transition-colors ${layer.direction === dir ? 'border-[#7c6ef6] bg-[#7c6ef6] text-white' : 'border-[rgba(255,255,255,0.1)] text-[#6b6b7a] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#e8e8f0]'}`}
            >
              {dir === 'row' ? 'Horizontal' : 'Vertical'}
            </button>
          ))}
        </div>
        <SliderField label="Gap" value={layer.gap} min={0} max={200} unit="px" onChange={(v) => upd({ gap: v })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} className="!mb-0" />
      </div>
    </div>
  )
}

function ShapeContent({ layer }: { layer: ShapeLayer }) {
  const { updateLayer } = useEditorStore()
  const upd = (patch: Partial<ShapeLayer>) => updateLayer(layer.id, patch as Partial<Layer>)

  return (
    <div className="space-y-4">
      <div className={panelSectionCls}>
        <label className={labelCls}>Shape Type</label>
        <div className="grid grid-cols-2 gap-2">
          {(['rect', 'ellipse'] as const).map((shapeType) => (
            <button
              key={shapeType}
              type="button"
              onClick={() => upd({ shapeType })}
              className={`rounded-lg border px-3 py-2 text-xs transition-colors ${layer.shapeType === shapeType ? 'border-[#7c6ef6] bg-[#7c6ef6] text-white' : 'border-[rgba(255,255,255,0.1)] text-[#6b6b7a] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#e8e8f0]'}`}
            >
              {shapeType === 'rect' ? 'Rect' : 'Ellipse'}
            </button>
          ))}
        </div>

        {layer.shapeType === 'rect' && (
          <div className="mt-3">
            <SliderField label="Corner Radius" value={layer.cornerRadius} min={0} max={500} unit="px" onChange={(v) => upd({ cornerRadius: v })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} className="!mb-0" />
          </div>
        )}
      </div>
    </div>
  )
}

const LAYER_TYPE_ICON: Record<string, string> = {
  text: 'T',
  phone: '📱',
  image: '🖼',
  shape: '■',
  chips: '◉',
  brand: '★',
  group: '▣',
  background: '▧',
}

function GroupContent({ layer }: { layer: GroupLayer }) {
  return (
    <div className="space-y-4">
      {/* Enter hint */}
      <div className="rounded-xl border border-[rgba(124,110,246,0.25)] bg-[rgba(124,110,246,0.08)] p-3">
        <p className="text-xs font-semibold text-[#c4b5fd] mb-1">Grupo seleccionado</p>
        <p className="text-xs text-[#9d90f8]">
          Haz <strong>doble clic</strong> en el canvas para entrar y editar las capas internas.
        </p>
      </div>

      {/* Children list */}
      {layer.children.length > 0 && (
        <div className={panelSectionCls}>
          <label className={labelCls}>Capas internas ({layer.children.length})</label>
          <div className="space-y-1">
            {layer.children.map((child) => (
              <div
                key={child.id}
                className="flex items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#101017] px-2 py-1.5"
              >
                <span className="text-xs text-[#6b6b7a] w-4 text-center shrink-0">
                  {LAYER_TYPE_ICON[child.type] ?? '?'}
                </span>
                <span className="text-xs text-[#a0a0b0] flex-1 truncate">{child.name}</span>
                <span className="text-[10px] text-[#4a4a5a] shrink-0 uppercase tracking-wide">{child.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function BackgroundContent() {
  return (
    <div className={panelSectionCls}>
      <p className="text-sm text-[#e8e8f0]">Background</p>
      <p className="mt-1 text-xs text-[#6b6b7a]">The background layer is always at the bottom. Edit its fill, presets, and accent bubbles in the Style tab.</p>
    </div>
  )
}

function ContentTab({ layer }: { layer: Layer }) {
  if (layer.type === 'background') return <BackgroundContent />
  if (layer.type === 'phone') return <PhoneContent layer={layer} />
  if (layer.type === 'text') return <TextContent layer={layer} />
  if (layer.type === 'image') return <ImageContent layer={layer} />
  if (layer.type === 'chips') return <ChipsContent layer={layer} />
  if (layer.type === 'brand') return <BrandContent layer={layer} />
  if (layer.type === 'shape') return <ShapeContent layer={layer} />
  if (layer.type === 'group') return <GroupContent layer={layer as GroupLayer} />
  return <div className={panelSectionCls}><p className="text-xs text-[#6b6b7a]">Unknown layer type</p></div>
}

export function PropertiesPanel() {
  const { project, activeSlideGroupId, selection, updateSlideGroup, editingGroupId } = useEditorStore()
  const [activeTab, setActiveTab] = useState<PanelTab>('layout')

  const activeGroup: SlideGroup | undefined = project.slideGroups.find((group) => group.id === activeSlideGroupId)
  const backgroundLayer = activeGroup?.layers.find((layer) => layer.type === 'background') as Extract<Layer, { type: 'background' }> | undefined

  let selectedLayer: Layer | null = null
  if (selection?.layerId && activeGroup) {
    if (editingGroupId) {
      // selection.layerId IS the child id in group edit mode
      const parentGroup = activeGroup.layers.find((l) => l.id === editingGroupId && l.type === 'group') as GroupLayer | undefined
      selectedLayer = parentGroup?.children.find((child) => child.id === selection.layerId) ?? null
    } else {
      selectedLayer = activeGroup.layers.find((layer) => layer.id === selection.layerId) ?? null
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveTab('layout')
  }, [selectedLayer?.id])

  const handlePanelFocus = (e: FocusEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement
    if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return
    const type = (el as HTMLInputElement).type
    if (type === 'range' || type === 'color' || type === 'checkbox' || type === 'radio' || type === 'file') return
    pauseTemporal()
  }

  const handlePanelBlur = (e: FocusEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement
    if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return
    const type = (el as HTMLInputElement).type
    if (type === 'range' || type === 'color' || type === 'checkbox' || type === 'radio' || type === 'file') return
    resumeTemporal()
  }



  const borderColor = 'rgba(255,255,255,0.06)'

  return (
    <aside className="w-72 h-full flex flex-col overflow-hidden shrink-0" style={{ background: '#18181f', borderLeft: `1px solid ${borderColor}` }}>
      <div className="shrink-0 border-b px-3 py-2" style={{ borderColor }}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#6b6b7a]">Properties</span>
        </div>

        {selectedLayer && (
          <div className="mt-3 flex gap-4 border-b border-[rgba(255,255,255,0.06)]">
            {([
              ['layout', 'Layout'],
              ['style', 'Style'],
              ['content', 'Content'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setActiveTab(value)}
                className={`h-7 border-b-2 text-[11px] font-medium transition-colors ${activeTab === value ? 'border-[#7c6ef6] text-white' : 'border-transparent text-[#6b6b7a] hover:text-[#e8e8f0]'}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3" onFocusCapture={handlePanelFocus} onBlurCapture={handlePanelBlur}>
        {!selectedLayer ? (
          activeGroup ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-3">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#6b6b7a]">Slide Background</div>
                {backgroundLayer ? (
                  <BackgroundProperties layer={backgroundLayer} />
                ) : (
                  <FillControl
                    fill={activeGroup.background?.fill ?? '#12101E'}
                    onChange={(fill) => {
                      updateSlideGroup(activeSlideGroupId, { background: { fill, accents: activeGroup.background?.accents } })
                    }}
                    onInteractionStart={pauseTemporal}
                    onInteractionEnd={resumeTemporal}
                  />
                )}
              </div>
            </div>
          ) : (
            <p className="mt-8 px-4 text-center text-xs text-[#6b6b7a]">Select a layer to edit properties</p>
          )
        ) : (
          <>
            {editingGroupId && selection?.layerId && (
              <div className="mb-4 rounded-xl border border-[rgba(124,110,246,0.3)] bg-[rgba(124,110,246,0.14)] px-3 py-2 text-xs text-[#c4b5fd]">
                ✦ Editing inside group
              </div>
            )}

            {activeTab === 'layout' && <LayoutTab layer={selectedLayer} />}
            {activeTab === 'style' && <StyleTab layer={selectedLayer} />}
            {activeTab === 'content' && <ContentTab layer={selectedLayer} />}
          </>
        )}
      </div>
    </aside>
  )
}
