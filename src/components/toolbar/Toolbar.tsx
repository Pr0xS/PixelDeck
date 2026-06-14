import { useState, useRef, useEffect, lazy, Suspense } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore, useUndoRedo } from '@/store'
import { useProjectsStore } from '@/store/projects'
import { BrandKitButton } from '@/components/toolbar/BrandKitButton'
import { Logo } from '@/components/toolbar/Logo'

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

  // Projects store — for save indicator + rename
  const { projects, renameProject } = useProjectsStore(
    useShallow((s) => ({
      projects: s.projects,
      renameProject: s.renameProject,
    })),
  )
  const activeProjectMeta = projects.find((p) => p.id === project.id)

  // Inline project name editing
  const [editingName, setEditingName] = useState(false)
  const [tempName, setTempName] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  function startEditingName() {
    setTempName(project.name)
    setEditingName(true)
  }

  function commitName() {
    const trimmed = tempName.trim()
    if (trimmed && trimmed !== project.name) {
      renameProject(project.id, trimmed)
    }
    setEditingName(false)
  }

  function cancelName() {
    setEditingName(false)
  }

  useEffect(() => {
    if (editingName) nameInputRef.current?.select()
  }, [editingName])
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
      <Logo />

      {/* Current project name — click to rename inline */}
      {editingName ? (
        <input
          ref={nameInputRef}
          value={tempName}
          onChange={(e) => setTempName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitName()
            if (e.key === 'Escape') cancelName()
          }}
          style={{
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(124,110,246,0.6)',
            borderRadius: 5,
            color: '#e8e8f0',
            fontSize: 12,
            padding: '3px 8px',
            width: 160,
            outline: 'none',
            flexShrink: 0,
          }}
        />
      ) : (
        <button
          onClick={startEditingName}
          title="Click to rename project"
          style={{
            background: 'none',
            border: 'none',
            color: '#a0a0b0',
            cursor: 'text',
            fontSize: 12,
            padding: '3px 6px',
            borderRadius: 5,
            maxWidth: 180,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.color = '#e8e8f0'
            ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.color = '#a0a0b0'
            ;(e.currentTarget as HTMLButtonElement).style.background = 'none'
          }}
        >
          {project.name}
        </button>
      )}

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
          className="flex items-center gap-1.5 text-xs text-[#a0a0b0] px-3 py-1.5 rounded border border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.05)] hover:text-[#e8e8f0] transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Help
        </button>

        {/* GitHub link */}
        <a
          href="https://github.com/Pr0xS/PixelDeck"
          target="_blank"
          rel="noopener noreferrer"
          title="View on GitHub"
          className="flex items-center gap-1.5 text-xs text-[#a0a0b0] px-3 py-1.5 rounded border border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.05)] hover:text-[#e8e8f0] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
          </svg>
          GitHub
        </a>
      </div>
    </header>
  )
}
