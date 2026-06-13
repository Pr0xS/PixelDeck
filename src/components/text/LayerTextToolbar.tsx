import { useEditorStore } from '@/store'
import type { TextLayer, Layer } from '@/types'
import { spansToMarks } from '@/utils/textRendering'
import { applyMarkStyle, normalizeMarks, getRangeStyle, type StylePatch } from '@/utils/richText'
import { type RichTextEditorApi } from './useRichTextEditor'
import { RichTextToolbar } from './RichTextToolbar'

// ─────────────────────────────────────────────────────────────────────────────
// Builds a RichTextEditorApi-compatible object that applies style patches to
// the ENTIRE text of a layer (no contentEditable, no selection tracking).
// Used by the always-visible panel toolbar when the canvas editor is not active.
// ─────────────────────────────────────────────────────────────────────────────

function useWholeTextStyler(layer: TextLayer): RichTextEditorApi {
  const updateLayer = useEditorStore((s) => s.updateLayer)

  // Migrate legacy spans on the fly (same as useRichTextEditor)
  const legacy = !layer.marks && (layer.spans?.length ?? 0) > 0 ? spansToMarks(layer.spans!) : null
  const text = legacy ? (layer.text || legacy.text) : layer.text
  const marks = layer.marks ?? legacy?.marks ?? []
  const textLen = text.length

  const rangeStyle = getRangeStyle(marks, textLen, 0, textLen, {
    fill: layer.fill,
    fontWeight: layer.fontWeight,
    italic: layer.italic,
    underline: layer.underline,
    strikethrough: layer.strikethrough,
  })

  const applyPatch = (patch: StylePatch) => {
    if (textLen === 0) return
    const newMarks = applyMarkStyle(marks, textLen, 0, textLen, patch)
    const norm = normalizeMarks(newMarks, textLen)
    updateLayer(layer.id, {
      text,                                    // always persist text (fixes legacy-spans migration)
      marks: norm.length ? norm : undefined,
      spans: undefined,
    } as Partial<Layer>)
  }

  const boldActive = rangeStyle.fontWeight !== 'mixed' && rangeStyle.fontWeight >= 600
  const toggleBold = () => {
    if (rangeStyle.fontWeight === 'mixed') return applyPatch({ fontWeight: 700 })
    if (boldActive) return applyPatch({ fontWeight: layer.fontWeight >= 600 ? 400 : null })
    return applyPatch({ fontWeight: layer.fontWeight >= 600 ? null : 700 })
  }

  const clearAll = () => {
    // Clear mark overrides AND reset the layer fill to white, so the result
    // is always plain white text (no inherited gradient from layer.fill).
    const newMarks = applyMarkStyle(marks, textLen, 0, textLen, {
      fill: null, fontWeight: null, italic: null, underline: null, strikethrough: null,
    })
    const norm = normalizeMarks(newMarks, textLen)
    updateLayer(layer.id, {
      text,
      fill: '#ffffff',
      marks: norm.length ? norm : undefined,
      spans: undefined,
    } as Partial<Layer>)
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
    // Not used by RichTextToolbar — no-ops for type compatibility
    editableProps: {} as RichTextEditorApi['editableProps'],
    focusAndSelectAll: () => {},
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Always-visible text styling toolbar for the properties panel.
// Applies styles to the whole layer text. Replaced by the portaled
// RichTextToolbar (selection-aware) when the canvas editor is active.
// ─────────────────────────────────────────────────────────────────────────────

export function LayerTextToolbar({ layer }: { layer: TextLayer }) {
  const api = useWholeTextStyler(layer)
  return <RichTextToolbar api={api} fillPopoverClassName="mt-2" />
}
