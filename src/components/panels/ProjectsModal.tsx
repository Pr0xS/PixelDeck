import { useState, useEffect, useRef } from 'react'
import { useProjectsStore } from '@/store/projects'
import { useEditorStore } from '@/store'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { ModalShell } from '@/components/ui/ModalShell'
import { InlineEditableLabel } from '@/components/ui/InlineEditableLabel'
import { FileUploadButton } from '@/components/ui/FileUploadButton'


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
  const exportProject = useEditorStore((s) => s.exportProject)
  const importProject = useEditorStore((s) => s.importProject)

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [creatingNew, setCreatingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newNameError, setNewNameError] = useState('')
  const newNameInputRef = useRef<HTMLInputElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  // Focus new name input when creating
  useEffect(() => {
    if (creatingNew) newNameInputRef.current?.focus()
  }, [creatingNew])

  const startRename = (id: string) => {
    setRenamingId(id)
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
    setCreatingNew(true)
    setNewName('')
    setNewNameError('')
  }

  const handleCreateConfirm = () => {
    const trimmed = newName.trim()
    if (!trimmed) {
      setNewNameError('Name is required')
      return
    }
    try {
      createProject(trimmed)
      setCreatingNew(false)
      onClose()
    } catch (err) {
      setNewNameError(err instanceof Error ? err.message : String(err))
    }
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

  const handleExportProject = (id: string, name: string) => {
    // If it's the active project, use the live editor state (most up-to-date)
    const json = id === activeProjectId
      ? exportProject()
      : localStorage.getItem(`pd:project:${id}`) ?? exportProject()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const slug = name.replace(/[^a-z0-9_-]/gi, '-').toLowerCase() || 'project'
    const a = document.createElement('a')
    a.href = url
    a.download = `${slug}.json`
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const handleImport = () => importInputRef.current?.click()

  const handleImportFile = (files: File[]) => {
    const file = files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        importProject(reader.result as string)
        onClose()
      } catch {
        alert('Failed to open project file.')
      }
    }
    reader.readAsText(file)
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

      <ModalShell
        open={open}
        onClose={onClose}
        onEscape={() => {
          if (deleteId) return
          if (creatingNew) setCreatingNew(false)
          else onClose()
        }}
        maxWidth="max-w-lg"
        backdropClassName="fixed inset-0 z-[200] flex items-center justify-center backdrop-blur-sm"
        panelStyle={{ background: '#18181f', borderColor: 'rgba(255,255,255,0.1)', maxHeight: '75vh', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}
        showCloseButton={false}
        header={<div
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
                onClick={handleImport}
                style={{
                  background: 'none',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6,
                  color: '#a0a0b0',
                  cursor: 'pointer',
                  fontSize: 12,
                  padding: '5px 12px',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.color = '#e8e8f0'
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.25)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.color = '#a0a0b0'
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.1)'
                }}
              >
                Import
              </button>
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
                + New
              </button>
              <FileUploadButton
                ref={importInputRef}
                accept=".json"
                onFiles={handleImportFile}
                className="hidden"
              >Import file</FileUploadButton>
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
          </div>}
        footerClassName=""
        footer={<div style={{ padding: '10px 20px', borderTop: '1px solid rgba(255,255,255,0.07)', fontSize: 11, color: '#6b6b7a', textAlign: 'center' }}>Auto-saved · Double-click a name to rename</div>}
      >

          {/* New project form */}
          {creatingNew && (
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                background: 'rgba(255,255,255,0.02)',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  ref={newNameInputRef}
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value)
                    if (newNameError) setNewNameError('')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateConfirm()
                    if (e.key === 'Escape') setCreatingNew(false)
                    e.stopPropagation()
                  }}
                  placeholder="Project name..."
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.08)',
                    border: `1px solid ${newNameError ? '#f87171' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 6,
                    color: '#e8e8f0',
                    fontSize: 13,
                    fontWeight: 500,
                    padding: '6px 10px',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleCreateConfirm}
                  disabled={!newName.trim()}
                  style={{
                    background: newName.trim() ? '#7c6ef6' : 'rgba(124,110,246,0.4)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 14px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: newName.trim() ? 'pointer' : 'not-allowed',
                    flexShrink: 0,
                  }}
                >
                  Create
                </button>
                <button
                  onClick={() => setCreatingNew(false)}
                  style={{
                    background: 'none',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 6,
                    color: '#6b6b7a',
                    fontSize: 12,
                    fontWeight: 500,
                    padding: '6px 10px',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  Cancel
                </button>
              </div>
              {newNameError && (
                <div style={{ fontSize: 11, color: '#f87171', marginTop: 6 }}>
                  {newNameError}
                </div>
              )}
            </div>
          )}

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
                    <InlineEditableLabel
                        value={p.name}
                        editing={isRenaming}
                        onEditingChange={(editing) => {
                          setRenamingId(editing ? p.id : null)
                        }}
                        onCommit={(name) => renameProject(p.id, name)}
                        inputStyle={{
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
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: isActive ? '#c4b9fc' : '#e8e8f0',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        className="block"
                      >
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
                      </InlineEditableLabel>
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
                      title="Export project as JSON"
                      onClick={(e) => { e.stopPropagation(); handleExportProject(p.id, p.name) }}
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
                      Export
                    </button>
                    <button
                      title="Rename (double-click name)"
                      onClick={(e) => {
                        e.stopPropagation()
                        startRename(p.id)
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

      </ModalShell>
    </>
  )
}
