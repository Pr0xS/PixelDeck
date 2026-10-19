import { useAssetStore } from '@/store/assets'

/**
 * Scope the asset store to the project, inject CLI-provided assets under their
 * given keys (never re-hashed) and mark the store hydrated, so stageCapture's
 * hydration wait returns immediately in headless mode.
 */
export async function injectExportAssets(projectId: string, assets: Record<string, string>): Promise<void> {
  const store = useAssetStore.getState()
  await store.setActiveProject(projectId)
  for (const [key, dataUrl] of Object.entries(assets)) {
    useAssetStore.getState().addAsset(key, dataUrl)
  }
  useAssetStore.getState().setAssetsHydrated(true)
}
