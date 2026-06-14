import { useRef } from 'react'
import { useEditorStore } from '@/store'
import type { BrandLayer, Layer } from '@/types'
import { fileToDataUrl } from '@/utils/files'
import { ColorField, SliderField } from '@/components/properties/PropertyControls'
import {
  inputCls,
  labelCls,
  fieldCls,
  panelSectionCls,
  subtleButtonCls,
  pauseTemporal,
  resumeTemporal,
} from '@/components/properties/panelConstants'

export function BrandProperties({ layer }: { layer: BrandLayer }) {
  const updateLayer = useEditorStore((s) => s.updateLayer)
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
