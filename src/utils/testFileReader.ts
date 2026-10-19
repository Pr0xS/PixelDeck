/** Minimal FileReader stand-in for the node test environment (readAsDataURL only). */
export class TestFileReader {
  result: string | null = null
  error: Error | null = null
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  readAsDataURL(blob: Blob): void {
    void blob.arrayBuffer().then(
      (buf) => {
        this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(buf).toString('base64')}`
        this.onload?.()
      },
      (e: Error) => { this.error = e; this.onerror?.() },
    )
  }
}
