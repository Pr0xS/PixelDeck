/**
 * Project ZIP + unified project-file import.
 *
 * ZIP layout (schemaVersion 2):
 *   project.json            { kind: 'pixeldeck-project', schemaVersion: 2, project }
 *   assets/<key>            raw image bytes, one file per referenced asset;
 *                           <key> is `img_<24 hex sha256(bytes)>.<ext>` (see assetKey.ts)
 * `project` has refs only (no `data:` URLs) plus `assetManifest` (name/mime per key).
 */
import type { AssetManifestEntry, Project } from '@/types'
import {
  assetKeyFromBytes, assetKeyFromDataUrl, isHashedAssetKey, mimeForKey, parseDataUrl,
} from '@/utils/assetKey'
import { migrateProjectWithAssets, assertProjectShape } from '@/store/helpers'
import {
  bundleAssetRecords, collectAssetKeys, isProjectExportBundle, mapProjectRefs,
  prepareProjectForExport, rekeyLegacyAssets,
} from '@/utils/projectAssets'

export const PROJECT_ZIP_KIND = 'pixeldeck-project'
export const PROJECT_ZIP_SCHEMA_VERSION = 2

export interface ImportAsset {
  key: string
  name: string
  mime: string
  dataUrl: string
}

/** A parsed-but-not-yet-migrated project file (any supported format). */
export interface IncomingProject {
  project: unknown
  assets: ImportAsset[]
  format: 'zip' | 'bundle-v2' | 'bundle-v1' | 'project'
}

export function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return `data:${mime};base64,${btoa(bin)}`
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function buildProjectZip(
  project: Project,
  resolve: (key: string) => string | undefined,
  nameOf?: (key: string) => string | undefined,
): Promise<{ blob: Blob; missing: string[] }> {
  const prepared = prepareProjectForExport(project, resolve, nameOf)
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  zip.file('project.json', JSON.stringify({
    kind: PROJECT_ZIP_KIND,
    schemaVersion: PROJECT_ZIP_SCHEMA_VERSION,
    project: prepared.project,
  }, null, 2))
  for (const [key, asset] of Object.entries(prepared.assets)) {
    zip.file(`assets/${key}`, parseDataUrl(asset.dataUrl).bytes)
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  return { blob, missing: prepared.missing }
}

export async function exportProjectZip(
  project: Project,
  resolve: (key: string) => string | undefined,
  nameOf?: (key: string) => string | undefined,
): Promise<Blob> {
  return (await buildProjectZip(project, resolve, nameOf)).blob
}

// ─── Import ───────────────────────────────────────────────────────────────────

type BinaryInput = Blob | ArrayBuffer | Uint8Array

async function toBytes(input: BinaryInput): Promise<Uint8Array> {
  if (input instanceof Uint8Array) return input
  if (input instanceof ArrayBuffer) return new Uint8Array(input)
  return new Uint8Array(await input.arrayBuffer())
}

export function isZipBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04
}

/**
 * Read a project ZIP. Every asset file is re-hashed; if the file name does not
 * match its content hash the asset is re-keyed and all refs rewritten (no failure).
 */
export async function importProjectZip(input: BinaryInput): Promise<IncomingProject> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(await toBytes(input))
  const projectFile = zip.file('project.json')
  if (!projectFile) throw new Error('Not a PixelDeck project zip (project.json missing)')
  const parsed: unknown = JSON.parse(await projectFile.async('string'))
  const rawProject: unknown = parsed && typeof parsed === 'object' && 'project' in parsed
    ? (parsed as { project: unknown }).project
    : parsed
  assertProjectShape(rawProject)
  let project = rawProject as Project
  const manifest = project.assetManifest ?? {}

  const assets: ImportAsset[] = []
  const renames = new Map<string, string>()
  const newManifest: Record<string, AssetManifestEntry> = {}
  const files = Object.keys(zip.files).filter((n) => n.startsWith('assets/') && !zip.files[n].dir)
  for (const path of files) {
    const name = path.slice('assets/'.length)
    const bytes = await zip.files[path].async('uint8array')
    const mime = manifest[name]?.mime ?? mimeForKey(name)
    const key = assetKeyFromBytes(bytes, mime)
    if (key !== name) renames.set(name, key)
    const displayName = manifest[name]?.name ?? name
    assets.push({ key, name: displayName, mime, dataUrl: bytesToDataUrl(bytes, mime) })
    newManifest[key] = { ...(manifest[name] ?? {}), name: displayName, mime }
  }
  if (renames.size) project = mapProjectRefs(project, (ref) => renames.get(ref) ?? ref)
  // Keep manifest entries for refs without files (missing legacy names).
  for (const [k, v] of Object.entries(manifest)) {
    if (!renames.has(k) && !newManifest[k]) newManifest[k] = v
  }
  if (Object.keys(newManifest).length) project = { ...project, assetManifest: newManifest }
  return { project, assets, format: 'zip' }
}

/** Sniff and parse any supported project file: zip, bundle v2/v1, raw project JSON. */
export async function parseProjectFile(input: BinaryInput | string): Promise<IncomingProject> {
  if (typeof input === 'string') return parseProjectJson(input)
  const bytes = await toBytes(input)
  if (isZipBytes(bytes)) return importProjectZip(bytes)
  return parseProjectJson(new TextDecoder().decode(bytes))
}

export function parseProjectJson(json: string): IncomingProject {
  const parsed: unknown = JSON.parse(json)
  if (isProjectExportBundle(parsed)) {
    if (parsed.schemaVersion === 1) {
      return { project: parsed.project, assets: bundleAssetRecords(parsed), format: 'bundle-v1' }
    }
    // v2: verify keys by re-hashing, like the ZIP path (re-key + rewrite refs on mismatch).
    const renames = new Map<string, string>()
    const assets = bundleAssetRecords(parsed).map((a) => {
      const real = assetKeyFromDataUrl(a.dataUrl)
      if (real !== a.key) renames.set(a.key, real)
      return { ...a, key: real }
    })
    let project = parsed.project
    if (renames.size) {
      project = mapProjectRefs(project, (ref) => renames.get(ref) ?? ref)
      const manifest = { ...(project.assetManifest ?? {}) }
      for (const [oldKey, newKey] of renames) {
        if (manifest[oldKey]) {
          manifest[newKey] ??= manifest[oldKey]
          delete manifest[oldKey]
        }
      }
      project = { ...project, assetManifest: manifest }
    }
    return { project, assets, format: 'bundle-v2' }
  }
  return { project: parsed, assets: [], format: 'project' }
}

export interface FinalizedImport {
  project: Project
  /** Hash-keyed assets that must be stored with the project. */
  assets: ImportAsset[]
  /** Referenced keys with no available bytes. */
  missing: string[]
}

/**
 * Pure: migrate an incoming project (inline legacy data, legacy filename keys)
 * into the ref-only shape and return the assets that go with it.
 * `extraResolve` lets already-stored assets satisfy legacy filename refs.
 */
export function finalizeProjectImport(
  incoming: IncomingProject,
  extraResolve?: (ref: string) => string | undefined,
): FinalizedImport {
  assertProjectShape(incoming.project)
  const byKey = new Map<string, ImportAsset>()
  for (const a of incoming.assets) byKey.set(a.key, a)

  const migrated = migrateProjectWithAssets(incoming.project)
  for (const a of migrated.assets) byKey.set(a.key, a)

  const resolve = (ref: string) => byKey.get(ref)?.dataUrl ?? extraResolve?.(ref)
  const rekeyed = rekeyLegacyAssets(migrated.project, resolve)
  for (const a of rekeyed.assets) byKey.set(a.key, a)

  const project = rekeyed.project
  const referenced = collectAssetKeys(project)
  // Legacy filename entries that were re-keyed are superseded by their hash copy.
  const assets = [...byKey.values()].filter((a) => isHashedAssetKey(a.key))
  const missing = [...referenced].filter((k) => !byKey.has(k) && !extraResolve?.(k))
  return { project, assets, missing }
}
