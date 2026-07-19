import { describe, it, expect } from 'vitest'
import { buildLocaleManifest, applyLocaleManifest } from './locale.mjs'

const project = {
  name: 'Test',
  settings: { defaultLocale: 'en', locales: ['en', 'es'] },
  slideGroups: [{
    id: 'g1', name: 'Group1',
    layers: [{
      id: 'l1', name: 'Title', type: 'text', text: 'Hello',
      localeOverrides: { es: { text: 'Hola' } },
    }],
  }],
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

describe('CLI locale manifest', () => {
  it('builds a manifest with default content and overrides', () => {
    const manifest = buildLocaleManifest(project)

    expect(manifest.groups).toHaveLength(1)
    expect(manifest.groups[0].name).toBe('Group1')
    expect(manifest.groups[0].layers).toHaveLength(1)
    expect(manifest.groups[0].layers[0].overrides.es.text).toBe('Hola')
    expect(manifest.groups[0].layers[0].default.text).toBe('Hello')
  })

  it('round-trips locale overrides back onto a stripped project', () => {
    const manifest = buildLocaleManifest(project)
    const stripped = clone(project)
    delete stripped.slideGroups[0].layers[0].localeOverrides

    const patched = applyLocaleManifest(stripped, manifest)

    expect(patched.slideGroups[0].layers[0].localeOverrides.es.text).toBe('Hola')
  })

  it('uses manifest locale settings rather than input project settings', () => {
    const manifest = buildLocaleManifest(project)
    manifest.defaultLocale = 'fr'
    manifest.locales = ['fr', 'de']
    const input = clone(project)
    input.settings.defaultLocale = 'en'
    input.settings.locales = ['en', 'es']

    const patched = applyLocaleManifest(input, manifest)

    expect(patched.settings.defaultLocale).toBe('fr')
    expect(patched.settings.locales).toEqual(['fr', 'de'])
  })

  it('leaves localeOverrides absent when all manifest overrides are null', () => {
    const stripped = clone(project)
    delete stripped.slideGroups[0].layers[0].localeOverrides
    const manifest = buildLocaleManifest(project)
    manifest.groups[0].layers[0].overrides = { es: null }

    const patched = applyLocaleManifest(stripped, manifest)

    expect(patched.slideGroups[0].layers[0]).not.toHaveProperty('localeOverrides')
  })

  it('collects and patches nested group layer children', () => {
    const nestedProject = {
      name: 'Nested',
      settings: { defaultLocale: 'en', locales: ['en', 'es'] },
      slideGroups: [{
        id: 'g1', name: 'Group1',
        layers: [{
          id: 'grp', name: 'Wrapper', type: 'group', children: [{
            id: 'child', name: 'Nested Title', type: 'text', text: 'Hello',
            localeOverrides: { es: { text: 'Hola nested' } },
          }],
        }],
      }],
    }
    const manifest = buildLocaleManifest(nestedProject)
    const stripped = clone(nestedProject)
    delete stripped.slideGroups[0].layers[0].children[0].localeOverrides

    const patched = applyLocaleManifest(stripped, manifest)

    expect(manifest.groups[0].layers.map((layer) => layer.id)).toContain('child')
    expect(patched.slideGroups[0].layers[0].children[0].localeOverrides.es.text).toBe('Hola nested')
  })

  it('builds default content and overrides from localeContent', () => {
    const input = clone(project)
    const layer = input.slideGroups[0].layers[0]
    delete layer.text
    delete layer.localeOverrides
    layer.localeContent = { en: { text: 'Def' }, es: { text: 'Hola' } }

    const manifest = buildLocaleManifest(input)

    expect(manifest.groups[0].layers[0].default.text).toBe('Def')
    expect(manifest.groups[0].layers[0].overrides.es.text).toBe('Hola')
  })

  it('prefers default localeContent over the flat text field', () => {
    const input = clone(project)
    const layer = input.slideGroups[0].layers[0]
    layer.text = 'From base field'
    layer.localeContent = { en: { text: 'From content' } }

    const manifest = buildLocaleManifest(input)

    expect(manifest.groups[0].layers[0].default.text).toBe('From content')
  })

  it('applies manifest overrides to localeOverrides and localeContent', () => {
    const input = clone(project)
    delete input.slideGroups[0].layers[0].localeOverrides
    const manifest = buildLocaleManifest(project)

    const patched = applyLocaleManifest(input, manifest)
    const layer = patched.slideGroups[0].layers[0]

    expect(layer.localeOverrides.es.text).toBe('Hola')
    expect(layer.localeContent.es.text).toBe('Hola')
    expect(layer.localeContent.es).toBe(layer.localeOverrides.es)
  })

  it('preserves unrelated localeContent entries when applying overrides', () => {
    const input = clone(project)
    delete input.slideGroups[0].layers[0].localeOverrides
    input.slideGroups[0].layers[0].localeContent = { fr: { text: 'Bonjour' } }
    const manifest = buildLocaleManifest(project)

    const patched = applyLocaleManifest(input, manifest)
    const layer = patched.slideGroups[0].layers[0]

    expect(layer.localeContent.fr).toEqual({ text: 'Bonjour' })
    expect(layer.localeContent.es).toEqual({ text: 'Hola' })
  })
})
