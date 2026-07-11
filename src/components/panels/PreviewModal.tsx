import { Fragment, useEffect, useRef } from 'react'
import { useEditorStore } from '@/store'
import { fillToCss } from '@/utils/gradients'
import { getLanguageName } from '@/utils/locale'
import { getExportTargets, getFormatCanvasDims, getFormatLabel, getProjectBaseFormat } from '@/utils/canvasFormats'
import type { BackgroundLayer, CanvasFormatId } from '@/types'
import type { ThumbnailMap } from '@/hooks/useThumbnails'
import { DEFAULT_PANO_COMPENSATION_PX, MAX_PANO_COMPENSATION_PX, normalizePanoCompensationPx } from '@/utils/panoGeometry'

interface PreviewModalProps {
  open: boolean
  onClose: () => void
  thumbnails: ThumbnailMap
  previewThumbs: ThumbnailMap
  isCapturingPreview: boolean
  captureAllHighRes: (options?: { panoCompensationPx?: number; panoCompensate?: boolean }) => void
  cancelCapture: () => void
  /** Locale to preview when the modal opens (defaults to the current editor locale). */
  initialLocale?: string
}

export function PreviewModal({
  open,
  onClose,
  thumbnails,
  previewThumbs,
  isCapturingPreview,
  captureAllHighRes,
  cancelCapture,
  initialLocale,
}: PreviewModalProps) {
  const project = useEditorStore((s) => s.project)
  const activeSlideGroupId = useEditorStore((s) => s.activeSlideGroupId)
  const activeLocale = useEditorStore((s) => s.activeLocale)
  const activeCanvasFormat = useEditorStore((s) => s.activeCanvasFormat)
  const setActiveSlideGroup = useEditorStore((s) => s.setActiveSlideGroup)
  const panoSettings = useEditorStore((s) => s.project.settings.pano ?? { gapPx: 24, compensate: false })
  const setPanoRenderOverride = useEditorStore((s) => s.setPanoRenderOverride)
  const updatePanoSettings = useEditorStore((s) => s.updatePanoSettings)

  const locales = project.settings.locales ?? [project.settings.defaultLocale]
  const platformFormats = getExportTargets(project)

  const totalSlides = project.slideGroups.reduce((n, g) => n + g.numSlides, 0)

  // Snapshot of the editor state at open time, restored on close — the preview
  // is ephemeral and must never leave the editor in a non-base locale/format.
  const restoreRef = useRef<{
    locale: string
    format: CanvasFormatId
  } | null>(null)
  const hasPanoGroups = project.slideGroups.some((g) => g.numSlides > 1)

  const recapturePreview = () => {
    captureAllHighRes({ panoCompensationPx: panoSettings.gapPx, panoCompensate: panoSettings.compensate })
  }

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (open) {
      const s = useEditorStore.getState()
      restoreRef.current = {
        locale: s.activeLocale,
        format: s.activeCanvasFormat,
      }
      if (initialLocale) s.setActiveLocale(initialLocale)
      // Ensure a platform (export) format is active — the editor may be on Base.
      const formats = getExportTargets(s.project)
      if (!formats.includes(s.activeCanvasFormat) && formats.length > 0) {
        s.setActiveCanvasFormat(formats[0])
      }
      captureAllHighRes({ panoCompensationPx: panoSettings.gapPx, panoCompensate: panoSettings.compensate })
    } else {
      cancelCapture()
      setPanoRenderOverride(null)
      if (restoreRef.current) {
        const s = useEditorStore.getState()
        s.setActiveLocale(restoreRef.current.locale)
        s.setActiveCanvasFormat(restoreRef.current.format)
        restoreRef.current = null
      }
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectLocale = (locale: string) => {
    if (locale === activeLocale) return
    useEditorStore.getState().setActiveLocale(locale)
    recapturePreview()
  }

  const selectFormat = (format: CanvasFormatId) => {
    if (format === activeCanvasFormat) return
    useEditorStore.getState().setActiveCanvasFormat(format)
    recapturePreview()
  }

  if (!open) return null

  // Build flat list once: each entry knows its global number
  type FlatSlide = {
    group: (typeof project.slideGroups)[number]
    slideIdx: number
    globalNum: number
    isFirstInGroup: boolean
    groupIndex: number
  }
  const flatSlides: FlatSlide[] = []
  let num = 0
  project.slideGroups.forEach((group, groupIndex) => {
    for (let i = 0; i < group.numSlides; i++) {
      num++
      flatSlides.push({
        group,
        slideIdx: i,
        globalNum: num,
        isFirstInGroup: i === 0,
    
        groupIndex,
      })
    }
  })

  const SLIDE_H = 400

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[rgba(0,0,0,0.82)] p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-[90vw] flex-col overflow-hidden rounded-xl border bg-[#18181f] shadow-2xl"
        style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(255,255,255,0.08)] px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-[#f3f0ff]">Preview</h2>
            {isCapturingPreview ? (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1 w-32 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
                  <div className="h-full animate-pulse bg-[#7c6ef6]" style={{ width: '40%' }} />
                </div>
                <span className="text-xs text-[#7c6ef6]">Rendering…</span>
              </div>
            ) : (
              <p className="mt-1 text-xs text-[#7d7a90]">
                {totalSlides} slide{totalSlides !== 1 ? 's' : ''} · {project.slideGroups.length} group{project.slideGroups.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Platform selector */}
            {platformFormats.length > 1 && (
              <div className="flex items-center gap-0.5 rounded-lg border border-[rgba(255,255,255,0.1)] p-1">
                {platformFormats.map((format) => {
                  const selected = activeCanvasFormat === format
                  return (
                    <button
                      key={format}
                      onClick={() => selectFormat(format)}
                      className="rounded-md px-2.5 py-1 text-[11px] transition-colors"
                      style={{
                        background: selected ? 'rgba(124,110,246,0.26)' : 'transparent',
                        color: selected ? '#cbbfff' : '#7d7a90',
                        fontWeight: selected ? 700 : 500,
                      }}
                    >
                      {getFormatLabel(format, project.settings.customFormats)}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Locale selector */}
            {locales.length > 1 && (
              <div className="flex items-center gap-0.5 rounded-lg border border-[rgba(255,255,255,0.1)] p-1">
                {locales.map((locale) => {
                  const selected = activeLocale === locale
                  return (
                    <button
                      key={locale}
                      onClick={() => selectLocale(locale)}
                      title={getLanguageName(locale)}
                      className="rounded-md px-2.5 py-1 text-[11px] transition-colors"
                      style={{
                        background: selected ? 'rgba(124,110,246,0.26)' : 'transparent',
                        color: selected ? '#cbbfff' : '#7d7a90',
                        fontWeight: selected ? 700 : 500,
                      }}
                    >
                      {getLanguageName(locale)}
                    </button>
                  )
                })}
              </div>
            )}

            {hasPanoGroups && (
              <label className="flex items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.1)] px-2 py-1 text-[11px] text-[#8f90a3]">
                <input
                  type="checkbox"
                  checked={panoSettings.compensate}
                  onChange={(e) => {
                    const next = e.target.checked
                    updatePanoSettings({ compensate: next })
                    captureAllHighRes({ panoCompensationPx: panoSettings.gapPx, panoCompensate: next })
                  }}
                  className="h-3 w-3 accent-[#7c6ef6]"
                />
                <span>Compensate</span>
                <input
                  type="number"
                  min={0}
                  max={MAX_PANO_COMPENSATION_PX}
                  value={panoSettings.gapPx || DEFAULT_PANO_COMPENSATION_PX}
                  onChange={(e) => updatePanoSettings({ gapPx: parseInt(e.target.value, 10) || 0 })}
                  onBlur={() => {
                    const next = normalizePanoCompensationPx(panoSettings.gapPx)
                    updatePanoSettings({ gapPx: next || DEFAULT_PANO_COMPENSATION_PX })
                    captureAllHighRes({ panoCompensationPx: next || DEFAULT_PANO_COMPENSATION_PX, panoCompensate: panoSettings.compensate })
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                    e.stopPropagation()
                  }}
                  className="w-14 rounded border border-[rgba(255,255,255,0.12)] bg-[#0f0f13] px-1 py-0.5 text-right text-[#e8e8f0] disabled:opacity-40"
                />
                <span>px</span>
              </label>
            )}

            <button
              onClick={onClose}
              className="rounded-md px-2 py-1 text-xl leading-none text-[#8d89a3] transition-colors hover:text-white"
              aria-label="Close preview"
            >
              ×
            </button>
          </div>
        </div>

        {/* Filmstrip */}
        <div className="overflow-y-auto px-6 py-6">
          <div className="overflow-x-auto pb-2">
            <div className="flex min-w-max items-start" style={{ gap: 0 }}>
              {flatSlides.map(({ group, slideIdx, globalNum: slideNum, isFirstInGroup, groupIndex }) => {
                const isActiveGroup = group.id === activeSlideGroupId
                const bgLayer = group.layers.find((l) => l.type === 'background') as BackgroundLayer | undefined
                const fallbackFill = fillToCss(bgLayer?.fill ?? group.background?.fill ?? '#171724')
                // Use format-specific dims so the container aspect ratio matches the captured image.
                const baseFormat = getProjectBaseFormat(project)
                const dims = getFormatCanvasDims(group, activeCanvasFormat, baseFormat, project.settings.customFormats)
                const slideW = Math.round((dims.width / dims.height) * SLIDE_H)
                const isPanoContinuation = !isFirstInGroup && group.numSlides > 1
                const seamGap = isPanoContinuation && panoSettings.compensate
                  ? Math.round((panoSettings.gapPx * SLIDE_H) / dims.height)
                  : 0
                const highResThumb = previewThumbs[group.id]?.[slideIdx]
                const navThumb = thumbnails[group.id]?.[slideIdx]

                return (
                  <Fragment key={`${group.id}-${slideIdx}`}>
                    {/* Divider between groups — carries the 16px inter-group spacing (container gap is 0) */}
                    {isFirstInGroup && groupIndex > 0 && (
                      <div
                        aria-hidden="true"
                        style={{
                          width: 1,
                          height: SLIDE_H,
                          background: 'rgba(255,255,255,0.07)',
                          flexShrink: 0,
                          alignSelf: 'flex-end',
                          marginLeft: 16,
                          marginRight: 16,
                        }}
                      />
                    )}

                    <div className="flex flex-col" style={{ gap: 6, marginLeft: seamGap }}>
                      {/* Group name label — only on first slide of each group */}
                      <div style={{ height: 16 }}>
                        {isFirstInGroup && (
                          <div className="flex items-center gap-1.5">
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 500,
                                textTransform: 'uppercase',
                                letterSpacing: '0.18em',
                                color: isActiveGroup ? '#9b8fff' : '#5a566e',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {group.name}
                            </span>
                            {isActiveGroup && (
                              <span
                                style={{
                                  fontSize: 9,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.12em',
                                  color: '#9b8fff',
                                  border: '1px solid rgba(124,110,246,0.4)',
                                  borderRadius: 999,
                                  padding: '1px 6px',
                                }}
                              >
                                active
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Slide card */}
                      <button
                        className="group/slide shrink-0 flex flex-col gap-0 text-left"
                        onClick={() => { setActiveSlideGroup(group.id); onClose() }}
                      >
                        <div
                          className="overflow-hidden rounded-2xl border transition-all duration-200 group-hover/slide:scale-[1.02] group-hover/slide:border-[rgba(124,110,246,0.65)]"
                          style={{
                            width: slideW,
                            height: SLIDE_H,
                            borderColor: isActiveGroup ? 'rgba(124,110,246,0.65)' : 'rgba(255,255,255,0.1)',
                            background:
                              highResThumb || navThumb
                                ? '#0f0f13'
                                : `linear-gradient(160deg, rgba(124,110,246,0.15), rgba(15,15,19,0.3)), ${fallbackFill}`,
                            boxShadow: isActiveGroup
                              ? '0 0 0 1px rgba(124,110,246,0.3), 0 12px 48px rgba(0,0,0,0.55)'
                              : '0 8px 32px rgba(0,0,0,0.4)',
                          }}
                        >
                          {highResThumb ? (
                            <img
                              src={highResThumb}
                              alt={`Slide ${slideNum}`}
                              className="h-full w-full object-cover"
                            />
                          ) : navThumb ? (
                            <img
                              src={navThumb}
                              alt={`Slide ${slideNum}`}
                              className="h-full w-full object-cover"
                              style={{ filter: isCapturingPreview ? 'blur(0.5px)' : 'none' }}
                            />
                          ) : (
                            <div className="h-full w-full animate-pulse bg-[rgba(124,110,246,0.07)]" />
                          )}
                        </div>

                        {/* Slide number label */}
                        <span
                          style={{
                            fontSize: 11,
                            color: isActiveGroup ? '#9b8fff' : '#5a566e',
                            marginTop: 6,
                            paddingLeft: 2,
                            lineHeight: 1,
                          }}
                        >
                          {slideNum}
                        </span>
                      </button>
                    </div>
                  </Fragment>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
