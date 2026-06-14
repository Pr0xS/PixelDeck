import type { Layer } from '@/types'
import type { ContextMenu } from './constants'

interface LayerContextMenuProps {
  contextMenu: ContextMenu
  layers: Layer[]
  clipboard: Layer[] | null
  onMenuAction: (action: string, layerId: string) => void
}

export function LayerContextMenu({ contextMenu, layers, clipboard, onMenuAction }: LayerContextMenuProps) {
  const ctxLayer = layers.find((l) => l.id === contextMenu.layerId)
  const menuItems = [
    { action: 'copy', label: 'Copy' },
    { action: 'cut', label: 'Cut' },
    ...(clipboard ? [{ action: 'paste', label: 'Paste' }] : []),
    { action: 'duplicate', label: 'Duplicate' },
    { action: 'up', label: 'Move Up' },
    { action: 'down', label: 'Move Down' },
    ...(ctxLayer?.type === 'group' ? [{ action: 'dissolve', label: 'Dissolve Group' }] : []),
    { action: 'delete', label: 'Delete' },
  ]

  return (
    <div
      className="fixed z-50 py-1 rounded shadow-2xl border"
      style={{ left: contextMenu.x, top: contextMenu.y, background: '#18181f', borderColor: 'rgba(255,255,255,0.08)', minWidth: 140 }}
      onClick={(e) => e.stopPropagation()}
    >
      {menuItems.map(({ action, label }) => (
        <button
          key={action}
          className="w-full text-left px-3 py-2 text-xs text-[#e8e8f0] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
          style={action === 'delete' ? { color: '#f87171' } : undefined}
          onClick={() => onMenuAction(action, contextMenu.layerId)}
        >{label}</button>
      ))}
    </div>
  )
}
