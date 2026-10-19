import { describe, expect, it } from 'vitest'
import type { ImageLayer, Layer, PhoneLayer, Project } from '@/types'
import { newProject } from '@/store/helpers'
import { assetKeyFromDataUrl } from './assetKey'
import { collectAssetKeys } from './projectAssets'
import {
  bytesToDataUrl, exportProjectZip, finalizeProjectImport, importProjectZip, parseProjectFile,
} from './projectZip'

const PNG = 'data:image/png;base64,cG5n'
const JPG = 'data:image/jpeg;base64,anBlZw=='
const base = { x: 0, y: 0, rotation: 0, opacity: 1, visible: true, locked: false }

function projectWith(srcs: string[]): Project {
  const p = newProject()
  srcs.forEach((src, i) => p.slideGroups[0].layers.push({
    ...base, id: `i${i}`, name: 'i', type: 'image', src, width: 1, height: 1, cornerRadius: 0,
  } as ImageLayer))
  return p
}

describe('project zip', () => {
  it('round-trips project and asset bytes with verified keys', async () => {
    const keyA = assetKeyFromDataUrl(PNG)
    const keyB = assetKeyFromDataUrl(JPG)
    const source = projectWith([keyA, keyB])
    const store: Record<string, string> = { [keyA]: PNG, [keyB]: JPG }
    const blob = await exportProjectZip(source, (k) => store[k])

    const incoming = await importProjectZip(blob)
    expect(incoming.assets.map((a) => [a.key, a.dataUrl]).sort()).toEqual([[keyA, PNG], [keyB, JPG]].sort())
    const final = finalizeProjectImport(incoming)
    expect(final.missing).toEqual([])
    expect(collectAssetKeys(final.project)).toEqual(new Set([keyA, keyB]))
    expect(JSON.stringify(final.project)).not.toContain('data:')
    expect(final.project.slideGroups[0].layers.map((l) => l.id)).toEqual(source.slideGroups[0].layers.map((l) => l.id))
  })

  it('exports legacy filename refs under hash keys with the filename as manifest name', async () => {
    const blob = await exportProjectZip(projectWith(['shot.png']), () => PNG)
    const incoming = await importProjectZip(blob)
    const key = assetKeyFromDataUrl(PNG)
    expect(incoming.assets).toHaveLength(1)
    expect(incoming.assets[0]).toMatchObject({ key, name: 'shot.png' })
  })

  it('re-keys (does not fail) when a zip file name does not match its content hash', async () => {
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    const wrong = 'img_000000000000000000000000.png'
    const project = projectWith([wrong])
    zip.file('project.json', JSON.stringify({ kind: 'pixeldeck-project', schemaVersion: 2, project }))
    zip.file(`assets/${wrong}`, new Uint8Array([0x70, 0x6e, 0x67]))
    const incoming = await importProjectZip(await zip.generateAsync({ type: 'uint8array' }))
    const real = assetKeyFromDataUrl(PNG)
    expect(incoming.assets[0].key).toBe(real)
    const layer = (incoming.project as Project).slideGroups[0].layers.find((l) => l.id === 'i0') as ImageLayer
    expect(layer.src).toBe(real)
  })

  it('sniffs zip vs JSON and accepts v1 bundles, raw projects and legacy inline projects', async () => {
    const zipBlob = await exportProjectZip(projectWith(['a.png']), () => PNG)
    expect((await parseProjectFile(zipBlob)).format).toBe('zip')

    const v1 = { kind: 'project-export', schemaVersion: 1, project: projectWith(['a.png']), assets: { 'a.png': PNG } }
    const parsedV1 = await parseProjectFile(new TextEncoder().encode(JSON.stringify(v1)))
    expect(parsedV1.format).toBe('bundle-v1')
    const finalV1 = finalizeProjectImport(parsedV1)
    expect(finalV1.assets.map((a) => a.key)).toEqual([assetKeyFromDataUrl(PNG)])
    expect(finalV1.missing).toEqual([])

    const raw = projectWith(['gone.png'])
    const finalRaw = finalizeProjectImport(await parseProjectFile(JSON.stringify(raw)))
    expect(finalRaw.missing).toEqual(['gone.png'])

    const legacy = JSON.parse(JSON.stringify(projectWith([]))) as Project
    const phone = { ...base, id: 'p', name: 'p', type: 'phone', model: 'iphone-16-pro', scale: 1, screenshotPath: 'p.png',
      screenshotDataUrl: JPG, screenshotFit: 'cover', screenshotOffsetX: 0, screenshotOffsetY: 0 } as unknown as PhoneLayer
    legacy.slideGroups[0].layers.push(phone as Layer)
    const finalLegacy = finalizeProjectImport(await parseProjectFile(JSON.stringify(legacy)))
    expect(finalLegacy.assets.map((a) => a.dataUrl)).toEqual([JPG])
    expect(JSON.stringify(finalLegacy.project)).not.toContain('data:')
  })

  it('re-keys v2 bundle assets whose key does not match their content hash', async () => {
    const wrong = 'img_000000000000000000000000.png'
    const project = projectWith([wrong])
    const bundle = { kind: 'project-export', schemaVersion: 2, project, assets: { [wrong]: { name: 'x.png', mime: 'image/png', dataUrl: PNG } } }
    const incoming = await parseProjectFile(JSON.stringify(bundle))
    const real = assetKeyFromDataUrl(PNG)
    expect(incoming.assets[0].key).toBe(real)
    const layer = (incoming.project as Project).slideGroups[0].layers.find((l) => l.id === 'i0') as ImageLayer
    expect(layer.src).toBe(real)
  })

  it('bytesToDataUrl round-trips with parse', () => {
    expect(bytesToDataUrl(new Uint8Array([0x70, 0x6e, 0x67]), 'image/png')).toBe(PNG)
  })

  it('keeps distinct keys for same filename with different bytes', () => {
    const a = finalizeProjectImport({ project: projectWith(['s.png']), assets: [{ key: 's.png', name: 's.png', mime: 'image/png', dataUrl: PNG }], format: 'bundle-v1' })
    const b = finalizeProjectImport({ project: projectWith(['s.png']), assets: [{ key: 's.png', name: 's.png', mime: 'image/jpeg', dataUrl: JPG }], format: 'bundle-v1' })
    expect(a.assets[0].key).not.toBe(b.assets[0].key)
  })
})
