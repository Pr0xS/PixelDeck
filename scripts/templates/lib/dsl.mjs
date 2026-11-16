/**
 * Tiny layer DSL for authoring bundled templates in code.
 *
 * Every factory returns a plain layer object in the exact shape the editor
 * stores (see src/types/index.ts). Ids are assigned later by finalizeTemplate.
 * Coordinates are in the base authoring canvas (1290×2796). `x`/`y` are the
 * top-left of the unrotated box; rotation pivots around the box centre.
 */

export const W = 1290
export const H = 2796
export const DEFAULT_LOCALE = 'en'

/** Frame sizes from src/assets/mockups/specs.ts (keep in sync). */
export const DEVICES = {
  'iphone-16-pro': { w: 390, h: 844 },
  'iphone-16-pro-plain': { w: 390, h: 844 },
  'pixel-9': { w: 380, h: 820 },
  'pixel-9-plain': { w: 380, h: 820 },
}

// ─── Fills / effects ──────────────────────────────────────────────────────────

/** Linear gradient. Stops are colors (evenly spaced) or [offset, color] pairs. */
export function lin(angle, ...stops) {
  return { type: 'linear', angle, stops: toStops(stops) }
}

/** Radial gradient. cx/cy are 0–1 fractions, radius a fraction of the shorter side. */
export function rad(cx, cy, radius, ...stops) {
  return { type: 'radial', cx, cy, radius, stops: toStops(stops) }
}

function toStops(stops) {
  return stops.map((s, i) => Array.isArray(s)
    ? { offset: s[0], color: s[1] }
    : { offset: stops.length === 1 ? 0 : i / (stops.length - 1), color: s })
}

/** Background glow. cx/cy are 0–100 (% of canvas), rx/ry are px. */
export function glow(color, cx, cy, rx, ry, opacity, blur) {
  return { color, cx, cy, rx, ry, ...(opacity !== undefined ? { opacity } : {}), ...(blur ? { blur } : {}) }
}

export function shadow(color, blur, offsetY, opacity, offsetX = 0) {
  return { color, blur, offsetX, offsetY, opacity }
}

// ─── Rich text markup ─────────────────────────────────────────────────────────

/**
 * Parse `Plain {{styled}} plain` into clean text + marks.
 * `styles` is one style object (applied to every segment) or an array (one per segment).
 */
export function parseRich(source, styles) {
  let text = ''
  const marks = []
  let index = 0
  const re = /\{\{([\s\S]*?)\}\}/g
  let last = 0
  let match
  while ((match = re.exec(source))) {
    text += source.slice(last, match.index)
    const start = text.length
    text += match[1]
    const style = Array.isArray(styles) ? styles[index] ?? styles[styles.length - 1] : styles
    if (style) marks.push({ start, end: text.length, ...style })
    index++
    last = match.index + match[0].length
  }
  text += source.slice(last)
  return { text, marks }
}

// ─── Layer factories ──────────────────────────────────────────────────────────

const PASSTHROUGH = ['formatOverrides', 'formatVisibility', 'ownerFormat', 'localeAdjust', 'localizationMode', 'blur', 'shadow']

function baseLayer(type, name, o) {
  const layer = {
    id: '',
    name: o.name ?? name,
    type,
    x: o.x ?? 0,
    y: o.y ?? 0,
    rotation: o.rotation ?? 0,
    opacity: o.opacity ?? 1,
    visible: o.visible ?? true,
    locked: o.locked ?? false,
  }
  for (const key of PASSTHROUGH) if (o[key] !== undefined) layer[key] = o[key]
  return layer
}

export function bg(fill, o = {}) {
  return {
    ...baseLayer('background', 'Background', { ...o, locked: true }),
    fill,
    accents: o.accents ?? [],
    ...(o.noise !== undefined ? { noise: o.noise } : {}),
    ...(o.image ? { imageRef: o.image, imageFit: o.imageFit ?? 'cover' } : {}),
    ...(o.imageBlur !== undefined ? { imageBlur: o.imageBlur } : {}),
    ...(o.imageOverlayColor ? { imageOverlayColor: o.imageOverlayColor, imageOverlayOpacity: o.imageOverlayOpacity ?? 0.4 } : {}),
  }
}

/**
 * Text layer. `o.mark` styles every `{{segment}}`; `o.l10n` maps locale → translated
 * source (same markup). `o.cx` centres the box horizontally on that x.
 */
export function text(source, o = {}) {
  const { text: plain, marks } = parseRich(source, o.mark)
  const width = o.width
  const layer = {
    ...baseLayer('text', 'Text', { ...o, x: o.cx !== undefined && width ? o.cx - width / 2 : o.x }),
    text: plain,
    fontFamily: o.font ?? 'Inter',
    fontSize: o.size ?? 48,
    fontWeight: o.weight ?? 400,
    ...(o.italic ? { italic: true } : {}),
    fill: o.fill ?? '#FFFFFF',
    letterSpacing: o.spacing ?? 0,
    lineHeight: o.leading ?? 1.15,
    align: o.align ?? 'left',
    ...(width !== undefined ? { width } : {}),
    ...(o.height !== undefined ? { height: o.height, verticalAlign: o.valign ?? 'top' } : {}),
    ...(marks.length ? { marks } : {}),
  }
  const localeContent = { [DEFAULT_LOCALE]: { text: plain, ...(marks.length ? { marks } : {}) } }
  for (const [locale, translated] of Object.entries(o.l10n ?? {})) {
    const parsed = parseRich(translated, o.mark)
    localeContent[locale] = { text: parsed.text, ...(parsed.marks.length ? { marks: parsed.marks } : {}) }
  }
  layer.localeContent = localeContent
  return layer
}

/**
 * Device mockup. `o.screen` is an asset key; `o.cx` centres the frame on that x.
 * `o.l10n` maps locale → asset key (per-locale screenshot).
 */
export function phone(o = {}) {
  const model = o.model ?? 'iphone-16-pro'
  const scale = o.scale ?? 2.4
  const frame = DEVICES[model]
  const layer = {
    ...baseLayer('phone', 'Phone', { ...o, x: o.cx !== undefined ? o.cx - (frame.w * scale) / 2 : o.x }),
    model,
    scale,
    ...(o.screen ? { screenshotPath: o.screen } : {}),
    screenshotFit: o.fit ?? 'cover',
    screenshotOffsetX: 0,
    screenshotOffsetY: 0,
    showStatusBar: o.statusBar !== false,
    statusBarTheme: o.statusBar === 'light' ? 'light' : 'dark',
    statusBarBg: 'transparent',
    statusBarColor: '#000000',
    ...(o.border ? { border: o.border } : {}),
  }
  const localeContent = { [DEFAULT_LOCALE]: o.screen ? { screenshotPath: o.screen } : {} }
  for (const [locale, key] of Object.entries(o.l10n ?? {})) localeContent[locale] = { screenshotPath: key }
  layer.localeContent = localeContent
  return layer
}

/** Pixel size of a phone frame at a given scale. */
export function phoneSize(scale, model = 'iphone-16-pro') {
  return { w: DEVICES[model].w * scale, h: DEVICES[model].h * scale }
}

/** Keep in sync with ShapeType in src/types/index.ts: an unknown type silently renders as a rect. */
const SHAPE_TYPES = new Set(['rect', 'ellipse', 'arrow', 'triangle', 'star', 'pentagon', 'hexagon', 'diamond', 'cross', 'check'])

export function shape(shapeType, o = {}) {
  if (!SHAPE_TYPES.has(shapeType)) throw new Error(`Unknown shape type "${shapeType}" (use one of: ${[...SHAPE_TYPES].join(', ')})`)
  return {
    ...baseLayer('shape', 'Shape', { ...o, x: o.cx !== undefined ? o.cx - o.width / 2 : o.x }),
    shapeType,
    width: o.width,
    height: o.height,
    fill: o.fill ?? '#FFFFFF',
    cornerRadius: o.radius ?? 0,
    ...(o.stroke ? { stroke: o.stroke, strokeWidth: o.strokeWidth ?? 2 } : {}),
    ...(o.starPoints ? { starPoints: o.starPoints } : {}),
    ...(o.starInnerRatio ? { starInnerRatio: o.starInnerRatio } : {}),
    ...(o.arrowDirection ? { arrowDirection: o.arrowDirection } : {}),
  }
}

/** Image layer. `key` is an asset key; `o.l10n` maps locale → asset key. */
export function image(key, o = {}) {
  const layer = {
    ...baseLayer('image', 'Image', { ...o, x: o.cx !== undefined ? o.cx - o.width / 2 : o.x }),
    src: key,
    width: o.width,
    height: o.height,
    cornerRadius: o.radius ?? 0,
  }
  const localeContent = { [DEFAULT_LOCALE]: { src: key } }
  for (const [locale, localized] of Object.entries(o.l10n ?? {})) localeContent[locale] = { src: localized }
  layer.localeContent = localeContent
  return layer
}

/**
 * Place a rendered art entry (`a.<id>`) as an image layer. `x`/`y`/`cx` position
 * the DECLARED art box and `o.k` scales its logical size to canvas px
 * (k ≈ phoneScale × 0.9 matches the UI inside a phone).
 *
 * Transparent art is stored cropped to its visible pixels, so the layer box is
 * tight to the card; this keeps the card exactly where the declared box would
 * have drawn it, also under rotation. A soft shadow lifted from the artwork is
 * cast by the layer (pass `shadow` to override it, `shadow: false` for none).
 */
export function art(entry, o = {}) {
  const k = o.k ?? 2.2
  const fw = (entry.fw ?? entry.w) * k
  const fh = (entry.fh ?? entry.h) * k
  const w = entry.w * k
  const h = entry.h * k
  const boxX = o.cx !== undefined ? o.cx - fw / 2 : o.x ?? 0
  const boxY = o.y ?? 0
  const offX = (entry.dx ?? 0) * k + w / 2 - fw / 2
  const offY = (entry.dy ?? 0) * k + h / 2 - fh / 2
  const angle = ((o.rotation ?? 0) * Math.PI) / 180
  const centreX = boxX + fw / 2 + offX * Math.cos(angle) - offY * Math.sin(angle)
  const centreY = boxY + fh / 2 + offX * Math.sin(angle) + offY * Math.cos(angle)

  const { cx: _cx, shadow: requested, ...rest } = o
  const lifted = entry.shadow && {
    color: entry.shadow.color,
    blur: entry.shadow.blur * k,
    offsetX: entry.shadow.offsetX * k,
    offsetY: entry.shadow.offsetY * k,
    opacity: entry.shadow.opacity,
  }
  const cast = requested === false ? undefined : requested ?? lifted ?? undefined
  return image(entry.key, {
    name: 'Card', ...rest, x: centreX - w / 2, y: centreY - h / 2, width: w, height: h, ...(cast ? { shadow: cast } : {}),
  })
}

export function emoji(char, o = {}) {
  return { ...baseLayer('emoji', `Emoji ${char}`, o), emoji: char, fontSize: o.size ?? 200 }
}

export function brand(appName, o = {}) {
  return {
    ...baseLayer('brand', 'Brand', o),
    appName,
    ...(o.logo ? { logoRef: o.logo } : {}),
    logoSize: o.logoSize ?? 66,
    nameColor: o.color ?? '#FFFFFF',
    nameFontSize: o.size ?? 40,
    nameFontFamily: o.font ?? 'Sora',
    nameFontWeight: o.weight ?? 800,
    direction: o.direction ?? 'row',
    gap: o.gap ?? 18,
  }
}

/** Group. Children coordinates are relative to the group's x/y. */
export function group(children, o = {}) {
  return {
    ...baseLayer('group', 'Group', o),
    children,
    ...(o.scale !== undefined ? { scale: o.scale } : {}),
  }
}

/** One slide group. `o.slides` > 1 makes a pano canvas (W × slides wide). */
export function slide(name, layers, o = {}) {
  if (layers[0]?.type !== 'background') throw new Error(`Slide "${name}": first layer must be a background`)
  return {
    name,
    numSlides: o.slides ?? 1,
    slideWidth: o.width ?? W,
    slideHeight: o.height ?? H,
    layers,
    slideNames: [],
    ...(o.formats ? { formats: o.formats } : {}),
  }
}

// ─── Finalisation ─────────────────────────────────────────────────────────────

const REF_FIELDS = ['screenshotPath', 'src', 'imageRef', 'logoRef']

function walk(layers, fn) {
  for (const layer of layers) {
    fn(layer)
    if (layer.type === 'group') walk(layer.children, fn)
  }
}

/** Every asset key referenced by a set of slide groups (all locales and formats). */
export function collectRefs(slideGroups) {
  const refs = new Set()
  const read = (rec) => {
    if (!rec || typeof rec !== 'object') return
    for (const field of REF_FIELDS) if (typeof rec[field] === 'string' && rec[field]) refs.add(rec[field])
  }
  for (const g of slideGroups) {
    walk(g.layers, (layer) => {
      read(layer)
      for (const content of Object.values(layer.localeContent ?? {})) read(content)
      for (const patch of Object.values(layer.formatOverrides ?? {})) read(patch)
    })
  }
  return refs
}

/**
 * Assign deterministic layer ids (l0, l1, …) and sequential slide names
 * (slide-01, slide-02, …) so committed JSON diffs stay clean and exported
 * files sort in listing order.
 */
export function finalizeSlideGroups(slideGroups) {
  let slideNo = 0
  return slideGroups.map((g) => {
    let id = 0
    walk(g.layers, (layer) => { layer.id = `l${id++}` })
    const slideNames = Array.from({ length: g.numSlides }, () => `slide-${String(++slideNo).padStart(2, '0')}`)
    return { ...g, slideNames }
  })
}
