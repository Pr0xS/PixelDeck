import type { Layer, GroupLayer } from '@/types'
import type { EditorStore, EditorSet, EditorGet } from '../types'
import {
  newId,
  bakeLayerScale,
  mutateActiveGroup,
  getActiveGroup,
  patchLayerForFormat,
} from '../helpers'
import { getProjectBaseFormat } from '@/utils/canvasFormats'

export const createGroupSlice = (
  set: EditorSet,
  get: EditorGet,
): Pick<
  EditorStore,
  | 'createGroup'
  | 'dissolveGroup'
  | 'addToGroup'
  | 'removeFromGroup'
  | 'updateChildLayer'
  | 'reorderGroupChildren'
  | 'moveLayerIntoGroup'
  | 'moveChildToTopLevel'
  | 'moveChildBetweenGroups'
> => ({
  // ─ Group actions
  createGroup: (layerIds) => {
    const group = getActiveGroup(get)
    const ids = layerIds.length > 0 ? layerIds : get().selectedLayerIds
    if (!group || ids.length < 2) return

    const toGroup = group.layers.filter((l) => ids.includes(l.id))
    if (toGroup.length < 2) return

    // Auto-flatten: dissolve any nested groups into their children (absolute coords)
    const flatLayers: Layer[] = []
    for (const l of toGroup) {
      if (l.type === 'group') {
        const grp = l as GroupLayer
        const grpScale = grp.scale ?? 1
        for (const child of grp.children) {
          const baked = bakeLayerScale(child, grpScale)
          flatLayers.push({ ...baked, x: baked.x + grp.x, y: baked.y + grp.y } as Layer)
        }
      } else {
        flatLayers.push(l)
      }
    }
    if (flatLayers.length < 2) return

    const minX = Math.min(...flatLayers.map((l) => l.x))
    const minY = Math.min(...flatLayers.map((l) => l.y))

    const newGroup: GroupLayer = {
      id: newId(),
      name: 'Group',
      type: 'group',
      x: minX,
      y: minY,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      children: flatLayers.map((l) => ({
        ...l,
        x: l.x - minX,
        y: l.y - minY,
      })),
    }

    mutateActiveGroup(set, (g) => ({
      ...g,
      layers: [
        ...g.layers.filter((l) => !ids.includes(l.id)),
        newGroup,
      ],
    }))
    set({ selectedLayerIds: [] })
    get().select(newGroup.id)
  },

  dissolveGroup: (groupId) => {
    const group = getActiveGroup(get)
    if (!group) return
    const grp = group.layers.find((l) => l.id === groupId) as GroupLayer | undefined
    if (!grp || grp.type !== 'group') return

    const grpScale = grp.scale ?? 1
    const children = grp.children.map((c) => {
      const baked = bakeLayerScale(c, grpScale)
      return { ...baked, x: baked.x + grp.x, y: baked.y + grp.y }
    })

    mutateActiveGroup(set, (g) => ({
      ...g,
      layers: [
        ...g.layers.filter((l) => l.id !== groupId),
        ...children,
      ],
    }))
  },

  addToGroup: (groupId, layer) => {
    mutateActiveGroup(set, (g) => ({
      ...g,
      layers: g.layers.map((l) => {
        if (l.id !== groupId || l.type !== 'group') return l
        const grp = l as GroupLayer
        return { ...grp, children: [...grp.children, layer] }
      }),
    }))
  },

  removeFromGroup: (groupId, layerId) => {
    mutateActiveGroup(set, (g) => ({
      ...g,
      layers: g.layers.map((l) => {
        if (l.id !== groupId || l.type !== 'group') return l
        const grp = l as GroupLayer
        return { ...grp, children: grp.children.filter((c) => c.id !== layerId) }
      }),
    }))
  },

  reorderGroupChildren: (groupId, childIds) => {
    mutateActiveGroup(set, (g) => ({
      ...g,
      layers: g.layers.map((l) => {
        if (l.id !== groupId || l.type !== 'group') return l
        const grp = l as GroupLayer
        const map = new Map(grp.children.map((c) => [c.id, c]))
        return { ...grp, children: childIds.map((id) => map.get(id)!).filter(Boolean) }
      }),
    }))
  },

  moveLayerIntoGroup: (layerId, groupId, insertBeforeChildId) => {
    mutateActiveGroup(set, (g) => {
      const layer = g.layers.find((l) => l.id === layerId)
      const grp = g.layers.find((l) => l.id === groupId) as GroupLayer | undefined
      // Don't allow nesting groups inside groups, or background layers
      if (!layer || !grp || layer.type === 'background' || layer.type === 'group') return g
      const relLayer = bakeLayerScale(
        { ...layer, x: layer.x - grp.x, y: layer.y - grp.y },
        1 / (grp.scale ?? 1),
      )
      const children = [...grp.children]
      const idx = insertBeforeChildId ? children.findIndex((c) => c.id === insertBeforeChildId) : -1
      if (idx >= 0) children.splice(idx, 0, relLayer)
      else children.push(relLayer)
      return {
        ...g,
        layers: g.layers
          .filter((l) => l.id !== layerId)
          .map((l) => (l.id === groupId ? { ...grp, children } : l)),
      }
    })
  },

  moveChildToTopLevel: (groupId, childId, insertBeforeLayerId) => {
    mutateActiveGroup(set, (g) => {
      const grp = g.layers.find((l) => l.id === groupId) as GroupLayer | undefined
      if (!grp) return g
      const child = grp.children.find((c) => c.id === childId)
      if (!child) return g
      // Absolute coords (bake the group's scale so visual size is preserved)
      const baked = bakeLayerScale(child as Layer, grp.scale ?? 1)
      const absChild: Layer = { ...baked, x: baked.x + grp.x, y: baked.y + grp.y } as Layer
      const updatedGrp = { ...grp, children: grp.children.filter((c) => c.id !== childId) }
      const newLayers = g.layers.map((l) => (l.id === groupId ? updatedGrp : l))
      const bg = newLayers.find((l) => l.type === 'background')
      const content: Layer[] = newLayers.filter((l) => l.type !== 'background')
      // Panel is reversed: "insert before X in panel" = "insert after X in store array"
      const idx = insertBeforeLayerId ? content.findIndex((l) => l.id === insertBeforeLayerId) : -1
      if (idx >= 0) content.splice(idx + 1, 0, absChild)
      else content.push(absChild)
      return { ...g, layers: [...(bg ? [bg] : []), ...content] }
    })
  },

  moveChildBetweenGroups: (fromGroupId, childId, toGroupId, insertBeforeChildId) => {
    mutateActiveGroup(set, (g) => {
      const fromGrp = g.layers.find((l) => l.id === fromGroupId) as GroupLayer | undefined
      const toGrp = g.layers.find((l) => l.id === toGroupId) as GroupLayer | undefined
      if (!fromGrp || !toGrp) return g
      const child = fromGrp.children.find((c) => c.id === childId)
      if (!child) return g
      // Convert through absolute → relative to target group (bake/unbake group scales)
      const abs = bakeLayerScale(child as Layer, fromGrp.scale ?? 1)
      const relChild: Layer = bakeLayerScale(
        { ...abs, x: abs.x + fromGrp.x - toGrp.x, y: abs.y + fromGrp.y - toGrp.y } as Layer,
        1 / (toGrp.scale ?? 1),
      )
      const newFromChildren = fromGrp.children.filter((c) => c.id !== childId)
      const newToChildren = [...toGrp.children]
      const idx = insertBeforeChildId ? newToChildren.findIndex((c) => c.id === insertBeforeChildId) : -1
      if (idx >= 0) newToChildren.splice(idx, 0, relChild)
      else newToChildren.push(relChild)
      return {
        ...g,
        layers: g.layers.map((l) => {
          if (l.id === fromGroupId) return { ...fromGrp, children: newFromChildren }
          if (l.id === toGroupId) return { ...toGrp, children: newToChildren }
          return l
        }),
      }
    })
  },

  updateChildLayer: (groupId, childId, patch) => {
    const { project, activeCanvasFormat } = get()
    const baseFormat = getProjectBaseFormat(project)
    mutateActiveGroup(set, (g) => ({
      ...g,
      layers: g.layers.map((l) => {
        if (l.id !== groupId || l.type !== 'group') return l
        const grp = l as GroupLayer
        return {
          ...grp,
          children: grp.children.map((c) =>
            c.id === childId ? patchLayerForFormat(c, patch, activeCanvasFormat, baseFormat) : c
          ),
        }
      }),
    }))
  },
})
