import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from './index'
import { useAssetStore } from '@/store/assets'
import type { TextLayer, GroupLayer, Template, PhoneLayer } from '@/types'
import { buildLocaleManifest } from '@/utils/locale'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getActiveGroup() {
  const { project, activeSlideGroupId } = useEditorStore.getState()
  return project.slideGroups.find((g) => g.id === activeSlideGroupId)!
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  useAssetStore.getState().clearAssets()
  useEditorStore.getState().resetProject()
  void useAssetStore.getState().setActiveProject(useEditorStore.getState().project.id)
  useEditorStore.setState({
    editingGroupId: null,
    selectedLayerIds: [],
    clipboard: null,
    clipboardSourceGroupId: null,
    pasteCount: 0,
    selection: null,
  })
  useEditorStore.temporal.getState().clear()
})

// ─── addLayer ─────────────────────────────────────────────────────────────────

describe('addLayer', () => {
  it('adds a layer to the active slide group', () => {
    useEditorStore.getState().addText()
    const layers = getActiveGroup().layers
    // background + text
    expect(layers).toHaveLength(2)
    expect(layers[1].type).toBe('text')
    expect(layers[1].localeContent?.en.text).toBe('Your headline')
  })

  it('selects the newly added layer', () => {
    useEditorStore.getState().addText()
    const { selection, activeSlideGroupId } = useEditorStore.getState()
    expect(selection?.slideGroupId).toBe(activeSlideGroupId)
    expect(selection?.layerId).toBeDefined()
  })
})

// ─── updateLayer ──────────────────────────────────────────────────────────────

describe('updateLayer', () => {
  it('merges a patch into the correct layer', () => {
    useEditorStore.getState().addText()
    const textLayer = getActiveGroup().layers.find((l) => l.type === 'text') as TextLayer
    expect(textLayer).toBeDefined()

    useEditorStore.getState().updateLayer(textLayer.id, { opacity: 0.42 })

    const updated = getActiveGroup().layers.find((l) => l.id === textLayer.id)!
    expect(updated.opacity).toBe(0.42)
  })

  it('does not affect other layers', () => {
    useEditorStore.getState().addText()
    useEditorStore.getState().addShape()
    const layers = getActiveGroup().layers
    const textLayer = layers.find((l) => l.type === 'text')!
    const shapeLayer = layers.find((l) => l.type === 'shape')!

    useEditorStore.getState().updateLayer(textLayer.id, { opacity: 0.1 })

    const shapeAfter = getActiveGroup().layers.find((l) => l.id === shapeLayer.id)!
    expect(shapeAfter.opacity).toBe(1) // unchanged
  })
})

describe('updateLayer — locale content sync', () => {
  it('writes text to both the legacy field and default locale content', () => {
    useEditorStore.getState().addText()
    const textLayer = getActiveGroup().layers.find((l) => l.type === 'text') as TextLayer
    const defaultLocale = useEditorStore.getState().project.settings.defaultLocale

    useEditorStore.getState().updateLayer(textLayer.id, { text: 'New headline' })

    const updated = getActiveGroup().layers.find((l) => l.id === textLayer.id) as TextLayer
    expect(updated.text).toBe('New headline')
    expect(updated.localeContent?.[defaultLocale]?.text).toBe('New headline')
  })

  it('preserves seeded locale content for a non-locale patch', () => {
    useEditorStore.getState().addText()
    const textLayer = getActiveGroup().layers.find((l) => l.type === 'text') as TextLayer

    useEditorStore.getState().updateLayer(textLayer.id, { opacity: 0.5 })

    const updated = getActiveGroup().layers.find((l) => l.id === textLayer.id) as TextLayer
    expect(updated.opacity).toBe(0.5)
    expect(updated.localeContent?.en.text).toBe('Your headline')
  })

  it('writes a phone screenshot path to both legacy and default locale content', () => {
    useEditorStore.getState().addPhone()
    const phone = getActiveGroup().layers.find((l) => l.type === 'phone') as PhoneLayer
    const defaultLocale = useEditorStore.getState().project.settings.defaultLocale

    useEditorStore.getState().updateLayer(phone.id, { screenshotPath: 'shot.png' })

    const updated = getActiveGroup().layers.find((l) => l.id === phone.id) as PhoneLayer
    expect(updated.screenshotPath).toBe('shot.png')
    expect(updated.localeContent?.[defaultLocale]?.screenshotPath).toBe('shot.png')
  })

  it('routes a mixed patch through locale and format pipelines', () => {
    useEditorStore.getState().addText()
    const textLayer = getActiveGroup().layers.find((l) => l.type === 'text') as TextLayer
    const defaultLocale = useEditorStore.getState().project.settings.defaultLocale

    useEditorStore.getState().updateLayer(textLayer.id, { text: 'Hi', opacity: 0.3, x: 50 })

    const updated = getActiveGroup().layers.find((l) => l.id === textLayer.id) as TextLayer
    expect(updated.text).toBe('Hi')
    expect(updated.localeContent?.[defaultLocale]?.text).toBe('Hi')
    expect(updated.opacity).toBe(0.3)
    expect(updated.x).toBe(50)
  })

  it('writes group child text to default locale content', () => {
    useEditorStore.getState().addText()
    useEditorStore.getState().addShape()
    const layers = getActiveGroup().layers
    const textId = layers.find((l) => l.type === 'text')!.id
    const shapeId = layers.find((l) => l.type === 'shape')!.id
    useEditorStore.getState().createGroup([textId, shapeId])
    const group = getActiveGroup().layers.find((l) => l.type === 'group') as GroupLayer
    const defaultLocale = useEditorStore.getState().project.settings.defaultLocale

    useEditorStore.getState().updateChildLayer(group.id, textId, { text: 'Nested edit' })

    const updatedGroup = getActiveGroup().layers.find((l) => l.id === group.id) as GroupLayer
    const child = updatedGroup.children.find((l) => l.id === textId) as TextLayer
    expect(child.localeContent?.[defaultLocale]?.text).toBe('Nested edit')
  })
})

// ─── removeLayer ──────────────────────────────────────────────────────────────

describe('removeLayer', () => {
  it('removes the specified layer and leaves others untouched', () => {
    useEditorStore.getState().addText()
    const textLayer = getActiveGroup().layers.find((l) => l.type === 'text')!

    useEditorStore.getState().removeLayer(textLayer.id)

    const layersAfter = getActiveGroup().layers
    expect(layersAfter.find((l) => l.id === textLayer.id)).toBeUndefined()
  })

  it('cannot remove the background layer', () => {
    const bgLayer = getActiveGroup().layers.find((l) => l.type === 'background')!
    const countBefore = getActiveGroup().layers.length

    useEditorStore.getState().removeLayer(bgLayer.id)

    expect(getActiveGroup().layers).toHaveLength(countBefore)
    expect(getActiveGroup().layers[0].type).toBe('background')
  })
})

// ─── duplicateLayer ───────────────────────────────────────────────────────────

describe('duplicateLayer', () => {
  it('creates a copy with a new ID', () => {
    useEditorStore.getState().addText()
    const textLayer = getActiveGroup().layers.find((l) => l.type === 'text')!

    useEditorStore.getState().duplicateLayer(textLayer.id)

    const afterLayers = getActiveGroup().layers
    expect(afterLayers).toHaveLength(3) // background + original + copy
    const copy = afterLayers.find((l) => l.type === 'text' && l.id !== textLayer.id)
    expect(copy).toBeDefined()
    expect(copy!.id).not.toBe(textLayer.id)
  })

  it('offsets the duplicate by 20px on both axes', () => {
    useEditorStore.getState().addText()
    const textLayer = getActiveGroup().layers.find((l) => l.type === 'text')!

    useEditorStore.getState().duplicateLayer(textLayer.id)

    const copy = getActiveGroup().layers.find((l) => l.type === 'text' && l.id !== textLayer.id)!
    expect(copy.x).toBe(textLayer.x + 20)
    expect(copy.y).toBe(textLayer.y + 20)
  })
})

// ─── moveLayerUp / moveLayerDown ──────────────────────────────────────────────

describe('moveLayerUp', () => {
  it('moves a layer toward a lower array index, background stays at 0', () => {
    useEditorStore.getState().addText()
    useEditorStore.getState().addShape()
    // layers: [background(0), text(1), shape(2)]
    const layers = getActiveGroup().layers
    const textId = layers[1].id
    const shapeId = layers[2].id

    useEditorStore.getState().moveLayerUp(shapeId)

    // Expected: [background(0), shape(1), text(2)]
    const after = getActiveGroup().layers
    expect(after[0].type).toBe('background')
    expect(after[1].id).toBe(shapeId)
    expect(after[2].id).toBe(textId)
  })

  it('does not move a layer at index 1 (would displace background)', () => {
    useEditorStore.getState().addText()
    useEditorStore.getState().addShape()
    // layers: [background(0), text(1), shape(2)]
    const layers = getActiveGroup().layers
    const textId = layers[1].id

    useEditorStore.getState().moveLayerUp(textId) // index 1 → blocked

    const after = getActiveGroup().layers
    expect(after[1].id).toBe(textId) // unchanged
  })
})

describe('moveLayerDown', () => {
  it('moves a layer toward a higher array index', () => {
    useEditorStore.getState().addText()
    useEditorStore.getState().addShape()
    // layers: [background(0), text(1), shape(2)]
    const layers = getActiveGroup().layers
    const textId = layers[1].id
    const shapeId = layers[2].id

    useEditorStore.getState().moveLayerDown(textId)

    // Expected: [background(0), shape(1), text(2)]
    const after = getActiveGroup().layers
    expect(after[1].id).toBe(shapeId)
    expect(after[2].id).toBe(textId)
  })

  it('does not move the last layer', () => {
    useEditorStore.getState().addText()
    useEditorStore.getState().addShape()
    // layers: [background(0), text(1), shape(2)]
    const layers = getActiveGroup().layers
    const shapeId = layers[2].id

    useEditorStore.getState().moveLayerDown(shapeId) // last → blocked

    expect(getActiveGroup().layers[2].id).toBe(shapeId)
  })
})

// ─── reorderLayers ────────────────────────────────────────────────────────────

describe('reorderLayers', () => {
  it('reorders layers to match the provided id order, keeping background at index 0', () => {
    useEditorStore.getState().addText()
    useEditorStore.getState().addShape()
    // Current: [background, text, shape]
    const layers = getActiveGroup().layers
    const textId = layers[1].id
    const shapeId = layers[2].id

    // Reverse: shape first, then text
    useEditorStore.getState().reorderLayers([shapeId, textId])

    const after = getActiveGroup().layers
    expect(after[0].type).toBe('background')
    expect(after[1].id).toBe(shapeId)
    expect(after[2].id).toBe(textId)
  })
})

// ─── setLayerVisibility / setLayerLocked ──────────────────────────────────────

describe('setLayerVisibility', () => {
  it('toggles visibility on the specified layer', () => {
    useEditorStore.getState().addText()
    const textLayer = getActiveGroup().layers.find((l) => l.type === 'text')!
    expect(textLayer.visible).toBe(true)

    useEditorStore.getState().setLayerVisibility(textLayer.id, false)

    const after = getActiveGroup().layers.find((l) => l.id === textLayer.id)!
    expect(after.visible).toBe(false)
  })
})

describe('setLayerLocked', () => {
  it('toggles locked on the specified layer', () => {
    useEditorStore.getState().addText()
    const textLayer = getActiveGroup().layers.find((l) => l.type === 'text')!
    expect(textLayer.locked).toBe(false)

    useEditorStore.getState().setLayerLocked(textLayer.id, true)

    const after = getActiveGroup().layers.find((l) => l.id === textLayer.id)!
    expect(after.locked).toBe(true)
  })
})

// ─── createGroup / dissolveGroup ──────────────────────────────────────────────

describe('createGroup', () => {
  it('replaces the selected layers with a single GroupLayer', () => {
    useEditorStore.getState().addText()
    useEditorStore.getState().addShape()
    const layers = getActiveGroup().layers
    const textId = layers.find((l) => l.type === 'text')!.id
    const shapeId = layers.find((l) => l.type === 'shape')!.id

    useEditorStore.getState().createGroup([textId, shapeId])

    const after = getActiveGroup().layers
    // background + group
    expect(after).toHaveLength(2)
    const grp = after.find((l) => l.type === 'group') as GroupLayer
    expect(grp).toBeDefined()
    expect(grp.children).toHaveLength(2)
  })

  it('does not group if fewer than 2 valid layers are selected', () => {
    useEditorStore.getState().addText()
    const textId = getActiveGroup().layers.find((l) => l.type === 'text')!.id
    const countBefore = getActiveGroup().layers.length

    useEditorStore.getState().createGroup([textId])

    expect(getActiveGroup().layers).toHaveLength(countBefore)
  })
})

describe('dissolveGroup', () => {
  it('replaces the GroupLayer with its children at the top level', () => {
    useEditorStore.getState().addText()
    useEditorStore.getState().addShape()
    const layers = getActiveGroup().layers
    const textId = layers.find((l) => l.type === 'text')!.id
    const shapeId = layers.find((l) => l.type === 'shape')!.id
    useEditorStore.getState().createGroup([textId, shapeId])

    const grp = getActiveGroup().layers.find((l) => l.type === 'group')!

    useEditorStore.getState().dissolveGroup(grp.id)

    const after = getActiveGroup().layers
    expect(after.find((l) => l.type === 'group')).toBeUndefined()
    // background + text + shape = 3
    expect(after).toHaveLength(3)
  })

  it('bakes the group scale into children so visuals are preserved', () => {
    useEditorStore.getState().addText()
    useEditorStore.getState().addShape()
    const layers = getActiveGroup().layers
    const textId = layers.find((l) => l.type === 'text')!.id
    const shapeId = layers.find((l) => l.type === 'shape')!.id
    useEditorStore.getState().createGroup([textId, shapeId])

    const grp = getActiveGroup().layers.find((l) => l.type === 'group') as GroupLayer
    const childText = grp.children.find((c) => c.type === 'text') as TextLayer
    const childShape = grp.children.find((c) => c.type === 'shape') as Extract<typeof grp.children[number], { type: 'shape' }>

    useEditorStore.getState().updateLayer(grp.id, { scale: 2 } as Partial<GroupLayer>)
    useEditorStore.getState().dissolveGroup(grp.id)

    const after = getActiveGroup().layers
    const textAfter = after.find((l) => l.id === textId) as TextLayer
    const shapeAfter = after.find((l) => l.id === shapeId) as typeof childShape

    // Positions: abs = local * scale + group origin
    expect(textAfter.x).toBeCloseTo(childText.x * 2 + grp.x)
    expect(textAfter.y).toBeCloseTo(childText.y * 2 + grp.y)
    // Sizes scale per layer type
    expect(textAfter.fontSize).toBeCloseTo(childText.fontSize * 2)
    expect(shapeAfter.width).toBeCloseTo(childShape.width * 2)
    expect(shapeAfter.height).toBeCloseTo(childShape.height * 2)
  })
})

// ─── addSlideGroup / removeSlideGroup ────────────────────────────────────────

describe('addSlideGroup', () => {
  it('increases the slideGroups count by one', () => {
    const countBefore = useEditorStore.getState().project.slideGroups.length
    useEditorStore.getState().addSlideGroup()
    expect(useEditorStore.getState().project.slideGroups).toHaveLength(countBefore + 1)
  })

  it('sets the new group as the active slide group', () => {
    useEditorStore.getState().addSlideGroup()
    const { project, activeSlideGroupId } = useEditorStore.getState()
    const last = project.slideGroups[project.slideGroups.length - 1]
    expect(activeSlideGroupId).toBe(last.id)
  })
})

describe('removeSlideGroup', () => {
  it('decreases the slideGroups count by one', () => {
    useEditorStore.getState().addSlideGroup()
    const { project } = useEditorStore.getState()
    const idToRemove = project.slideGroups[1].id

    useEditorStore.getState().removeSlideGroup(idToRemove)

    expect(useEditorStore.getState().project.slideGroups).toHaveLength(1)
  })
})

// ─── undo / redo ──────────────────────────────────────────────────────────────

describe('undo / redo', () => {
  it('undo restores previous project state after updateLayer', () => {
    useEditorStore.getState().addText()
    const textLayer = getActiveGroup().layers.find((l) => l.type === 'text') as TextLayer
    const originalOpacity = textLayer.opacity

    useEditorStore.getState().updateLayer(textLayer.id, { opacity: 0.123 })
    expect(getActiveGroup().layers.find((l) => l.id === textLayer.id)!.opacity).toBe(0.123)

    useEditorStore.temporal.getState().undo()

    const afterUndo = getActiveGroup().layers.find((l) => l.id === textLayer.id)
    expect(afterUndo?.opacity).toBe(originalOpacity)
  })

  it('redo re-applies the change after undo', () => {
    useEditorStore.getState().addText()
    const textLayer = getActiveGroup().layers.find((l) => l.type === 'text') as TextLayer

    useEditorStore.getState().updateLayer(textLayer.id, { opacity: 0.77 })
    useEditorStore.temporal.getState().undo()
    useEditorStore.temporal.getState().redo()

    const afterRedo = getActiveGroup().layers.find((l) => l.id === textLayer.id)!
    expect(afterRedo.opacity).toBe(0.77)
  })
})

// ─── copyLayers / pasteLayers ────────────────────────────────────────────────

describe('copyLayers + pasteLayers', () => {
  it('pasted layer has a new ID and the same type', () => {
    useEditorStore.getState().addText()
    const textLayer = getActiveGroup().layers.find((l) => l.type === 'text')!

    useEditorStore.getState().copyLayers([textLayer.id])
    useEditorStore.getState().pasteLayers()

    const afterLayers = getActiveGroup().layers
    expect(afterLayers).toHaveLength(3) // background + original + paste
    const pasted = afterLayers.find((l) => l.type === 'text' && l.id !== textLayer.id)
    expect(pasted).toBeDefined()
    expect(pasted!.type).toBe('text')
    expect(pasted!.id).not.toBe(textLayer.id)
  })

  it('pasted layer is offset from the original', () => {
    useEditorStore.getState().addText()
    const textLayer = getActiveGroup().layers.find((l) => l.type === 'text')!

    useEditorStore.getState().copyLayers([textLayer.id])
    useEditorStore.getState().pasteLayers()

    const pasted = getActiveGroup().layers.find((l) => l.type === 'text' && l.id !== textLayer.id)!
    expect(pasted.x).toBe(textLayer.x + 20)
    expect(pasted.y).toBe(textLayer.y + 20)
  })
})

// ─── setLocaleContent / clearLocaleContent ────────────────────────────────────

describe('setLocaleContent / clearLocaleContent', () => {
  it('keeps default locale content in sync when editing base text by slide group', () => {
    useEditorStore.getState().addText()
    const groupId = useEditorStore.getState().activeSlideGroupId
    const textLayer = getActiveGroup().layers.find((l) => l.type === 'text') as TextLayer

    useEditorStore.getState().updateLayerInSlideGroup(groupId, textLayer.id, { text: 'Fresh source' })

    const manifest = buildLocaleManifest(useEditorStore.getState().project)
    expect(manifest.groups[0].layers.find((layer) => layer.id === textLayer.id)?.default.text).toBe('Fresh source')
  })

  it('setLocaleContent adds locale content on the layer', () => {
    useEditorStore.getState().addText()
    const groupId = useEditorStore.getState().activeSlideGroupId
    const textLayer = getActiveGroup().layers.find((l) => l.type === 'text')!

    useEditorStore.getState().setLocaleContent(groupId, textLayer.id, 'es', { text: 'Hola' })

    const after = getActiveGroup().layers.find((l) => l.id === textLayer.id)!
    expect(after.localeContent?.['es']?.text).toBe('Hola')
  })

  it('clearLocaleContent removes locale content', () => {
    useEditorStore.getState().addText()
    const groupId = useEditorStore.getState().activeSlideGroupId
    const textLayer = getActiveGroup().layers.find((l) => l.type === 'text')!

    useEditorStore.getState().setLocaleContent(groupId, textLayer.id, 'es', { text: 'Hola' })
    useEditorStore.getState().clearLocaleContent(groupId, textLayer.id, 'es')

    const after = getActiveGroup().layers.find((l) => l.id === textLayer.id)!
    expect(after.localeContent?.['es']).toBeUndefined()
  })
})

describe('relabelDefaultLocale / promoteLocaleToDefault', () => {
  it('relabels the default locale and moves its locale content key', () => {
    useEditorStore.getState().addText()
    const textLayer = getActiveGroup().layers.find((l) => l.type === 'text') as TextLayer
    useEditorStore.getState().updateLayer(textLayer.id, { text: 'Hello' })

    useEditorStore.getState().relabelDefaultLocale('en-us')

    const { project } = useEditorStore.getState()
    const updated = getActiveGroup().layers.find((l) => l.id === textLayer.id) as TextLayer
    expect(project.settings.defaultLocale).toBe('en-us')
    expect(project.settings.locales?.[0]).toBe('en-us')
    expect(updated.localeContent?.['en-us']?.text).toBe('Hello')
    expect(updated.localeContent?.en).toBeUndefined()
  })

  it('does not relabel the default to an existing distinct locale', () => {
    useEditorStore.getState().addLocale('es')

    useEditorStore.getState().relabelDefaultLocale('es')

    expect(useEditorStore.getState().project.settings.defaultLocale).toBe('en')
  })

  it('promotes an existing translation and preserves the demoted default', () => {
    useEditorStore.getState().addText()
    const groupId = useEditorStore.getState().activeSlideGroupId
    const textLayer = getActiveGroup().layers.find((l) => l.type === 'text') as TextLayer
    useEditorStore.getState().updateLayer(textLayer.id, { text: 'Hello' })
    useEditorStore.getState().addLocale('es')
    useEditorStore.getState().setLocaleContent(groupId, textLayer.id, 'es', { text: 'Hola' })

    useEditorStore.getState().promoteLocaleToDefault('es')

    const { project } = useEditorStore.getState()
    const updated = getActiveGroup().layers.find((l) => l.id === textLayer.id) as TextLayer
    expect(project.settings.defaultLocale).toBe('es')
    expect(updated.text).toBe('Hola')
    expect(updated.localeContent?.es.text).toBe('Hola')
    expect(updated.localeContent?.en.text).toBe('Hello')
  })

  it('seeds an incomplete promoted locale from the old default', () => {
    useEditorStore.getState().addText()
    const textLayer = getActiveGroup().layers.find((l) => l.type === 'text') as TextLayer
    useEditorStore.getState().updateLayer(textLayer.id, { text: 'Hello' })
    useEditorStore.getState().addLocale('es')

    useEditorStore.getState().promoteLocaleToDefault('es')

    const updated = getActiveGroup().layers.find((l) => l.id === textLayer.id) as TextLayer
    expect(updated.text).toBe('Hello')
    expect(updated.localeContent?.es.text).toBe('Hello')
    expect(updated.localeContent?.en.text).toBe('Hello')
  })

  it('falls back to the old default when the promoted text override is empty', () => {
    useEditorStore.getState().addText()
    const groupId = useEditorStore.getState().activeSlideGroupId
    const textLayer = getActiveGroup().layers.find((l) => l.type === 'text') as TextLayer
    useEditorStore.getState().updateLayer(textLayer.id, { text: 'Hello' })
    useEditorStore.getState().addLocale('es')
    useEditorStore.getState().setLocaleContent(groupId, textLayer.id, 'es', { text: '' })

    useEditorStore.getState().promoteLocaleToDefault('es')

    const updated = getActiveGroup().layers.find((l) => l.id === textLayer.id) as TextLayer
    expect(updated.text).toBe('Hello')
    expect(updated.localeContent?.es.text).toBe('Hello')
    expect(updated.localeContent?.en.text).toBe('Hello')
  })

  it('does not promote a locale absent from project settings', () => {
    const projectBefore = useEditorStore.getState().project

    useEditorStore.getState().promoteLocaleToDefault('es')

    expect(useEditorStore.getState().project).toBe(projectBefore)
    expect(useEditorStore.getState().project.settings.defaultLocale).toBe('en')
  })

  it('clears stale default text marks when the promoted translation has none', () => {
    useEditorStore.getState().addText()
    const groupId = useEditorStore.getState().activeSlideGroupId
    const textLayer = getActiveGroup().layers.find((l) => l.type === 'text') as TextLayer
    useEditorStore.getState().updateLayer(textLayer.id, {
      text: 'Hello',
      marks: [{ start: 0, end: 5, fontWeight: 700 }],
    })
    useEditorStore.getState().addLocale('es')
    useEditorStore.getState().setLocaleContent(groupId, textLayer.id, 'es', { text: 'Hola' })

    useEditorStore.getState().promoteLocaleToDefault('es')

    const updated = getActiveGroup().layers.find((l) => l.id === textLayer.id) as TextLayer
    expect(updated.text).toBe('Hola')
    expect(updated.marks).toBeUndefined()
  })

  it('writes symmetric locale content', () => {
    useEditorStore.getState().addText()
    const groupId = useEditorStore.getState().activeSlideGroupId
    const textLayer = getActiveGroup().layers.find((l) => l.type === 'text') as TextLayer

    useEditorStore.getState().setLocaleContent(groupId, textLayer.id, 'es', { text: 'Hola' })

    const updated = getActiveGroup().layers.find((l) => l.id === textLayer.id) as TextLayer
    expect(updated.localeContent?.es).toEqual({ text: 'Hola' })
  })

  it('clears locale content', () => {
    useEditorStore.getState().addText()
    const groupId = useEditorStore.getState().activeSlideGroupId
    const textLayer = getActiveGroup().layers.find((l) => l.type === 'text') as TextLayer
    useEditorStore.getState().setLocaleContent(groupId, textLayer.id, 'es', { text: 'Hola' })

    useEditorStore.getState().clearLocaleContent(groupId, textLayer.id, 'es')

    const updated = getActiveGroup().layers.find((l) => l.id === textLayer.id) as TextLayer
    expect(updated.localeContent?.es).toBeUndefined()
  })

  it('removes a locale from locale content on every layer', () => {
    useEditorStore.getState().addText()
    useEditorStore.getState().addText()
    const groupId = useEditorStore.getState().activeSlideGroupId
    const textLayers = getActiveGroup().layers.filter((l) => l.type === 'text') as TextLayer[]
    useEditorStore.getState().addLocale('es')
    for (const [index, layer] of textLayers.entries()) {
      useEditorStore.getState().setLocaleContent(groupId, layer.id, 'es', { text: `Hola ${index}` })
    }

    useEditorStore.getState().removeLocale('es')

    for (const layer of getActiveGroup().layers.filter((l) => l.type === 'text') as TextLayer[]) {
      expect(layer.localeContent?.es).toBeUndefined()
    }
  })
})

// ─── addTemplateSlideGroups (brand kit merge) ─────────────────────────────────

describe('addTemplateSlideGroups', () => {
  const makeTemplate = (): Template => ({
    id: 'tpl-test',
    kind: 'template',
    schemaVersion: 1,
    name: 'Brand Merge Test',
    description: '',
    slideGroups: [
      {
        name: 'Slide A',
        numSlides: 1,
        slideWidth: 1290,
        slideHeight: 2796,
        slideNames: ['slide-a'],
        layers: [
          {
            id: 'l0', name: 'Background', type: 'background',
            x: 0, y: 0, rotation: 0, opacity: 1, visible: true, locked: true,
            fill: '{brand:tpl-primary}', accents: [],
          },
        ],
      },
    ],
    settings: {
      brandColors: [
        { id: 'tpl-primary', name: 'Primary', value: '#1ED760' },
        { id: 'tpl-surface', name: 'Surface', value: '#14151F' },
      ],
    },
  })

  it('merges template brand colors into the current project palette', () => {
    useEditorStore.getState().addTemplateSlideGroups(makeTemplate())
    const colors = useEditorStore.getState().project.settings.brandColors ?? []
    expect(colors.map((c) => c.id)).toEqual(['tpl-primary', 'tpl-surface'])
  })

  it('never overwrites an existing brand color with the same id', () => {
    useEditorStore.getState().addBrandColor('Mine', '#FF0000')
    const mine = useEditorStore.getState().project.settings.brandColors![0]
    // Simulate collision: template carries a color with the user's id
    const tpl = makeTemplate()
    tpl.settings!.brandColors![0].id = mine.id

    useEditorStore.getState().addTemplateSlideGroups(tpl)

    const colors = useEditorStore.getState().project.settings.brandColors!
    expect(colors.find((c) => c.id === mine.id)?.value).toBe('#FF0000')
    // The non-colliding color still came in
    expect(colors.some((c) => c.id === 'tpl-surface')).toBe(true)
  })

  it('appends the template slide groups to the project', () => {
    const before = useEditorStore.getState().project.slideGroups.length
    useEditorStore.getState().addTemplateSlideGroups(makeTemplate())
    expect(useEditorStore.getState().project.slideGroups.length).toBe(before + 1)
  })

  it('moves inline phone screenshots into the asset store', () => {
    const tpl = makeTemplate()
    tpl.slideGroups[0].layers.push({
      id: 'l1', name: 'Phone', type: 'phone', x: 0, y: 0, rotation: 0,
      opacity: 1, visible: true, locked: false, model: 'iphone-16-pro', scale: 1,
      screenshotDataUrl: 'data:image/png;base64,dGVtcGxhdGU=', screenshotFit: 'cover',
      screenshotOffsetX: 0, screenshotOffsetY: 0,
    })

    useEditorStore.getState().addTemplateSlideGroups(tpl)
    const phone = getActiveGroup().layers.find((layer) => layer.type === 'phone') as PhoneLayer
    expect(phone.screenshotPath).toBeDefined()
    expect(phone.screenshotDataUrl).toBeUndefined()
    expect(useAssetStore.getState().assets[phone.screenshotPath!]?.dataUrl)
      .toBe('data:image/png;base64,dGVtcGxhdGU=')
  })
})

describe('importTemplateAsNewProject', () => {
  it('moves inline phone screenshots into the asset store', () => {
    const dataUrl = 'data:image/jpeg;base64,dGVtcGxhdGU='
    const tpl: Template = {
      id: 'tpl-import', kind: 'template', schemaVersion: 1, name: 'Import Template',
      description: '',
      slideGroups: [{
        name: 'Slide', numSlides: 1, slideWidth: 1290, slideHeight: 2796,
        slideNames: ['slide'],
        layers: [{
          id: 'l0', name: 'Phone', type: 'phone', x: 0, y: 0, rotation: 0,
          opacity: 1, visible: true, locked: false, model: 'iphone-16-pro', scale: 1,
          screenshotDataUrl: dataUrl, screenshotFit: 'cover', screenshotOffsetX: 0,
          screenshotOffsetY: 0,
        }],
      }],
    }

    useEditorStore.getState().importTemplateAsNewProject(tpl)
    const phone = getActiveGroup().layers[0] as PhoneLayer
    expect(phone.screenshotPath).toBe('template-import-template-1.jpg')
    expect(phone.screenshotDataUrl).toBeUndefined()
    expect(useAssetStore.getState().assets[phone.screenshotPath!]?.dataUrl).toBe(dataUrl)
  })
})
