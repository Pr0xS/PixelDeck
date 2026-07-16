import { useEffect, useState } from 'react'
import { useEditorStore } from '@/store'
import { AiProviderSettings } from '@/components/ai/AiProviderSettings'
import { BrandColorList } from '@/components/common/BrandColorList'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

// ─── Shared style tokens ────────────────────────────────────────────────────

const labelCls = 'text-[11px] text-[#6b6b7a] mb-1 block uppercase tracking-[0.08em]'

// ─── Tab definitions ─────────────────────────────────────────────────────────

type Tab = 'ai' | 'brand' | 'pano'

interface TabMeta {
  id: Tab
  label: string
  icon: string
  section: 'GLOBAL' | 'PROJECT'
}

const TABS: TabMeta[] = [
  { id: 'ai', label: 'AI', icon: '🤖', section: 'GLOBAL' },
  { id: 'brand', label: 'Brand', icon: '🎨', section: 'PROJECT' },
  { id: 'pano', label: 'Pano', icon: '🖼', section: 'PROJECT' },
]

// ─── Brand tab content ────────────────────────────────────────────────────────

function BrandSettingsContent() {
  const brandColors = useEditorStore((s) => s.project.settings.brandColors) ?? []

  return (
    <div>
      <h3 className="text-sm font-semibold text-[#e8e8f0] mb-1">Brand Colors</h3>
      <p className="text-[12px] text-[#6b6b7a] mb-5 leading-relaxed">
        Reusable colors for this project. Apply them in any color field — edit one here and every
        layer updates automatically.
      </p>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] text-[#4a4a5a] uppercase tracking-[0.1em]">
          {brandColors.length} {brandColors.length === 1 ? 'color' : 'colors'}
        </span>
      </div>
      <BrandColorList />
    </div>
  )
}

// ─── Pano tab content ─────────────────────────────────────────────────────────

function PanoSettingsContent() {
  const panoSettings = useEditorStore(
    (s) => s.project.settings.pano ?? { gapPx: 24, compensate: false },
  )
  const updatePanoSettings = useEditorStore((s) => s.updatePanoSettings)

  return (
    <div>
      <h3 className="text-sm font-semibold text-[#e8e8f0] mb-1">Panorama Settings</h3>
      <p className="text-[12px] text-[#6b6b7a] mb-5 leading-relaxed">
        Configure how multi-slide panoramic groups are displayed and exported.
      </p>

      <div className="space-y-5">
        {/* Gap input */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.08)] p-4 bg-[rgba(255,255,255,0.02)]">
          <label className={labelCls}>Store Preview Gap</label>
          <p className="text-[11px] text-[#4a4a5a] mb-3 leading-relaxed">
            Gap used when compensation is enabled. Simulates the bezel gap shown in app stores.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              max={300}
              value={panoSettings.gapPx ?? 24}
              onChange={(e) =>
                updatePanoSettings({ gapPx: Math.max(0, Math.min(300, Number(e.target.value))) })
              }
              className="bg-[#0f0f13] border border-[rgba(255,255,255,0.1)] rounded px-3 py-2 text-sm text-[#e8e8f0] w-24 focus:outline-none focus:border-[rgba(124,110,246,0.5)]"
            />
            <span className="text-xs text-[#6b6b7a]">px</span>
            <input
              type="range"
              min={0}
              max={300}
              value={panoSettings.gapPx ?? 24}
              onChange={(e) => updatePanoSettings({ gapPx: Number(e.target.value) })}
              className="flex-1 accent-[#7c6ef6]"
            />
          </div>
        </div>

        {/* Compensate checkbox */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.08)] p-4 bg-[rgba(255,255,255,0.02)]">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="pano-compensate"
              checked={panoSettings.compensate ?? false}
              onChange={(e) => updatePanoSettings({ compensate: e.target.checked })}
              className="mt-0.5 accent-[#7c6ef6] w-4 h-4 shrink-0 cursor-pointer"
            />
            <div>
              <label
                htmlFor="pano-compensate"
                className="text-xs font-medium text-[#e8e8f0] cursor-pointer"
              >
                Compensate on Export
              </label>
              <p className="text-[11px] text-[#4a4a5a] mt-1 leading-relaxed">
                When enabled, the gap becomes visible in the canvas/preview and is skipped during export.
                When disabled, pano slides remain continuous with no gap compensation.
              </p>
            </div>
          </div>
        </div>

        {/* Status summary */}
        <div className="rounded-lg border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.01)] px-4 py-3">
          <p className="text-[11px] text-[#6b6b7a] leading-relaxed">
            <span className="text-[#c4b5fd]">Current:</span>{' '}
            {panoSettings.gapPx ?? 24}px gap{' '}
            {panoSettings.compensate
              ? '— compensation active, gap visible and skipped on export'
              : '— compensation inactive, continuous pano with no visual gap'}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [tab, setTab] = useState<Tab>('ai')

  // Escape key closes
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const sections = ['GLOBAL', 'PROJECT'] as const
  const tabsBySection = (section: (typeof sections)[number]) =>
    TABS.filter((t) => t.section === section)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={onClose}
    >
      <div
        className="relative rounded-2xl border shadow-2xl w-full max-w-5xl mx-4 h-[85vh] flex flex-col overflow-hidden"
        style={{ background: '#18181f', borderColor: 'rgba(255,255,255,0.1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-[#6b6b7a] hover:text-[#e8e8f0] transition-colors text-lg w-7 h-7 flex items-center justify-center rounded hover:bg-[rgba(255,255,255,0.06)]"
          aria-label="Close settings"
        >
          ✕
        </button>

        {/* Modal header */}
        <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)] shrink-0">
          <h2 className="text-base font-semibold text-[#e8e8f0]">Settings</h2>
        </div>

        {/* Body: sidebar + content */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <nav
            className="w-44 shrink-0 border-r border-[rgba(255,255,255,0.06)] p-3 overflow-y-auto"
            style={{ background: 'rgba(0,0,0,0.15)' }}
          >
            {sections.map((section) => (
              <div key={section}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#4a4a5a] mb-1 mt-3 first:mt-0 px-2">
                  {section}
                </p>
                {tabsBySection(section).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors flex items-center gap-2 ${
                      tab === t.id
                        ? 'bg-[rgba(124,110,246,0.18)] text-[#c4b5fd]'
                        : 'text-[#6b6b7a] hover:text-[#e8e8f0] hover:bg-[rgba(255,255,255,0.05)]'
                    }`}
                  >
                    <span>{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto p-6">
            {tab === 'ai' && (
              <div>
                <h3 className="text-sm font-semibold text-[#e8e8f0] mb-1">AI Settings</h3>
                <p className="text-[12px] text-[#6b6b7a] mb-5 leading-relaxed">
                  API keys are stored locally in this browser and sent only to the selected provider.
                  Consumer subscriptions like ChatGPT Plus or Claude Pro cannot be used as API access.
                </p>
                <AiProviderSettings />
              </div>
            )}
            {tab === 'brand' && <BrandSettingsContent />}
            {tab === 'pano' && <PanoSettingsContent />}
          </div>
        </div>

        {/* Footer — version info */}
        <div
          className="shrink-0 px-5 py-2.5 border-t border-[rgba(255,255,255,0.06)] flex items-center gap-3"
          style={{ background: 'rgba(0,0,0,0.15)' }}
        >
          <span className="text-[11px] text-[#4a4a5a] font-mono select-all">
            v{__APP_VERSION__}
          </span>
          <span className="text-[#2a2a3a]">·</span>
          <span className="text-[11px] text-[#4a4a5a] font-mono select-all" title="Git commit hash">
            {__GIT_HASH__}
          </span>
          <span className="flex-1" />
          <a
            href="https://github.com/Pr0xS/PixelDeck"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-[#4a4a5a] hover:text-[#7c6ef6] transition-colors"
          >
            github.com/Pr0xS/PixelDeck
          </a>
        </div>
      </div>
    </div>
  )
}
