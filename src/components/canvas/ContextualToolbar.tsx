import { useEditorStore } from '@/store'
import type {
  PhoneLayer, TextLayer, ShapeLayer, ChipsLayer, Layer, GroupLayer,
} from '@/types'
import { PHONE_MODELS } from '@/assets/mockups/specs'

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 5,
  color: '#e8e8f0',
  fontSize: 11,
  padding: '2px 4px',
  width: 60,
  outline: 'none',
}

const colorInputStyle: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 4,
  border: '1px solid rgba(255,255,255,0.2)',
  padding: 0,
  cursor: 'pointer',
  background: 'none',
}

const labelStyle: React.CSSProperties = {
  color: '#6b6b7a',
  fontSize: 10,
  marginRight: 3,
}

function Separator() {
  return <span style={{ opacity: 0.2, margin: '0 4px' }}>|</span>
}

export function ContextualToolbar() {
  const {
    selection,
    project,
    activeSlideGroupId,
    editingGroupId,
    updateLayer,
    removeLayer,
  } = useEditorStore()

  if (!selection?.layerId) return null

  const group = project.slideGroups.find((g) => g.id === activeSlideGroupId)
  if (!group) return null

  // Resolve the active layer: child when in group edit mode, otherwise top-level
  const layer = editingGroupId
    ? (() => {
        // selection.layerId IS the child id in group edit mode
        const parentGroup = group.layers.find((l) => l.id === editingGroupId && l.type === 'group') as GroupLayer | undefined
        return parentGroup?.children.find((c) => c.id === selection.layerId) ?? null
      })()
    : (group.layers.find((l) => l.id === selection.layerId) ?? null)
  if (!layer) return null

  const layerId = layer.id

  const handleDelete = () => {
    removeLayer(layerId)
  }

  const handleOpacityChange = (val: string) => {
    const num = parseFloat(val)
    if (!isNaN(num)) {
      updateLayer(layerId, { opacity: Math.max(0, Math.min(1, num / 100)) } as Partial<Layer>)
    }
  }

  // Type-specific controls
  let typeControls: React.ReactNode = null

  if (layer.type === 'phone') {
    const phone = layer as PhoneLayer
    const currentIdx = PHONE_MODELS.findIndex((m) => m.id === phone.model)
    const nextSpec = PHONE_MODELS[(currentIdx + 1) % PHONE_MODELS.length]
    const toggleModel = () => {
      updateLayer(layerId, { model: nextSpec.id, name: nextSpec.label } as Partial<Layer>)
    }
    const currentLabel = PHONE_MODELS[currentIdx]?.label ?? phone.model
    typeControls = (
      <>
        <Separator />
        <span style={labelStyle}>Model</span>
        <button
          onClick={toggleModel}
          title={`Switch to ${nextSpec.label}`}
          style={{
            background: 'rgba(124,110,246,0.15)',
            border: '1px solid rgba(124,110,246,0.3)',
            borderRadius: 5,
            color: '#c4b5fd',
            cursor: 'pointer',
            fontSize: 11,
            padding: '2px 7px',
            maxWidth: 130,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {currentLabel}
        </button>
        <Separator />
        <span style={labelStyle}>Scale</span>
        <input
          type="number"
          step={0.1}
          min={0.1}
          max={10}
          value={phone.scale}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v)) updateLayer(layerId, { scale: v } as Partial<Layer>)
          }}
          style={inputStyle}
        />
      </>
    )
  } else if (layer.type === 'text') {
    const text = layer as TextLayer
    const fillColor = typeof text.fill === 'string' ? text.fill : '#ffffff'
    typeControls = (
      <>
        <Separator />
        <span style={labelStyle}>Size</span>
        <input
          type="number"
          step={1}
          min={1}
          value={text.fontSize}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10)
            if (!isNaN(v) && v > 0) updateLayer(layerId, { fontSize: v } as Partial<Layer>)
          }}
          style={inputStyle}
        />
        <Separator />
        <span style={labelStyle}>Color</span>
        <input
          type="color"
          value={fillColor}
          onChange={(e) => updateLayer(layerId, { fill: e.target.value } as Partial<Layer>)}
          style={colorInputStyle}
        />
        <Separator />
        <button
          onClick={() => updateLayer(layerId, { fontWeight: text.fontWeight >= 700 ? 400 : 800 } as Partial<Layer>)}
          style={{
            background: text.fontWeight >= 700 ? 'rgba(124,110,246,0.25)' : 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 4,
            color: '#e8e8f0',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: 12,
            padding: '1px 6px',
          }}
          title="Bold"
        >B</button>
      </>
    )
  } else if (layer.type === 'shape') {
    const shape = layer as ShapeLayer
    const fillColor = typeof shape.fill === 'string' ? shape.fill : '#7c6ef6'
    typeControls = (
      <>
        <Separator />
        <span style={labelStyle}>Color</span>
        <input
          type="color"
          value={fillColor}
          onChange={(e) => updateLayer(layerId, { fill: e.target.value } as Partial<Layer>)}
          style={colorInputStyle}
        />
        <Separator />
        <span style={labelStyle}>W</span>
        <input
          type="number"
          step={1}
          min={1}
          value={shape.width}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10)
            if (!isNaN(v) && v > 0) updateLayer(layerId, { width: v } as Partial<Layer>)
          }}
          style={inputStyle}
        />
        <span style={labelStyle}>H</span>
        <input
          type="number"
          step={1}
          min={1}
          value={shape.height}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10)
            if (!isNaN(v) && v > 0) updateLayer(layerId, { height: v } as Partial<Layer>)
          }}
          style={inputStyle}
        />
      </>
    )
  } else if (layer.type === 'chips') {
    const chips = layer as ChipsLayer
    typeControls = (
      <>
        <Separator />
        <button
          onClick={() => {
            updateLayer(layerId, {
              items: [...chips.items, { label: 'New chip', primary: true }],
            } as Partial<Layer>)
          }}
          style={{
            background: 'rgba(124,110,246,0.15)',
            border: '1px solid rgba(124,110,246,0.3)',
            borderRadius: 5,
            color: '#c4b5fd',
            cursor: 'pointer',
            fontSize: 11,
            padding: '2px 7px',
          }}
        >
          + Add chip
        </button>
      </>
    )
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(15,15,19,0.92)',
        backdropFilter: 'blur(12px)',
        borderRadius: 10,
        padding: '6px 12px',
        border: '1px solid rgba(255,255,255,0.12)',
        zIndex: 200,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        fontSize: 12,
        color: '#e8e8f0',
        pointerEvents: 'all',
        whiteSpace: 'nowrap',
      }}
    >
      {/* Layer name */}
      <span style={{ fontSize: 11, color: '#a0a0b0', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {layer.name}
      </span>

      <Separator />

      {/* Opacity */}
      <span style={labelStyle}>Opacity</span>
      <input
        type="number"
        step={1}
        min={0}
        max={100}
        value={Math.round(layer.opacity * 100)}
        onChange={(e) => handleOpacityChange(e.target.value)}
        style={inputStyle}
      />

      {/* Type-specific controls */}
      {typeControls}

      <Separator />

      {/* Delete */}
      <button
        onClick={handleDelete}
        style={{
          background: 'none',
          border: 'none',
          color: '#6b6b7a',
          cursor: 'pointer',
          fontSize: 13,
          padding: '0 2px',
          lineHeight: 1,
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#f87171' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#6b6b7a' }}
        title="Delete layer"
      >
        🗑
      </button>
    </div>
  )
}
