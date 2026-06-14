import { useEffect, type ReactNode } from 'react'

interface HelpModalProps {
  open: boolean
  onClose: () => void
}

type ShortcutRow = { keys: ReactNode; desc: string }

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd
      style={{
        background: '#1e1e2a',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 4,
        padding: '2px 6px',
        fontSize: 11,
        fontFamily: 'monospace',
        color: '#c8c8d8',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </kbd>
  )
}

function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: '#6b6b7a',
        marginTop: 28,
        marginBottom: 10,
        paddingBottom: 6,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {children}
    </div>
  )
}

function ShortcutTable({ rows }: { rows: ShortcutRow[] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={i}
            style={{
              background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
            }}
          >
            <td style={{ padding: '6px 10px', color: '#6b6b7a', width: '40%' }}>
              {row.keys}
            </td>
            <td style={{ padding: '6px 10px', color: '#c8c8d8' }}>{row.desc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function HelpModal({ open, onClose }: HelpModalProps) {
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#13131a',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          width: '100%',
          maxWidth: 960,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          margin: '0 16px',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#e8e8f0' }}>
              🎴 PixelDeck Help
            </div>
            <div style={{ fontSize: 12, color: '#6b6b7a', marginTop: 2 }}>
              Usage guide &amp; keyboard shortcuts
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6,
              color: '#a0a0b0',
              cursor: 'pointer',
              fontSize: 16,
              width: 30,
              height: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.color = '#e8e8f0'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.2)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.color = '#a0a0b0'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.1)'
            }}
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', padding: '8px 24px 28px', flex: 1 }}>

          {/* ── Overview ── */}
          <SectionHeader>Overview</SectionHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f0', marginBottom: 4 }}>
                What is PixelDeck?
              </div>
              <p style={{ fontSize: 13, color: '#a0a0b0', lineHeight: 1.6, margin: 0 }}>
                PixelDeck is a visual editor for designing App Store screenshot layouts. Build polished
                screenshots with layers, device mockups, text, shapes, and images — then export them
                as high-resolution PNGs.
              </p>
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f0', marginBottom: 4 }}>
                Slides &amp; Slide Groups
              </div>
              <p style={{ fontSize: 13, color: '#a0a0b0', lineHeight: 1.6, margin: 0 }}>
                A <strong style={{ color: '#c8c8d8' }}>Slide Group</strong> is a set of related
                screenshots (e.g., "iPhone 16 Pro — 3 slides"). Each slide shares the same layer
                stack. Panorama groups extend the canvas width across multiple slides and let you
                position elements anywhere in that wide space.
              </p>
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f0', marginBottom: 4 }}>
                Layers
              </div>
              <p style={{ fontSize: 13, color: '#a0a0b0', lineHeight: 1.6, margin: 0 }}>
                Add layers from the <strong style={{ color: '#c8c8d8' }}>toolbar</strong> (phone
                mockup, text, image, shape, etc.). Select layers on the canvas or in the{' '}
                <strong style={{ color: '#c8c8d8' }}>Layers Panel</strong> on the left. Drag to
                reorder them. Hold <Kbd>Shift</Kbd> to multi-select.
              </p>
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f0', marginBottom: 4 }}>
                Properties Panel
              </div>
              <p style={{ fontSize: 13, color: '#a0a0b0', lineHeight: 1.6, margin: 0 }}>
                When a layer is selected, the right-hand{' '}
                <strong style={{ color: '#c8c8d8' }}>Properties Panel</strong> shows its
                type-specific options — position, size, fill, font, shadow, blur, opacity, and more.
                Changes take effect instantly and can be undone.
              </p>
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f0', marginBottom: 4 }}>
                Exporting
              </div>
              <p style={{ fontSize: 13, color: '#a0a0b0', lineHeight: 1.6, margin: 0 }}>
                Click <strong style={{ color: '#c8c8d8' }}>Export</strong> in the bottom bar to
                download PNGs for every slide. Use{' '}
                <strong style={{ color: '#c8c8d8' }}>Export Project</strong> in the toolbar to save
                your work as a JSON file, and{' '}
                <strong style={{ color: '#c8c8d8' }}>Import Project</strong> to restore it later.
                The CLI (<code style={{ color: '#c8c8d8', fontSize: 12 }}>node cli/index.mjs</code>)
                supports headless batch export via Playwright.
              </p>
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f0', marginBottom: 4 }}>
                Localization Mode
              </div>
              <p style={{ fontSize: 13, color: '#a0a0b0', lineHeight: 1.6, margin: 0 }}>
                Switch to <strong style={{ color: '#c8c8d8' }}>Localization</strong> mode from the
                toolbar to translate text layers across multiple locales. AI-powered translation is
                available if you configure an API key under{' '}
                <strong style={{ color: '#c8c8d8' }}>⚙ AI Settings</strong>.
              </p>
            </div>
          </div>

          {/* ── Keyboard Shortcuts ── */}
          <SectionHeader>Keyboard Shortcuts</SectionHeader>

          <div
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#7c6ef6',
              marginBottom: 8,
              fontWeight: 600,
            }}
          >
            Canvas &amp; View
          </div>
          <ShortcutTable
            rows={[
              { keys: <><Kbd>Space</Kbd> + Drag</>, desc: 'Pan the canvas' },
              { keys: <><Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd>+<Kbd>0</Kbd></>, desc: 'Fit canvas to window' },
              { keys: <><Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd>+<Kbd>1</Kbd></>, desc: 'Zoom to 100%' },
            ]}
          />

          <div
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#7c6ef6',
              marginTop: 20,
              marginBottom: 8,
              fontWeight: 600,
            }}
          >
            Layers
          </div>
          <ShortcutTable
            rows={[
              { keys: <><Kbd>↑</Kbd><Kbd>↓</Kbd><Kbd>←</Kbd><Kbd>→</Kbd></>, desc: 'Nudge selected layer 1px' },
              { keys: <><Kbd>Shift</Kbd>+Arrow Keys</>, desc: 'Nudge selected layer 10px' },
              { keys: <><Kbd>Delete</Kbd> / <Kbd>Backspace</Kbd></>, desc: 'Remove selected layer(s)' },
              { keys: <><Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd>+<Kbd>D</Kbd></>, desc: 'Duplicate selected layer' },
            ]}
          />

          <div
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#7c6ef6',
              marginTop: 20,
              marginBottom: 8,
              fontWeight: 600,
            }}
          >
            Copy &amp; Paste
          </div>
          <ShortcutTable
            rows={[
              { keys: <><Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd>+<Kbd>C</Kbd></>, desc: 'Copy selected layer(s)' },
              { keys: <><Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd>+<Kbd>X</Kbd></>, desc: 'Cut selected layer(s)' },
              { keys: <><Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd>+<Kbd>V</Kbd></>, desc: 'Paste layer(s)' },
              { keys: <><Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd>+<Kbd>Alt</Kbd>+<Kbd>C</Kbd></>, desc: 'Copy layer style' },
              { keys: <><Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd>+<Kbd>Alt</Kbd>+<Kbd>V</Kbd></>, desc: 'Paste layer style' },
            ]}
          />

          <div
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#7c6ef6',
              marginTop: 20,
              marginBottom: 8,
              fontWeight: 600,
            }}
          >
            Groups
          </div>
          <ShortcutTable
            rows={[
              { keys: <><Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd>+<Kbd>G</Kbd></>, desc: 'Group selected layers' },
              { keys: <><Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd>+<Kbd>Shift</Kbd>+<Kbd>G</Kbd></>, desc: 'Dissolve group' },
              { keys: <><Kbd>Escape</Kbd></>, desc: 'Exit group editing mode' },
            ]}
          />

          <div
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#7c6ef6',
              marginTop: 20,
              marginBottom: 8,
              fontWeight: 600,
            }}
          >
            History
          </div>
          <ShortcutTable
            rows={[
              { keys: <><Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd>+<Kbd>Z</Kbd></>, desc: 'Undo' },
              { keys: <><Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd>+<Kbd>Shift</Kbd>+<Kbd>Z</Kbd> or <Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd>+<Kbd>Y</Kbd></>, desc: 'Redo' },
            ]}
          />
        </div>
      </div>
    </div>
  )
}
