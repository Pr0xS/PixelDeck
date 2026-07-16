import { useRef } from 'react'
import { useEditorStore } from '@/store'
import type { BackgroundAccent, BackgroundLayer, Layer } from '@/types'
import { fileToDataUrl } from '@/utils/files'
import { resolveBrandColor } from '@/utils/brandColors'
import {
  getBackgroundAccentOpacity,
  getBackgroundAccentRenderColor,
  updateBackgroundAccentAt,
} from '@/utils/backgroundAccents'
import { ColorField, FillControl, SliderField } from '@/components/properties/PropertyControls'
import {
  fieldCls,
  labelCls,
  panelSectionCls,
  pauseTemporal,
  resumeTemporal,
  subtleButtonCls,
} from '@/components/properties/panelConstants'

const ACCENT_PRESETS = [
  { cx: 50, cy: 20, rx: 500, ry: 450 },
  { cx: 18, cy: 78, rx: 420, ry: 480 },
  { cx: 82, cy: 65, rx: 460, ry: 400 },
  { cx: 25, cy: 32, rx: 380, ry: 440 },
  { cx: 72, cy: 12, rx: 440, ry: 400 },
  { cx: 12, cy: 50, rx: 400, ry: 460 },
] as const

export function BackgroundProperties({ layer }: { layer: BackgroundLayer }) {
  const updateLayer = useEditorStore((s) => s.updateLayer)
  const selectedAccentIndex = useEditorStore((s) => s.selectedAccentIndex)
  const selectAccent = useEditorStore((s) => s.selectAccent)
  const brandColors = useEditorStore((s) => s.project.settings.brandColors) ?? []
  const upd = (patch: Partial<BackgroundLayer>) => updateLayer(layer.id, patch as Partial<Layer>)
  const bgImageInputRef = useRef<HTMLInputElement>(null)

  const hasImage = !!layer.imageDataUrl

  const updateAccent = (i: number, patch: Partial<BackgroundAccent>) =>
    upd({ accents: updateBackgroundAccentAt(layer.accents, i, patch) })
  const removeAccent = (i: number) => {
    upd({ accents: layer.accents.filter((_, idx) => idx !== i) })
    if (selectedAccentIndex === i) selectAccent(null)
    else if (selectedAccentIndex !== null && i < selectedAccentIndex) {
      selectAccent(selectedAccentIndex - 1)
    }
  }
  // Staggered presets so each new accent starts visually distinct from the
  // ones already on the canvas — otherwise every "+ Add Accent" click would
  // spawn an exact duplicate (same color/position/size) perfectly overlapping
  // the previous one, making edits to the new one look like they do nothing.
  const addAccent = () => {
    const n = layer.accents.length
    const preset = ACCENT_PRESETS[n % ACCENT_PRESETS.length]
    upd({
      accents: [
        ...layer.accents,
        { color: '#7c6ef6', opacity: 0.25, ...preset },
      ],
    })
    selectAccent(n)
  }

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
                <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  (layer.imageOverlayOpacity ?? 0) > 0 ? 'translate-x-[18px]' : 'translate-x-0'
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
            <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
              (layer.noise ?? 0) > 0 ? 'translate-x-4' : 'translate-x-0'
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

      {/* Decorative glow accents */}
      <div className={panelSectionCls}>
        <label className={labelCls}>Accents</label>
        <div className="space-y-3">
          <div className="space-y-1.5">
            {layer.accents.map((accent, i) => (
              <div
                key={i}
                onClick={() => selectAccent(i)}
                className={`flex w-full cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors ${
                  selectedAccentIndex === i
                    ? 'border-[#7c6ef6] bg-[rgba(124,110,246,0.14)] text-[#e8e8f0]'
                    : 'border-[rgba(255,255,255,0.08)] text-[#9a9aaa] hover:border-[rgba(124,110,246,0.5)] hover:bg-[rgba(255,255,255,0.04)]'
                }`}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span
                    className="h-4 w-4 shrink-0 rounded-full border border-[rgba(255,255,255,0.2)]"
                    style={{
                      background: getBackgroundAccentRenderColor(
                        accent,
                        resolveBrandColor(accent.color, brandColors),
                      ),
                      opacity: accent.opacity === undefined ? 1 : getBackgroundAccentOpacity(accent),
                    }}
                  />
                  <span className="flex-1">Accent {i + 1}</span>
                </button>
                <button
                  type="button"
                  aria-label={`Remove accent ${i + 1}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    removeAccent(i)
                  }}
                  className="px-1 text-lg leading-none text-[#f87171] hover:text-[#fca5a5] transition-colors"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {selectedAccentIndex !== null && layer.accents[selectedAccentIndex] ? (() => {
            const accent = layer.accents[selectedAccentIndex]
            return (
              <div className="space-y-3 border-t border-[rgba(255,255,255,0.08)] pt-3">
                <div className={fieldCls}>
                  <label className={labelCls}>Color</label>
                  <ColorField
                    value={accent.color}
                    onChange={(color) => updateAccent(selectedAccentIndex, {
                      color,
                      opacity: getBackgroundAccentOpacity(accent),
                    })}
                    onInteractionStart={pauseTemporal}
                    onInteractionEnd={resumeTemporal}
                  />
                </div>

                <SliderField
                  label="Opacity"
                  value={Math.round(getBackgroundAccentOpacity(accent) * 100)}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(v) => updateAccent(selectedAccentIndex, { opacity: v / 100 })}
                  onInteractionStart={pauseTemporal}
                  onInteractionEnd={resumeTemporal}
                />
                <SliderField
                  label="Position X"
                  value={accent.cx}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(v) => updateAccent(selectedAccentIndex, { cx: v })}
                  onInteractionStart={pauseTemporal}
                  onInteractionEnd={resumeTemporal}
                />
                <SliderField
                  label="Position Y"
                  value={accent.cy}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(v) => updateAccent(selectedAccentIndex, { cy: v })}
                  onInteractionStart={pauseTemporal}
                  onInteractionEnd={resumeTemporal}
                />
                <SliderField
                  label="Size X"
                  value={accent.rx}
                  min={20}
                  max={1400}
                  unit="px"
                  onChange={(v) => updateAccent(selectedAccentIndex, { rx: v })}
                  onInteractionStart={pauseTemporal}
                  onInteractionEnd={resumeTemporal}
                />
                <SliderField
                  label="Size Y"
                  value={accent.ry}
                  min={20}
                  max={1400}
                  unit="px"
                  onChange={(v) => updateAccent(selectedAccentIndex, { ry: v })}
                  onInteractionStart={pauseTemporal}
                  onInteractionEnd={resumeTemporal}
                />
                <SliderField
                  label="Blur"
                  value={accent.blur ?? 0}
                  min={0}
                  max={60}
                  unit="px"
                  onChange={(v) => updateAccent(selectedAccentIndex, { blur: v || undefined })}
                  onInteractionStart={pauseTemporal}
                  onInteractionEnd={resumeTemporal}
                  className="!mb-0"
                />
              </div>
            )
          })() : (
            <p className="text-xs text-[#6b6b7a]">Select an accent to edit it</p>
          )}

          <button type="button" onClick={addAccent} className={subtleButtonCls}>
            + Add Accent
          </button>
        </div>
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
