import { useEditorStore } from '@/store'
import type { ChipsLayer, ChipItem, ChipVariant, Layer } from '@/types'
import { ColorField, SliderField } from '@/components/properties/PropertyControls'
import {
  inputCls,
  labelCls,
  rowCls,
  fieldCls,
  panelSectionCls,
  pauseTemporal,
  resumeTemporal,
} from '@/components/properties/panelConstants'

export function ChipsProperties({ layer }: { layer: ChipsLayer }) {
  const updateLayer = useEditorStore((s) => s.updateLayer)
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
