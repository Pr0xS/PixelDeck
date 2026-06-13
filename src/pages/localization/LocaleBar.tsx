import type { RefObject } from 'react'
import { getLanguageName } from '@/utils/locale'
import { LanguagePopover } from './LanguagePopover'

export interface LocaleBarProps {
  locales: string[]
  defaultLocale: string
  activeLocale: string
  progressByLocale: Map<string, { complete: number; total: number }>
  showDefaultLocalePicker: boolean
  showAddLocale: boolean
  defaultLocaleAnchorRef: RefObject<HTMLDivElement | null>
  addLocaleAnchorRef: RefObject<HTMLDivElement | null>
  onPreview?: (locale: string) => void
  onBack: () => void
  setActiveLocale: (locale: string) => void
  setShowDefaultLocalePicker: (open: boolean | ((prev: boolean) => boolean)) => void
  setShowAddLocale: (open: boolean | ((prev: boolean) => boolean)) => void
  handleRemoveLocale: (locale: string) => void
  handleDefaultLocaleChange: (locale: string) => void
  addLocale: (code: string) => void
  setAddLocaleOpen: (open: boolean) => void
}

export function LocaleBar({
  locales,
  defaultLocale,
  activeLocale,
  progressByLocale,
  showDefaultLocalePicker,
  showAddLocale,
  defaultLocaleAnchorRef,
  addLocaleAnchorRef,
  onPreview,
  onBack,
  setActiveLocale,
  setShowDefaultLocalePicker,
  setShowAddLocale,
  handleRemoveLocale,
  handleDefaultLocaleChange,
  addLocale,
  setAddLocaleOpen,
}: LocaleBarProps) {
  return (
    <section className="border-b border-white/8 bg-[#18181f]/86 px-8 py-4 backdrop-blur-xl shrink-0">
      <div className="flex flex-wrap items-start gap-3">
        <div className="pt-2 text-xs font-medium uppercase tracking-[0.22em] text-[#6b6b7a] shrink-0">Languages</div>
        <div className="flex flex-1 flex-wrap gap-2 items-center">
          {locales.map((locale) => {
            const progress = progressByLocale.get(locale) ?? { complete: 0, total: 0 }
            const ratio = progress.total === 0 ? 1 : progress.complete / progress.total
            const selected = locale === activeLocale
            const isDefault = locale === defaultLocale
            return (
              <div key={locale} ref={isDefault ? defaultLocaleAnchorRef : undefined} className="relative group">
                <button
                  type="button"
                  onClick={() => setActiveLocale(locale)}
                  className="rounded-full border px-4 py-2 text-sm transition"
                  style={{
                    borderColor: selected ? 'rgba(124,110,246,0.7)' : 'rgba(255,255,255,0.08)',
                    background: selected ? 'rgba(124,110,246,0.14)' : 'rgba(255,255,255,0.03)',
                    color: selected ? '#f3f1ff' : '#c6c6d2',
                  }}
                >
                  <span className="font-semibold">{getLanguageName(locale)}</span>
                  <span className="ml-1.5 text-xs font-mono opacity-60">{locale}</span>
                  {isDefault ? (
                    <span className="ml-2 text-xs text-[#9f98dc]">default</span>
                  ) : (
                    <span className="ml-2 text-xs" style={{ color: ratio >= 0.5 ? '#7c6ef6' : '#f59e0b' }}>
                      {progress.complete}/{progress.total}
                    </span>
                  )}
                </button>
                {isDefault ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddLocale(false)
                        setShowDefaultLocalePicker((open) => !open)
                      }}
                      className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[#1a1a24] border border-white/10 text-[9px] text-[#6b6b7a] hover:text-[#c4b5fd] hover:border-[rgba(124,110,246,0.45)] opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
                      title="Change base language label"
                    >
                      ✎
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRemoveLocale(locale)}
                    className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[#1a1a24] border border-white/10 text-[9px] text-[#6b6b7a] hover:text-[#f87171] hover:border-[rgba(239,68,68,0.4)] opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
                    title={`Remove ${getLanguageName(locale)}`}
                  >
                    ×
                  </button>
                )}
              </div>
            )
          })}

          {/* Add locale */}
          <div ref={addLocaleAnchorRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setShowDefaultLocalePicker(false)
                setShowAddLocale((open) => !open)
              }}
              className="rounded-full border border-dashed border-white/12 bg-white/2 px-4 py-2 text-sm font-medium text-[#b7b7c7] transition hover:border-[#7c6ef6]/50 hover:bg-[#7c6ef6]/10 hover:text-white"
            >
              + Add language
            </button>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {/* Preview the selected language (opens the shared preview modal) */}
            {onPreview && (
              <button
                type="button"
                onClick={() => onPreview(activeLocale)}
                title={`Preview slides in ${getLanguageName(activeLocale)}`}
                className="rounded-full border border-[#7c6ef6]/40 bg-[#7c6ef6]/10 px-4 py-2 text-sm font-medium text-[#cbbfff] transition hover:border-[#7c6ef6]/70 hover:bg-[#7c6ef6]/20 hover:text-white"
              >
                ▶ Preview
              </button>
            )}
            <button
              type="button"
              onClick={onBack}
              className="rounded-full border border-white/10 bg-white/4 px-5 py-2 text-sm font-medium text-[#d7d7e3] transition hover:border-[#7c6ef6]/50 hover:bg-[#7c6ef6]/10 hover:text-white"
            >
              ← Back to Editor
            </button>
          </div>
        </div>
      </div>

      <LanguagePopover
        open={showDefaultLocalePicker}
        anchorRef={defaultLocaleAnchorRef}
        existingLocales={locales.filter((l) => l !== defaultLocale)}
        note="This only changes the language label for the source content. Existing translated languages cannot be promoted to default."
        onAdd={handleDefaultLocaleChange}
        onCancel={() => setShowDefaultLocalePicker(false)}
      />

      <LanguagePopover
        open={showAddLocale}
        anchorRef={addLocaleAnchorRef}
        existingLocales={locales}
        onAdd={(code) => {
          addLocale(code)
          setActiveLocale(code)
          setAddLocaleOpen(false)
        }}
        onCancel={() => setAddLocaleOpen(false)}
      />
    </section>
  )
}
