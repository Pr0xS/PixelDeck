import { useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '@/store'
import { useAssetStore } from '@/store/assets'
import type { PhoneLayer, Layer } from '@/types'
import { fileToDataUrl } from '@/utils/files'
import { ColorField, SliderField } from '@/components/properties/PropertyControls'
import { OverrideDot } from '@/components/properties/OverrideDot'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { FileUploadButton } from '@/components/ui/FileUploadButton'
import { PHONE_MODELS, getPhoneSpec } from '@/assets/mockups/specs'
import {
  inputCls,
  labelCls,
  panelSectionCls,
  pauseTemporal,
  resumeTemporal,
} from '@/components/properties/panelConstants'

// ─── Locale Screenshot Row ────────────────────────────────────────────────────

function LocaleScreenshotRow({
  locale,
  previewSrc,
  onUpload,
  onClear,
}: {
  locale: string
  previewSrc?: string
  onUpload: (file: File) => Promise<void>
  onClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[#6b6b7a] uppercase w-8 shrink-0 font-mono">{locale}</span>
      {previewSrc ? (
        <>
          <img src={previewSrc} alt={locale} className="h-8 w-5 rounded object-cover border border-[rgba(255,255,255,0.12)] shrink-0" />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex-1 text-left text-[10px] text-[#7c6ef6] hover:text-[#9d90f8] transition-colors"
          >
            Change
          </button>
          <button
            type="button"
            onClick={onClear}
            className="text-[10px] text-[#f87171] hover:text-[#fca5a5] transition-colors shrink-0"
          >
            ✕
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex-1 text-left text-[10px] text-[#6b6b7a] hover:text-[#e8e8f0] border border-dashed border-[rgba(255,255,255,0.1)] rounded px-2 py-1 transition-colors hover:border-[rgba(124,110,246,0.4)]"
        >
          + Upload for {locale}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file) return
          await onUpload(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

// ─── PhoneProperties ──────────────────────────────────────────────────────────

export function PhoneProperties({ layer }: { layer: PhoneLayer }) {
  const { updateLayer, project, activeSlideGroupId, setLocaleOverride, clearLocaleOverride } = useEditorStore(
    useShallow((s) => ({
      updateLayer: s.updateLayer,
      project: s.project,
      activeSlideGroupId: s.activeSlideGroupId,
      setLocaleOverride: s.setLocaleOverride,
      clearLocaleOverride: s.clearLocaleOverride,
    }))
  )
  const upd = (patch: Partial<PhoneLayer>) => updateLayer(layer.id, patch as Partial<Layer>)
  const screenshotInputRef = useRef<HTMLInputElement>(null)
  const addAsset = useAssetStore((s) => s.addAsset)
  const assets = useAssetStore((s) => s.assets)  // reactive to IDB hydration

  const handleScreenshotFile = async (file: File) => {
    const dataUrl = await fileToDataUrl(file)
    addAsset(file.name, dataUrl)
    // Keep the inline data URL as a last-resort fallback. The asset store lives
    // in IndexedDB and can fail/hydrate late; without this, phone screenshots
    // can render blank in the editor, previews, or exports.
    upd({ screenshotPath: file.name, screenshotDataUrl: dataUrl })
  }

  const previewSrc = layer.screenshotPath ? assets[layer.screenshotPath]?.dataUrl ?? layer.screenshotDataUrl : layer.screenshotDataUrl
  const screenshotLabel = layer.screenshotPath ? layer.screenshotPath : layer.screenshotDataUrl ? 'Inline (legacy)' : null

  return (
    <div className="space-y-4">
      <div className={panelSectionCls}>
        <div className="flex items-center mb-1">
          <label className={labelCls + ' !mb-0'}>Phone Model</label>
          <OverrideDot layerId={layer.id} propKey="model" />
        </div>
        <select value={layer.model} onChange={(e) => upd({ model: e.target.value as PhoneLayer['model'] })} className={inputCls}>
          {PHONE_MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Position presets */}
      {(() => {
        const activeGroup = project.slideGroups.find((g) => g.id === activeSlideGroupId)
        const slideWidth = activeGroup?.slideWidth ?? 1290
        const slideHeight = activeGroup?.slideHeight ?? 2796
        const spec = getPhoneSpec(layer.model)
        const fw = spec.frameWidth * layer.scale
        const fh = spec.frameHeight * layer.scale
        const cx = (slideWidth - fw) / 2

        const presets = [
          { label: 'Center',   patch: { x: cx, y: (slideHeight - fh) / 2, rotation: 0 } },
          { label: 'Hero',     patch: { x: cx, y: Math.round(slideHeight * 0.05), rotation: 0 } },
          { label: 'Bleed',    patch: { x: cx, y: Math.round(slideHeight * 0.38), rotation: 0 } },
          { label: '↺ Tilt',  patch: { x: cx, y: Math.round(slideHeight * 0.18), rotation: -10 } },
          { label: 'Tilt ↻',  patch: { x: cx, y: Math.round(slideHeight * 0.18), rotation: 10 } },
        ]

        return (
          <div className={panelSectionCls}>
            <label className={labelCls}>Composition</label>
            <div className="grid grid-cols-5 gap-1">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => upd(preset.patch as Partial<PhoneLayer>)}
                  className="rounded border border-[rgba(255,255,255,0.1)] px-1 py-1.5 text-[10px] text-[#8f90a3] hover:border-[rgba(124,110,246,0.5)] hover:text-[#e8e8f0] hover:bg-[rgba(255,255,255,0.04)] transition-colors leading-tight text-center"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )
      })()}

      <div className={panelSectionCls}>
        {/* Status bar toggle */}
        <div className="mb-3 flex items-center justify-between">
          <label className={labelCls + ' !mb-0'}>Status Bar</label>
          <ToggleSwitch
            checked={layer.showStatusBar ?? true}
            onChange={(checked) => upd({ showStatusBar: checked })}
            ariaLabel="Toggle status bar"
          />
        </div>
        {/* Controls — only shown when status bar is on */}
        {(layer.showStatusBar ?? true) && (
          <div className="space-y-3">
            {/* Background type */}
            <div>
              <label className={labelCls}>Background</label>
              <SegmentedControl
                value={layer.statusBarBg ?? 'transparent'}
                options={[
                  { value: 'transparent', label: 'Transparent' },
                  { value: 'solid', label: 'Solid' },
                ]}
                onChange={(b) => upd({ statusBarBg: b })}
                className="grid grid-cols-2 gap-2"
                optionClassName="rounded-lg border px-3 py-2 text-xs transition-colors"
              />
            </div>

            {/* Colour picker — only for solid */}
            {(layer.statusBarBg ?? 'transparent') === 'solid' && (
              <div>
                <label className={labelCls}>Color</label>
                <ColorField
                  value={layer.statusBarColor ?? '#000000'}
                  onChange={(v) => upd({ statusBarColor: v })}
                  onInteractionStart={pauseTemporal}
                  onInteractionEnd={resumeTemporal}
                />
              </div>
            )}

            {/* Icon theme */}
            <div>
              <label className={labelCls}>Icons</label>
              <SegmentedControl
                value={layer.statusBarTheme ?? 'dark'}
                options={[
                  { value: 'dark', label: '🌙 Dark' },
                  { value: 'light', label: '☀️ Light' },
                ]}
                onChange={(t) => upd({ statusBarTheme: t })}
                className="grid grid-cols-2 gap-2"
                optionClassName="rounded-lg border px-3 py-2 text-xs transition-colors"
              />
            </div>
          </div>
        )}
      </div>

      <div className={panelSectionCls}>
        <div className="mb-1 flex items-center justify-between">
          <label className={labelCls + ' !mb-0'}>Scale</label>
          <span className="text-xs text-[#e8e8f0]">{layer.scale.toFixed(2)}×</span>
        </div>
        <input type="range" min={0.5} max={4} step={0.05} value={layer.scale} onChange={(e) => upd({ scale: Number(e.target.value) })} onMouseDown={pauseTemporal} onMouseUp={resumeTemporal} className="w-full accent-[#7c6ef6]" />
      </div>

      <div className={panelSectionCls}>
        <label className={labelCls}>Screenshot</label>
        <FileUploadButton
          ref={screenshotInputRef}
          variant="dropzone"
          accept="image/*"
          ariaLabel="Upload screenshot"
          className="rounded-xl border border-dashed border-[rgba(255,255,255,0.14)] bg-[#0f0f13] p-4 text-center transition-colors hover:border-[rgba(124,110,246,0.55)] cursor-pointer"
          onFiles={async (files) => {
            const file = files[0]
            if (!file) return
            await handleScreenshotFile(file)
          }}
        >
          {previewSrc ? <img src={previewSrc} alt="Screenshot" className="mx-auto max-h-24 rounded-lg object-contain" /> : <span className="text-xs text-[#6b6b7a]">Click or drag to upload screenshot</span>}
        </FileUploadButton>
        {screenshotLabel && <p className="mt-2 truncate text-[10px] text-[#6b6b7a]">{screenshotLabel}</p>}
      </div>

      <div className={panelSectionCls}>
        <label className={labelCls}>Fit</label>
        <SegmentedControl
          value={layer.screenshotFit}
          options={(['cover', 'contain', 'fill'] as const).map((fit) => ({
            value: fit,
            label: fit.charAt(0).toUpperCase() + fit.slice(1),
          }))}
          onChange={(fit) => upd({ screenshotFit: fit })}
        />
      </div>

      <div className={panelSectionCls}>
        <SliderField label="Offset X" value={layer.screenshotOffsetX} min={-500} max={500} unit="px" onChange={(v) => upd({ screenshotOffsetX: v })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />
        <SliderField label="Offset Y" value={layer.screenshotOffsetY} min={-500} max={500} unit="px" onChange={(v) => upd({ screenshotOffsetY: v })} onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} className="!mb-0" />
      </div>

      {/* Screenshot border */}
      <div className={panelSectionCls}>
        <div className="mb-3 flex items-center justify-between">
          <label className={labelCls + ' !mb-0'}>Border</label>
          <ToggleSwitch
            checked={Boolean(layer.border)}
            onChange={(checked) => upd({ border: checked ? { color: '#FFFFFF', width: 2, opacity: 0.5 } : undefined })}
            ariaLabel="Toggle screenshot border"
          />
        </div>
        {layer.border && (
          <div className="space-y-3">
            <ColorField
              value={layer.border.color}
              onChange={(v) => upd({ border: { ...layer.border!, color: v } })}
              onInteractionStart={pauseTemporal}
              onInteractionEnd={resumeTemporal}
            />
            <SliderField label="Width" value={layer.border.width} min={1} max={30} unit="px"
              onChange={(v) => upd({ border: { ...layer.border!, width: v } })}
              onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} />
            <SliderField label="Opacity" value={Math.round(layer.border.opacity * 100)} min={0} max={100} unit="%"
              onChange={(v) => upd({ border: { ...layer.border!, opacity: v / 100 } })}
              onInteractionStart={pauseTemporal} onInteractionEnd={resumeTemporal} className="!mb-0" />
          </div>
        )}
      </div>

      {/* Per-locale screenshots */}
      {(() => {
        const locales = project.settings.locales ?? [project.settings.defaultLocale]
        const nonDefaultLocales = locales.filter((l) => l !== project.settings.defaultLocale)
        if (nonDefaultLocales.length === 0) return null
        return (
          <div className={panelSectionCls}>
            <label className={labelCls}>Localized Screenshots</label>
            <div className="space-y-2">
              {nonDefaultLocales.map((locale) => {
                const override = layer.localeOverrides?.[locale]
                const path = override?.screenshotPath
                const previewSrc = path ? assets[path]?.dataUrl ?? override?.screenshotDataUrl : override?.screenshotDataUrl
                return (
                  <LocaleScreenshotRow
                    key={locale}
                    locale={locale}
                    previewSrc={previewSrc}
                    onUpload={async (file) => {
                      const dataUrl = await fileToDataUrl(file)
                      addAsset(file.name, dataUrl)
                      setLocaleOverride(activeSlideGroupId, layer.id, locale, { screenshotPath: file.name, screenshotDataUrl: dataUrl })
                    }}
                    onClear={() => clearLocaleOverride(activeSlideGroupId, layer.id, locale)}
                  />
                )
              })}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
