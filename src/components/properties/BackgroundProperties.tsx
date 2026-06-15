import { useRef } from 'react'
import { useEditorStore } from '@/store'
import type { BackgroundLayer, Layer } from '@/types'
import { fileToDataUrl } from '@/utils/files'
import { ColorField, FillControl, SliderField } from '@/components/properties/PropertyControls'
import { labelCls, pauseTemporal, resumeTemporal } from '@/components/properties/panelConstants'

export function BackgroundProperties({ layer }: { layer: BackgroundLayer }) {
  const updateLayer = useEditorStore((s) => s.updateLayer)
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
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
              (layer.noise ?? 0) > 0 ? 'translate-x-[18px]' : 'translate-x-0'
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
