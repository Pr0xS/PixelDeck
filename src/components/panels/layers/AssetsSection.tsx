import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { RefObject } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAssetStore } from '@/store/assets'
import { fileToDataUrl } from '@/utils/files'
import type { Layer } from '@/types'

interface AssetsSectionProps {
  /** Forwarded ref so the parent's insert toolbar can trigger image import */
  imageInputRef: RefObject<HTMLInputElement | null>
  selectedLayer: Layer | null
  addImage: (filename: string, width: number, height: number) => void
  updateLayer: (layerId: string, patch: Partial<Layer>) => void
}

export function AssetsSection({ imageInputRef, selectedLayer, addImage, updateLayer }: AssetsSectionProps) {
  const { addAsset, removeAsset, loadFolder, loadFiles, assets } = useAssetStore(
    useShallow((s) => ({
      addAsset: s.addAsset,
      removeAsset: s.removeAsset,
      loadFolder: s.loadFolder,
      loadFiles: s.loadFiles,
      assets: s.assets,
    })),
  )

  const screenshotsInputRef = useRef<HTMLInputElement>(null)
  const [assetsCollapsed, setAssetsCollapsed] = useState(false)
  const [assetsModalOpen, setAssetsModalOpen] = useState(false)

  const assetEntries = Object.values(assets).sort((a, b) => a.filename.localeCompare(b.filename))
  const assetCount = assetEntries.length

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const dataUrl = await fileToDataUrl(file)
    addAsset(file.name, dataUrl)
    const img = new Image()
    img.onload = () => addImage(file.name, img.width, img.height)
    img.src = dataUrl
    e.target.value = ''
  }

  const handleScreenshotFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((file) => file.type.startsWith('image/'))
    if (files.length > 0) await loadFiles(files)
    e.target.value = ''
  }

  const handleImportScreenshotFolder = async () => {
    try {
      const count = await loadFolder()
      alert(`Imported ${count} screenshot asset(s).`)
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string }
      if (err?.name === 'AbortError') return
      screenshotsInputRef.current?.click()
    }
  }

  const getImageSize = (dataUrl: string) =>
    new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve({ width: img.width, height: img.height })
      img.onerror = () => reject(new Error('Could not load asset image'))
      img.src = dataUrl
    })

  const addAssetToCanvas = async (filename: string, dataUrl: string) => {
    const { width, height } = await getImageSize(dataUrl)
    addImage(filename, width, height)
  }

  const handleUseAssetForSelection = async (filename: string, dataUrl: string) => {
    if (!selectedLayer) {
      await addAssetToCanvas(filename, dataUrl)
      return
    }

    if (selectedLayer.type === 'phone') {
      updateLayer(selectedLayer.id, { screenshotPath: filename, screenshotDataUrl: undefined } as Partial<Layer>)
      return
    }

    if (selectedLayer.type === 'image') {
      const { width, height } = await getImageSize(dataUrl)
      updateLayer(selectedLayer.id, { src: filename, width, height } as Partial<Layer>)
      return
    }

    await addAssetToCanvas(filename, dataUrl)
  }

  const getAssetPrimaryAction = () => (
    selectedLayer?.type === 'phone'
      ? 'Use as phone screenshot'
      : selectedLayer?.type === 'image'
        ? 'Replace selected image'
        : 'Add image to canvas'
  )

  const handleAssetDragStart = (event: React.DragEvent, filename: string) => {
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData('application/x-pixeldeck-asset', filename)
    event.dataTransfer.setData('text/plain', filename)
  }

  const renderAssetCard = (asset: (typeof assetEntries)[number], large = false) => {
    const primaryAction = getAssetPrimaryAction()
    return (
      <div
        key={asset.filename}
        draggable
        onDragStart={(event) => handleAssetDragStart(event, asset.filename)}
        className="group overflow-hidden rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#111118] transition-colors hover:border-[rgba(124,110,246,0.45)]"
        title={`${asset.filename} — drag to canvas or click to use`}
      >
        <button
          type="button"
          draggable
          aria-label={`${primaryAction}: ${asset.filename}`}
          onDragStart={(event) => handleAssetDragStart(event, asset.filename)}
          onClick={() => { void handleUseAssetForSelection(asset.filename, asset.dataUrl) }}
          className="block w-full"
          title={primaryAction}
        >
          <div className={`relative bg-black/25 ${large ? 'aspect-[9/16]' : 'aspect-[4/3]'}`}>
            <img
              src={asset.dataUrl}
              alt={asset.filename}
              draggable={false}
              className="h-full w-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-1.5 pb-1 pt-5 text-left text-[9px] text-white opacity-0 transition-opacity group-hover:opacity-100">
              Drag to canvas · {primaryAction}
            </div>
          </div>
        </button>
        <div className={`flex items-center gap-1 px-1.5 py-1 ${large ? 'py-2' : ''}`}>
          <span className={`min-w-0 flex-1 truncate text-[#9b9bad] ${large ? 'text-xs' : 'text-[9px]'}`}>{asset.filename}</span>
          <button
            type="button"
            aria-label={`Add ${asset.filename} to canvas`}
            onClick={() => { void addAssetToCanvas(asset.filename, asset.dataUrl) }}
            className="rounded px-1 text-[10px] text-[#a89cf6] hover:bg-[rgba(124,110,246,0.16)] hover:text-white"
            title="Add image to canvas"
          >
            +
          </button>
          <button
            type="button"
            aria-label={`Remove ${asset.filename}`}
            onClick={() => removeAsset(asset.filename)}
            className="rounded px-1 text-[10px] text-[#7f8094] hover:bg-[rgba(248,113,113,0.16)] hover:text-[#f87171]"
            title="Remove asset"
          >
            ×
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />

      <div className="mt-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-2">
        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label={assetsCollapsed ? 'Show assets' : 'Minimize assets'}
            onClick={() => setAssetsCollapsed((value) => !value)}
            className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6b6b7a] hover:text-[#e8e8f0]"
            title={assetsCollapsed ? 'Show assets' : 'Minimize assets'}
          >
            <span className="tracking-normal">{assetsCollapsed ? '▸' : '▾'}</span>
            Assets
          </button>
          <div className="flex items-center gap-1">
            <span className="rounded-full bg-[rgba(124,110,246,0.16)] px-2 py-0.5 text-[10px] text-[#a89cf6]">{assetCount}</span>
            <button
              type="button"
              aria-label="Open large asset browser"
              onClick={() => setAssetsModalOpen(true)}
              disabled={assetEntries.length === 0}
              className="rounded px-1.5 py-0.5 text-[10px] text-[#8f90a3] hover:bg-[rgba(255,255,255,0.06)] hover:text-white disabled:opacity-35 disabled:cursor-not-allowed"
              title="Open large asset browser"
            >
              ⛶
            </button>
          </div>
        </div>
        {!assetsCollapsed && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-label="Import screenshot files"
                onClick={() => screenshotsInputRef.current?.click()}
                className="rounded-lg border border-[rgba(255,255,255,0.08)] px-2 py-1.5 text-[10px] text-[#b0b0c4] transition-colors hover:border-[rgba(124,110,246,0.35)] hover:bg-[rgba(124,110,246,0.12)] hover:text-[#e8e8f0]"
                title="Import screenshot files into the asset library"
              >
                Import Files
              </button>
              <button
                type="button"
                aria-label="Import screenshot folder"
                onClick={handleImportScreenshotFolder}
                className="rounded-lg border border-[rgba(255,255,255,0.08)] px-2 py-1.5 text-[10px] text-[#b0b0c4] transition-colors hover:border-[rgba(124,110,246,0.35)] hover:bg-[rgba(124,110,246,0.12)] hover:text-[#e8e8f0]"
                title="Import a screenshots folder when the browser supports it; falls back to file import"
              >
                Import Folder
              </button>
            </div>
            <input ref={screenshotsInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleScreenshotFiles} />

            {assetEntries.length > 0 ? (
              <div className="mt-3 max-h-44 overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-2">
                  {assetEntries.map((asset) => renderAssetCard(asset))}
                </div>
              </div>
            ) : (
              <p className="mt-3 rounded-lg border border-dashed border-[rgba(255,255,255,0.08)] px-2 py-3 text-center text-[10px] leading-4 text-[#6b6b7a]">
                Imported screenshots will appear here.
              </p>
            )}
          </>
        )}
      </div>

      {assetsModalOpen && createPortal(
        <div className="pointer-events-none fixed inset-0 z-[1000]">
          <div
            className="pointer-events-auto absolute bottom-24 left-60 top-14 flex w-[360px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#18181f]/96 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/8 px-4 py-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7c6ef6]">Asset Browser</div>
                <div className="mt-1 text-xs leading-5 text-[#9b9bad]">Drag to the visible canvas, or click to use with the current selection.</div>
              </div>
              <button
                type="button"
                aria-label="Close asset browser"
                onClick={() => setAssetsModalOpen(false)}
                className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-xs text-[#d7d7e3] hover:border-[#7c6ef6]/50 hover:bg-[#7c6ef6]/10 hover:text-white"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto p-3">
              <div className="grid grid-cols-2 gap-3">
                {assetEntries.map((asset) => renderAssetCard(asset, true))}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
