/**
 * Shared CSS class constants, temporal helpers, and utility functions used
 * across per-layer-type property editor files.
 */

import { useEditorStore } from '@/store'
import type { CanvasFormatId } from '@/types'

// ─── Temporal pause/resume helpers ───────────────────────────────────────────
export const pauseTemporal = () => useEditorStore.temporal.getState().pause()
export const resumeTemporal = () => useEditorStore.temporal.getState().resume()

// ─── Panel CSS class constants ─────────────────────────────────────────────
export const inputCls =
  'bg-[#0f0f13] border border-[rgba(255,255,255,0.1)] rounded px-2 py-1 text-sm text-[#e8e8f0] w-full focus:outline-none focus:border-[rgba(124,110,246,0.5)]'
export const labelCls = 'text-[11px] text-[#6b6b7a] mb-1 block uppercase tracking-[0.08em]'
export const rowCls = 'flex gap-2 mb-3'
export const fieldCls = 'flex-1 min-w-0'
export const panelSectionCls = 'mb-4 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-3'
export const subtleButtonCls =
  'text-xs text-[#e8e8f0] px-3 py-1.5 rounded-lg border border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.18)] hover:bg-[rgba(255,255,255,0.06)] transition-colors'

// ─── Panel tab type ───────────────────────────────────────────────────────
export type PanelTab = 'layout' | 'style' | 'content'

// ─── Format label helper ─────────────────────────────────────────────────
export function shortFormatLabel(id: CanvasFormatId): string {
  const map: Record<CanvasFormatId, string> = {
    'base': 'Base',
    'iphone-69': 'iPhone',
    'android-phone': 'Android',
    'ipad-13': 'iPad',
    'android-tablet': 'Android Tab',
  }
  return map[id] ?? id
}
