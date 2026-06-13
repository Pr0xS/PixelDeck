import { useState, useEffect, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useTemplatesStore } from '@/store/templates'
import { useEditorStore, useUndoRedo } from '@/store'
import { looksLikeTemplate } from '@/utils/templates'
import { downloadDataUrl } from '@/utils/export'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import type { Template } from '@/types'

interface TemplatesModalProps {
  open: boolean
  onClose: () => void
}

export function TemplatesModal({ open, onClose }: TemplatesModalProps) {
  const { manifest, loading, error, loadManifest, fetchTemplate } = useTemplatesStore()
  const { project, exportActiveAsTemplate, importTemplateAsNewProject, addTemplateSlideGroups } =
    useEditorStore(useShallow((s) => ({
      project: s.project,
      exportActiveAsTemplate: s.exportActiveAsTemplate,
      importTemplateAsNewProject: s.importTemplateAsNewProject,
      addTemplateSlideGroups: s.addTemplateSlideGroups,
    })))
  const { canUndo } = useUndoRedo()

  const [view, setView] = useState<'gallery' | 'export'>('gallery')
  const [applying, setApplying] = useState<string | null>(null)
  const [confirmTemplate, setConfirmTemplate] = useState<Template | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const [exportName, setExportName] = useState('')
  const [exportDescription, setExportDescription] = useState('')
  const [exportCategory, setExportCategory] = useState('')

  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (open) loadManifest() }, [open, loadManifest])
  useEffect(() => { if (open) {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExportName(project.name)
  } }, [open, project.name])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmTemplate) { setConfirmTemplate(null); return }
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, confirmTemplate])

  if (!open) return null

  const doApplyNew = (tpl: Template) => {
    importTemplateAsNewProject(tpl)
    onClose()
  }

  const handleApplyNew = (tpl: Template) => {
    if (canUndo) {
      setConfirmTemplate(tpl)
    } else {
      doApplyNew(tpl)
    }
  }

  const handleApplyAdd = (tpl: Template) => {
    addTemplateSlideGroups(tpl)
    onClose()
  }

  const handleGalleryApply = async (
    entry: typeof manifest[0],
    mode: 'new' | 'add',
  ) => {
    setApplying(entry.slug)
    try {
      const tpl = await fetchTemplate(entry)
      if (mode === 'new') handleApplyNew(tpl)
      else handleApplyAdd(tpl)
    } catch {
      setApplying(null)
    }
  }

  const handleExport = () => {
    if (!exportName.trim()) return
    const tpl = exportActiveAsTemplate({
      name: exportName.trim(),
      description: exportDescription.trim() || undefined,
      category: exportCategory.trim() || undefined,
    })
    const json = JSON.stringify(tpl, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const slug = exportName
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
    downloadDataUrl(url, `${slug || 'template'}.template.json`)
    URL.revokeObjectURL(url)
    onClose()
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError(null)
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result as string)
        if (looksLikeTemplate(obj)) {
          const tpl = obj as Template
          if (!tpl.kind) tpl.kind = 'template'
          if (!tpl.schemaVersion) tpl.schemaVersion = 1
          handleApplyNew(tpl)
        } else {
          setImportError(
            'This file is not a template. Use "Import Project" for project files.',
          )
        }
      } catch {
        setImportError('Could not read file.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200 }}
      />

      <ConfirmDialog
        open={confirmTemplate !== null}
        title="Replace current project with this template?"
        message={`Your current project will be overwritten by "${confirmTemplate?.name ?? 'this template'}". You can undo with Ctrl+Z only within this session.`}
        confirmLabel="Replace Project"
        danger
        onConfirm={() => {
          if (!confirmTemplate) return
          doApplyNew(confirmTemplate)
          setConfirmTemplate(null)
        }}
        onCancel={() => setConfirmTemplate(null)}
      />

      {/* Main modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 680,
          maxHeight: '80vh',
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
            padding: '16px 20px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', gap: 4, flex: 1 }}>
            {(['gallery', 'export'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  background: view === v ? 'rgba(124,110,246,0.2)' : 'none',
                  border:
                    view === v
                      ? '1px solid rgba(124,110,246,0.4)'
                      : '1px solid transparent',
                  borderRadius: 6,
                  color: view === v ? '#c4b9fc' : '#6b6b7a',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: view === v ? 600 : 400,
                  padding: '4px 12px',
                }}
              >
                {v === 'gallery' ? '🗂 Templates' : '⬇ Export as Template'}
              </button>
            ))}
          </div>
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

        {/* Gallery view */}
        {view === 'gallery' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {/* Import from file */}
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => importRef.current?.click()}
                style={{
                  background: 'none',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 6,
                  color: '#a0a0b0',
                  cursor: 'pointer',
                  fontSize: 12,
                  padding: '5px 14px',
                }}
              >
                ↑ Import template file…
              </button>
              <input
                ref={importRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleImportFile}
              />
              {importError && (
                <span style={{ fontSize: 11, color: '#f87171' }}>{importError}</span>
              )}
            </div>

            {loading && (
              <p style={{ textAlign: 'center', color: '#6b6b7a', fontSize: 13 }}>
                Loading templates…
              </p>
            )}
            {error && (
              <p style={{ textAlign: 'center', color: '#f87171', fontSize: 13 }}>
                Failed to load templates
              </p>
            )}

            {!loading && manifest.length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '48px 20px',
                  color: '#6b6b7a',
                  fontSize: 13,
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 12 }}>🗂</div>
                <p style={{ margin: '0 0 6px', color: '#a0a0b0', fontWeight: 500 }}>
                  No bundled templates yet
                </p>
                <p style={{ margin: 0, fontSize: 11 }}>
                  Add templates to{' '}
                  <code
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      padding: '1px 5px',
                      borderRadius: 3,
                    }}
                  >
                    public/templates/
                  </code>{' '}
                  and they'll appear here.
                </p>
              </div>
            )}

            {manifest.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: 12,
                }}
              >
                {manifest.map((entry) => (
                  <div
                    key={entry.slug}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 10,
                      overflow: 'hidden',
                    }}
                  >
                    {/* Thumbnail */}
                    <div
                      style={{
                        aspectRatio: '9 / 19.5',
                        background: 'rgba(255,255,255,0.04)',
                        overflow: 'hidden',
                      }}
                    >
                      {entry.thumbnail ? (
                        <img
                          src={entry.thumbnail}
                          alt={entry.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 32,
                          }}
                        >
                          🗂
                        </div>
                      )}
                    </div>

                    {/* Info + actions */}
                    <div style={{ padding: '10px 10px 8px' }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: '#e8e8f0',
                          marginBottom: 3,
                        }}
                      >
                        {entry.name}
                      </div>
                      {entry.description && (
                        <div
                          style={{
                            fontSize: 11,
                            color: '#6b6b7a',
                            marginBottom: 8,
                            lineHeight: 1.4,
                          }}
                        >
                          {entry.description}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button
                          disabled={applying === entry.slug}
                          onClick={() => handleGalleryApply(entry, 'new')}
                          style={{
                            flex: 1,
                            background: '#7c6ef6',
                            border: 'none',
                            borderRadius: 5,
                            color: '#fff',
                            cursor: applying === entry.slug ? 'wait' : 'pointer',
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '5px 0',
                          }}
                        >
                          {applying === entry.slug ? '…' : 'New project'}
                        </button>
                        <button
                          disabled={applying === entry.slug}
                          onClick={() => handleGalleryApply(entry, 'add')}
                          style={{
                            flex: 1,
                            background: 'rgba(124,110,246,0.12)',
                            border: '1px solid rgba(124,110,246,0.28)',
                            borderRadius: 5,
                            color: '#c4b9fc',
                            cursor: applying === entry.slug ? 'wait' : 'pointer',
                            fontSize: 11,
                            fontWeight: 500,
                            padding: '5px 0',
                          }}
                        >
                          Add to current
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Export view */}
        {view === 'export' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
            <p
              style={{
                margin: '0 0 22px',
                fontSize: 13,
                color: '#6b6b7a',
                lineHeight: 1.5,
              }}
            >
              Export the current project as a shareable{' '}
              <code
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  padding: '1px 5px',
                  borderRadius: 3,
                  fontSize: 12,
                }}
              >
                .template.json
              </code>{' '}
              file. Screenshots and asset references are removed — each user adds their own.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#a0a0b0' }}>
                Template name *
                <input
                  value={exportName}
                  onChange={(e) => setExportName(e.target.value)}
                  placeholder="e.g. Minimal Hero"
                  style={{
                    display: 'block',
                    marginTop: 6,
                    width: '100%',
                    boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 6,
                    color: '#e8e8f0',
                    fontSize: 13,
                    padding: '7px 10px',
                    outline: 'none',
                  }}
                />
              </label>

              <label style={{ fontSize: 12, fontWeight: 500, color: '#a0a0b0' }}>
                Description
                <textarea
                  value={exportDescription}
                  onChange={(e) => setExportDescription(e.target.value)}
                  placeholder="Brief description of this template…"
                  rows={3}
                  style={{
                    display: 'block',
                    marginTop: 6,
                    width: '100%',
                    boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 6,
                    color: '#e8e8f0',
                    fontSize: 13,
                    padding: '7px 10px',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </label>

              <label style={{ fontSize: 12, fontWeight: 500, color: '#a0a0b0' }}>
                Category{' '}
                <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span>
                <input
                  value={exportCategory}
                  onChange={(e) => setExportCategory(e.target.value)}
                  placeholder="e.g. minimal, bold, feature"
                  style={{
                    display: 'block',
                    marginTop: 6,
                    width: '100%',
                    boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 6,
                    color: '#e8e8f0',
                    fontSize: 13,
                    padding: '7px 10px',
                    outline: 'none',
                  }}
                />
              </label>

              <button
                onClick={handleExport}
                disabled={!exportName.trim()}
                style={{
                  alignSelf: 'flex-start',
                  background: exportName.trim() ? '#7c6ef6' : 'rgba(124,110,246,0.3)',
                  border: 'none',
                  borderRadius: 7,
                  color: '#fff',
                  cursor: exportName.trim() ? 'pointer' : 'not-allowed',
                  fontSize: 13,
                  fontWeight: 600,
                  marginTop: 4,
                  padding: '8px 20px',
                }}
              >
                ⬇ Download .template.json
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            padding: '10px 20px',
            borderTop: '1px solid rgba(255,255,255,0.07)',
            fontSize: 11,
            color: '#4a4a5a',
            textAlign: 'center',
          }}
        >
          Add templates to{' '}
          <code
            style={{
              background: 'rgba(255,255,255,0.04)',
              padding: '1px 4px',
              borderRadius: 3,
            }}
          >
            public/templates/
          </code>{' '}
          to include them in the gallery
        </div>
      </div>
    </>
  )
}
