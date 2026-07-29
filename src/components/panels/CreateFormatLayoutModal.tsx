import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ModalShell } from '@/components/ui/ModalShell'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useEditorStore } from '@/store'
import type { CanvasFormatId } from '@/types'
import { BASE_CANVAS_FORMAT, FORMAT_FAMILY, getFormatLabel, getFormatScaleFactor, getProjectActiveFormats, getProjectBaseFormat, resolveForkSourceFormat, selectForkSourceCandidates, selectForkSourceGroups } from '@/utils/canvasFormats'

interface CreateFormatLayoutModalProps { open: boolean; targetFormatId: CanvasFormatId | null; onClose: () => void }
const familyLabels = { phone: 'Phone', tablet: 'Tablet', watch: 'Watch', desktop: 'TV & Desktop' } as const

export function CreateFormatLayoutModal({ open, targetFormatId, onClose }: CreateFormatLayoutModalProps) {
  const store = useEditorStore(useShallow((state) => ({ project: state.project, activeCanvasFormat: state.activeCanvasFormat, activeSlideGroupId: state.activeSlideGroupId, createFormatLayout: state.createFormatLayout, setActiveCanvasFormat: state.setActiveCanvasFormat })))
  const defaultSourceFormat = targetFormatId
    ? resolveForkSourceFormat(store.project, store.activeCanvasFormat, store.activeSlideGroupId, targetFormatId)
    : BASE_CANVAS_FORMAT
  const sourceCandidates = targetFormatId ? selectForkSourceCandidates(store.project, targetFormatId) : []
  const [sourceFormat, setSourceFormat] = useState<CanvasFormatId>(defaultSourceFormat)
  const [choice, setChoice] = useState<'copy' | 'blank'>(() => {
    if (!targetFormatId) return 'copy'
    const sourceGroups = selectForkSourceGroups(store.project, defaultSourceFormat, targetFormatId)
    const smallestScaleFactor = sourceGroups.length
      ? Math.min(...sourceGroups.map((group) => getFormatScaleFactor(group, targetFormatId, getProjectBaseFormat(store.project), store.project.settings.customFormats)))
      : 1
    return smallestScaleFactor < 0.5 ? 'blank' : 'copy'
  })
  if (!targetFormatId) return null

  const targetFamily = FORMAT_FAMILY[targetFormatId as keyof typeof FORMAT_FAMILY]
  const sourceGroups = selectForkSourceGroups(store.project, sourceFormat, targetFormatId)
  const pinCount = sourceGroups.filter((group) => group.formats === undefined).length
  const remainingFormats = getProjectActiveFormats(store.project)
    .filter((format) => format !== targetFormatId)
    .map((format) => getFormatLabel(format, store.project.settings.customFormats))
  const sourceLabel = sourceFormat === BASE_CANVAS_FORMAT
    ? 'Unscoped'
    : getFormatLabel(sourceFormat, store.project.settings.customFormats)
  const handleCreate = () => {
    store.createFormatLayout(targetFormatId, {
      content: choice,
      sourceFormat,
    })
    store.setActiveCanvasFormat(targetFormatId)
    onClose()
  }

  return <ModalShell open={open} onClose={onClose} title={`Start your ${familyLabels[targetFamily]} layout`} maxWidth="max-w-md" bodyClassName="px-5 py-5" footerClassName="flex justify-end gap-2 border-t border-[rgba(255,255,255,0.06)] px-5 py-4" footer={<><button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-xs text-[#8f90a3] hover:bg-[rgba(255,255,255,0.06)] hover:text-white">Cancel</button><button type="button" onClick={handleCreate} disabled={sourceGroups.length === 0} className="rounded-lg bg-[#7c6ef6] px-3 py-2 text-xs font-medium text-white hover:bg-[#6c5ed6] disabled:cursor-not-allowed disabled:opacity-50">Create {familyLabels[targetFamily]} layout</button></>}>
    <p className="text-sm leading-6 text-[#b7b7c5]">This will create <span className="font-medium text-[#f4f4f7]">{sourceGroups.length} shared {familyLabels[targetFamily]} screen layout{sourceGroups.length === 1 ? '' : 's'}</span> from your <span className="font-medium text-[#f4f4f7]">{sourceGroups.length} {sourceLabel} screen{sourceGroups.length === 1 ? '' : 's'}</span>.</p>
    {pinCount > 0 && <p className="mt-3 rounded-lg border border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.07)] px-3 py-2 text-[11px] leading-4 text-[#d7c08b]">Your {pinCount} existing screen{pinCount === 1 ? '' : 's'} will be marked {remainingFormats.join(', ') || 'their current formats'} only.</p>}
    {sourceGroups.length === 0 && <p className="mt-3 text-[11px] text-[#d7c08b]">Pick a format tab to copy from.</p>}
    {sourceCandidates.length > 0 && <label className="mt-4 block text-[10px] font-semibold uppercase tracking-[0.15em] text-[#6b6b7a]">Copy from<select value={sourceFormat} onChange={(event) => setSourceFormat(event.target.value as CanvasFormatId)} className="mt-2 w-full rounded border border-[rgba(255,255,255,0.1)] bg-[#0f0f13] px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-[#e8e8f0] focus:outline-none">{sourceCandidates.map((format) => { const count = selectForkSourceGroups(store.project, format, targetFormatId).length; const label = format === BASE_CANVAS_FORMAT ? 'Unscoped screens' : getFormatLabel(format, store.project.settings.customFormats); return <option key={format} value={format}>{label} ({count} screen{count === 1 ? '' : 's'})</option> })}</select></label>}
    <div className="mt-5"><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#6b6b7a]">Starting point</p><SegmentedControl value={choice} onChange={setChoice} options={[{ value: 'copy', label: <><span className="block font-medium">Copy and scale</span><span className="mt-0.5 block text-[10px] opacity-70">Bring over each layout, sized to fit.</span></> }, { value: 'blank', label: <><span className="block font-medium">Start blank</span><span className="mt-0.5 block text-[10px] opacity-70">Start each canvas with its background.</span></> }]} className="grid grid-cols-2 gap-2" optionClassName="min-h-20 rounded-lg border px-3 py-2 text-left text-[11px]" activeClassName="border-[#7c6ef6] bg-[rgba(124,110,246,0.16)] text-white" inactiveClassName="border-[rgba(255,255,255,0.1)] text-[#a6a7b8] hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.04)]" /></div>
  </ModalShell>
}
