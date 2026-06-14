import { useState, useRef, useEffect, lazy, Suspense } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore, useUndoRedo } from '@/store'
import { useProjectsStore } from '@/store/projects'
import { BrandKitButton } from '@/components/toolbar/BrandKitButton'

// Lazy-load heavy modals — only fetched when the user opens them for the first time.
const ProjectsModal = lazy(() =>
  import('@/components/panels/ProjectsModal').then((m) => ({ default: m.ProjectsModal })),
)
const TemplatesModal = lazy(() =>
  import('@/components/panels/TemplatesModal').then((m) => ({ default: m.TemplatesModal })),
)
const SettingsModal = lazy(() =>
  import('@/components/panels/SettingsModal').then((m) => ({ default: m.SettingsModal })),
)
const HelpModal = lazy(() =>
  import('@/components/panels/HelpModal').then((m) => ({ default: m.HelpModal })),
)

interface ToolbarProps {
  mode: 'editor' | 'localization'
  onSetMode: (mode: 'editor' | 'localization') => void
}

export function Toolbar({ mode, onSetMode }: ToolbarProps) {
  const {
    project,
    selectedLayerIds,
    createGroup,
  } = useEditorStore(useShallow((s) => ({
    project: s.project,
    selectedLayerIds: s.selectedLayerIds,
    createGroup: s.createGroup,
  })))

  const { undo, redo, canUndo, canRedo } = useUndoRedo()

  // Projects store — for save indicator
  const projects = useProjectsStore((s) => s.projects)
  const activeProjectMeta = projects.find((p) => p.id === project.id)
  const [projectsOpen, setProjectsOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  // Saved indicator — flashes "Saving…" then "Saved" briefly
  const [saveLabel, setSaveLabel] = useState<'saved' | 'saving' | null>(null)
  const saveLabelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Show "Saved" for 2s whenever the meta updatedAt changes
    if (!activeProjectMeta) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaveLabel('saved')
    if (saveLabelTimer.current) clearTimeout(saveLabelTimer.current)
    saveLabelTimer.current = setTimeout(() => setSaveLabel(null), 2000)
    return () => {
      if (saveLabelTimer.current) clearTimeout(saveLabelTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectMeta?.updatedAt])

  return (
    <header
      className="h-12 flex items-center px-3 gap-4 border-b"
      style={{
        background: '#18181f',
        borderColor: 'rgba(255,255,255,0.08)',
      }}
    >
      {/* Projects / Templates / API modals — lazy loaded on first open */}
      <Suspense>
        <ProjectsModal open={projectsOpen} onClose={() => setProjectsOpen(false)} />
        <TemplatesModal open={templatesOpen} onClose={() => setTemplatesOpen(false)} />
        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      </Suspense>

      {/* Logo */}
      <div className="text-sm font-semibold text-[#e8e8f0] whitespace-nowrap select-none">
        🎴 PixelDeck
      </div>

      {/* Projects button */}
      <button
        onClick={() => setProjectsOpen(true)}
        title="Manage projects"
        style={{
          background: 'none',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 6,
          color: '#a0a0b0',
          cursor: 'pointer',
          fontSize: 12,
          padding: '3px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.25)'
          ;(e.currentTarget as HTMLButtonElement).style.color = '#e8e8f0'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.1)'
          ;(e.currentTarget as HTMLButtonElement).style.color = '#a0a0b0'
        }}
      >
        Projects
      </button>

      {/* Templates button */}
      <button
        onClick={() => setTemplatesOpen(true)}
        title="Browse and manage templates"
        style={{
          background: 'none',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 6,
          color: '#a0a0b0',
          cursor: 'pointer',
          fontSize: 12,
          padding: '3px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.25)'
          ;(e.currentTarget as HTMLButtonElement).style.color = '#e8e8f0'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.1)'
          ;(e.currentTarget as HTMLButtonElement).style.color = '#a0a0b0'
        }}
      >
        🗂 Templates
      </button>

      <BrandKitButton />

      {/* Save indicator */}
      {saveLabel && (
        <span style={{ fontSize: 11, color: '#6ee7b7', opacity: 0.8 }}>
          {saveLabel === 'saving' ? '⏳ Saving…' : '✓ Saved'}
        </span>
      )}

      <div className="w-px h-6 bg-[rgba(255,255,255,0.1)]" />

      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => undo()}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="w-7 h-7 flex items-center justify-center text-sm rounded hover:bg-[rgba(255,255,255,0.06)] disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ color: canUndo ? '#e8e8f0' : '#3a3a4a' }}
        >
          ↩
        </button>
        <button
          onClick={() => redo()}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          className="w-7 h-7 flex items-center justify-center text-sm rounded hover:bg-[rgba(255,255,255,0.06)] disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ color: canRedo ? '#e8e8f0' : '#3a3a4a' }}
        >
          ↪
        </button>
      </div>

      <div className="w-px h-6 bg-[rgba(255,255,255,0.1)]" />

      {/* Group actions */}
      <div className="flex items-center gap-1.5">
        {selectedLayerIds.length >= 2 && (
          <button
            onClick={() => createGroup(selectedLayerIds)}
            title="Group selected layers"
            className="text-xs text-[#e8e8f0] px-2.5 py-1 rounded border border-[rgba(124,110,246,0.5)] bg-[rgba(124,110,246,0.15)] hover:bg-[rgba(124,110,246,0.25)] transition-colors"
          >
            ⊞ Group ({selectedLayerIds.length})
          </button>
        )}
      </div>

      <div className="flex-1" />

      {/* Right section */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setSettingsOpen(true)}
          title="Open settings"
          className="text-xs text-[#e8e8f0] px-3 py-1.5 rounded border border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.05)] transition-colors"
        >
          ⚙ Settings
        </button>

        <button
          onClick={() => onSetMode(mode === 'localization' ? 'editor' : 'localization')}
          title="Manage translations inside the editor flow"
          className={`text-xs px-3 py-1.5 rounded border transition-colors ${
            mode === 'localization'
              ? 'text-white bg-[rgba(124,110,246,0.22)] border-[rgba(124,110,246,0.45)]'
              : 'text-[#e8e8f0] border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.05)]'
          }`}
        >
          {mode === 'localization' ? 'Back to Design' : 'Localization'}
        </button>

        <button
          onClick={() => setHelpOpen(true)}
          title="Help & keyboard shortcuts"
          className="text-xs text-[#e8e8f0] px-3 py-1.5 rounded border border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.05)] transition-colors"
        >
          ? Help
        </button>
      </div>
    </header>
  )
}
