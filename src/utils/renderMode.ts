import { create } from 'zustand'

/**
 * Distinguishes editor rendering from export rendering. Missing-image
 * placeholders show a "Missing: <name>" label only in the editor; during a
 * GUI export capture (flag below) or in the headless CLI render
 * (`window.__EXPORT_CONFIG__`) they render as a flat neutral rect with no text,
 * so debug text is never baked into exported PNGs.
 */
interface ExportCaptureState {
  active: boolean
  setActive: (active: boolean) => void
}

export const useExportCaptureStore = create<ExportCaptureState>((set) => ({
  active: false,
  setActive: (active) => set({ active }),
}))

export function isHeadlessExport(): boolean {
  return typeof window !== 'undefined' && Boolean((window as { __EXPORT_CONFIG__?: unknown }).__EXPORT_CONFIG__)
}

/** True when placeholder labels may be drawn (editor only). */
export function useShowPlaceholderLabels(): boolean {
  const capturing = useExportCaptureStore((s) => s.active)
  return !capturing && !isHeadlessExport()
}
