import { useEffect, useRef, useState } from 'react'
import type { FocusEvent } from 'react'
import { useEditorStore } from '@/store'
import { useAssetStore } from '@/store/assets'
import type {
  Layer,
  BackgroundLayer,
  PhoneLayer,
  TextLayer,
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
import { PHONE_MODELS, getPhoneSpec } from '@/assets/mockups/specs'
import { useApiKeysStore } from '@/store/apiKeys'
import { translateText } from '@/utils/translate'
import { applyCanvasFormat, getCanvasFormat, getFormatCanvasDims, getProjectActiveFormats, getProjectBaseFormat } from '@/utils/canvasFormats'
import type { CanvasFormatId } from '@/types'
import { OverrideDot } from '@/components/properties/OverrideDot'

function shortFormatLabel(id: CanvasFormatId): string {
  const map: Record<CanvasFormatId, string> = {
    'base': 'Base',
    'iphone-69': 'iPhone',
    'android-phone': 'Android',
    'ipad-13': 'iPad',
    'android-tablet': 'Android Tab',
  }
  return map[id] ?? id
}


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
  const bgImageInputRef = useRef<HTMLInputElement>(null)

  const hasImage = !!layer.imageDataUrl

  const handleImageFile = async (file: File) => {
    const dataUrl = await fileToDataUrl(file)
    upd({ imageDataUrl: dataUrl })
  }

  return (
    <div className="space-y-4">
      {/* Background type toggle */}
      <div>
        <label className={labelCls}>Background Type</label>
        <div className="grid grid-cols-2 gap-2">
          {(['gradient', 'image'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                if (mode === 'image') bgImageInputRef.current?.click()
                else upd({ imageDataUrl: undefined })
              }}
              className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
                (mode === 'image') === hasImage
                  ? 'border-[#7c6ef6] bg-[#7c6ef6] text-white'
                  : 'border-[rgba(255,255,255,0.1)] text-[#6b6b7a] hover:text-[#e8e8f0] hover:bg-[rgba(255,255,255,0.06)]'
              }`}
            >
              {mode === 'gradient' ? '🎨 Gradient' : '🖼 Image'}
            </button>
          ))}
        </div>
      </div>

      {/* Gradient fill — shown when no image */}
      {!hasImage && (
        <div>
          <FillControl
            key={layer.id}
            fill={layer.fill}
            onChange={(fill) => upd({ fill })}
            onInteractionStart={pauseTemporal}
            onInteractionEnd={resumeTemporal}
          />
        </div>
      )}

      {/* Image controls — shown when image is set */}
      {hasImage && (
        <div className="space-y-3">
          <div
            className="relative rounded-xl border border-[rgba(255,255,255,0.1)] overflow-hidden cursor-pointer group"
            style={{ height: 80 }}
            onClick={() => bgImageInputRef.current?.click()}
          >
            <img
              src={layer.imageDataUrl}
              alt="Background"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-[rgba(0,0,0,0.5)]">
              <span className="text-xs text-white">Change image</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => upd({ imageDataUrl: undefined })}
            className="text-xs text-[#f87171] hover:text-[#fca5a5] transition-colors"
          >
            Remove image ×
          </button>

          <div>
            <label className={labelCls}>Fit</label>
            <div className="grid grid-cols-3 gap-2">
              {(['cover', 'contain', 'fill'] as const).map((fit) => (
                <button
                  key={fit}
                  type="button"
                  onClick={() => upd({ imageFit: fit })}
                  className={`rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                    (layer.imageFit ?? 'cover') === fit
                      ? 'border-[#7c6ef6] bg-[#7c6ef6] text-white'
                      : 'border-[rgba(255,255,255,0.1)] text-[#6b6b7a] hover:text-[#e8e8f0]'
                  }`}
                >
                  {fit.charAt(0).toUpperCase() + fit.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <SliderField
            label="Blur"
            value={layer.imageBlur ?? 0}
            min={0}
            max={50}
            unit="px"
            onChange={(v) => upd({ imageBlur: v || undefined })}
            onInteractionStart={pauseTemporal}
            onInteractionEnd={resumeTemporal}
            className="!mb-0"
          />

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls + ' !mb-0'}>Color Overlay</label>
              <button
                type="button"
                onClick={() => upd({ imageOverlayOpacity: (layer.imageOverlayOpacity ?? 0) > 0 ? 0 : 0.4 })}
                className={`relative h-5 w-9 rounded-full transition-colors ${
                  (layer.imageOverlayOpacity ?? 0) > 0 ? 'bg-[#7c6ef6]' : 'bg-[rgba(255,255,255,0.12)]'
                }`}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  (layer.imageOverlayOpacity ?? 0) > 0 ? 'translate-x-4' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
            {(layer.imageOverlayOpacity ?? 0) > 0 && (
              <div className="space-y-2">
                <ColorField
                  value={layer.imageOverlayColor ?? '#000000'}
                  onChange={(v) => upd({ imageOverlayColor: v })}
                  onInteractionStart={pauseTemporal}
                  onInteractionEnd={resumeTemporal}
                />
                <SliderField
                  label="Opacity"
                  value={Math.round((layer.imageOverlayOpacity ?? 0) * 100)}
                  min={0} max={100} unit="%"
                  onChange={(v) => upd({ imageOverlayOpacity: v / 100 })}
                  onInteractionStart={pauseTemporal}
                  onInteractionEnd={resumeTemporal}
                  className="!mb-0"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Noise texture — always visible */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={labelCls + ' !mb-0'}>Noise Texture</label>
          <button
            type="button"
            onClick={() => upd({ noise: (layer.noise ?? 0) > 0 ? 0 : 0.05 })}
            className={`relative h-5 w-9 rounded-full transition-colors ${
              (layer.noise ?? 0) > 0 ? 'bg-[#7c6ef6]' : 'bg-[rgba(255,255,255,0.12)]'
            }`}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
              (layer.noise ?? 0) > 0 ? 'translate-x-4' : 'translate-x-0.5'
            }`} />
          </button>
        </div>
        {(layer.noise ?? 0) > 0 && (
          <SliderField
            label="Intensity"
            value={Math.round((layer.noise ?? 0) * 100)}
            min={1} max={30} unit="%"
            onChange={(v) => upd({ noise: v / 100 })}
            onInteractionStart={pauseTemporal}
            onInteractionEnd={resumeTemporal}
            className="!mb-0"
          />
        )}
      </div>

      <input
        ref={bgImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file) return
          await handleImageFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

function LayoutTab({ layer }: { layer: Layer }) {
  const { updateLayer, project, activeSlideGroupId, activeCanvasFormat, editingGroupId, setLayerFormatVisibility } = useEditorStore()
  const upd = (patch: Partial<Layer>) => updateLayer(layer.id, patch)
  const isBackground = layer.type === 'background'
  const sizeLayer = layer.type === 'shape' || layer.type === 'image' ? layer : null

  // Dynamic ranges based on the active format's canvas dimensions
  const activeGroup = project.slideGroups.find((g) => g.id === activeSlideGroupId)
  const formatDims = activeGroup
    ? getFormatCanvasDims(activeGroup, activeCanvasFormat, getProjectBaseFormat(project))
    : { width: 1080, height: 1920 }
  const canvasW = formatDims.width * (activeGroup?.numSlides ?? 1)
  const canvasH = formatDims.height
  const xMin = -Math.round(canvasW * 0.25)
  const xMax = Math.round(canvasW * 1.25)
  const yMin = -Math.round(canvasH * 0.25)
  const yMax = Math.round(canvasH * 1.25)

  // Raw layer (unresolved) for format overrides and visibility
  const rawGroup = project.slideGroups.find((g) => g.id === activeSlideGroupId)
  let rawLayer: Layer | null = null
  if (rawGroup) {
    if (editingGroupId) {
      const parentGroup = rawGroup.layers.find((l) => l.id === editingGroupId && l.type === 'group') as GroupLayer | undefined
      rawLayer = parentGroup?.children.find((c) => c.id === layer.id) ?? null
    } else {
      rawLayer = rawGroup.layers.find((l) => l.id === layer.id) ?? null
    }
  }

  // Active formats for platform visibility chips
  const activeFormats: CanvasFormatId[] = getProjectActiveFormats(project)

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

      {/* Platform visibility — only shown when multiple formats are active and layer is not format-owned */}
      {!isBackground && activeFormats.length > 1 && !rawLayer?.ownerFormat && (
        <div className={panelSectionCls}>
          <label className={labelCls}>Visible in</label>
          <div className="flex flex-wrap gap-1.5">
            {activeFormats.map((fmtId) => {
              const vis = rawLayer?.formatVisibility?.[fmtId]
              // undefined = visible (default), true = explicitly visible, false = hidden
              const isVisible = vis !== false
              return (
                <button
                  key={fmtId}
                  type="button"
                  onClick={() => setLayerFormatVisibility(layer.id, fmtId, isVisible ? false : undefined)}
                  className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                    isVisible
                      ? 'border-[rgba(255,255,255,0.15)] text-[#e8e8f0] bg-[rgba(255,255,255,0.06)]'
                      : 'border-[rgba(255,255,255,0.06)] text-[#555665] line-through'
                  }`}
                >
                  {shortFormatLabel(fmtId)}
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 text-[10px] text-[#6b6b7a]">Click to hide/show this layer in a format</p>
        </div>
      )}

      {/* Position / Size / Rotation — not applicable for background */}
      <div className={panelSectionCls}>
        {!isBackground && (
          <>
            <SliderField label="X" value={layer.x} min={xMin} max={xMax} unit="px" onChange={(v) => upd({ x: v })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} labelAddon={<OverrideDot layerId={layer.id} propKey="x" />} />
            <SliderField label="Y" value={layer.y} min={yMin} max={yMax} unit="px" onChange={(v) => upd({ y: v })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} labelAddon={<OverrideDot layerId={layer.id} propKey="y" />} />
            {sizeLayer && (
              <>
                <SliderField label="W" value={sizeLayer.width} min={1} max={canvasW} unit="px" onChange={(v) => upd({ width: v } as Partial<Layer>)} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} labelAddon={<OverrideDot layerId={layer.id} propKey="width" />} />
                <SliderField label="H" value={sizeLayer.height} min={1} max={canvasH} unit="px" onChange={(v) => upd({ height: v } as Partial<Layer>)} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} labelAddon={<OverrideDot layerId={layer.id} propKey="height" />} />
              </>
            )}
            {layer.type === 'text' && (
              <>
                <SliderField label="W" value={Math.round(layer.width ?? 1000)} min={40} max={canvasW} unit="px" onChange={(v) => upd({ width: v } as Partial<Layer>)} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} labelAddon={<OverrideDot layerId={layer.id} propKey="width" />} />
                <div className="mb-3">
                  <div className="flex items-center justify-between">
                    <label className={labelCls + ' !mb-0'}>H</label>
                    <button
                      type="button"
                      title={layer.height != null ? 'Switch to automatic height (box grows with content)' : 'Box height is automatic'}
                      onClick={() => upd({ height: undefined } as Partial<Layer>)}
                      className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                        layer.height == null
                          ? 'border-[#7c6ef6] text-[#9d90f8] bg-[rgba(124,110,246,0.12)] cursor-default'
                          : 'border-[rgba(255,255,255,0.1)] text-[#6b6b7a] hover:text-[#e8e8f0]'
                      }`}
                    >
                      {layer.height == null ? '✓ Auto' : 'Auto'}
                    </button>
                  </div>
                  {layer.height != null && (
                    <SliderField label="" value={Math.round(layer.height)} min={Math.round(layer.fontSize * layer.lineHeight)} max={canvasH} unit="px" onChange={(v) => upd({ height: v } as Partial<Layer>)} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} className="!mb-0 mt-1" />
                  )}
                </div>
              </>
            )}
            <SliderField label="Rotation" value={layer.rotation} min={-180} max={180} unit="°" onChange={(v) => upd({ rotation: v })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} labelAddon={<OverrideDot layerId={layer.id} propKey="rotation" />} />
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

// ─── Locale Screenshot Row ────────────────────────────────────────────────────

function LocaleScreenshotRow({
  locale,
  previewSrc,
  onUpload,
  onClear,
}: {
  locale: string
  previewSrc?: string
  onUpload: (file: File) => Promise<void>
  onClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[#6b6b7a] uppercase w-8 shrink-0 font-mono">{locale}</span>
      {previewSrc ? (
        <>
          <img src={previewSrc} alt={locale} className="h-8 w-5 rounded object-cover border border-[rgba(255,255,255,0.12)] shrink-0" />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex-1 text-left text-[10px] text-[#7c6ef6] hover:text-[#9d90f8] transition-colors"
          >
            Change
          </button>
          <button
            type="button"
            onClick={onClear}
            className="text-[10px] text-[#f87171] hover:text-[#fca5a5] transition-colors shrink-0"
          >
            ✕
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex-1 text-left text-[10px] text-[#6b6b7a] hover:text-[#e8e8f0] border border-dashed border-[rgba(255,255,255,0.1)] rounded px-2 py-1 transition-colors hover:border-[rgba(124,110,246,0.4)]"
        >
          + Upload for {locale}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file) return
          await onUpload(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

function PhoneContent({ layer }: { layer: PhoneLayer }) {
  const { updateLayer, project, activeSlideGroupId, setLocaleOverride, clearLocaleOverride } = useEditorStore()
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
        <div className="flex items-center mb-1">
          <label className={labelCls + ' !mb-0'}>Phone Model</label>
          <OverrideDot layerId={layer.id} propKey="model" />
        </div>
        <select value={layer.model} onChange={(e) => upd({ model: e.target.value as PhoneLayer['model'] })} className={inputCls}>
          {PHONE_MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Position presets */}
      {(() => {
        const activeGroup = project.slideGroups.find((g) => g.id === activeSlideGroupId)
        const slideWidth = activeGroup?.slideWidth ?? 1290
        const slideHeight = activeGroup?.slideHeight ?? 2796
        const spec = getPhoneSpec(layer.model)
        const fw = spec.frameWidth * layer.scale
        const fh = spec.frameHeight * layer.scale
        const cx = (slideWidth - fw) / 2

        const presets = [
          { label: 'Center',   patch: { x: cx, y: (slideHeight - fh) / 2, rotation: 0 } },
          { label: 'Hero',     patch: { x: cx, y: Math.round(slideHeight * 0.05), rotation: 0 } },
          { label: 'Bleed',    patch: { x: cx, y: Math.round(slideHeight * 0.38), rotation: 0 } },
          { label: '↺ Tilt',  patch: { x: cx, y: Math.round(slideHeight * 0.18), rotation: -10 } },
          { label: 'Tilt ↻',  patch: { x: cx, y: Math.round(slideHeight * 0.18), rotation: 10 } },
        ]

        return (
          <div className={panelSectionCls}>
            <label className={labelCls}>Position Preset</label>
            <div className="grid grid-cols-5 gap-1">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => upd(preset.patch as Partial<PhoneLayer>)}
                  className="rounded border border-[rgba(255,255,255,0.1)] px-1 py-1.5 text-[10px] text-[#8f90a3] hover:border-[rgba(124,110,246,0.5)] hover:text-[#e8e8f0] hover:bg-[rgba(255,255,255,0.04)] transition-colors leading-tight text-center"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )
      })()}

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
            {(layer.statusBarBg ?? 'transparent') === 'solid' && (
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

      {/* Screenshot border */}
      <div className={panelSectionCls}>
        <div className="mb-3 flex items-center justify-between">
          <label className={labelCls + ' !mb-0'}>Border</label>
          <button
            type="button"
            onClick={() => upd({ border: layer.border ? undefined : { color: '#FFFFFF', width: 2, opacity: 0.5 } })}
            className={`relative h-5 w-9 rounded-full transition-colors ${layer.border ? 'bg-[#7c6ef6]' : 'bg-[rgba(255,255,255,0.12)]'}`}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${layer.border ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </button>
        </div>
        {layer.border && (
          <div className="space-y-3">
            <ColorField
              value={layer.border.color}
              onChange={(v) => upd({ border: { ...layer.border!, color: v } })}
              onInteractionStart={pauseTemporal}
              onInteractionEnd={resumeTemporal}
            />
            <SliderField label="Width" value={layer.border.width} min={1} max={30} unit="px"
              onChange={(v) => upd({ border: { ...layer.border!, width: v } })}
              onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />
            <SliderField label="Opacity" value={Math.round(layer.border.opacity * 100)} min={0} max={100} unit="%"
              onChange={(v) => upd({ border: { ...layer.border!, opacity: v / 100 } })}
              onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} className="!mb-0" />
          </div>
        )}
      </div>

      {/* Per-locale screenshots */}
      {(() => {
        const locales = project.settings.locales ?? [project.settings.defaultLocale]
        const nonDefaultLocales = locales.filter((l) => l !== project.settings.defaultLocale)
        if (nonDefaultLocales.length === 0) return null
        return (
          <div className={panelSectionCls}>
            <label className={labelCls}>Localized Screenshots</label>
            <div className="space-y-2">
              {nonDefaultLocales.map((locale) => {
                const override = layer.localeOverrides?.[locale]
                const path = override?.screenshotPath
                const previewSrc = path ? assets[path]?.dataUrl : undefined
                return (
                  <LocaleScreenshotRow
                    key={locale}
                    locale={locale}
                    previewSrc={previewSrc}
                    onUpload={async (file) => {
                      const dataUrl = await fileToDataUrl(file)
                      addAsset(file.name, dataUrl)
                      setLocaleOverride(activeSlideGroupId, layer.id, locale, { screenshotPath: file.name })
                    }}
                    onClear={() => clearLocaleOverride(activeSlideGroupId, layer.id, locale)}
                  />
                )
              })}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ─── Text Content preview → opens the in-canvas editor ───────────────────────
// There is ONE text editor: the contextual WYSIWYG on the canvas. This is just
// a preview + entry point so the panel doesn't duplicate the editing UI.

function TextContentPreview({ layer }: { layer: TextLayer }) {
  const startTextEdit = useEditorStore((s) => s.startTextEdit)
  const isEditing = useEditorStore((s) => s.editingTextId === layer.id)

  return (
    <div>
      <button
        type="button"
        onClick={() => startTextEdit(layer.id)}
        className={`${inputCls} block w-full text-left min-h-[72px] cursor-text transition-colors hover:border-[rgba(124,110,246,0.5)] ${
          isEditing ? '!border-[#7c6ef6]' : ''
        }`}
        style={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontFamily: layer.fontFamily,
          fontWeight: layer.fontWeight,
          fontStyle: layer.italic ? 'italic' : 'normal',
          color: typeof layer.fill === 'string' ? layer.fill : undefined,
        }}
      >
        <span className="line-clamp-4 text-[13px] leading-relaxed">
          {layer.text || <span className="text-[#4a4a5a]">Empty text</span>}
        </span>
      </button>
      <button
        type="button"
        onClick={() => startTextEdit(layer.id)}
        className={`${subtleButtonCls} mt-2 w-full text-center text-[#9d90f8] hover:border-[#7c6ef6]`}
      >
        ✏️ {isEditing ? 'Editing on canvas…' : 'Edit text on canvas'}
      </button>
      <p className="mt-1.5 text-[10px] text-[#4a4a5a] leading-relaxed">
        Double-click the text on the canvas (or use this button) to edit in place.
        Select text there and style it with the floating toolbar.
        <br />Enter confirms · Ctrl+Enter inserts a new line.
      </p>
    </div>
  )
}

// ─── AI Translation Section ────────────────────────────────────────────────────

function TranslateSection({
  layer,
  nonDefaultLocales,
  slideGroupId,
}: {
  layer: TextLayer
  nonDefaultLocales: string[]
  slideGroupId: string
}) {
  const { setLocaleOverride } = useEditorStore()
  const { provider, getActiveKey, getActiveModel } = useApiKeysStore()
  const [status, setStatus] = useState<Record<string, 'idle' | 'translating' | 'ok' | 'error'>>({})
  const [isRunning, setIsRunning] = useState(false)
  const [translateError, setTranslateError] = useState<string | null>(null)

  const handleTranslateAll = async () => {
    const key = getActiveKey()
    const model = getActiveModel()
    if (!key) {
      setTranslateError('No API key configured. Add one in AI Settings.')
      return
    }
    setTranslateError(null)
    setIsRunning(true)
    const next: Record<string, 'idle' | 'translating' | 'ok' | 'error'> = {}
    try {
      for (const locale of nonDefaultLocales) {
        next[locale] = 'translating'
        setStatus({ ...next })
        try {
          const translated = await translateText(layer.text, locale, provider, key, model)
          setLocaleOverride(slideGroupId, layer.id, locale, { text: translated })
          next[locale] = 'ok'
        } catch (error) {
          next[locale] = 'error'
          setTranslateError(error instanceof Error ? error.message : `Translation failed for ${locale}.`)
        }
        setStatus({ ...next })
      }
    } catch (error) {
      setTranslateError(error instanceof Error ? error.message : 'Translation failed. Try again.')
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className={panelSectionCls}>
      <div className="flex items-center justify-between mb-2">
        <label className={labelCls + ' !mb-0'}>AI Translation</label>
        <span className="text-[10px] text-[#6b6b7a] text-right max-w-[150px] truncate" title={getActiveModel()}>
          {provider} · {getActiveModel()}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {nonDefaultLocales.map((locale) => {
          const s = status[locale] ?? 'idle'
          return (
            <span
              key={locale}
              className={`text-[10px] px-2 py-0.5 rounded border ${
                s === 'ok'          ? 'border-[#6ee7b7] text-[#6ee7b7] bg-[rgba(110,231,183,0.08)]' :
                s === 'error'       ? 'border-[#f87171] text-[#f87171] bg-[rgba(248,113,113,0.08)]' :
                s === 'translating' ? 'border-[#7c6ef6] text-[#9d90f8]' :
                                      'border-[rgba(255,255,255,0.1)] text-[#6b6b7a]'
              }`}
            >
              {locale}
              {s === 'ok' ? ' ✓' : s === 'error' ? ' ✕' : s === 'translating' ? ' …' : ''}
            </span>
          )
        })}
      </div>
      <button
        type="button"
        disabled={isRunning}
        onClick={handleTranslateAll}
        className="w-full text-xs py-2 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed border-[rgba(124,110,246,0.4)] text-[#9d90f8] hover:bg-[rgba(124,110,246,0.08)] hover:text-[#c4b5fd]"
      >
        {isRunning ? '⏳ Translating…' : '🌐 Translate to all locales'}
      </button>
      {translateError && <p className="mt-1 text-xs text-[#f87171]">{translateError}</p>}
    </div>
  )
}

// ─── Text Content ────────────────────────────────────────────────────────────

function TextContent({ layer }: { layer: TextLayer }) {
  const { updateLayer, project, activeSlideGroupId } = useEditorStore()
  const upd = (patch: Partial<TextLayer>) => updateLayer(layer.id, patch as Partial<Layer>)
  const editingThis = useEditorStore((s) => s.editingTextId === layer.id)

  const availableWeights = getFontWeights(layer.fontFamily)
  const [fontSearch, setFontSearch] = useState('')
  const filteredFonts = FONT_LIST.filter(
    (f) => !fontSearch || f.label.toLowerCase().includes(fontSearch.toLowerCase()) || f.family === layer.fontFamily,
  )

  return (
    <div className="space-y-4">

      {/* ── Text styling toolbar (docked here while editing on canvas) ── */}
      {/* CanvasTextEditor portals its RichTextToolbar into this slot, so the
          styling controls always live in the same place with room for the
          gradient editor. */}
      {editingThis && (
        <div className={`${panelSectionCls} !border-[rgba(124,110,246,0.35)]`}>
          <label className={labelCls}>✏️ Text Styling</label>
          <div id="rich-text-toolbar-slot" />
        </div>
      )}

      {/* ── Font ── */}
      <div className={panelSectionCls}>
        <label className={labelCls}>Font</label>
        <input
          type="search"
          value={fontSearch}
          onChange={(e) => setFontSearch(e.target.value)}
          placeholder="Search fonts…"
          className={`${inputCls} mb-2 text-xs`}
        />
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
          {filteredFonts.map((f) => (
            <option key={f.family} value={f.family} style={{ fontFamily: f.family }}>
              {f.label}
            </option>
          ))}
        </select>

        {/* Size + Weight */}
        <div className="mt-3">
          <SliderField label="Size" value={layer.fontSize} min={6} max={300} unit="px" onChange={(v) => upd({ fontSize: v })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />
          <div className={fieldCls}>
            <label className={labelCls}>Weight</label>
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

        {/* Italic / underline / strikethrough toggles */}
        <div className="mb-3">
          <label className={labelCls}>Style</label>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => upd({ italic: !layer.italic })}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors italic font-medium ${
                layer.italic
                  ? 'border-[#7c6ef6] bg-[rgba(124,110,246,0.18)] text-[#c4b5fd]'
                  : 'border-[rgba(255,255,255,0.1)] text-[#6b6b7a] hover:text-[#e8e8f0]'
              }`}
            >
              I  Italic
            </button>
            <button
              type="button"
              onClick={() => upd({ underline: !layer.underline })}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors underline font-medium ${
                layer.underline
                  ? 'border-[#7c6ef6] bg-[rgba(124,110,246,0.18)] text-[#c4b5fd]'
                  : 'border-[rgba(255,255,255,0.1)] text-[#6b6b7a] hover:text-[#e8e8f0]'
              }`}
            >
              U  Underline
            </button>
            <button
              type="button"
              onClick={() => upd({ strikethrough: !layer.strikethrough })}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors line-through font-medium ${
                layer.strikethrough
                  ? 'border-[#7c6ef6] bg-[rgba(124,110,246,0.18)] text-[#c4b5fd]'
                  : 'border-[rgba(255,255,255,0.1)] text-[#6b6b7a] hover:text-[#e8e8f0]'
              }`}
            >
              S  Strike
            </button>
          </div>
        </div>

        {/* Spacing */}
        <SliderField label="Letter Spacing" value={layer.letterSpacing} min={-20} max={100} step={1} onChange={(v) => upd({ letterSpacing: v })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />
        <SliderField label="Line Height" value={layer.lineHeight} min={0.5} max={4} step={0.05} unit="×" onChange={(v) => upd({ lineHeight: v })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} className="!mb-0" />
      </div>

      {/* ── AI Translation ── */}
      {(() => {
        const locales = project.settings.locales ?? [project.settings.defaultLocale]
        const nonDefaultLocales = locales.filter((l) => l !== project.settings.defaultLocale)
        if (nonDefaultLocales.length === 0) return null
        return (
          <TranslateSection
            layer={layer}
            nonDefaultLocales={nonDefaultLocales}
            slideGroupId={activeSlideGroupId}
          />
        )
      })()}

      {/* ── Align ── */}
      <div className={panelSectionCls}>
        <label className={labelCls}>Alignment</label>
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: 'left',   label: '⬱ Left' },
            { value: 'center', label: '≡ Center' },
            { value: 'right',  label: '⬲ Right' },
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

        {/* Vertical alignment — meaningful when the box has an explicit height */}
        {layer.height != null && (
          <div className="mt-3">
            <label className={labelCls}>Vertical Align</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'top',    label: '⤒ Top' },
                { value: 'middle', label: '☰ Middle' },
                { value: 'bottom', label: '⤓ Bottom' },
              ] as const).map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => upd({ verticalAlign: item.value })}
                  className={`rounded-lg border px-2 py-2 text-xs transition-colors ${
                    (layer.verticalAlign ?? 'top') === item.value
                      ? 'border-[#7c6ef6] bg-[#7c6ef6] text-white'
                      : 'border-[rgba(255,255,255,0.1)] text-[#6b6b7a] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#e8e8f0]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Content (WYSIWYG rich text) ── */}
      <div className={panelSectionCls}>
        <label className={labelCls}>Content</label>
        <TextContentPreview layer={layer} />
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
  const { updateLayer } = useEditorStore()
  const upd = (patch: Partial<GroupLayer>) => updateLayer(layer.id, patch as Partial<Layer>)
  const scale = layer.scale ?? 1
  return (
    <div className="space-y-4">
      {/* Enter hint */}
      <div className="rounded-xl border border-[rgba(124,110,246,0.25)] bg-[rgba(124,110,246,0.08)] p-3">
        <p className="text-xs font-semibold text-[#c4b5fd] mb-1">Group selected</p>
        <p className="text-xs text-[#9d90f8]">
          <strong>Double-click</strong> the canvas to enter and edit inner layers.
        </p>
      </div>

      {/* Scale */}
      <div className={panelSectionCls}>
        <div className="mb-1 flex items-center justify-between">
          <label className={labelCls + ' !mb-0'}>Scale</label>
          <span className="text-xs text-[#e8e8f0]">{scale.toFixed(2)}×</span>
        </div>
        <input type="range" min={0.1} max={4} step={0.05} value={scale} onChange={(e) => upd({ scale: Number(e.target.value) })} onMouseDown={pauseTemporal} onMouseUp={resumeTemporal} className="w-full accent-[#7c6ef6]" />
      </div>

      {/* Children list */}
      {layer.children.length > 0 && (
        <div className={panelSectionCls}>
          <label className={labelCls}>Inner layers ({layer.children.length})</label>
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
  const {
    project,
    activeSlideGroupId,
    selection,
    editingGroupId,
    activeCanvasFormat,
    clearLayerFormatOverride,
    syncLayerFormatToShared,
    makeLayerShared,
    copyLayerStyle,
    pasteLayerStyle,
    styleClipboard,
  } = useEditorStore()
  const [activeTab, setActiveTab] = useState<PanelTab>('layout')

  const viewProject = applyCanvasFormat(project, activeCanvasFormat)
  const activeGroup: SlideGroup | undefined = viewProject.slideGroups.find((group) => group.id === activeSlideGroupId)
  const rawActiveGroup: SlideGroup | undefined = project.slideGroups.find((group) => group.id === activeSlideGroupId)

  let selectedLayer: Layer | null = null
  let rawSelectedLayer: Layer | null = null
  if (selection?.layerId && activeGroup) {
    if (editingGroupId) {
      // selection.layerId IS the child id in group edit mode
      const parentGroup = activeGroup.layers.find((l) => l.id === editingGroupId && l.type === 'group') as GroupLayer | undefined
      selectedLayer = parentGroup?.children.find((child) => child.id === selection.layerId) ?? null
      const rawParentGroup = rawActiveGroup?.layers.find((l) => l.id === editingGroupId && l.type === 'group') as GroupLayer | undefined
      rawSelectedLayer = rawParentGroup?.children.find((child) => child.id === selection.layerId) ?? null
    } else {
      selectedLayer = activeGroup.layers.find((layer) => layer.id === selection.layerId) ?? null
      rawSelectedLayer = rawActiveGroup?.layers.find((layer) => layer.id === selection.layerId) ?? null
    }
  }
  if (!selectedLayer && rawSelectedLayer) selectedLayer = rawSelectedLayer

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveTab('layout')
  }, [selectedLayer?.id])

  // In-canvas text editing started → jump to the Content tab so the docked
  // styling toolbar and font/size controls are at hand.
  const editingTextId = useEditorStore((s) => s.editingTextId)
  useEffect(() => {
    if (!editingTextId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveTab('content')
  }, [editingTextId])

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

  const baseCanvasFormat = getProjectBaseFormat(project)
  const activeFormatInfo = getCanvasFormat(activeCanvasFormat)
  const isBaseFormat = activeCanvasFormat === baseCanvasFormat
  const selectedHasFormatOverride = Boolean(rawSelectedLayer?.formatOverrides?.[activeCanvasFormat])
  const isBackgroundSelected = selectedLayer?.type === 'background'



  const borderColor = 'rgba(255,255,255,0.06)'

  return (
    <aside data-properties-panel className="w-72 h-full flex flex-col overflow-hidden shrink-0" style={{ background: '#18181f', borderLeft: `1px solid ${borderColor}` }}>
      <div className="shrink-0 border-b px-3 py-2" style={{ borderColor }}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#6b6b7a]">Properties</span>
          {selectedLayer && (
            <div className="flex gap-1">
              <button
                type="button"
                title="Copy style (Ctrl+Alt+C)"
                onClick={() => copyLayerStyle(selectedLayer.id)}
                className="text-[10px] px-2 py-1 rounded border border-[rgba(255,255,255,0.1)] text-[#6b6b7a] hover:text-[#e8e8f0] hover:border-[rgba(255,255,255,0.2)] transition-colors"
              >
                Copy Style
              </button>
              {styleClipboard && (
                <button
                  type="button"
                  title={
                    styleClipboard.layerType === selectedLayer.type
                      ? 'Paste style (Ctrl+Alt+V)'
                      : `Paste style — copied from ${styleClipboard.layerType}, select a ${styleClipboard.layerType} layer`
                  }
                  onClick={() => {
                    if (styleClipboard.layerType === selectedLayer.type) pasteLayerStyle(selectedLayer.id)
                  }}
                  disabled={styleClipboard.layerType !== selectedLayer.type}
                  className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                    styleClipboard.layerType === selectedLayer.type
                      ? 'border-[rgba(124,110,246,0.4)] text-[#9d90f8] hover:text-white hover:border-[#7c6ef6] hover:bg-[rgba(124,110,246,0.15)]'
                      : 'border-[rgba(255,255,255,0.06)] text-[#3a3a4a] cursor-not-allowed'
                  }`}
                >
                  Paste Style
                </button>
              )}
            </div>
          )}
        </div>

        {selectedLayer && !isBackgroundSelected && (
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
          null
        ) : (
          <>
            {editingGroupId && selection?.layerId && (
              <div className="mb-4 rounded-xl border border-[rgba(124,110,246,0.3)] bg-[rgba(124,110,246,0.14)] px-3 py-2 text-xs text-[#c4b5fd]">
                ✦ Editing inside group
              </div>
            )}

            {rawSelectedLayer && !isBaseFormat && rawSelectedLayer.ownerFormat === activeCanvasFormat && (
              <div className="mb-3 rounded-lg border border-[rgba(124,110,246,0.3)] bg-[rgba(124,110,246,0.08)] px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-[#c4b5fd]">
                    Only in {activeFormatInfo.label} · Added specifically for this format
                  </span>
                  <button
                    onClick={() => makeLayerShared(rawSelectedLayer.id)}
                    className="text-[10px] text-[#c4b5fd] hover:text-white underline shrink-0"
                  >
                    Make shared
                  </button>
                </div>
              </div>
            )}

            {rawSelectedLayer && !isBaseFormat && !rawSelectedLayer.ownerFormat && selectedHasFormatOverride && (
              <div className="mb-3 rounded-lg border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.06)] px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-[#fbbf24]">
                    {Object.keys(rawSelectedLayer.formatOverrides?.[activeCanvasFormat] ?? {}).length} layout adjustments for {activeFormatInfo.label}
                  </span>
                  <div className="flex gap-1.5">
                    <button onClick={() => clearLayerFormatOverride(rawSelectedLayer.id)} className="text-[10px] text-[#fbbf24] hover:text-white underline">Reset</button>
                    <button onClick={() => syncLayerFormatToShared(rawSelectedLayer.id)} className="text-[10px] text-[#fbbf24] hover:text-white underline">Share</button>
                  </div>
                </div>
              </div>
            )}

            {isBackgroundSelected ? (
              <div className={panelSectionCls}>
                <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#6b6b7a]">Background</div>
                <BackgroundProperties layer={selectedLayer as BackgroundLayer} />
              </div>
            ) : (
              <>
                {activeTab === 'layout' && <LayoutTab layer={selectedLayer} />}
                {activeTab === 'style' && <StyleTab layer={selectedLayer} />}
                {activeTab === 'content' && <ContentTab layer={selectedLayer} />}
              </>
            )}
          </>
        )}
      </div>
    </aside>
  )
}
