import { useEditorStore } from '@/store'
import type { ShapeLayer, Layer } from '@/types'
import { SliderField } from '@/components/properties/PropertyControls'
import { labelCls, panelSectionCls, pauseTemporal, resumeTemporal } from '@/components/properties/panelConstants'

export function ShapeProperties({ layer }: { layer: ShapeLayer }) {
  const updateLayer = useEditorStore((s) => s.updateLayer)
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
