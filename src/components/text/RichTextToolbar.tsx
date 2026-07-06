import { useState } from 'react'
import type React from 'react'
import { useEditorStore } from '@/store'
import { getFontWeights } from '@/utils/fonts'
import { fillToCss } from '@/utils/gradients'
import { FillControl } from '@/components/properties/PropertyControls'
import { toggleBoolPatch, type RichTextEditorApi } from './useRichTextEditor'

const pauseTemporal = () => useEditorStore.temporal.getState().pause()
const resumeTemporal = () => useEditorStore.temporal.getState().resume()

const toolbarBtnCls = (active: boolean) =>
  `h-7 min-w-7 px-1.5 flex items-center justify-center rounded border text-xs transition-colors ${
    active
      ? 'border-[#7c6ef6] bg-[rgba(124,110,246,0.18)] text-[#c4b5fd]'
      : 'border-[rgba(255,255,255,0.1)] text-[#a0a0b0] hover:text-[#e8e8f0] hover:border-[rgba(255,255,255,0.22)]'
  }`

/** B / I / U / S / fill / clear toolbar for the rich text editors (panel + canvas). */
export function RichTextToolbar({
  api,
  fillPopoverClassName,
}: {
  api: RichTextEditorApi
  /** Extra classes for the fill popover container (positioning per context) */
  fillPopoverClassName?: string
}) {
  const [fillOpen, setFillOpen] = useState(false)
  const { layer, rangeStyle } = api
  const weights = getFontWeights(layer.fontFamily)
  // Keep the editor focus/selection when clicking toolbar buttons
  const keepFocus = (e: React.MouseEvent) => e.preventDefault()

  return (
    <>
      <div className="flex items-center gap-1 flex-wrap" onMouseDown={keepFocus}>
        <button type="button" title="Bold" onMouseDown={keepFocus} onClick={api.toggleBold} className={toolbarBtnCls(api.boldActive)}>
          <span className="font-bold">B</span>
        </button>
        <button
          type="button"
          title="Italic"
          onMouseDown={keepFocus}
          onClick={() => api.applyPatch({ italic: toggleBoolPatch(rangeStyle.italic, layer.italic ?? false) })}
          className={toolbarBtnCls(rangeStyle.italic === true)}
        >
          <span className="italic">I</span>
        </button>
        <button
          type="button"
          title="Underline"
          onMouseDown={keepFocus}
          onClick={() => api.applyPatch({ underline: toggleBoolPatch(rangeStyle.underline, layer.underline ?? false) })}
          className={toolbarBtnCls(rangeStyle.underline === true)}
        >
          <span className="underline">U</span>
        </button>
        <button
          type="button"
          title="Strikethrough"
          onMouseDown={keepFocus}
          onClick={() => api.applyPatch({ strikethrough: toggleBoolPatch(rangeStyle.strikethrough, layer.strikethrough ?? false) })}
          className={toolbarBtnCls(rangeStyle.strikethrough === true)}
        >
          <span className="line-through">S</span>
        </button>
        <button
          type="button"
          title="Text color / gradient"
          onMouseDown={keepFocus}
          onClick={() => setFillOpen((v) => !v)}
          className={toolbarBtnCls(fillOpen)}
        >
          <span
            className="inline-block h-4 w-4 rounded border border-[rgba(255,255,255,0.25)]"
            style={{ background: fillToCss(api.swatchFill) }}
          />
        </button>
        <button
          type="button"
          title="Clear formatting in selection"
          onMouseDown={keepFocus}
          onClick={() => {
            setFillOpen(false)
            api.clearAll()
          }}
          disabled={!api.hasMarks}
          className={`${toolbarBtnCls(false)} disabled:opacity-35 disabled:cursor-not-allowed`}
        >
          ⌫
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <label className="text-[10px] text-[#6b6b7a] uppercase tracking-wider">Weight</label>
        <select
          value={rangeStyle.fontWeight === 'mixed' ? '' : rangeStyle.fontWeight}
          onChange={(e) => api.applyPatch({ fontWeight: Number(e.target.value) })}
          className="h-7 rounded-md border border-[rgba(255,255,255,0.1)] bg-[#0f0f13] px-2 text-xs text-[#e8e8f0]"
        >
          {rangeStyle.fontWeight === 'mixed' && <option value="">Mixed</option>}
          {weights.map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
      </div>

      {fillOpen && (
        <div className={`rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0d0d12] p-2.5 ${fillPopoverClassName ?? 'mt-2'}`}>
          <FillControl
            key={`${layer.id}-${typeof api.swatchFill === 'string' ? 'solid' : api.swatchFill.type}`}
            fill={api.swatchFill}
            onChange={(fill) => api.applyPatch({ fill })}
            onInteractionStart={pauseTemporal}
            onInteractionEnd={resumeTemporal}
          />
          <button
            type="button"
            onClick={() => api.applyPatch({ fill: null })}
            className="mt-2 text-[10px] text-[#6b6b7a] hover:text-[#e8e8f0] transition-colors"
          >
            ↺ Use layer fill
          </button>
        </div>
      )}
    </>
  )
}
