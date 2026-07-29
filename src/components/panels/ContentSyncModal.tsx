import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ModalShell } from '@/components/ui/ModalShell'
import { useEditorStore } from '@/store'
import { planContentSync } from '@/utils/contentSync'
import { FORMAT_FAMILY_LABELS, selectProjectFamilies } from '@/utils/canvasFormats'
import { resolveContentSyncSourceGroup } from '@/store/slices/slideGroupSlice'

interface ContentSyncModalProps { open: boolean; onClose: () => void }

export function ContentSyncModal({ open, onClose }: ContentSyncModalProps) {
  const store = useEditorStore(useShallow((state) => ({
    project: state.project,
    activeFamily: state.activeFamily,
    activeSlideGroupId: state.activeSlideGroupId,
    pullContentFromFamily: state.pullContentFromFamily,
  })))
  const candidates = selectProjectFamilies(store.project).filter((family) => family !== store.activeFamily)
  const [sourceFamily, setSourceFamily] = useState<typeof candidates[number] | undefined>(candidates[0])
  const selectedFamily = sourceFamily && candidates.includes(sourceFamily) ? sourceFamily : candidates[0]
  const activeGroup = store.project.slideGroups.find((group) => group.id === store.activeSlideGroupId)
  const sourceGroup = selectedFamily
    ? resolveContentSyncSourceGroup(store.project, store.activeFamily, store.activeSlideGroupId, selectedFamily)
    : undefined
  const plan = sourceGroup && activeGroup ? planContentSync(sourceGroup.layers, activeGroup.layers) : undefined
  const updates = plan?.entries.filter((entry) => entry.status === 'updated') ?? []

  if (candidates.length === 0) {
    return <ModalShell open={open} onClose={onClose} title="Bring content from" maxWidth="max-w-md" bodyClassName="px-5 py-5" footerClassName="flex justify-end border-t border-[rgba(255,255,255,0.06)] px-5 py-4" footer={<button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-xs text-[#8f90a3] hover:bg-[rgba(255,255,255,0.06)] hover:text-white">Close</button>}>
      <p className="text-sm leading-6 text-[#b7b7c5]">No other layout families yet.</p>
    </ModalShell>
  }

  const handleConfirm = () => {
    if (!selectedFamily) return
    store.pullContentFromFamily(selectedFamily)
    onClose()
  }

  return <ModalShell open={open} onClose={onClose} title="Bring content from" maxWidth="max-w-md" bodyClassName="px-5 py-5" footerClassName="flex justify-end gap-2 border-t border-[rgba(255,255,255,0.06)] px-5 py-4" footer={<><button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-xs text-[#8f90a3] hover:bg-[rgba(255,255,255,0.06)] hover:text-white">Cancel</button><button type="button" onClick={handleConfirm} disabled={!plan || plan.updatedCount === 0} className="rounded-lg bg-[#7c6ef6] px-3 py-2 text-xs font-medium text-white hover:bg-[#6c5ed6] disabled:cursor-not-allowed disabled:opacity-50">Bring content</button></>}>
    {candidates.length === 1 && selectedFamily && <p className="text-sm leading-6 text-[#b7b7c5]">Bring content from <span className="font-medium text-[#f4f4f7]">{FORMAT_FAMILY_LABELS[selectedFamily]}</span></p>}
    {candidates.length > 1 && <label className="block text-[10px] font-semibold uppercase tracking-[0.15em] text-[#6b6b7a]">Bring content from<select value={selectedFamily} onChange={(event) => setSourceFamily(event.target.value as typeof candidates[number])} className="mt-2 w-full rounded border border-[rgba(255,255,255,0.1)] bg-[#0f0f13] px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-[#e8e8f0] focus:outline-none">{candidates.map((family) => <option key={family} value={family}>{FORMAT_FAMILY_LABELS[family]}</option>)}</select></label>}
    {sourceGroup && <p className="mt-4 text-sm leading-6 text-[#b7b7c5]">Pull from <span className="font-medium text-[#f4f4f7]">{FORMAT_FAMILY_LABELS[selectedFamily!]} → “{sourceGroup.name}”</span></p>}
    {!sourceGroup && <p className="mt-4 text-[11px] text-[#d7c08b]">This family does not have a matching screen at this position.</p>}
    {updates.length > 0 && <div className="mt-4 max-h-52 overflow-y-auto rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0f0f13]">{updates.map((entry) => <div key={entry.path.join('.')} className="flex items-center gap-2 border-b border-[rgba(255,255,255,0.06)] px-3 py-2 text-xs last:border-b-0"><span className="min-w-0 flex-1 truncate text-[#e8e8f0]">{entry.layerName}</span><span className="text-[#6b6b7a]">←</span><span className="min-w-0 flex-1 truncate text-right text-[#a6a7b8]">{entry.preview ?? entry.changedKeys.join(', ')}</span></div>)}</div>}
    {(plan?.skippedCount ?? 0) > 0 && <p className="mt-3 text-[11px] text-[#6b6b7a]">{plan!.skippedCount} layer{plan!.skippedCount === 1 ? '' : 's'} skipped — different type or structure</p>}
  </ModalShell>
}
