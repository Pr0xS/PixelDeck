import type { Layer, LocaleContent, Project } from '@/types'
import { isDataUrl } from './assetKey'
import { useAssetStore } from '@/store/assets'

export interface MissingAsset {
  ref: string
  name: string
  where: string
}

type Resolver = (ref: string) => string | undefined

/** Image refs carried by a layer's own fields (flat, format overrides, locale content). */
function layerRefs(layer: Layer): { ref: string; field: string }[] {
  const out: { ref: string; field: string }[] = []
  const add = (ref: unknown, field: string) => {
    if (typeof ref === 'string' && ref) out.push({ ref, field })
  }
  const fromBag = (bag: Partial<Record<string, unknown>> | undefined, scope: string) => {
    if (!bag) return
    add(bag.screenshotPath, `${scope}screenshotPath`)
    add(bag.src, `${scope}src`)
    add(bag.imageRef, `${scope}imageRef`)
    add(bag.logoRef, `${scope}logoRef`)
  }
  fromBag(layer as unknown as Record<string, unknown>, '')
  for (const [format, patch] of Object.entries(layer.formatOverrides ?? {})) {
    fromBag(patch as Record<string, unknown>, `format ${format} `)
  }
  for (const [locale, content] of Object.entries(layer.localeContent ?? {} as Record<string, LocaleContent>)) {
    fromBag(content as Record<string, unknown>, `locale ${locale} `)
  }
  return out
}

/**
 * Every image ref in the project that cannot be resolved from the asset store.
 * Walks layers (incl. group children), localeContent, formatOverrides,
 * backgrounds, brand logos and `settings.brandLogoRef`. Deduped by ref+location.
 */
export function findMissingAssets(
  project: Project,
  resolve: Resolver = (ref) => useAssetStore.getState().resolveAsset(ref),
): MissingAsset[] {
  const missing: MissingAsset[] = []
  const seen = new Set<string>()
  const check = (ref: string, where: string) => {
    if (isDataUrl(ref) || resolve(ref)) return
    const key = `${ref}\u0000${where}`
    if (seen.has(key)) return
    seen.add(key)
    missing.push({ ref, name: project.assetManifest?.[ref]?.name ?? ref, where })
  }
  const walk = (layers: Layer[], groupName: string) => {
    for (const layer of layers) {
      for (const { ref, field } of layerRefs(layer)) {
        check(ref, `${groupName} › ${layer.name} (${field})`)
      }
      if (layer.type === 'group') walk(layer.children, groupName)
    }
  }
  for (const group of project.slideGroups) walk(group.layers, group.name)
  const logo = project.settings.brandLogoRef
  if (logo) check(logo, 'Brand kit logo')
  return missing
}
