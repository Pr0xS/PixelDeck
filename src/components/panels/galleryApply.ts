import type { Template } from '@/types'
import type { ImportAsset } from '@/utils/projectZip'
import type { TemplateBundle, TemplateManifestEntry } from '@/store/templates'

export type GalleryApplyMode = 'new' | 'append'

export interface GalleryApplyDeps {
  fetchBundle: (entry: TemplateManifestEntry) => Promise<TemplateBundle>
  createProject: (template: Template, assets: ImportAsset[]) => Promise<void>
  addSlides: (template: Template, assets: ImportAsset[]) => void
  setApplying: (key: string | null) => void
  setError: (message: string | null) => void
  onDone: () => void
}

/**
 * Apply a gallery template. The busy flag is ALWAYS cleared (the modal stays mounted
 * after a successful apply), and failures are surfaced instead of swallowed.
 */
export async function applyGalleryTemplate(
  entry: TemplateManifestEntry,
  mode: GalleryApplyMode,
  deps: GalleryApplyDeps,
): Promise<void> {
  deps.setApplying(`${mode}:${entry.slug}`)
  deps.setError(null)
  try {
    const { template, assets } = await deps.fetchBundle(entry)
    if (mode === 'new') await deps.createProject(template, assets)
    else deps.addSlides(template, assets)
    deps.onDone()
  } catch (err) {
    console.warn('[PixelDeck] Template could not be applied', err)
    deps.setError(`Could not load "${entry.name}": ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    deps.setApplying(null)
  }
}
