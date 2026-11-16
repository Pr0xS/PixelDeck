import { describe, expect, it } from 'vitest'
import type { PhoneLayer, Template } from '@/types'
import { useEditorStore } from './index'
import { useAssetStore } from './assets'

const KEY_OK = 'img_aaaaaaaaaaaaaaaaaaaaaaaa.webp'
const KEY_GONE = 'img_bbbbbbbbbbbbbbbbbbbbbbbb.webp'
const DATA = 'data:image/webp;base64,AQID'

const phone = (id: string, path: string): PhoneLayer => ({
  id, name: id, type: 'phone', x: 0, y: 0, rotation: 0, opacity: 1, visible: true, locked: false,
  model: 'iphone-16-pro', scale: 1, screenshotPath: path, screenshotFit: 'cover',
  screenshotOffsetX: 0, screenshotOffsetY: 0,
} as PhoneLayer)

const makeTpl = (layers: PhoneLayer[], promised = [KEY_OK, KEY_GONE]): Template => ({
  id: 't', kind: 'template', schemaVersion: 1, name: 'Assets', description: '',
  assetManifest: Object.fromEntries(promised.map((k) => [k, { name: `${k}.n`, mime: 'image/webp' }])),
  slideGroups: [{
    name: 'S', numSlides: 1, slideWidth: 1290, slideHeight: 2796, slideNames: ['s'],
    layers,
  }],
})

const addedLayers = (before: number) =>
  useEditorStore.getState().project.slideGroups[before].layers as PhoneLayer[]

describe('addTemplateSlideGroups with assets', () => {
  it('keeps keys, merges the manifest and strips promised-but-undelivered refs', () => {
    useAssetStore.getState().clearAssets()
    const before = useEditorStore.getState().project.slideGroups.length
    useEditorStore.getState().addTemplateSlideGroups(makeTpl([phone('a', KEY_OK), phone('b', KEY_GONE)]), [
      { key: KEY_OK, name: 'home.webp', mime: 'image/webp', dataUrl: DATA },
    ])
    const state = useEditorStore.getState()
    expect(state.project.slideGroups).toHaveLength(before + 1)
    const layers = addedLayers(before)
    expect(layers[0].screenshotPath).toBe(KEY_OK)
    expect(layers[1].screenshotPath).toBeUndefined()
    expect(useAssetStore.getState().assets[KEY_OK]?.dataUrl).toBe(DATA)
    // Manifest entry comes from the template (display name preserved).
    expect(state.project.assetManifest?.[KEY_OK]).toEqual({ name: `${KEY_OK}.n`, mime: 'image/webp' })
  })

  it('keeps promised refs that are already resolvable in the asset store', () => {
    useAssetStore.getState().clearAssets()
    useAssetStore.getState().putAssetEntries([{ key: KEY_GONE, name: 'x.webp', dataUrl: DATA }])
    const before = useEditorStore.getState().project.slideGroups.length
    useEditorStore.getState().addTemplateSlideGroups(makeTpl([phone('a', KEY_OK), phone('b', KEY_GONE)]))
    const layers = addedLayers(before)
    expect(layers[1].screenshotPath).toBe(KEY_GONE)
    expect(layers[0].screenshotPath).toBeUndefined()
  })

  it('leaves refs the template never promised (legacy filenames) alone', () => {
    useAssetStore.getState().clearAssets()
    const before = useEditorStore.getState().project.slideGroups.length
    const tpl = makeTpl([phone('a', 'home.png'), phone('b', KEY_GONE)], [KEY_GONE])
    delete tpl.assetManifest
    useEditorStore.getState().addTemplateSlideGroups(tpl)
    expect(addedLayers(before)[0].screenshotPath).toBe('home.png')
    expect(addedLayers(before)[1].screenshotPath).toBe(KEY_GONE) // no manifest => nothing promised
  })
})
