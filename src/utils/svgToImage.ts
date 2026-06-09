const cache = new Map<string, HTMLImageElement>()

/** Convert an SVG string to a loaded HTMLImageElement (cached). */
export async function svgStringToImage(svgString: string): Promise<HTMLImageElement> {
  const cacheKey = svgString.length + svgString.slice(0, 100)
  if (cache.has(cacheKey)) return cache.get(cacheKey)!

  const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`
  const img = new Image()

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = reject
    img.src = dataUrl
  })

  cache.set(cacheKey, img)
  return img
}

/** Convert a file (from File System Access API or input) to a data URL string. */
export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/** Resize an image data URL to max dimensions while maintaining aspect ratio. */
export async function resizeDataUrl(
  dataUrl: string,
  maxWidth: number,
  maxHeight: number,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const img = new Image()
  await new Promise<void>((resolve) => {
    img.onload = () => resolve()
    img.src = dataUrl
  })

  let { width, height } = img
  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width)
    width = maxWidth
  }
  if (height > maxHeight) {
    width = Math.round((width * maxHeight) / height)
    height = maxHeight
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, width, height)
  return { dataUrl: canvas.toDataURL('image/png'), width, height }
}
