import type { RefObject } from 'react'

export interface BulkTranslateBarProps {
  nonDefaultLocales: string[]
  bulkEligibleCount: number
  hasApiKey: boolean
  isBulkRunning: boolean
  overwriteExisting: boolean
  setOverwriteExisting: (value: boolean) => void
  onBulkTranslate: () => void
  bulkCancelRef: RefObject<boolean>
  onOpenAiSettings: () => void
}

export function BulkTranslateBar({
  nonDefaultLocales,
  bulkEligibleCount,
  hasApiKey,
  isBulkRunning,
  overwriteExisting,
  setOverwriteExisting,
  onBulkTranslate,
  bulkCancelRef,
  onOpenAiSettings,
}: BulkTranslateBarProps) {
  if (nonDefaultLocales.length === 0) return null

  return (
    <section className="border-b border-white/6 bg-[#111118]/70 px-8 py-3 backdrop-blur-xl shrink-0">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#6b6b7a]">Bulk AI translate:</span>
          <span className="text-xs text-[#9d90f8]">{bulkEligibleCount} cells</span>
        </div>

        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={overwriteExisting}
            onChange={(e) => setOverwriteExisting(e.target.checked)}
            className="accent-[#7c6ef6] w-3 h-3"
          />
          <span className="text-xs text-[#8f90a3]">Overwrite existing</span>
        </label>

        <button
          type="button"
          onClick={onBulkTranslate}
          disabled={!hasApiKey || isBulkRunning || bulkEligibleCount === 0}
          className={`rounded-lg border px-4 py-1.5 text-xs font-medium transition ${
            !hasApiKey
              ? 'border-white/8 text-[#4a4a5a] cursor-not-allowed'
              : isBulkRunning
                ? 'border-[rgba(124,110,246,0.3)] text-[#9d90f8] cursor-wait'
                : bulkEligibleCount === 0
                  ? 'border-white/8 text-[#4a4a5a] cursor-not-allowed'
                  : 'border-[rgba(124,110,246,0.5)] bg-[rgba(124,110,246,0.12)] text-[#c5befd] hover:bg-[rgba(124,110,246,0.22)] hover:text-white'
          }`}
          title={!hasApiKey ? 'Configure an AI API key in AI Settings' : undefined}
        >
          {isBulkRunning ? '⟳ Translating…' : `✦ Translate all (${nonDefaultLocales.length} lang${nonDefaultLocales.length > 1 ? 's' : ''})`}
        </button>

        {!hasApiKey && (
          <button
            type="button"
            onClick={onOpenAiSettings}
            className="text-xs text-[#f59e0b] hover:text-white underline underline-offset-2 transition"
          >
            No API key — open AI Settings
          </button>
        )}

        {isBulkRunning && (
          <button
            type="button"
            onClick={() => { bulkCancelRef.current = true }}
            className="text-xs text-[#f87171] hover:text-white transition"
          >
            Stop
          </button>
        )}
      </div>
    </section>
  )
}
