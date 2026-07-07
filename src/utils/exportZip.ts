import type { ProjectImageExportResult } from './multiFormatExport'

/**
 * Build a ZIP Blob from exported images. Uses ArrayBuffer (not Blob) as the
 * intermediate representation passed to JSZip — behaviorally identical for
 * the resulting zip content, and reliably supported by JSZip in both the
 * browser and Node (unlike passing a native Blob directly, which JSZip does
 * not consistently accept across environments).
 */
export async function buildExportZipBlob(results: ProjectImageExportResult[]): Promise<Blob> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  for (const item of results) {
    const res = await fetch(item.dataUrl)
    const buf = await res.arrayBuffer()
    zip.file(`${item.relativePath}.png`, buf)
  }
  return zip.generateAsync({ type: 'blob' })
}

/** Sanitize a project name into a safe filename stem for the exported zip. */
export function zipFileNameFor(projectName: string): string {
  return `${projectName.replace(/[^a-z0-9_-]/gi, '-').toLowerCase() || 'pixeldeck'}-export.zip`
}
