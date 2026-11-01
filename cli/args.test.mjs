import { describe, expect, it } from 'vitest'
import { join } from 'path'
import { parseArgs } from './args.mjs'
import { formatDirectoryName, getExportFilePath, normalizeFormatIds } from './formatOptions.mjs'

describe('CLI format arguments', () => {
  it('parses repeated formats in equals and separate-value forms', () => {
    expect(parseArgs([
      '--project=project.json',
      '--format=iphone-69',
      '--format', 'ipad-13',
      '--locale=es',
    ])).toEqual({
      project: 'project.json',
      format: ['iphone-69', 'ipad-13'],
      locale: 'es',
    })
  })

  it('accepts comma-separated formats and removes duplicates', () => {
    expect(normalizeFormatIds(['iphone-69, ipad-13', 'android-phone', 'iphone-69']))
      .toEqual(['iphone-69', 'ipad-13', 'android-phone'])
  })

  it('leaves an omitted format unset so the project defaults can be used', () => {
    expect(normalizeFormatIds(undefined)).toBeUndefined()
  })

  it('rejects an empty or valueless format option', () => {
    expect(() => normalizeFormatIds([''])).toThrow('--format" requires at least one format id')
    expect(() => normalizeFormatIds(['true'])).toThrow('--format" requires at least one format id')
  })

  it('preserves the existing path for one format and separates multiple formats', () => {
    const result = { name: 'Hero', formatId: 'ipad-13' }

    expect(getExportFilePath(join('output', 'es'), result, false))
      .toBe(join('output', 'es', 'Hero.png'))
    expect(getExportFilePath(join('output', 'es'), result, true))
      .toBe(join('output', 'es', 'ipad-13', 'Hero.png'))
  })

  it('keeps custom format ids from becoming path components', () => {
    expect(formatDirectoryName('custom:tablet/family')).toBe('custom-tablet-family')
    expect(formatDirectoryName('..')).toBe('format')
  })
})
