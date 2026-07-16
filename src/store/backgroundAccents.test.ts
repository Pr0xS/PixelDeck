import { beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from './index'
import type { BackgroundLayer, Layer } from '@/types'

function getBackground(): BackgroundLayer {
  const state = useEditorStore.getState()
  const group = state.project.slideGroups.find((item) => item.id === state.activeSlideGroupId)
  return group!.layers.find((layer) => layer.type === 'background') as BackgroundLayer
}

describe('background accent editing', () => {
  beforeEach(() => {
    useEditorStore.getState().resetProject()
  })

  it('updates the selected second accent without changing the first', () => {
    const background = getBackground()
    const accents = [
      { color: '#7c6ef6', opacity: 0.25, cx: 50, cy: 20, rx: 500, ry: 450 },
      { color: '#ec4899', opacity: 0.25, cx: 18, cy: 78, rx: 420, ry: 480 },
    ]
    useEditorStore.getState().updateLayer(background.id, { accents } as Partial<Layer>)
    useEditorStore.getState().select(background.id)
    useEditorStore.getState().selectAccent(1)

    const current = getBackground()
    useEditorStore.getState().updateLayer(background.id, {
      accents: current.accents.map((accent, index) => (
        index === 1 ? { ...accent, opacity: 0.7 } : accent
      )),
    } as Partial<Layer>)

    expect(getBackground().accents.map((accent) => accent.opacity)).toEqual([0.25, 0.7])
    expect(useEditorStore.getState().selectedAccentIndex).toBe(1)
  })
})
