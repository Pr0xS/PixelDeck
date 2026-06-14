import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type React from 'react'
import { useRichTextEditor } from './useRichTextEditor'
import { RichTextToolbar } from './RichTextToolbar'
import { isEmptyStyle, normalizeMarks, segmentMarks, type MarkStyle } from '@/utils/richText'
import { fillToCss } from '@/utils/gradients'
import type { FillValue, TextLayer, TextMark } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// WYSIWYG editor for locale overrides (Localization view cells).
//
// Renders a cheap styled preview; clicking it mounts the shared rich-text
// editor (same engine as the canvas/panel editors) bound to the override's
// text+marks instead of the layer itself. Styling commits go through
// `onCommit` → setLocaleOverride, so marks stay locale-specific.
//
// Toolbar placement: when `toolbarSlot` is provided, the RichTextToolbar is
// portaled into it (a floating, viewport-fixed panel owned by the view — same
// pattern as the canvas editor portaling into the properties panel). This
// avoids the toolbar/fill-popover being clipped by the table's
// overflow-hidden sections. When omitted, the toolbar renders inline.
// ─────────────────────────────────────────────────────────────────────────────

export interface LocaleRichTextEditorProps {
  /** Base layer — provides default styling (font, fill, weight…) for the editor. */
  baseLayer: TextLayer
  /** Locale override text (the value being edited). */
  text: string
  /** Locale override marks. */
  marks?: TextMark[]
  placeholder?: string
  onCommit: (patch: { text: string; marks?: TextMark[] }) => void
  /**
   * Floating toolbar target. Pass the slot element (or null while it mounts)
   * to portal the toolbar there; omit entirely for an inline toolbar.
   */
  toolbarSlot?: HTMLElement | null
  /** Notifies the view when this cell enters/leaves editing (drives the floating panel). */
  onEditingChange?: (editing: boolean) => void
}

export function LocaleRichTextEditor({
  baseLayer,
  text,
  marks,
  placeholder,
  onCommit,
  toolbarSlot,
  onEditingChange,
}: LocaleRichTextEditorProps) {
  const [editing, setEditing] = useState(false)

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="Click to edit — select text to apply formatting"
        className="block w-full cursor-text text-left text-sm leading-6 text-[#f3f2ff] outline-none"
      >
        {text ? (
          <span className="whitespace-pre-wrap break-words">
            <RichTextPreview text={text} marks={marks ?? []} />
          </span>
        ) : (
          <span className="text-[#9a95c8]">{placeholder ?? 'Enter localized text'}</span>
        )}
      </button>
    )
  }

  return (
    <ActiveLocaleEditor
      baseLayer={baseLayer}
      text={text}
      marks={marks}
      onCommit={onCommit}
      onExit={() => setEditing(false)}
      toolbarSlot={toolbarSlot}
      onEditingChange={onEditingChange}
    />
  )
}

function RichTextPreview({ text, marks }: { text: string; marks: TextMark[] }) {
  const segments = segmentMarks(normalizeMarks(marks, text.length), text.length)
  return segments.map((seg) => {
    const value = text.slice(seg.start, seg.end)
    if (isEmptyStyle(seg.style)) return <span key={`${seg.start}-${seg.end}`}>{value}</span>
    return (
      <span key={`${seg.start}-${seg.end}`} style={styleToReactStyle(seg.style)}>
        {value}
      </span>
    )
  })
}

function styleToReactStyle(style: MarkStyle): React.CSSProperties {
  const css: React.CSSProperties = {}
  if (style.fill !== undefined) applyFillStyle(css, style.fill)
  if (style.fontWeight !== undefined) css.fontWeight = style.fontWeight
  if (style.italic !== undefined) css.fontStyle = style.italic ? 'italic' : 'normal'
  if (style.underline !== undefined || style.strikethrough !== undefined) {
    const decorations = [style.underline ? 'underline' : '', style.strikethrough ? 'line-through' : '']
      .filter(Boolean)
      .join(' ')
    css.textDecoration = decorations || 'none'
  }
  return css
}

function applyFillStyle(css: React.CSSProperties, fill: FillValue) {
  if (typeof fill === 'string') {
    css.color = fill
    return
  }
  css.backgroundImage = fillToCss(fill)
  css.WebkitBackgroundClip = 'text'
  css.backgroundClip = 'text'
  css.color = 'transparent'
  css.WebkitTextFillColor = 'transparent'
}

function ActiveLocaleEditor({
  baseLayer,
  text,
  marks,
  onCommit,
  onExit,
  toolbarSlot,
  onEditingChange,
}: {
  baseLayer: TextLayer
  text: string
  marks?: TextMark[]
  onCommit: (patch: { text: string; marks?: TextMark[] }) => void
  onExit: () => void
  toolbarSlot?: HTMLElement | null
  onEditingChange?: (editing: boolean) => void
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // Portal mode when the prop is passed at all (element may arrive a frame later)
  const usePortal = toolbarSlot !== undefined

  // Virtual layer: base styling + the locale's text/marks as canonical state.
  const virtualLayer: TextLayer = { ...baseLayer, text, marks, spans: undefined }

  const api = useRichTextEditor(virtualLayer, editorRef, {
    commitLayer: (patch) => onCommit({ text: patch.text ?? text, marks: patch.marks }),
    onConfirm: onExit,
  })

  // Focus on mount (after the hook's innerHTML sync effect has run)
  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    el.focus({ preventScroll: true })
    // Caret at the end — less destructive than select-all for quick fixes
    const sel = window.getSelection()
    if (sel) {
      const range = document.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
      sel.removeAllRanges()
      sel.addRange(range)
    }
  }, [])

  // The editor's mount/unmount IS the editing session: notify true on mount
  // and false on unmount. Symmetric, so it survives StrictMode's double
  // effect invocation in dev, and covers every exit path (blur, Enter,
  // override cleared, row removed…).
  const notifyRef = useRef(onEditingChange)
  useEffect(() => {
    notifyRef.current = onEditingChange
  }, [onEditingChange])
  useEffect(() => {
    notifyRef.current?.(true)
    return () => notifyRef.current?.(false)
  }, [])

  // Exit when focus leaves the cell editor AND the docked styling panel
  const handleBlur = (e: React.FocusEvent) => {
    const related = e.relatedTarget as Node | null
    if (containerRef.current?.contains(related)) return
    // The slot lives inside the view's docked panel — keep the session alive
    // for interactions anywhere within that panel (toolbar, fill editor…).
    const panel = toolbarSlot?.closest('[data-locale-toolbar-panel]') ?? toolbarSlot
    if (panel?.contains(related)) return
    onExit()
  }

  const toolbar = (
    <RichTextToolbar
      api={api}
      // Docked panel has room — let the fill editor flow inline (it scrolls).
      fillPopoverClassName={usePortal ? undefined : 'absolute left-0 right-0 z-30 mt-1'}
    />
  )

  return (
    <div ref={containerRef} onBlur={handleBlur} className="relative">
      {usePortal
        ? toolbarSlot && createPortal(toolbar, toolbarSlot)
        : <div className="mb-1.5">{toolbar}</div>}
      <div
        ref={editorRef}
        {...api.editableProps}
        tabIndex={0}
        className="min-h-[24px] w-full whitespace-pre-wrap break-words border-0 bg-transparent text-sm leading-6 text-[#f3f2ff] outline-none"
      />
      <div className="mt-1 text-[9px] text-[#6b6b7a]">Select text → style with the toolbar · Enter to confirm</div>
    </div>
  )
}
