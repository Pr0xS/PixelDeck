import { describe, expect, it, vi } from 'vitest'
import { applyGalleryTemplate, type GalleryApplyDeps } from './galleryApply'
import type { Template } from '@/types'

const entry = { slug: 'pulse', name: 'Pulse', description: '', file: '/templates/pulse.template.json' }
const template = { name: 'Pulse' } as Template

function makeDeps(overrides: Partial<GalleryApplyDeps> = {}) {
  const applying: Array<string | null> = []
  const errors: Array<string | null> = []
  const deps: GalleryApplyDeps = {
    fetchBundle: async () => ({ template, assets: [] }),
    createProject: vi.fn(async () => {}),
    addSlides: vi.fn(),
    setApplying: (k) => { applying.push(k) },
    setError: (m) => { errors.push(m) },
    onDone: vi.fn(),
    ...overrides,
  }
  return { deps, applying, errors }
}

describe('applyGalleryTemplate', () => {
  it('clears the busy flag after success so the gallery can be used again', async () => {
    const { deps, applying } = makeDeps()
    await applyGalleryTemplate(entry, 'new', deps)
    await applyGalleryTemplate(entry, 'append', deps)
    expect(applying).toEqual(['new:pulse', null, 'append:pulse', null])
    expect(deps.createProject).toHaveBeenCalledTimes(1)
    expect(deps.addSlides).toHaveBeenCalledTimes(1)
    expect(deps.onDone).toHaveBeenCalledTimes(2)
  })

  it('surfaces a failure and still clears the busy flag', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { deps, applying, errors } = makeDeps({ fetchBundle: async () => { throw new Error('HTTP 404') } })
    await applyGalleryTemplate(entry, 'new', deps)
    expect(applying).toEqual(['new:pulse', null])
    expect(errors.at(-1)).toContain('HTTP 404')
    expect(deps.onDone).not.toHaveBeenCalled()
  })
})
