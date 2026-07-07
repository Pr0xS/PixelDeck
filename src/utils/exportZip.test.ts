import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { buildExportZipBlob, zipFileNameFor } from './exportZip'
import type { ProjectImageExportResult } from './multiFormatExport'

const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

function exportResult(overrides: Partial<ProjectImageExportResult>): ProjectImageExportResult {
  return {
    formatId: 'iphone-69' as ProjectImageExportResult['formatId'],
    formatLabel: 'iPhone 69',
    locale: 'en',
    groupId: 'group-1',
    groupName: 'Hero',
    name: 'hero',
    relativePath: 'iphone-69/en/hero',
    dataUrl: TINY_PNG,
    ...overrides,
  }
}

async function fileEntries(blob: Blob): Promise<string[]> {
  const loaded = await JSZip.loadAsync(await blob.arrayBuffer())
  return Object.keys(loaded.files).filter((key) => !loaded.files[key].dir)
}

describe('buildExportZipBlob', () => {
  it('produces a zip with correct entries', async () => {
    const blob = await buildExportZipBlob([
      exportResult({ relativePath: 'iphone-69/en/hero', name: 'hero' }),
      exportResult({ relativePath: 'iphone-69/en/screen2', name: 'screen2' }),
    ])

    expect(await fileEntries(blob)).toEqual([
      'iphone-69/en/hero.png',
      'iphone-69/en/screen2.png',
    ])
  })

  it('produces an empty valid zip archive for empty results', async () => {
    const blob = await buildExportZipBlob([])

    expect(blob.size).toBeGreaterThan(0)
    expect(await fileEntries(blob)).toEqual([])
  })
})

describe('zipFileNameFor', () => {
  it('sanitizes project names into lowercase zip filenames', () => {
    expect(zipFileNameFor('My Cool App')).toBe('my-cool-app-export.zip')
  })

  it('falls back for an empty project name', () => {
    expect(zipFileNameFor('')).toBe('pixeldeck-export.zip')
  })

  it('preserves the existing dash replacement behavior for punctuation', () => {
    expect(zipFileNameFor('!!!')).toBe('----export.zip')
  })
})
