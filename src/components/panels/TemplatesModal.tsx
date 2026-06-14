import { useState, useEffect, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useTemplatesStore, toAbsolute } from '@/store/templates'
import { useEditorStore } from '@/store'
import { looksLikeTemplate } from '@/utils/templates'
import { downloadDataUrl } from '@/utils/export'
import type { Template } from '@/types'

interface TemplatesModalProps {
  open: boolean
  onClose: () => void
}

export function TemplatesModal({ open, onClose }: TemplatesModalProps) {
  const { manifest, loading, error, loadManifest, fetchTemplate } = useTemplatesStore()
  const { project, exportActiveAsTemplate, addTemplateSlideGroups } =
    useEditorStore(useShallow((s) => ({
      project: s.project,
      exportActiveAsTemplate: s.exportActiveAsTemplate,
      addTemplateSlideGroups: s.addTemplateSlideGroups,
    })))

  const [applying, setApplying] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)

  const [exportName, setExportName] = useState('')
  const [exportDescription, setExportDescription] = useState('')
  const [exportCategory, setExportCategory] = useState('')

  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (open) loadManifest() }, [open, loadManifest])
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExportName(project.name)
    }
  }, [open, project.name])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (exportOpen) {
          setExportOpen(false)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, exportOpen])

  if (!open) return null

  const handleGalleryApply = async (entry: typeof manifest[0]) => {
    setApplying(entry.slug)
    try {
      const tpl = await fetchTemplate(entry)
      addTemplateSlideGroups(tpl)
      onClose()
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
          addTemplateSlideGroups(tpl)
          onClose()
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

  /* ─── shared input style ─────────────────────────────────── */
  const inputStyle: React.CSSProperties = {
    display: 'block',
    marginTop: 5,
    width: '100%',
    boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    color: '#e8e8f0',
    fontSize: 12,
    padding: '6px 10px',
    outline: 'none',
    fontFamily: 'inherit',
  }

  return (
    <>
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
          overflow: 'hidden',
        }}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div
          style={{
            padding: '14px 16px 14px 20px',
            borderBottom: exportOpen
              ? 'none'
              : '1px solid rgba(255,255,255,0.07)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}
        >
          {/* Title */}
          <span
            style={{
              flex: 1,
              fontSize: 14,
              fontWeight: 600,
              color: '#e8e8f0',
              letterSpacing: '-0.01em',
            }}
          >
            Templates
          </span>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Import */}
            <button
              onClick={() => importRef.current?.click()}
              title="Import a .template.json file"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                color: '#a0a0b0',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                padding: '5px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)'
                e.currentTarget.style.color = '#c8c8d8'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                e.currentTarget.style.color = '#a0a0b0'
              }}
            >
              <span style={{ fontSize: 11 }}>↑</span>
              Import
            </button>

            {/* Export */}
            <button
              onClick={() => setExportOpen((v) => !v)}
              title="Export current project as a template"
              style={{
                background: exportOpen ? 'rgba(124,110,246,0.18)' : 'rgba(255,255,255,0.04)',
                border: exportOpen
                  ? '1px solid rgba(124,110,246,0.45)'
                  : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                color: exportOpen ? '#c4b9fc' : '#a0a0b0',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                padding: '5px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!exportOpen) {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)'
                  e.currentTarget.style.color = '#c8c8d8'
                }
              }}
              onMouseLeave={(e) => {
                if (!exportOpen) {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                  e.currentTarget.style.color = '#a0a0b0'
                }
              }}
            >
              <span style={{ fontSize: 11 }}>⬇</span>
              Export
            </button>

            {/* Divider */}
            <div
              style={{
                width: 1,
                height: 20,
                background: 'rgba(255,255,255,0.08)',
                margin: '0 2px',
              }}
            />

            {/* Close */}
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
                borderRadius: 4,
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#a0a0b0' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#6b6b7a' }}
            >
              ×
            </button>
          </div>
        </div>

        {/* ── Export panel (inline collapsible) ──────────────── */}
        {exportOpen && (
          <div
            style={{
              background: 'rgba(124,110,246,0.05)',
              borderBottom: '1px solid rgba(124,110,246,0.15)',
              padding: '16px 20px',
              flexShrink: 0,
            }}
          >
            {/* Description */}
            <p
              style={{
                margin: '0 0 14px',
                fontSize: 12,
                color: '#6b6b7a',
                lineHeight: 1.5,
              }}
            >
              Export the current project as a shareable{' '}
              <code
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  padding: '1px 5px',
                  borderRadius: 3,
                  fontSize: 11,
                  color: '#a0a0b0',
                }}
              >
                .template.json
              </code>{' '}
              file. Screenshots and asset references are removed — each user adds their own.
            </p>

            {/* Form: Name + Category in one row */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <label
                style={{
                  flex: 2,
                  fontSize: 11,
                  fontWeight: 500,
                  color: '#8a8a9a',
                }}
              >
                Name *
                <input
                  value={exportName}
                  onChange={(e) => setExportName(e.target.value)}
                  placeholder="e.g. Minimal Hero"
                  style={inputStyle}
                />
              </label>
              <label
                style={{
                  flex: 1,
                  fontSize: 11,
                  fontWeight: 500,
                  color: '#8a8a9a',
                }}
              >
                Category
                <input
                  value={exportCategory}
                  onChange={(e) => setExportCategory(e.target.value)}
                  placeholder="minimal, bold…"
                  style={inputStyle}
                />
              </label>
            </div>

            {/* Description textarea */}
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 500,
                color: '#8a8a9a',
                marginBottom: 12,
              }}
            >
              Description
              <textarea
                value={exportDescription}
                onChange={(e) => setExportDescription(e.target.value)}
                placeholder="Brief description of this template…"
                rows={2}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                }}
              />
            </label>

            {/* Download button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleExport}
                disabled={!exportName.trim()}
                style={{
                  background: exportName.trim() ? '#7c6ef6' : 'rgba(124,110,246,0.25)',
                  border: 'none',
                  borderRadius: 6,
                  color: exportName.trim() ? '#fff' : 'rgba(255,255,255,0.35)',
                  cursor: exportName.trim() ? 'pointer' : 'not-allowed',
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '7px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>⬇</span>
                Download .template.json
              </button>
            </div>
          </div>
        )}

        {/* ── Gallery ────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {/* Hidden file input for Import */}
          <input
            ref={importRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />

          {/* Import error (shown inline in gallery area) */}
          {importError && (
            <div
              style={{
                marginBottom: 14,
                padding: '9px 12px',
                background: 'rgba(248,113,113,0.08)',
                border: '1px solid rgba(248,113,113,0.2)',
                borderRadius: 7,
                fontSize: 12,
                color: '#f87171',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>⚠</span>
              {importError}
              <button
                onClick={() => setImportError(null)}
                style={{
                  marginLeft: 'auto',
                  background: 'none',
                  border: 'none',
                  color: '#f87171',
                  cursor: 'pointer',
                  fontSize: 14,
                  lineHeight: 1,
                  padding: 0,
                  opacity: 0.7,
                }}
              >
                ×
              </button>
            </div>
          )}

          {loading && (
            <p style={{ textAlign: 'center', color: '#6b6b7a', fontSize: 13, marginTop: 32 }}>
              Loading templates…
            </p>
          )}
          {error && (
            <p style={{ textAlign: 'center', color: '#f87171', fontSize: 13, marginTop: 32 }}>
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
                      aspectRatio: '16 / 9',
                      background: 'rgba(255,255,255,0.04)',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    {entry.thumbnail ? (
                      <img
                        src={toAbsolute(entry.thumbnail)}
                        alt={entry.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          padding: '12px 10px',
                          boxSizing: 'border-box',
                        }}
                      >
                        {entry.category && (
                          <div
                            style={{
                              background: 'rgba(124,110,246,0.18)',
                              border: '1px solid rgba(124,110,246,0.3)',
                              borderRadius: 20,
                              color: '#c4b9fc',
                              fontSize: 9,
                              fontWeight: 600,
                              letterSpacing: '0.06em',
                              padding: '2px 8px',
                              textTransform: 'uppercase',
                            }}
                          >
                            {entry.category}
                          </div>
                        )}
                        <div
                          style={{
                            color: '#e8e8f0',
                            fontSize: 13,
                            fontWeight: 700,
                            textAlign: 'center',
                            lineHeight: 1.3,
                          }}
                        >
                          {entry.name}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 3,
                            marginTop: 4,
                          }}
                        >
                          {entry.slides != null && (
                            <div style={{ color: '#6b6b7a', fontSize: 10 }}>
                              {entry.slides} {entry.slides === 1 ? 'slide' : 'slides'}
                            </div>
                          )}
                          {entry.previewSize && (
                            <div style={{ color: '#4a4a5a', fontSize: 9, fontFamily: 'monospace' }}>
                              {entry.previewSize}
                            </div>
                          )}
                        </div>
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
                    <button
                      disabled={applying === entry.slug}
                      onClick={() => handleGalleryApply(entry)}
                      style={{
                        width: '100%',
                        background: '#7c6ef6',
                        border: 'none',
                        borderRadius: 5,
                        color: '#fff',
                        cursor: applying === entry.slug ? 'wait' : 'pointer',
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '6px 0',
                      }}
                    >
                      {applying === entry.slug ? 'Adding…' : '+ Add slides to project'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div
          style={{
            padding: '10px 20px',
            borderTop: '1px solid rgba(255,255,255,0.07)',
            fontSize: 11,
            color: '#4a4a5a',
            textAlign: 'center',
            flexShrink: 0,
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
