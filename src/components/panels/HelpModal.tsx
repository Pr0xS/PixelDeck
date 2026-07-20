import { useMemo, useRef, useState } from 'react'
import { ModalShell } from '@/components/ui/ModalShell'
import { HELP_SECTIONS, type HelpSectionId } from '@/components/panels/help/HelpContent'

interface HelpModalProps {
  open: boolean
  onClose: () => void
}

const GROUP_LABELS = ['GETTING STARTED', 'DESIGN', 'ADAPT', 'DELIVER'] as const

export function HelpModal({ open, onClose }: HelpModalProps) {
  const [activeId, setActiveId] = useState<HelpSectionId>('introduction')
  const [query, setQuery] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)

  const activeIndex = HELP_SECTIONS.findIndex((section) => section.id === activeId)
  const activeSection = HELP_SECTIONS[activeIndex] ?? HELP_SECTIONS[0]
  const filteredSections = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return HELP_SECTIONS
    return HELP_SECTIONS.filter((section) => section.title.toLowerCase().includes(normalized))
  }, [query])

  const selectSection = (id: HelpSectionId) => {
    setActiveId(id)
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="PixelDeck user guide"
      closeLabel="Close help"
      maxWidth="max-w-[1120px]"
      backdropClassName="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5"
      backdropStyle={{ background: 'rgba(4,4,7,0.72)', backdropFilter: 'blur(6px)' }}
      panelClassName="relative w-full h-[92vh] sm:h-[88vh] flex flex-col overflow-hidden rounded-2xl border shadow-2xl"
      panelStyle={{
        background: '#18181f',
        borderColor: 'rgba(255,255,255,0.09)',
        boxShadow: '0 32px 100px rgba(0,0,0,0.65), 0 0 0 1px rgba(124,110,246,0.04)',
      }}
      closeButtonClassName="absolute top-4 right-4 z-10 text-[#6b6b7a] hover:text-[#e8e8f0] transition-all text-base w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[rgba(255,255,255,0.07)]"
      header={(
        <header className="relative shrink-0 overflow-hidden border-b border-[rgba(255,255,255,0.07)] px-5 py-4 sm:px-6">
          <div className="pointer-events-none absolute -top-16 left-12 h-32 w-64 rounded-full bg-[#7c6ef6] opacity-[0.08] blur-3xl" />
          <div className="relative flex items-center gap-3 pr-10">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[rgba(155,143,255,0.28)] bg-[rgba(124,110,246,0.12)] text-[#b8afff] shadow-[0_8px_24px_rgba(124,110,246,0.12)]">
              <span aria-hidden="true" className="text-base">?</span>
            </div>
            <div>
              <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[#f0eff8]">
                PixelDeck user guide
              </h2>
              <p className="mt-0.5 text-[11px] text-[#6b6b7a]">
                Everything you need to design, adapt, and export screenshot sets.
              </p>
            </div>
            <span className="ml-auto hidden rounded-full border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.025)] px-2.5 py-1 text-[10px] font-medium tracking-wide text-[#6b6b7a] sm:block">
              14 SECTIONS
            </span>
          </div>
        </header>
      )}
    >
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[230px] shrink-0 flex-col border-r border-[rgba(255,255,255,0.06)] bg-[#131318] md:flex">
          <div className="border-b border-[rgba(255,255,255,0.055)] p-3">
            <label className="relative block">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-[#525260]">⌕</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a section…"
                aria-label="Find a help section"
                className="h-9 w-full rounded-lg border border-[rgba(255,255,255,0.075)] bg-[#0f0f13] pl-8 pr-3 text-[11px] text-[#d8d8e2] outline-none transition placeholder:text-[#4a4a57] focus:border-[rgba(124,110,246,0.52)] focus:ring-2 focus:ring-[rgba(124,110,246,0.08)]"
              />
            </label>
          </div>

          <nav aria-label="Help sections" className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {GROUP_LABELS.map((group) => {
              const sections = filteredSections.filter((section) => section.group === group)
              if (sections.length === 0) return null
              return (
                <div key={group} className="mb-4 last:mb-0">
                  <p className="mb-1.5 px-2 text-[9px] font-semibold tracking-[0.18em] text-[#4e4e5b]">
                    {group}
                  </p>
                  <div className="space-y-0.5">
                    {sections.map((section) => {
                      const isActive = section.id === activeId
                      return (
                        <button
                          key={section.id}
                          type="button"
                          onClick={() => selectSection(section.id)}
                          aria-current={isActive ? 'page' : undefined}
                          className={`group relative flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[11px] transition-all ${
                            isActive
                              ? 'bg-[rgba(124,110,246,0.14)] text-[#d4ceff]'
                              : 'text-[#777786] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#d1d1dc]'
                          }`}
                        >
                          {isActive && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[#8f82ff]" />}
                          <span className={`w-5 shrink-0 text-right font-mono text-[9px] ${isActive ? 'text-[#8f82ff]' : 'text-[#444451] group-hover:text-[#666675]'}`}>
                            {String(section.number).padStart(2, '0')}
                          </span>
                          <span className="truncate">{section.title}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {filteredSections.length === 0 && (
              <div className="px-2 py-8 text-center text-[11px] leading-relaxed text-[#555562]">
                No section titles match<br />“{query}”
              </div>
            )}
          </nav>
          <div className="border-t border-[rgba(255,255,255,0.055)] px-5 py-3 text-[10px] text-[#454552]">
            Select a section to jump directly to it.
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col bg-[#18181f]">
          <div className="shrink-0 border-b border-[rgba(255,255,255,0.06)] bg-[#15151b] px-4 py-2.5 md:hidden">
            <label className="flex items-center gap-3">
              <span className="text-[10px] font-semibold tracking-[0.12em] text-[#575765]">SECTION</span>
              <select
                value={activeId}
                onChange={(event) => selectSection(event.target.value as HelpSectionId)}
                className="min-w-0 flex-1 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0f0f13] px-3 py-2 text-[11px] text-[#d8d8e2] outline-none focus:border-[rgba(124,110,246,0.5)]"
                aria-label="Choose help section"
              >
                {HELP_SECTIONS.map((section) => (
                  <option key={section.id} value={section.id}>
                    {String(section.number).padStart(2, '0')} · {section.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto scroll-smooth">
            <article className="mx-auto max-w-[760px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-10">
              <div className="mb-7 flex items-start gap-4 border-b border-[rgba(255,255,255,0.065)] pb-6">
                <span className="mt-0.5 font-mono text-[11px] font-medium tracking-[0.12em] text-[#8f82ff]">
                  {String(activeSection.number).padStart(2, '0')}
                </span>
                <div>
                  <p className="mb-2 text-[9px] font-semibold tracking-[0.18em] text-[#565664]">
                    {activeSection.group}
                  </p>
                  <h3 className="text-[22px] font-semibold leading-tight tracking-[-0.025em] text-[#f0eff8] sm:text-2xl">
                    {activeSection.title}
                  </h3>
                </div>
              </div>

              <div key={activeSection.id} className="animate-[pixeldeck-loader-enter_240ms_cubic-bezier(0.22,1,0.36,1)_both]">
                {activeSection.content}
              </div>

              <div className="mt-10 flex items-center justify-between gap-3 border-t border-[rgba(255,255,255,0.06)] pt-5">
                <button
                  type="button"
                  disabled={activeIndex === 0}
                  onClick={() => selectSection(HELP_SECTIONS[activeIndex - 1].id)}
                  className="rounded-lg border border-[rgba(255,255,255,0.08)] px-3 py-2 text-[11px] text-[#858594] transition hover:border-[rgba(255,255,255,0.15)] hover:text-[#e0e0e9] disabled:pointer-events-none disabled:opacity-0"
                >
                  ← Previous
                </button>
                <span className="font-mono text-[9px] text-[#484855]">{activeIndex + 1} / {HELP_SECTIONS.length}</span>
                <button
                  type="button"
                  disabled={activeIndex === HELP_SECTIONS.length - 1}
                  onClick={() => selectSection(HELP_SECTIONS[activeIndex + 1].id)}
                  className="rounded-lg border border-[rgba(124,110,246,0.22)] bg-[rgba(124,110,246,0.07)] px-3 py-2 text-[11px] text-[#aaa1f5] transition hover:border-[rgba(124,110,246,0.42)] hover:bg-[rgba(124,110,246,0.12)] disabled:pointer-events-none disabled:opacity-0"
                >
                  Next →
                </button>
              </div>
            </article>
          </div>
        </main>
      </div>
    </ModalShell>
  )
}
