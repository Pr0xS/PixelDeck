import { getPanoSlideX } from '@/utils/panoGeometry'
import type { SlideGroup } from '@/types'
import type { AssetDropHighlight } from './useAssetDropTarget'

interface StageOverlaysProps {
  group: SlideGroup
  showSeamGuides: boolean
  panoCompensate: boolean
  visualGapPx: number
  effectiveCompensationPx: number
  totalHeight: number
  displayWidth: number
  displayHeight: number
  zoom: number
  viewportX: number
  viewportY: number
  editingGroupId: string | null
  exitGroupEdit: () => void
  setZoom: (zoom: number) => void
  zoomInput: string | null
  setZoomInput: (value: string | null) => void
  handleFit: () => void
  assetDropHighlight: AssetDropHighlight | null
  spaceDown: boolean
}

export function CanvasShadow({
  group,
  viewportX,
  viewportY,
  displayWidth,
  displayHeight,
}: Pick<StageOverlaysProps, 'group' | 'viewportX' | 'viewportY' | 'displayWidth' | 'displayHeight'>) {
  return group.numSlides === 1
    ? <div style={{ position: 'absolute', left: viewportX, top: viewportY, width: displayWidth, height: displayHeight, borderRadius: 10, boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)', pointerEvents: 'none', zIndex: 1 }} />
    : null
}

export function SeamGuides({
  group,
  showSeamGuides,
  panoCompensate,
  visualGapPx,
  effectiveCompensationPx,
  totalHeight,
  zoom,
  viewportX,
  viewportY,
}: Pick<StageOverlaysProps, 'group' | 'showSeamGuides' | 'panoCompensate' | 'visualGapPx' | 'effectiveCompensationPx' | 'totalHeight' | 'zoom' | 'viewportX' | 'viewportY'>) {
  if (!showSeamGuides || group.numSlides <= 1) return null
  return <>{Array.from({ length: group.numSlides - 1 }, (_, i) => {
    const screenH = Math.round(totalHeight * zoom)
    if (panoCompensate && visualGapPx > 0) {
      const seamX = getPanoSlideX(group, i + 1, effectiveCompensationPx)
      const bandScreenX = Math.round(viewportX + (seamX - visualGapPx) * zoom)
      const bandW = Math.max(2, Math.round(visualGapPx * zoom))
      return <div key={`seam-${i}`} style={{ position: 'absolute', left: bandScreenX, top: Math.round(viewportY), width: bandW, height: screenH, background: 'rgba(17,17,24,0.85)', borderLeft: '1px solid rgba(124,110,246,0.5)', borderRight: '1px solid rgba(124,110,246,0.5)', pointerEvents: 'none', zIndex: 6 }} />
    }
    const seamX = getPanoSlideX(group, i + 1, 0)
    const screenX = Math.round(viewportX + seamX * zoom)
    return <div key={`seam-${i}`} style={{ position: 'absolute', left: screenX - 1, top: Math.round(viewportY), width: 2, height: screenH, background: 'rgba(255,255,255,0.15)', pointerEvents: 'none', zIndex: 6 }} />
  })}</>
}

export function StageChrome({
  group,
  effectiveCompensationPx,
  displayHeight,
  zoom,
  viewportX,
  viewportY,
  editingGroupId,
  exitGroupEdit,
  setZoom,
  zoomInput,
  setZoomInput,
  handleFit,
  assetDropHighlight,
  spaceDown,
}: Pick<StageOverlaysProps, 'group' | 'effectiveCompensationPx' | 'displayHeight' | 'zoom' | 'viewportX' | 'viewportY' | 'editingGroupId' | 'exitGroupEdit' | 'setZoom' | 'zoomInput' | 'setZoomInput' | 'handleFit' | 'assetDropHighlight' | 'spaceDown'>) {
  return <>
    {group.numSlides > 1 && Array.from({ length: group.numSlides }, (_, i) => {
      const slideScreenW = Math.round(group.slideWidth * zoom)
      const slideScreenX = Math.round(viewportX + getPanoSlideX(group, i, effectiveCompensationPx) * zoom)
      const isFirst = i === 0
      const isLast = i === group.numSlides - 1
      const R = 10
      return <div key={`card-frame-${i}`} style={{ position: 'absolute', left: slideScreenX, top: Math.round(viewportY), width: slideScreenW, height: Math.round(displayHeight), borderTopLeftRadius: isFirst ? R : 0, borderBottomLeftRadius: isFirst ? R : 0, borderTopRightRadius: isLast ? R : 0, borderBottomRightRadius: isLast ? R : 0, border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 16px 48px rgba(0,0,0,0.55)', pointerEvents: 'none', zIndex: 5 }} />
    })}
    {editingGroupId && <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(124,110,246,0.95)', borderRadius: 8, padding: '6px 14px', zIndex: 100, pointerEvents: 'all', boxShadow: '0 4px 20px rgba(124,110,246,0.4)' }}>
      <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>✦ Editing group</span>
      <button onClick={(e) => { e.stopPropagation(); exitGroupEdit() }} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: '3px 10px' }}>Exit</button>
    </div>}
    <div style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(15,15,19,0.88)', backdropFilter: 'blur(8px)', borderRadius: 8, padding: '4px 8px', border: '1px solid rgba(255,255,255,0.1)', zIndex: 100, pointerEvents: 'all' }}>
      <button onClick={(e) => { e.stopPropagation(); setZoom(Math.max(0.05, zoom - 0.02)) }} title="Zoom out" style={{ background: 'none', border: 'none', color: '#e8e8f0', cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1 }}>−</button>
      <input type="text" value={zoomInput ?? `${Math.round(zoom * 100)}`} onChange={(e) => setZoomInput(e.target.value)} onFocus={(e) => { setZoomInput(`${Math.round(zoom * 100)}`); e.target.select() }} onBlur={() => { const parsed = parseInt(zoomInput ?? '', 10); if (!isNaN(parsed) && parsed > 0) setZoom(Math.max(0.05, Math.min(4, parsed / 100))); setZoomInput(null) }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setZoomInput(null); (e.target as HTMLInputElement).blur() }; e.stopPropagation() }} onClick={(e) => e.stopPropagation()} title="Zoom level — click to edit" style={{ background: 'none', border: 'none', color: '#6b6b7a', fontSize: 11, width: 36, textAlign: 'center', cursor: 'text', outline: 'none', padding: 0 }} />
      <span style={{ color: '#6b6b7a', fontSize: 11, marginLeft: -2 }}>%</span>
      <button onClick={(e) => { e.stopPropagation(); setZoom(Math.min(4, zoom + 0.02)) }} title="Zoom in" style={{ background: 'none', border: 'none', color: '#e8e8f0', cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1 }}>＋</button>
      <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.12)', margin: '0 2px' }} />
      <button onClick={(e) => { e.stopPropagation(); handleFit() }} title="Fit canvas in view" style={{ background: 'none', border: 'none', color: '#a0a0b0', cursor: 'pointer', fontSize: 11, padding: '0 4px', lineHeight: 1 }}>Fit</button>
    </div>
    {assetDropHighlight && <div style={{ position: 'absolute', left: assetDropHighlight.x, top: assetDropHighlight.y, width: assetDropHighlight.w, height: assetDropHighlight.h, borderRadius: 10, border: `2px solid ${assetDropHighlight.mode === 'replace' ? '#7c6ef6' : '#38bdf8'}`, background: assetDropHighlight.mode === 'replace' ? 'rgba(124,110,246,0.14)' : 'rgba(56,189,248,0.10)', boxShadow: assetDropHighlight.mode === 'replace' ? '0 0 0 1px rgba(124,110,246,0.22), 0 0 32px rgba(124,110,246,0.28)' : '0 0 0 1px rgba(56,189,248,0.18), 0 0 28px rgba(56,189,248,0.22)', pointerEvents: 'none', zIndex: 90 }}>
      <div style={{ position: 'absolute', left: 8, top: -28, borderRadius: 999, padding: '4px 9px', background: assetDropHighlight.mode === 'replace' ? 'rgba(124,110,246,0.94)' : 'rgba(14,116,144,0.94)', color: 'white', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', boxShadow: '0 10px 24px rgba(0,0,0,0.35)' }}>{assetDropHighlight.label}</div>
    </div>}
    {spaceDown && <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', background: 'rgba(15,15,19,0.88)', backdropFilter: 'blur(8px)', borderRadius: 8, padding: '4px 12px', border: '1px solid rgba(255,255,255,0.1)', color: '#6b6b7a', fontSize: 11, zIndex: 100, pointerEvents: 'none' }}>✋ Pan mode — drag to move</div>}
    {group.numSlides > 1 && Array.from({ length: group.numSlides }, (_, i) => <div key={i} style={{ position: 'absolute', top: Math.round(viewportY + displayHeight) + 8, left: Math.round(viewportX + (getPanoSlideX(group, i, effectiveCompensationPx) + group.slideWidth / 2) * zoom) - 20, color: 'rgba(124,110,246,0.6)', fontSize: 10, pointerEvents: 'none', zIndex: 5 }}>{group.slideNames[i] ?? `slide ${i + 1}`}</div>)}
  </>
}
