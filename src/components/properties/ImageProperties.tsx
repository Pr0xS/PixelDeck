import { useEditorStore } from '@/store'
import type { ImageLayer, Layer } from '@/types'
import { SliderField } from '@/components/properties/PropertyControls'
import { panelSectionCls, pauseTemporal, resumeTemporal } from '@/components/properties/panelConstants'

export function ImageProperties({ layer }: { layer: ImageLayer }) {
  const updateLayer = useEditorStore((s) => s.updateLayer)
  const upd = (patch: Partial<ImageLayer>) => updateLayer(layer.id, patch as Partial<Layer>)

  return (
    <div className="space-y-4">
      <div className={panelSectionCls}>
        <SliderField label="Corner Radius" value={layer.cornerRadius} min={0} max={500} unit="px" onChange={(v) => upd({ cornerRadius: v })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} className="!mb-0" />
      </div>
    </div>
  )
}
