import { join } from 'path'

export function normalizeFormatIds(value) {
  if (value === undefined) return undefined

  const values = Array.isArray(value) ? value : [value]
  const formatIds = values.flatMap((item) => {
    if (typeof item !== 'string') {
      throw new Error('Export option "--format" must contain format ids as strings.')
    }
    return item.split(',').map((formatId) => formatId.trim()).filter(Boolean)
  })

  if (formatIds.length === 0 || formatIds.includes('true')) {
    throw new Error('Export option "--format" requires at least one format id.')
  }

  return [...new Set(formatIds)]
}

export function formatDirectoryName(formatId) {
  const safeName = String(formatId)
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')

  return safeName && safeName !== '.' && safeName !== '..' ? safeName : 'format'
}

export function getExportFilePath(outputDir, result, useFormatDirectories) {
  const filename = result.name.endsWith('.png') ? result.name : `${result.name}.png`
  return useFormatDirectories
    ? join(outputDir, formatDirectoryName(result.formatId), filename)
    : join(outputDir, filename)
}
