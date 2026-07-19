import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

// ─── Pure locale manifest logic (mirrors src/utils/locale.ts) ─────────────────

export function buildLocaleManifest(project) {
  const { defaultLocale = 'en', locales = [defaultLocale] } = project.settings
  const nonDefaultLocales = locales.filter((l) => l !== defaultLocale)

  const groups = project.slideGroups.map((group) => {
    const layers = []
    collectManifestEntries(group.layers, group.name, nonDefaultLocales, defaultLocale, layers)
    return { name: group.name, id: group.id, layers }
  })

  return { project: project.name, defaultLocale, locales, groups }
}

function collectManifestEntries(layers, groupName, locales, defaultLocale, result) {
  for (const layer of layers) {
    if (layer.type === 'group') {
      collectManifestEntries(layer.children, groupName, locales, defaultLocale, result)
      continue
    }
    if (layer.type !== 'text' && layer.type !== 'phone' && layer.type !== 'image') continue

    const defaultContent = layer.localeContent?.[defaultLocale]
    const defaultPatch =
      layer.type === 'text'
        ? {
            text: defaultContent?.text ?? layer.text,
            ...((defaultContent?.spans ?? layer.spans) ? { spans: defaultContent?.spans ?? layer.spans } : {}),
          }
        : layer.type === 'phone'
          ? { screenshotPath: defaultContent?.screenshotPath ?? layer.screenshotPath }
          : { src: '[data-uri-omitted]' }  // don't dump base64 in the manifest

    const overrides = {}
    for (const locale of locales) {
      overrides[locale] = layer.localeContent?.[locale] ?? layer.localeOverrides?.[locale] ?? null
    }

    result.push({
      ref: `${groupName}/${layer.name}`,
      id: layer.id,
      name: layer.name,
      type: layer.type,
      default: defaultPatch,
      overrides,
    })
  }
}

export function applyLocaleManifest(project, manifest) {
  const overrideMap = new Map()
  for (const group of manifest.groups) {
    for (const entry of group.layers) {
      const localeOverrides = {}
      for (const [locale, patch] of Object.entries(entry.overrides)) {
        if (patch !== null) localeOverrides[locale] = patch
      }
      if (Object.keys(localeOverrides).length > 0) {
        overrideMap.set(entry.id, localeOverrides)
      }
    }
  }

  function patchLayer(layer) {
    const localeOverrides = overrideMap.get(layer.id)
    let patched = layer
    if (localeOverrides) {
      const mergedLocaleContent = { ...(layer.localeContent ?? {}) }
      for (const [locale, patch] of Object.entries(localeOverrides)) {
        mergedLocaleContent[locale] = patch
      }
      patched = { ...layer, localeOverrides, localeContent: mergedLocaleContent }
    }
    if (patched.type === 'group') {
      return { ...patched, children: patched.children.map(patchLayer) }
    }
    return patched
  }

  return {
    ...project,
    settings: {
      ...project.settings,
      locales: manifest.locales,
      defaultLocale: manifest.defaultLocale,
    },
    slideGroups: project.slideGroups.map((g) => ({
      ...g,
      layers: g.layers.map(patchLayer),
    })),
  }
}

// ─── CLI commands ─────────────────────────────────────────────────────────────

export async function runLocaleManifest(opts) {
  if (!opts.project) throw new Error('--project is required')
  
  const projectPath = resolve(opts.project)
  const project = JSON.parse(readFileSync(projectPath, 'utf8'))
  const manifest = buildLocaleManifest(project)
  
  const outputPath = opts.output ? resolve(opts.output) : resolve('locale-manifest.json')
  writeFileSync(outputPath, JSON.stringify(manifest, null, 2))
  
  console.log(`[CLI] Locale manifest written to ${outputPath}`)
  console.log(`  Locales: ${manifest.locales.join(', ')}`)
  console.log(`  Total localizable layers: ${manifest.groups.reduce((n, g) => n + g.layers.length, 0)}`)
}

export async function runLocaleImport(opts) {
  if (!opts.project) throw new Error('--project is required')
  if (!opts.manifest) throw new Error('--manifest is required')
  
  const projectPath = resolve(opts.project)
  const manifestPath = resolve(opts.manifest)
  
  const project = JSON.parse(readFileSync(projectPath, 'utf8'))
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  
  const updated = applyLocaleManifest(project, manifest)
  
  const outputPath = opts.output ? resolve(opts.output) : projectPath
  writeFileSync(outputPath, JSON.stringify(updated, null, 2))
  
  console.log(`[CLI] Locale manifest imported → ${outputPath}`)
  console.log(`  Locales: ${updated.settings.locales?.join(', ')}`)
}
