import { describe, it, expect } from 'vitest'
import {
  resolveLayerLocale,
  applyLocale,
  getLocalizableLayers,
  buildLocaleManifest,
  applyLocaleManifest,
} from './locale'
import type { Project, TextLayer, Layer, SlideGroup } from '@/types'

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeTextLayer(overrides?: Partial<TextLayer>): TextLayer {
  return {
    id: 'text1',
    name: 'Title',
    type: 'text',
    x: 0,
    y: 0,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    text: 'Hello',
    fontFamily: 'Inter',
    fontSize: 24,
    fontWeight: 400,
    fill: '#ffffff',
    letterSpacing: 0,
    lineHeight: 1,
    align: 'left',
    ...overrides,
  }
}

function makeProject(layers: Layer[] = []): Project {
  return {
    id: 'proj1',
    name: 'Test Project',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    settings: {
      defaultSlideWidth: 1290,
      defaultSlideHeight: 2796,
      defaultLocale: 'en',
      locales: ['en', 'es'],
      brandName: 'TestApp',
    },
    slideGroups: [
      {
        id: 'sg1',
        name: 'Slide 1',
        numSlides: 1,
        slideWidth: 1290,
        slideHeight: 2796,
        slideNames: ['slide-01'],
        layers,
      } satisfies SlideGroup,
    ],
  }
}

// ─── resolveLayerLocale ───────────────────────────────────────────────────────

describe('resolveLayerLocale', () => {
  it('returns the layer unchanged when there are no locale overrides', () => {
    const layer = makeTextLayer()
    const result = resolveLayerLocale(layer, 'es')
    expect(result).toBe(layer)
  })

  it('returns the layer unchanged when no content exists for the given locale', () => {
    const layer = makeTextLayer({
      localeContent: { fr: { text: 'Bonjour' } },
    })
    const result = resolveLayerLocale(layer, 'es')
    expect(result).toBe(layer)
  })

  it('shallowly merges the matching locale patch into the layer', () => {
    const layer = makeTextLayer({
      localeContent: { es: { text: 'Hola' } },
    })
    const result = resolveLayerLocale(layer, 'es')
    expect(result).not.toBe(layer)
    expect((result as TextLayer).text).toBe('Hola')
    // Unoverridden properties are preserved
    expect(result.id).toBe('text1')
    expect(result.opacity).toBe(1)
  })

  it('reads localeContent', () => {
    const layer = makeTextLayer({
      localeContent: { es: { text: 'Hola' } },
    })

    const result = resolveLayerLocale(layer, 'es')

    expect(result.text).toBe('Hola')
  })

  it('returns the layer unchanged when localeContent has no requested locale', () => {
    const layer = makeTextLayer({
      localeContent: { fr: { text: 'Bonjour' } },
    })

    expect(resolveLayerLocale(layer, 'es')).toBe(layer)
  })
})

// ─── applyLocale ──────────────────────────────────────────────────────────────

describe('applyLocale', () => {
  it('returns the same project reference when locale equals defaultLocale', () => {
    const project = makeProject([makeTextLayer()])
    const result = applyLocale(project, 'en')
    expect(result).toBe(project)
  })

  it('applies a text override to a TextLayer in a SlideGroup', () => {
    const layer = makeTextLayer({
      localeContent: { es: { text: 'Hola mundo' } },
    })
    const project = makeProject([layer])
    const result = applyLocale(project, 'es')

    expect(result).not.toBe(project)
    const resolved = result.slideGroups[0].layers.find((l) => l.id === 'text1') as TextLayer
    expect(resolved.text).toBe('Hola mundo')
  })

  it('leaves layers that have no override for the given locale unchanged', () => {
    const layer = makeTextLayer() // no localeContent
    const project = makeProject([layer])
    const result = applyLocale(project, 'es')
    const resolved = result.slideGroups[0].layers.find((l) => l.id === 'text1') as TextLayer
    expect(resolved.text).toBe('Hello')
  })

  it('applies localeContent when legacy locale overrides are absent', () => {
    const project = makeProject([
      makeTextLayer({ localeContent: { es: { text: 'Hola mundo' } } }),
    ])

    const result = applyLocale(project, 'es')
    const resolved = result.slideGroups[0].layers.find((l) => l.id === 'text1') as TextLayer

    expect(resolved.text).toBe('Hola mundo')
  })
})

// ─── getLocalizableLayers ────────────────────────────────────────────────────

describe('getLocalizableLayers', () => {
  it('prefers default-locale content over a stale flat text field', () => {
    const project = makeProject([
      makeTextLayer({
        text: 'From base field',
        localeContent: { en: { text: 'From content' } },
      }),
    ])

    expect(getLocalizableLayers(project)[0].defaultText).toBe('From content')
  })
})

// ─── buildLocaleManifest ──────────────────────────────────────────────────────

describe('buildLocaleManifest', () => {
  it('returns the correct top-level structure', () => {
    const project = makeProject([makeTextLayer({ localeContent: { en: { text: 'Hello' } } })])
    const manifest = buildLocaleManifest(project)

    expect(manifest.project).toBe('Test Project')
    expect(manifest.defaultLocale).toBe('en')
    expect(manifest.locales).toEqual(['en', 'es'])
    expect(manifest.groups).toHaveLength(1)
  })

  it('includes only text/phone/image layers (excludes background)', () => {
    const bg: Layer = {
      id: 'bg1',
      name: 'Background',
      type: 'background',
      x: 0,
      y: 0,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: true,
      fill: '#000000',
      accents: [],
    }
    const project = makeProject([bg, makeTextLayer()])
    const manifest = buildLocaleManifest(project)

    expect(manifest.groups[0].layers).toHaveLength(1)
    expect(manifest.groups[0].layers[0].type).toBe('text')
  })

  it('captures default text and null override for non-default locales', () => {
    const project = makeProject([makeTextLayer({ localeContent: { en: { text: 'Hello' } } })])
    const manifest = buildLocaleManifest(project)
    const entry = manifest.groups[0].layers[0]

    expect(entry.default.text).toBe('Hello')
    expect(entry.overrides['es']).toBeNull()
  })

  it('captures existing locale content', () => {
    const layer = makeTextLayer({ localeContent: { en: { text: 'Hello' }, es: { text: 'Hola' } } })
    const project = makeProject([layer])
    const manifest = buildLocaleManifest(project)
    const entry = manifest.groups[0].layers[0]

    expect(entry.overrides['es']).toEqual({ text: 'Hola' })
  })

  it('sources default and override text from localeContent', () => {
    const layer = makeTextLayer({
      text: 'Stale default',
      localeContent: {
        en: { text: 'Def' },
        es: { text: 'Hola' },
      },
    })

    const entry = buildLocaleManifest(makeProject([layer])).groups[0].layers[0]

    expect(entry.default.text).toBe('Def')
    expect(entry.overrides.es?.text).toBe('Hola')
  })
})

// ─── applyLocaleManifest ──────────────────────────────────────────────────────

describe('applyLocaleManifest', () => {
  it('round-trip: build manifest then apply returns layers with the original locale content', () => {
    const layer = makeTextLayer({ localeContent: { en: { text: 'Hello' }, es: { text: 'Hola' } } })
    const project = makeProject([layer])

    const manifest = buildLocaleManifest(project)
    const result = applyLocaleManifest(project, manifest)

    const resultLayer = result.slideGroups[0].layers.find((l) => l.id === 'text1')
    expect(resultLayer?.localeContent?.['es']?.text).toBe('Hola')
  })

  it('updates locales and defaultLocale from the manifest', () => {
    const project = makeProject([makeTextLayer()])
    const manifest = buildLocaleManifest(project)
    const result = applyLocaleManifest(project, manifest)

    expect(result.settings.defaultLocale).toBe('en')
    expect(result.settings.locales).toEqual(['en', 'es'])
  })

  it('does not add localeContent to layers with no non-null overrides in the manifest', () => {
    // Layer has no pre-existing overrides; manifest will have null for 'es'
    const project = makeProject([makeTextLayer()])
    const manifest = buildLocaleManifest(project)
    // All overrides are null → applyLocaleManifest should not inject localeContent
    const result = applyLocaleManifest(project, manifest)
    const resultLayer = result.slideGroups[0].layers.find((l) => l.id === 'text1')
    expect(resultLayer?.localeContent).toBeUndefined()
  })

  it('writes imported overrides to localeContent', () => {
    const project = makeProject([makeTextLayer()])
    const manifest = buildLocaleManifest(project)
    manifest.groups[0].layers[0].overrides.es = { text: 'Hola' }

    const result = applyLocaleManifest(project, manifest)
    const resultLayer = result.slideGroups[0].layers.find((l) => l.id === 'text1')

    expect(resultLayer?.localeContent?.es).toEqual({ text: 'Hola' })
  })
})
