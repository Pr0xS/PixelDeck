import { useState, useEffect, useRef } from 'react'
import { useProjectsStore } from '@/store/projects'
import { useEditorStore } from '@/store'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

interface ProjectsModalProps {
  open: boolean
  onClose: () => void
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export function ProjectsModal({ open, onClose }: ProjectsModalProps) {
  const { projects, createProject, openProject, deleteProject, renameProject } =
    useProjectsStore()
  const activeProjectId = useEditorStore((s) => s.project.id)

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Focus rename input when it appears
  useEffect(() => {
    if (renamingId) renameInputRef.current?.select()
  }, [renamingId])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (deleteId) return
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, deleteId])

  if (!open) return null

  const startRename = (id: string, currentName: string) => {
    setRenamingId(id)
    setRenameValue(currentName)
  }

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      renameProject(renamingId, renameValue.trim())
    }
    setRenamingId(null)
  }

  const handleOpen = (id: string) => {
    if (id === activeProjectId) {
      onClose()
      return
    }
    openProject(id)
    onClose()
  }

  const handleNew = () => {
    createProject()
    onClose()
  }

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setDeleteId(id)
  }

  const confirmDelete = () => {
    if (!deleteId) return
    deleteProject(deleteId)
    if (deleteId === activeProjectId) onClose()
    setDeleteId(null)
  }

  // Sort: active first, then by most recently updated
  const sorted = [...projects].sort((a, b) => {
    if (a.id === activeProjectId) return -1
    if (b.id === activeProjectId) return 1
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  return (
    <>
      <ConfirmDialog
        open={deleteId !== null}
        title={`Delete project "${projects.find((p) => p.id === deleteId)?.name ?? 'this project'}"?`}
        message="This cannot be undone."
        confirmLabel="Delete Project"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 200,
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 480,
          maxHeight: '70vh',
          background: '#18181f',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 201,
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 20px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#e8e8f0' }}>
            Projects
          </h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={handleNew}
              style={{
                background: '#7c6ef6',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '5px 14px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + New Project
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#6b6b7a',
                cursor: 'pointer',
                fontSize: 18,
                lineHeight: 1,
                padding: '2px 4px',
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Project list */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 8px' }}>
          {sorted.length === 0 && (
            <p style={{ textAlign: 'center', color: '#6b6b7a', fontSize: 13, padding: '24px 0' }}>
              No projects yet
            </p>
          )}

          {sorted.map((p) => {
            const isActive = p.id === activeProjectId
            const isRenaming = renamingId === p.id

            return (
              <div
                key={p.id}
                onClick={() => !isRenaming && handleOpen(p.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: isActive ? 'rgba(124,110,246,0.15)' : 'transparent',
                  border: isActive
                    ? '1px solid rgba(124,110,246,0.4)'
                    : '1px solid transparent',
                  marginBottom: 4,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLDivElement).style.background =
                      'rgba(255,255,255,0.04)'
                }}
                onMouseLeave={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLDivElement).style.background = 'transparent'
                }}
              >
                {/* Icon */}
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: isActive
                      ? 'rgba(124,110,246,0.25)'
                      : 'rgba(255,255,255,0.07)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    flexShrink: 0,
                  }}
                >
                  📸
                </div>

                {/* Name + meta */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {isRenaming ? (
                    <input
                      ref={renameInputRef}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename()
                        if (e.key === 'Escape') setRenamingId(null)
                        e.stopPropagation()
                      }}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(124,110,246,0.6)',
                        borderRadius: 4,
                        color: '#e8e8f0',
                        fontSize: 13,
                        fontWeight: 500,
                        padding: '2px 6px',
                        width: '100%',
                        outline: 'none',
                      }}
                    />
                  ) : (
                    <div
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        startRename(p.id, p.name)
                      }}
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: isActive ? '#c4b9fc' : '#e8e8f0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {p.name}
                      {isActive && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 10,
                            background: 'rgba(124,110,246,0.35)',
                            color: '#a89cf6',
                            borderRadius: 4,
                            padding: '1px 6px',
                            fontWeight: 600,
                          }}
                        >
                          current
                        </span>
                      )}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: '#6b6b7a', marginTop: 2 }}>
                    {relativeTime(p.updatedAt)}
                  </div>
                </div>

                {/* Actions */}
                <div
                  style={{ display: 'flex', gap: 4 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    title="Rename (double-click name)"
                    onClick={(e) => {
                      e.stopPropagation()
                      startRename(p.id, p.name)
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#6b6b7a',
                      cursor: 'pointer',
                      fontSize: 14,
                      padding: '4px',
                      borderRadius: 4,
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLButtonElement).style.color = '#e8e8f0')
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLButtonElement).style.color = '#6b6b7a')
                    }
                  >
                    ✎
                  </button>
                  <button
                    title="Delete project"
                    onClick={(e) => handleDelete(e, p.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#6b6b7a',
                      cursor: 'pointer',
                      fontSize: 14,
                      padding: '4px',
                      borderRadius: 4,
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLButtonElement).style.color = '#f87171')
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLButtonElement).style.color = '#6b6b7a')
                    }
                  >
                    🗑
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer hint */}
        <div
          style={{
            padding: '10px 20px',
            borderTop: '1px solid rgba(255,255,255,0.07)',
            fontSize: 11,
            color: '#6b6b7a',
            textAlign: 'center',
          }}
        >
          Projects are auto-saved to your browser · Double-click a name to rename
        </div>
      </div>
    </>
  )
}
