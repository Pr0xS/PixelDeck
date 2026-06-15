import { useEditorStore } from '@/store'
import type { ShapeLayer, Layer } from '@/types'
import { SliderField } from '@/components/properties/PropertyControls'
import { labelCls, panelSectionCls, pauseTemporal, resumeTemporal } from '@/components/properties/panelConstants'

// Shapes that look best starting square
const SQUARE_SHAPES = new Set<ShapeLayer['shapeType']>(['triangle', 'diamond', 'star', 'pentagon', 'hexagon', 'cross'])

const SHAPE_OPTIONS: { type: ShapeLayer['shapeType']; label: string; icon: string }[] = [
  { type: 'rect',     label: 'Rect',     icon: '▭' },
  { type: 'ellipse',  label: 'Ellipse',  icon: '⬭' },
  { type: 'triangle', label: 'Triangle', icon: '△' },
  { type: 'diamond',  label: 'Diamond',  icon: '◇' },
  { type: 'star',     label: 'Star',     icon: '☆' },
  { type: 'pentagon', label: 'Pentagon', icon: '⬠' },
  { type: 'hexagon',  label: 'Hexagon',  icon: '⬡' },
  { type: 'arrow',    label: 'Arrow',    icon: '→' },
  { type: 'cross',    label: 'Cross',    icon: '+' },
]

const ARROW_DIRECTIONS: { dir: ShapeLayer['arrowDirection']; label: string }[] = [
  { dir: 'right', label: '→' },
  { dir: 'up',    label: '↑' },
  { dir: 'down',  label: '↓' },
  { dir: 'left',  label: '←' },
]

export function ShapeProperties({ layer }: { layer: ShapeLayer }) {
  const updateLayer = useEditorStore((s) => s.updateLayer)
  const upd = (patch: Partial<ShapeLayer>) => updateLayer(layer.id, patch as Partial<Layer>)

  return (
    <div className="space-y-4">
      <div className={panelSectionCls}>
        <label className={labelCls}>Shape Type</label>
        <div className="grid grid-cols-3 gap-2">
          {SHAPE_OPTIONS.map(({ type, label, icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                const patch: Partial<ShapeLayer> = { shapeType: type }
                if (SQUARE_SHAPES.has(type)) {
                  const side = Math.min(layer.width, layer.height)
                  patch.width = side
                  patch.height = side
                }
                upd(patch)
              }}
              className={`rounded-lg border px-2 py-2 text-xs transition-colors flex flex-col items-center gap-0.5 ${
                layer.shapeType === type
                  ? 'border-[#7c6ef6] bg-[#7c6ef6] text-white'
                  : 'border-[rgba(255,255,255,0.1)] text-[#6b6b7a] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#e8e8f0]'
              }`}
            >
              <span className="text-base leading-none">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {layer.shapeType === 'rect' && (
        <div className={panelSectionCls}>
          <SliderField
            label="Corner Radius"
            value={layer.cornerRadius}
            min={0}
            max={500}
            unit="px"
            onChange={(v) => upd({ cornerRadius: v })}
            onInteractionStart={pauseTemporal}
            onInteractionEnd={resumeTemporal}
            className="!mb-0"
          />
        </div>
      )}

      {layer.shapeType === 'star' && (
        <div className={panelSectionCls}>
          <SliderField
            label="Points"
            value={layer.starPoints ?? 5}
            min={3}
            max={12}
            onChange={(v) => upd({ starPoints: v })}
            onInteractionStart={pauseTemporal}
            onInteractionEnd={resumeTemporal}
          />
          <SliderField
            label="Inner Ratio"
            value={Math.round((layer.starInnerRatio ?? 0.4) * 100)}
            min={10}
            max={90}
            unit="%"
            onChange={(v) => upd({ starInnerRatio: v / 100 })}
            onInteractionStart={pauseTemporal}
            onInteractionEnd={resumeTemporal}
            className="!mb-0"
          />
        </div>
      )}

      {layer.shapeType === 'arrow' && (
        <div className={panelSectionCls}>
          <label className={labelCls}>Direction</label>
          <div className="grid grid-cols-4 gap-2">
            {ARROW_DIRECTIONS.map(({ dir, label }) => (
              <button
                key={dir}
                type="button"
                onClick={() => upd({ arrowDirection: dir })}
                className={`rounded-lg border py-2 text-base transition-colors ${
                  (layer.arrowDirection ?? 'right') === dir
                    ? 'border-[#7c6ef6] bg-[#7c6ef6] text-white'
                    : 'border-[rgba(255,255,255,0.1)] text-[#6b6b7a] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#e8e8f0]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
