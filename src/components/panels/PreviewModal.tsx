import { Fragment, useEffect } from 'react'
import { useEditorStore } from '@/store'
import { fillToCss } from '@/utils/gradients'
import type { BackgroundLayer } from '@/types'
import type { ThumbnailMap } from '@/hooks/useThumbnails'

interface PreviewModalProps {
  open: boolean
  onClose: () => void
  thumbnails: ThumbnailMap
  previewThumbs: ThumbnailMap
  isCapturingPreview: boolean
  captureAllHighRes: () => void
  cancelCapture: () => void
}

export function PreviewModal({
  open,
  onClose,
  thumbnails,
  previewThumbs,
  isCapturingPreview,
  captureAllHighRes,
  cancelCapture,
}: PreviewModalProps) {
  const project = useEditorStore((s) => s.project)
  const activeSlideGroupId = useEditorStore((s) => s.activeSlideGroupId)
  const activeLocale = useEditorStore((s) => s.activeLocale)
  const setActiveLocale = useEditorStore((s) => s.setActiveLocale)
  const setActiveSlideGroup = useEditorStore((s) => s.setActiveSlideGroup)

  const locales = project.settings.locales ?? [project.settings.defaultLocale]

  const totalSlides = project.slideGroups.reduce((n, g) => n + g.numSlides, 0)

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (open) captureAllHighRes()
    else cancelCapture()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

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
            {/* Locale selector */}
            {locales.length > 1 && (
              <div className="flex items-center gap-0.5 rounded-lg border border-[rgba(255,255,255,0.1)] p-1">
                {locales.map((locale) => (
                  <button
                    key={locale}
                    onClick={() => setActiveLocale(locale)}
                    className="rounded-md px-2.5 py-1 text-[11px] uppercase transition-colors"
                    style={{
                      background: activeLocale === locale ? 'rgba(124,110,246,0.26)' : 'transparent',
                      color: activeLocale === locale ? '#cbbfff' : '#7d7a90',
                      fontWeight: activeLocale === locale ? 700 : 500,
                    }}
                  >
                    {locale}
                  </button>
                ))}
              </div>
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
            <div className="flex min-w-max items-start gap-4">
              {flatSlides.map(({ group, slideIdx, globalNum: slideNum, isFirstInGroup, groupIndex }) => {
                const isActiveGroup = group.id === activeSlideGroupId
                const bgLayer = group.layers.find((l) => l.type === 'background') as BackgroundLayer | undefined
                const fallbackFill = fillToCss(bgLayer?.fill ?? group.background?.fill ?? '#171724')
                const slideW = Math.round((group.slideWidth / group.slideHeight) * SLIDE_H)
                const highResThumb = previewThumbs[group.id]?.[slideIdx]
                const navThumb = thumbnails[group.id]?.[slideIdx]

                return (
                  <Fragment key={`${group.id}-${slideIdx}`}>
                    {/* Divider between groups — no extra margin, sits in the natural gap-4 */}
                    {isFirstInGroup && groupIndex > 0 && (
                      <div
                        aria-hidden="true"
                        style={{
                          width: 1,
                          height: SLIDE_H,
                          background: 'rgba(255,255,255,0.07)',
                          flexShrink: 0,
                          alignSelf: 'flex-end',
                        }}
                      />
                    )}

                    <div className="flex flex-col" style={{ gap: 6 }}>
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
