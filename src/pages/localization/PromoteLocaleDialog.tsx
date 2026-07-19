import { ModalShell } from '@/components/ui/ModalShell'
import { getLanguageName } from '@/utils/locale'

interface PromoteLocaleDialogProps {
  open: boolean
  locale: string | null
  currentDefaultLocale: string
  complete: number
  total: number
  incompleteLabels: string[]
  remainingCount: number
  onCancel: () => void
  onConfirm: () => void
}

export function PromoteLocaleDialog({
  open,
  locale,
  currentDefaultLocale,
  complete,
  total,
  incompleteLabels,
  remainingCount,
  onCancel,
  onConfirm,
}: PromoteLocaleDialogProps) {
  const targetName = locale ? getLanguageName(locale) : ''
  const currentDefaultName = getLanguageName(currentDefaultLocale)
  const ratio = total === 0 ? 1 : complete / total
  const isComplete = complete >= total

  return (
    <ModalShell
      open={open}
      onClose={onCancel}
      title="Promote language to default"
      maxWidth="max-w-2xl"
      bodyClassName="px-6 py-5"
      footerClassName="flex items-center justify-end gap-3 border-t border-white/8 bg-[#14141b] px-6 py-4"
      footer={(
        <>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-white/10 bg-white/4 px-4 py-2 text-sm font-medium text-[#c9c9d5] transition hover:border-white/20 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full border border-[#7c6ef6]/45 bg-[#7c6ef6]/16 px-4 py-2 text-sm font-medium text-[#f3f1ff] transition hover:border-[#7c6ef6]/70 hover:bg-[#7c6ef6]/24"
          >
            Promote to default
          </button>
        </>
      )}
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <div className="inline-flex items-center rounded-full border border-[#7c6ef6]/25 bg-[#7c6ef6]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c4b5fd]">
            {targetName} · {locale}
          </div>
          <p className="text-sm leading-relaxed text-[#d6d6e2]">
            This will make <span className="font-semibold text-white">{targetName}</span> the new source language for the project.
          </p>
        </div>

        <div className="rounded-2xl border border-white/8 bg-[#13131a] p-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b6b7a]">Translation coverage</div>
              <div className="mt-1 text-2xl font-semibold text-white">{complete}/{total}</div>
            </div>
            <div className="text-right text-xs text-[#8d8ea0]">
              {isComplete ? 'Everything is translated.' : `${total - complete} layers still need review.`}
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/6">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${ratio === 0 ? 0 : Math.max(6, Math.round(ratio * 100))}%`,
                background: isComplete ? '#7c6ef6' : '#f59e0b',
              }}
            />
          </div>
        </div>

        {!isComplete && (
          <div className="rounded-2xl border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.08)] p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-sm text-[#f59e0b]">⚠</div>
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-semibold text-[#fde68a]">Some layers are still incomplete</div>
                  <p className="mt-1 text-sm leading-relaxed text-[#e7dbc0]">
                    Missing translations will keep their current <span className="font-medium text-white">{currentDefaultName}</span> content under the new default label. Review these layers before confirming if you want to avoid a mixed-language source.
                  </p>
                </div>

                <div className="rounded-xl border border-white/8 bg-[#111118] px-3 py-3">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8d8ea0]">Affected layers</div>
                  <ul className="space-y-2 text-sm text-[#d9d9e6]">
                    {incompleteLabels.map((label) => (
                      <li key={label} className="flex gap-2">
                        <span className="text-[#f59e0b]">•</span>
                        <span>{label}</span>
                      </li>
                    ))}
                  </ul>
                  {remainingCount > 0 && (
                    <div className="mt-3 text-xs text-[#8d8ea0]">+{remainingCount} more</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  )
}
