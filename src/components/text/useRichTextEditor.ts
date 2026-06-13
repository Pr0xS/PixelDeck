import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { useEditorStore } from '@/store'
import type { TextLayer, TextMark, Layer, FillValue } from '@/types'
import { spansToMarks } from '@/utils/textRendering'
import {
  applyMarkStyle,
  normalizeMarks,
  getRangeStyle,
  marksToHtml,
  parseEditorDom,
  domSelectionToOffsets,
  setDomSelection,
  type StylePatch,
  type RangeStyle,
} from '@/utils/richText'

// ─────────────────────────────────────────────────────────────────────────────
// Shared WYSIWYG rich-text editing logic. Used by the properties panel editor
// and the in-canvas contextual editor. One contentEditable box: select text →
// apply B / I / U / S / fill. Marks are derived automatically; with no
// selection, styles apply to the whole text.
// Keys: Enter confirms · Ctrl/Cmd/Shift+Enter inserts a line break · Esc exits.
//
// The consumer owns the editor ref (`<div ref={editorRef} {...api.editableProps} />`)
// and passes it in — the returned api object deliberately contains no refs.
// ─────────────────────────────────────────────────────────────────────────────

export interface RichTextEditorApi {
  text: string
  marks: TextMark[]
  rangeStyle: RangeStyle
  boldActive: boolean
  hasMarks: boolean
  swatchFill: FillValue
  layer: TextLayer
  toggleBold: () => void
  applyPatch: (patch: StylePatch) => void
  clearAll: () => void
  /** Spread these on the contentEditable element */
  editableProps: {
    contentEditable: true
    suppressContentEditableWarning: true
    spellCheck: false
    role: 'textbox'
    'aria-multiline': 'true'
    onInput: () => void
    onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void
    onPaste: (e: React.ClipboardEvent<HTMLDivElement>) => void
  }
  /** Focus the editor and select all of its text */
  focusAndSelectAll: () => void
}

export interface UseRichTextEditorOptions {
  /** Custom commit (e.g. group children commit through updateChildLayer) */
  commitLayer?: (patch: Partial<TextLayer>) => void
  /** Called when the user confirms (Enter) or exits (Escape) */
  onConfirm?: () => void
}

/** Toggle override for a boolean style key, minimizing stored overrides. */
export function toggleBoolPatch(effective: boolean | 'mixed', layerDefault: boolean): boolean | null {
  const turnOn = effective === 'mixed' ? true : !effective
  if (turnOn) return layerDefault ? null : true
  return layerDefault ? false : null
}

export function useRichTextEditor(
  layer: TextLayer,
  editorRef: React.RefObject<HTMLDivElement | null>,
  opts: UseRichTextEditorOptions = {},
): RichTextEditorApi {
  const updateLayer = useEditorStore((s) => s.updateLayer)
  const [sel, setSel] = useState<{ start: number; end: number } | null>(null)
  // Key of the last state we wrote to the store — used to skip DOM rewrites
  // caused by our own commits (preserves the caret while typing).
  const lastEmitted = useRef<string | null>(null)

  // Canonical state — migrate legacy spans on the fly
  const legacy = !layer.marks && (layer.spans?.length ?? 0) > 0 ? spansToMarks(layer.spans!) : null
  const text = legacy ? (layer.text || legacy.text) : layer.text
  const marks = layer.marks ?? legacy?.marks ?? []
  const stateKey = JSON.stringify([text, marks])

  // Sync editor DOM from state on external changes (layer switch, undo, edits elsewhere)
  useEffect(() => {
    const el = editorRef.current
    if (!el || stateKey === lastEmitted.current) return
    el.innerHTML = marksToHtml(text, marks)
    lastEmitted.current = stateKey
  }, [stateKey, layer.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Track the selection inside the editor (kept while interacting with a toolbar)
  useEffect(() => {
    const handler = () => {
      const el = editorRef.current
      if (!el) return
      const offsets = domSelectionToOffsets(el)
      if (offsets) setSel(offsets)
    }
    document.addEventListener('selectionchange', handler)
    return () => document.removeEventListener('selectionchange', handler)
  }, [editorRef])

  const commit = (newText: string, newMarks: TextMark[]) => {
    const norm = normalizeMarks(newMarks, newText.length)
    lastEmitted.current = JSON.stringify([newText, norm])
    const patch = {
      text: newText,
      marks: norm.length ? norm : undefined,
      spans: undefined,
    } as Partial<TextLayer>
    if (opts.commitLayer) opts.commitLayer(patch)
    else updateLayer(layer.id, patch as Partial<Layer>)
  }

  const handleInput = () => {
    const el = editorRef.current
    if (!el) return
    const parsed = parseEditorDom(el)
    commit(parsed.text, parsed.marks)
  }

  const confirm = () => {
    editorRef.current?.blur()
    window.getSelection()?.removeAllRanges()
    opts.onConfirm?.()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        // Ctrl/Cmd/Shift+Enter → new line
        document.execCommand('insertLineBreak')
      } else {
        // Enter → confirm changes (committed live; just exit)
        confirm()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      confirm()
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      // Route undo/redo to the app history instead of the browser's
      e.preventDefault()
      const temporal = useEditorStore.temporal.getState()
      if (e.shiftKey) temporal.redo()
      else temporal.undo()
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault()
      useEditorStore.temporal.getState().redo()
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
  }

  // Effective range for toolbar actions: selection, or the whole text as fallback
  const range = (() => {
    const len = text.length
    if (!sel || sel.start === sel.end) return { start: 0, end: len, whole: true }
    return { start: Math.min(sel.start, len), end: Math.min(sel.end, len), whole: false }
  })()

  const rangeStyle = getRangeStyle(marks, text.length, range.start, range.end, {
    fill: layer.fill,
    fontWeight: layer.fontWeight,
    italic: layer.italic,
    underline: layer.underline,
    strikethrough: layer.strikethrough,
  })

  const applyPatch = (patch: StylePatch) => {
    const el = editorRef.current
    if (!el || text.length === 0) return
    const newMarks = applyMarkStyle(marks, text.length, range.start, range.end, patch)
    el.innerHTML = marksToHtml(text, newMarks)
    if (sel && !range.whole) setDomSelection(el, sel.start, sel.end)
    commit(text, newMarks)
  }

  const boldActive = rangeStyle.fontWeight !== 'mixed' && rangeStyle.fontWeight >= 600
  const toggleBold = () => {
    if (rangeStyle.fontWeight === 'mixed') return applyPatch({ fontWeight: 700 })
    if (boldActive) return applyPatch({ fontWeight: layer.fontWeight >= 600 ? 400 : null })
    return applyPatch({ fontWeight: layer.fontWeight >= 600 ? null : 700 })
  }

  const clearAll = () => {
    // Clear mark overrides AND reset layer.fill to white so no gradient bleeds through.
    const el = editorRef.current
    if (!el || text.length === 0) return
    const newMarks = applyMarkStyle(marks, text.length, range.start, range.end, {
      fill: null, fontWeight: null, italic: null, underline: null, strikethrough: null,
    })
    el.innerHTML = marksToHtml(text, newMarks)
    if (sel && !range.whole) setDomSelection(el, sel.start, sel.end)
    const norm = normalizeMarks(newMarks, text.length)
    lastEmitted.current = JSON.stringify([text, norm])
    const patch = {
      text,
      fill: '#ffffff',
      marks: norm.length ? norm : undefined,
      spans: undefined,
    } as Partial<TextLayer>
    if (opts.commitLayer) opts.commitLayer(patch)
    else updateLayer(layer.id, patch as Partial<Layer>)
  }

  const focusAndSelectAll = () => {
    const el = editorRef.current
    if (!el) return
    el.focus({ preventScroll: true })
    setDomSelection(el, 0, text.length)
  }

  return {
    text,
    marks,
    rangeStyle,
    boldActive,
    hasMarks: marks.length > 0,
    swatchFill: rangeStyle.fill === 'mixed' ? layer.fill : rangeStyle.fill,
    layer,
    toggleBold,
    applyPatch,
    clearAll,
    editableProps: {
      contentEditable: true,
      suppressContentEditableWarning: true,
      spellCheck: false,
      role: 'textbox',
      'aria-multiline': 'true',
      onInput: handleInput,
      onKeyDown: handleKeyDown,
      onPaste: handlePaste,
    },
    focusAndSelectAll,
  }
}
