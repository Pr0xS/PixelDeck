import { useState, useRef, useEffect } from 'react'
import { useEditorStore, useUndoRedo } from '@/store'
import { useProjectsStore } from '@/store/projects'
import { downloadDataUrl } from '@/utils/export'
import { ProjectsModal } from '@/components/panels/ProjectsModal'
import { TemplatesModal } from '@/components/panels/TemplatesModal'

interface ToolbarProps {
  mode: 'editor' | 'localization'
  onSetMode: (mode: 'editor' | 'localization') => void
}

export function Toolbar({ mode, onSetMode }: ToolbarProps) {
  const {
    project,
    activeLocale,
    setActiveLocale,
    zoom,
    setZoom,
    exportProject,
    importProject,
    selectedLayerIds,
    createGroup,
  } = useEditorStore()

  const { undo, redo, canUndo, canRedo } = useUndoRedo()

  // Projects store — for save indicator
  const projects = useProjectsStore((s) => s.projects)
  const activeProjectMeta = projects.find((p) => p.id === project.id)
  const [projectsOpen, setProjectsOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)

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

  const locales = project.settings.locales ?? [project.settings.defaultLocale]
  const openJsonInputRef = useRef<HTMLInputElement>(null)

  const handleSave = () => {
    const json = exportProject()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    downloadDataUrl(url, 'project.json')
    URL.revokeObjectURL(url)
  }

  const handleOpenJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        importProject(reader.result as string)
      } catch {
        alert('Failed to open project file.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const inputCls = 'hidden'

  return (
    <header
      className="h-12 flex items-center px-3 gap-4 border-b"
      style={{
        background: '#18181f',
        borderColor: 'rgba(255,255,255,0.08)',
      }}
    >
      {/* Projects modal */}
      <ProjectsModal open={projectsOpen} onClose={() => setProjectsOpen(false)} />
      <TemplatesModal open={templatesOpen} onClose={() => setTemplatesOpen(false)} />

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
        Project Library
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

      {/* Zoom controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setZoom(zoom - 0.1)}
          title="Zoom out (canvas Fit button centers)"
          className="w-7 h-7 flex items-center justify-center text-[#e8e8f0] text-sm rounded hover:bg-[rgba(255,255,255,0.06)]"
        >
          −
        </button>
        <span className="text-xs text-[#e8e8f0] w-12 text-center tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom(zoom + 0.1)}
          title="Zoom in (canvas Fit button centers)"
          className="w-7 h-7 flex items-center justify-center text-[#e8e8f0] text-sm rounded hover:bg-[rgba(255,255,255,0.06)]"
        >
          ＋
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

      {/* Locale switcher */}
      {locales.length > 1 && (
        <div className="flex items-center gap-0.5 border border-[rgba(255,255,255,0.1)] rounded px-1">
          {locales.map((locale) => (
            <button
              key={locale}
              onClick={() => setActiveLocale(locale)}
              style={{
                background: activeLocale === locale ? 'rgba(124,110,246,0.3)' : 'transparent',
                border: 'none',
                borderRadius: 4,
                color: activeLocale === locale ? '#7c6ef6' : '#6b6b7a',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: activeLocale === locale ? 700 : 400,
                padding: '2px 7px',
                textTransform: 'uppercase',
              }}
            >
              {locale}
              {locale === project.settings.defaultLocale && (
                <span style={{ fontSize: 9, marginLeft: 2, opacity: 0.6 }}>⬩</span>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1" />

      {/* Right section */}
      <div className="flex items-center gap-2">
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
          onClick={handleSave}
          title="Download the project template as JSON"
          className="text-xs text-[#e8e8f0] px-3 py-1.5 rounded border border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.05)] transition-colors"
        >
          Export Project
        </button>

        <button
          onClick={() => openJsonInputRef.current?.click()}
          title="Import a project JSON template"
          className="text-xs text-[#e8e8f0] px-3 py-1.5 rounded border border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.05)] transition-colors"
        >
          Import Project
        </button>
        <input
          ref={openJsonInputRef}
          type="file"
          accept=".json"
          className={inputCls}
          onChange={handleOpenJson}
        />
      </div>
    </header>
  )
}
