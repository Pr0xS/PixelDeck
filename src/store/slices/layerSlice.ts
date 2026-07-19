import type {
  Layer, GroupLayer,
  PhoneLayer, TextLayer, ImageLayer, ShapeLayer, EmojiLayer, BrandLayer,
} from '@/types'
import { getProjectBaseFormat } from '@/utils/canvasFormats'
import { DEFAULT_TEXT_WIDTH } from '@/utils/textRendering'
import type { EditorStore, EditorSet, EditorGet } from '../types'
import {
  newId,
  bakeLayerScale,
  mutateActiveGroup,
  getActiveGroup,
  patchLayerForLocale,
  patchLayerForFormat,
} from '../helpers'

export const createLayerSlice = (
  set: EditorSet,
  get: EditorGet,
): Pick<
  EditorStore,
  | 'addLayer'
  | 'removeLayer'
  | 'updateLayer'
  | 'duplicateLayer'
  | 'moveLayerUp'
  | 'moveLayerDown'
  | 'reorderLayers'
  | 'setLayerVisibility'
  | 'setLayerLocked'
  | 'addPhone'
  | 'addText'
  | 'addImage'
  | 'addImageAt'
  | 'addShape'
  | 'addEmoji'
  | 'addBrand'
  | 'addChipGroup'
> => ({
  // ─ Layer actions
  addLayer: (layer) => {
    const { editingGroupId, activeSlideGroupId, project, activeCanvasFormat } = get()
    const baseFormat = getProjectBaseFormat(project)
    const activeGroupForAdd = getActiveGroup(get)
    let layerToAdd = layer
    if (activeCanvasFormat !== baseFormat && activeGroupForAdd) {
      // Layer is owned by this format — store as-is with ownerFormat tag.
      // No coordinate mapping needed: owned layers only render in their format.
      layerToAdd = { ...layer, ownerFormat: activeCanvasFormat } as Layer
    }
    if (editingGroupId) {
      // Inside group edit mode: add the layer into the group with group-local coords
      const grp = getActiveGroup(get)?.layers.find(
        (l) => l.id === editingGroupId && l.type === 'group',
      ) as GroupLayer | undefined
      if (grp) {
        // Inverse-bake the group's scale so the new layer appears at its natural size/position
        const localLayer: Layer = bakeLayerScale(
          { ...layerToAdd, x: layerToAdd.x - grp.x, y: layerToAdd.y - grp.y },
          1 / (grp.scale ?? 1),
        )
        get().addToGroup(editingGroupId, localLayer)
        set({ selection: { slideGroupId: activeSlideGroupId, layerId: localLayer.id } })
        return
      }
    }
    mutateActiveGroup(set, (g) => ({ ...g, layers: [...g.layers, layerToAdd] }))
    set({ selection: { slideGroupId: get().activeSlideGroupId, layerId: layerToAdd.id } })
  },

  removeLayer: (layerId) => {
    const { editingGroupId, activeSlideGroupId } = get()
    if (editingGroupId) {
      // Check if it's a child of the editing group
      const grp = getActiveGroup(get)?.layers.find(
        (l) => l.id === editingGroupId && l.type === 'group',
      ) as GroupLayer | undefined
      if (grp?.children.some((c) => c.id === layerId)) {
        get().removeFromGroup(editingGroupId, layerId)
        // Stay in group edit mode but deselect the child
        if (get().selection?.layerId === layerId) {
          set({ selection: { slideGroupId: activeSlideGroupId, layerId: null } })
        }
        return
      }
    }
    // Background layer cannot be removed
    const group = getActiveGroup(get)
    if (group?.layers.find((l) => l.id === layerId)?.type === 'background') return
    mutateActiveGroup(set, (g) => ({ ...g, layers: g.layers.filter((l) => l.id !== layerId) }))
    if (get().selection?.layerId === layerId) set({ selection: null, editingGroupId: null })
    if (editingGroupId === layerId) set({ editingGroupId: null })
  },

  updateLayer: (layerId, patch) => {
    // When in group-edit mode, transparently route to the child if the ID matches
    const { editingGroupId, project, activeCanvasFormat, activeLocale } = get()
    const baseFormat = getProjectBaseFormat(project)
    const defaultLocale = project.settings.defaultLocale
    if (editingGroupId) {
      const slideGroup = getActiveGroup(get)
      const groupLayer = slideGroup?.layers.find(
        (l) => l.id === editingGroupId && l.type === 'group',
      ) as GroupLayer | undefined
      if (groupLayer?.children.some((c) => c.id === layerId)) {
        get().updateChildLayer(editingGroupId, layerId, patch)
        return
      }
    }
    mutateActiveGroup(set, (g) => ({
      ...g,
      layers: g.layers.map((l) => {
        if (l.id !== layerId) return l
        const { layer: localized, rest } = patchLayerForLocale(l, patch, activeLocale, defaultLocale)
        return patchLayerForFormat(localized, rest, activeCanvasFormat, baseFormat)
      }),
    }))
  },

  duplicateLayer: (layerId) => {
    const group = getActiveGroup(get)
    if (!group) return
    const src = group.layers.find((l) => l.id === layerId)
    if (!src) return
    const clone: Layer = { ...JSON.parse(JSON.stringify(src)), id: newId(), x: src.x + 20, y: src.y + 20 }
    get().addLayer(clone)
  },

  moveLayerUp: (layerId) => {
    mutateActiveGroup(set, (g) => {
      const idx = g.layers.findIndex((l) => l.id === layerId)
      // Can't move background, and can't move a layer to index 0 (background slot)
      if (idx <= 1 || g.layers[idx]?.type === 'background') return g
      const layers = [...g.layers]
      ;[layers[idx - 1], layers[idx]] = [layers[idx], layers[idx - 1]]
      return { ...g, layers }
    })
  },

  moveLayerDown: (layerId) => {
    mutateActiveGroup(set, (g) => {
      const idx = g.layers.findIndex((l) => l.id === layerId)
      if (idx < 0 || idx >= g.layers.length - 1 || g.layers[idx]?.type === 'background') return g
      const layers = [...g.layers]
      ;[layers[idx], layers[idx + 1]] = [layers[idx + 1], layers[idx]]
      return { ...g, layers }
    })
  },

  reorderLayers: (layerIds) => {
    mutateActiveGroup(set, (g) => {
      const map = new Map(g.layers.map((l) => [l.id, l]))
      // Background stays at index 0
      const bgLayer = g.layers.find((l) => l.type === 'background')
      const ordered = layerIds
        .filter((id) => map.get(id)?.type !== 'background')
        .map((id) => map.get(id)!)
      return { ...g, layers: bgLayer ? [bgLayer, ...ordered] : ordered }
    })
  },

  setLayerVisibility: (layerId, visible) => {
    get().updateLayer(layerId, { visible } as Partial<Layer>)
  },

  setLayerLocked: (layerId, locked) => {
    get().updateLayer(layerId, { locked } as Partial<Layer>)
  },

  // ─ Layer factories
  addPhone: () => {
    const group = getActiveGroup(get)
    if (!group) return
    const layer: PhoneLayer = {
      id: newId(),
      name: 'iPhone 16 Pro',
      type: 'phone',
      x: group.slideWidth / 2 - 195,
      y: group.slideHeight / 2 - 422,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      model: 'iphone-16-pro',
      scale: 2.0,
      screenshotFit: 'cover',
      screenshotOffsetX: 0,
      screenshotOffsetY: 0,
      showStatusBar: true,
      statusBarTheme: 'dark',
      statusBarBg: 'transparent',
      statusBarColor: '#000000',
    }
    get().addLayer(layer)
  },

  addText: () => {
    const group = getActiveGroup(get)
    if (!group) return
    const layer: TextLayer = {
      id: newId(),
      name: 'Text',
      type: 'text',
      x: 100,
      y: 200,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      text: 'Your headline',
      fontFamily: 'Sora',
      fontSize: 100,
      fontWeight: 800,
      fill: '#ffffff',
      letterSpacing: -4,
      lineHeight: 1.0,
      align: 'left',
      width: DEFAULT_TEXT_WIDTH,
    }
    get().addLayer(layer)
  },

  addImage: (src, width, height) => {
    const group = getActiveGroup(get)
    if (!group) return
    const layer: ImageLayer = {
      id: newId(),
      name: 'Image',
      type: 'image',
      x: group.slideWidth / 2 - width / 2,
      y: group.slideHeight / 2 - height / 2,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      src,
      width,
      height,
      cornerRadius: 0,
    }
    get().addLayer(layer)
  },

  addImageAt: (src, width, height, x, y) => {
    const layer: ImageLayer = {
      id: newId(),
      name: 'Image',
      type: 'image',
      x,
      y,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      src,
      width,
      height,
      cornerRadius: 0,
    }
    get().addLayer(layer)
  },

  addShape: () => {
    const group = getActiveGroup(get)
    if (!group) return
    const layer: ShapeLayer = {
      id: newId(),
      name: 'Shape',
      type: 'shape',
      x: 200,
      y: 200,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      shapeType: 'rect',
      width: 600,
      height: 400,
      fill: {
        type: 'linear',
        angle: 120,
        stops: [
          { offset: 0, color: '#FF6F61' },
          { offset: 1, color: '#EC4899' },
        ],
      },
      cornerRadius: 40,
    }
    get().addLayer(layer)
    set({ pendingContentFocusLayerId: layer.id })
  },

  addEmoji: () => {
    const group = getActiveGroup(get)
    if (!group) return
    const layer: EmojiLayer = {
      id: newId(),
      name: 'Emoji',
      type: 'emoji',
      x: group.slideWidth / 2 - 100,
      y: group.slideHeight / 2 - 100,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      emoji: '🚀',
      fontSize: 200,
    }
    get().addLayer(layer)
    set({ pendingContentFocusLayerId: layer.id })
  },

  addBrand: () => {
    const group = getActiveGroup(get)
    if (!group) return
    const { settings } = get().project
    const layer: BrandLayer = {
      id: newId(),
      name: 'Brand',
      type: 'brand',
      x: 100,
      y: 92,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      appName: settings.brandName,
      logoDataUrl: settings.brandLogoDataUrl,
      logoSize: 66,
      nameColor: '#E05243',
      nameFontSize: 40,
      nameFontFamily: 'Sora',
      nameFontWeight: 800,
      direction: 'row',
      gap: 18,
    }
    get().addLayer(layer)
  },

  addChipGroup: () => {
    const group = getActiveGroup(get)
    if (!group) return
    const { settings } = get().project

    const bg: ShapeLayer = {
      id: newId(), name: 'Chip BG', type: 'shape',
      x: 0, y: 0, rotation: 0, opacity: 1, visible: true, locked: false,
      shapeType: 'rect',
      width: 280, height: 72,
      fill: { type: 'linear', angle: 120, stops: [{ offset: 0, color: '#FF6F61' }, { offset: 1, color: '#EC4899' }] },
      cornerRadius: 36,
    }
    const label: TextLayer = {
      id: newId(), name: 'Chip Label', type: 'text',
      x: 32, y: 20, rotation: 0, opacity: 1, visible: true, locked: false,
      text: 'Feature', fontFamily: 'Inter', fontSize: 31, fontWeight: 700,
      fill: '#ffffff', letterSpacing: -0.4, lineHeight: 1, align: 'left',
    }
    const chipGroup: GroupLayer = {
      id: newId(), name: 'Chip', type: 'group',
      x: 100, y: 600, rotation: 0, opacity: 1, visible: true, locked: false,
      children: [bg, label],
    }
    void settings // used for brand context in other factories

    get().addLayer(chipGroup)
  },
})
