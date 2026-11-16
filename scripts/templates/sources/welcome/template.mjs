/**
 * Welcome tour: the project a new user lands in on first run. One feature per
 * slide, every explanation demonstrated by a real layer the user can poke at.
 * English is the default locale; Spanish is a real second locale so the
 * localization and per-locale layout slides are live demos, not descriptions.
 */
import {
  art, bg, brand, emoji, glow, group, image, lin, phone, phoneSize, shadow, shape, slide, text, W, H,
} from '../../lib/dsl.mjs'
import {
  STR, formatsDiagram, galleryDiagram, homeScreen, logoMark, matrixDiagram, photo, tableDiagram, tiersDiagram,
} from './parts.mjs'

const FONTS = ['family=Inter:wght@400;500;600;700;800', 'family=Sora:wght@600;700;800']
// Not cropped: the EN and ES renders of a diagram are swapped into the same layer box.
const diagram = (html, width, height) => ({ html, width, height, transparent: true, crop: false, fonts: FONTS })

// The editor marks format-scoped editing in amber and locale-scoped editing in teal; the tour uses the same code.
const VIOLET = '#A78BFA'
const AMBER = '#F59E0B'
const TEAL = '#22D3C5'
const INK = '#FFFFFF'
const BODY = '#C9C9D8'
const GRAD = lin(90, '#B49EFF', '#EC4899')

const B = { fontWeight: 700, fill: INK }
const V = { fontWeight: 700, fill: VIOLET }
const A = { fontWeight: 700, fill: AMBER }
const T = { fontWeight: 700, fill: TEAL }

const M = 96
const CW = W - 2 * M
const LOCALES = ['en', 'es']
const FORMATS = ['iphone-69', 'android-phone']
const ANDROID = { w: 1080, h: 1920 }
const ANDROID_F = Math.min(ANDROID.w / W, ANDROID.h / H)
/** Base-canvas point → Android-format point (the editor's fit-centre projection). */
const toAndroid = (x, y) => ({ x: ANDROID.w / 2 + (x - W / 2) * ANDROID_F, y: ANDROID.h / 2 + (y - H / 2) * ANDROID_F })

const lineCount = (...sources) => Math.max(...sources.map((s) => s.split('\n').length))

const GLOWS = {
  violet: [glow('#7C5CF6', 88, 6, 900, 800, 0.3), glow('#EC4899', 4, 96, 800, 760, 0.14)],
  amber: [glow(AMBER, 88, 6, 900, 800, 0.2), glow('#7C5CF6', 4, 96, 800, 760, 0.2)],
  teal: [glow(TEAL, 88, 6, 900, 800, 0.2), glow('#7C5CF6', 4, 96, 800, 760, 0.2)],
  both: [glow(AMBER, 6, 8, 800, 760, 0.18), glow(TEAL, 94, 10, 800, 760, 0.18), glow('#7C5CF6', 50, 100, 900, 700, 0.18)],
}
const tourBg = (kind = 'violet', o = {}) => bg(lin(160, '#12101E', '#1C1929', '#0F0E1A'), { accents: GLOWS[kind], noise: 0.04, ...o })

const step = (n, en, es, o = {}) => text(`${n} · ${en}`, {
  name: 'Step', l10n: { es: `${n} · ${es}` }, font: 'Inter', weight: 700, size: 32, spacing: 5, fill: VIOLET,
  x: M, y: 150, width: 1000, ...o,
})

const title = (en, es, o = {}) => text(en, {
  name: 'Title', l10n: { es }, font: 'Sora', weight: 800, size: 112, leading: 1.04, spacing: -3, fill: INK,
  x: M, y: 215, width: 1100, mark: { fill: GRAD }, ...o,
})

/** Stack paragraphs ([en, es, markStyles?]); returns the layers and the y where they end. */
function body(paragraphs, { x = M, y = 500, width = CW, size = 46 } = {}) {
  const leading = 1.3
  const layers = []
  let cursor = y
  paragraphs.forEach(([en, es, mark], i) => {
    layers.push(text(en, {
      name: `Body ${i + 1}`, l10n: { es }, font: 'Inter', weight: 500, size, leading, fill: BODY, x, y: cursor, width, mark,
    }))
    cursor += lineCount(en, es) * size * leading + 34
  })
  return { layers, end: cursor - 34 }
}

/** "Try it" call-out anchored to the bottom of the slide. Returns its layers and top edge. */
function tryIt(en, es, { x = M, width = CW, bottom = H - 96, label = ['TRY IT', 'PRUÉBALO'], color = VIOLET } = {}) {
  const size = 44
  const leading = 1.25
  const height = 54 + 30 + 20 + lineCount(en, es) * size * leading + 50
  const top = bottom - height
  return {
    top,
    layers: [
      shape('rect', { name: 'Try it card', x, y: top, width, height, radius: 40, fill: '#1E1B2E', stroke: color, strokeWidth: 3 }),
      text(label[0], { name: 'Try it label', l10n: { es: label[1] }, font: 'Inter', weight: 800, size: 30, spacing: 5, fill: color, x: x + 48, y: top + 50, width: width - 96 }),
      text(en, { name: 'Try it', l10n: { es }, font: 'Inter', weight: 600, size, leading, fill: INK, x: x + 48, y: top + 104, width: width - 96 }),
    ],
  }
}

/** A pill that only exists in one view: the live proof that a format tab was switched. */
function formatNote(en, es, y, visibility, color) {
  const height = 96
  return [
    shape('rect', { name: `Note ${en}`, x: M, y, width: CW, height, radius: 48, fill: 'rgba(255,255,255,0.07)', stroke: color, strokeWidth: 3, ...visibility }),
    text(en, { name: `Note text ${en}`, l10n: { es }, font: 'Inter', weight: 700, size: 40, fill: color, align: 'center', x: M, y: y + 24, width: CW, ...visibility }),
  ]
}
const ONLY_BASE = { formatVisibility: { 'iphone-69': false, 'android-phone': false } }
const onlyIn = (format) => ({ ownerFormat: format })

const deviceShadow = shadow('#000000', 100, 50, 0.55)

/** y that centres a block of `height` between the end of the copy and the call-out. */
const centred = (copy, cta, height) => copy.end + Math.max(50, (cta.top - copy.end - height) / 2)

export default {
  slug: 'welcome',
  order: 0,
  tour: true,
  name: 'Welcome to PixelDeck',
  category: 'Tour',
  description: 'A hands-on tour: one feature per slide, from panoramas and layers to formats, localization and export.',
  settings: {
    brandName: 'PixelDeck',
    locales: LOCALES,
    activeFormats: FORMATS,
    brandColors: [
      { id: 'pdviolet', name: 'Violet', value: '#8B6CF7' },
      { id: 'pdpink', name: 'Pink', value: '#EC4899' },
      { id: 'pdaccent', name: 'Accent', value: '#FF7A59' },
    ],
  },
  art: {
    logo: diagram(logoMark(), 136, 144),
    home: { html: homeScreen(STR.en), fonts: FONTS },
    homeEs: { html: homeScreen(STR.es), fonts: FONTS },
    photoPeak: { html: photo('🏔️', 'Alpine morning', 'Photo layer', 'linear-gradient(160deg,#5b8def,#7c5cf6)'), width: 300, height: 300, fonts: FONTS },
    photoSea: { html: photo('🌊', 'Open water', 'Photo layer', 'linear-gradient(160deg,#22d3c5,#3b82f6)'), width: 300, height: 300, fonts: FONTS },
    photoCity: { html: photo('🌇', 'Golden hour', 'Photo layer', 'linear-gradient(160deg,#f59e0b,#ec4899)'), width: 300, height: 300, fonts: FONTS },
    formats: diagram(formatsDiagram(STR.en), 600, 340),
    formatsEs: diagram(formatsDiagram(STR.es), 600, 340),
    tiers: diagram(tiersDiagram(STR.en), 420, 250),
    tiersEs: diagram(tiersDiagram(STR.es), 420, 250),
    table: diagram(tableDiagram(STR.en), 430, 262),
    tableEs: diagram(tableDiagram(STR.es), 430, 262),
    gallery: diagram(galleryDiagram(), 640, 250),
  },
  /** The export slide quotes the real file count, so its art depends on how many screenshots the tour has. */
  lateArt({ screenshots }) {
    return { matrix: diagram(matrixDiagram(screenshots - 3), 560, 330) }
  },
  build({ a, late }) {
    const esImg = (en, es) => ({ l10n: { es: es.key } })
    const slides = []

    // 01 ── Welcome ──────────────────────────────────────────────────────────
    {
      const copy = body([
        ['This project is a hands-on tour.\nEach slide explains one feature.', 'Este proyecto es una visita guiada.\nCada diapositiva explica una función.'],
        ['Click anything. Move it. Edit it.\nIt is yours to break.', 'Haz clic en lo que quieras. Muévelo.\nEdítalo. Puedes romperlo sin miedo.'],
      ], { y: 600 })
      const cta = tryIt('Open the next slide in the\nSLIDES strip at the bottom.', 'Abre la siguiente diapositiva en la\ntira SLIDES de la parte inferior.')
      const scale = 1.72
      slides.push(slide('Welcome', [
        tourBg('violet'),
        brand('PixelDeck', { x: M, y: 92, logo: a.logo.key, logoSize: 76, color: INK, font: 'Sora', weight: 700, size: 46, gap: 20 }),
        step('01', 'WELCOME', 'BIENVENIDA', { y: 250 }),
        title('Welcome to\n{{PixelDeck}}', 'Te damos la\n{{bienvenida}}', { y: 315 }),
        ...copy.layers,
        phone({ screen: a.home.key, l10n: { es: a.homeEs.key }, statusBar: 'light', cx: W / 2, y: copy.end + 70, scale, shadow: deviceShadow }),
        ...cta.layers,
      ]))
    }

    // 02 ── Panoramas (2 screenshots, one canvas) ────────────────────────────
    {
      const left = body([
        ['A pano is one wide canvas that\nexports as 2 or 3 screenshots.', 'Un pano es un lienzo ancho que se\nexporta como 2 o 3 capturas.'],
        ['Whatever crosses the dashed seam\ncontinues on the next screenshot.', 'Lo que cruza la línea discontinua\ncontinúa en la captura siguiente.'],
      ])
      const right = body([
        ['Each half is saved as its own PNG,\nso the set flows in the store.', 'Cada mitad se guarda como un PNG\npropio y el conjunto fluye en la tienda.'],
      ], { x: W + M })
      const cta = tryIt('Drag the phone or a photo\nacross the dashed seam.', 'Arrastra el móvil o una foto\nal otro lado de la línea.', { x: W + 500, width: W - 500 - M })
      const hint = tryIt('Use ×2 or ×3 in SLIDES to\nmake any slide a pano.', 'Usa ×2 o ×3 en SLIDES para\nconvertir una en pano.', { x: M, width: 740, label: ['GOOD TO KNOW', 'A SABER'], color: BODY })
      const tile = 430
      const tileK = tile / 300
      slides.push(slide('Panoramas', [
        tourBg('violet', { accents: [glow('#7C5CF6', 50, 52, 1500, 900, 0.3), glow('#EC4899', 4, 96, 800, 760, 0.14), glow('#3B82F6', 96, 8, 800, 760, 0.16)] }),
        step('02', 'PANORAMAS', 'PANORAMAS'),
        title('One canvas,\n{{two screenshots}}', 'Un lienzo,\n{{dos capturas}}'),
        ...left.layers,
        title('Exported as\n{{separate PNGs}}', 'Se exporta en\n{{PNG separados}}', { x: W + M }),
        ...right.layers,
        art(a.photoPeak, { name: 'Photo left', x: W - 590 - tile / 2, y: 960, k: tileK, rotation: -5, radius: 48, shadow: shadow('#000000', 60, 30, 0.45) }),
        art(a.photoCity, { name: 'Photo right', x: W + 590 - tile / 2, y: 985, k: tileK, rotation: 4, radius: 48, shadow: shadow('#000000', 60, 30, 0.45) }),
        art(a.photoSea, { name: 'Photo on the seam', x: W - tile / 2, y: 905, k: tileK, rotation: 3, radius: 48, shadow: shadow('#000000', 60, 30, 0.45) }),
        phone({ screen: a.home.key, l10n: { es: a.homeEs.key }, statusBar: 'light', cx: W, y: 1500, scale: 2.2, rotation: -6, shadow: deviceShadow }),
        ...hint.layers,
        ...cta.layers,
      ], { slides: 2 }))
    }

    // 03 ── Layers ───────────────────────────────────────────────────────────
    {
      const copy = body([
        ['A slide is a stack of layers. There\nare 8 types, and here is one of each.', 'Una diapositiva es una pila de capas.\nHay 8 tipos; aquí tienes uno de cada.'],
      ])
      const cta = tryIt('Select a layer here or in the LAYERS\npanel, then edit it in PROPERTIES.', 'Selecciona una capa aquí o en el panel\nLAYERS y edítala en PROPERTIES.')
      const top = copy.end + 70
      const rowH = (cta.top - 50 - top) / 4
      const colW = CW / 2
      const cell = (i) => ({ x: M + (i % 2) * colW, y: top + Math.floor(i / 2) * rowH })
      const label = (i, en, es) => text(en, {
        name: `Label ${en}`, l10n: { es }, font: 'Inter', weight: 800, size: 30, spacing: 4, fill: VIOLET, x: cell(i).x, y: cell(i).y, width: colW - 30,
      })
      const mini = phoneSize(0.36)
      slides.push(slide('Layers', [
        tourBg('violet'),
        step('03', 'LAYERS', 'CAPAS'),
        title('Everything\nis a {{layer}}', 'Todo es\nuna {{capa}}'),
        ...copy.layers,
        label(0, '1 · BACKGROUND', '1 · FONDO'),
        shape('rect', { name: 'Background sample', x: cell(0).x, y: cell(0).y + 64, width: 380, height: rowH - 130, radius: 32, fill: lin(140, '#7C5CF6', '#EC4899', '#F59E0B') }),
        label(1, '2 · PHONE', '2 · MÓVIL'),
        phone({ name: 'Phone sample', screen: a.home.key, l10n: { es: a.homeEs.key }, statusBar: false, x: cell(1).x + 30, y: cell(1).y + 58, scale: 0.36, shadow: shadow('#000000', 30, 14, 0.4) }),
        phone({ name: 'Phone sample (Android)', model: 'pixel-9', screen: a.home.key, l10n: { es: a.homeEs.key }, statusBar: false, x: cell(1).x + 30 + mini.w + 40, y: cell(1).y + 58, scale: 0.36, shadow: shadow('#000000', 30, 14, 0.4) }),
        label(2, '3 · TEXT', '3 · TEXTO'),
        text('Rich {{text}},\n{{any}} style', {
          name: 'Text sample', l10n: { es: '{{Texto}} rico,\n{{mil}} estilos' }, font: 'Sora', weight: 700, size: 76, leading: 1.08, spacing: -2, fill: INK,
          x: cell(2).x, y: cell(2).y + 66, width: colW - 30, mark: [{ fill: GRAD }, { italic: true, fill: TEAL }],
        }),
        label(3, '4 · IMAGE', '4 · IMAGEN'),
        art(a.photoCity, { name: 'Image sample', x: cell(3).x, y: cell(3).y + 62, k: (rowH - 120) / 300, radius: 36 }),
        label(4, '5 · SHAPE', '5 · FORMA'),
        shape('star', { name: 'Shape star', x: cell(4).x, y: cell(4).y + 74, width: 170, height: 170, fill: '#FBBF24' }),
        shape('hexagon', { name: 'Shape hexagon', x: cell(4).x + 190, y: cell(4).y + 74, width: 170, height: 170, fill: TEAL }),
        shape('ellipse', { name: 'Shape ellipse', x: cell(4).x + 380, y: cell(4).y + 74, width: 130, height: 170, fill: '#EC4899' }),
        label(5, '6 · EMOJI', '6 · EMOJI'),
        emoji('🚀', { name: 'Emoji sample', x: cell(5).x, y: cell(5).y + 62, size: 170 }),
        emoji('✨', { name: 'Emoji sample 2', x: cell(5).x + 220, y: cell(5).y + 62, size: 170 }),
        label(6, '7 · BRAND', '7 · MARCA'),
        brand('PixelDeck', { name: 'Brand sample', x: cell(6).x, y: cell(6).y + 88, logo: a.logo.key, logoSize: 110, color: INK, font: 'Sora', weight: 700, size: 60, gap: 24 }),
        label(7, '8 · GROUP', '8 · GRUPO'),
        group([
          shape('rect', { name: 'Chip 1', x: 0, y: 0, width: 210, height: 92, radius: 46, fill: GRAD }),
          text('Move', { name: 'Chip 1 label', l10n: { es: 'Mover' }, font: 'Inter', weight: 700, size: 36, fill: INK, align: 'center', x: 0, y: 24, width: 210 }),
          shape('rect', { name: 'Chip 2', x: 230, y: 0, width: 210, height: 92, radius: 46, fill: 'rgba(255,255,255,0.12)' }),
          text('Scale', { name: 'Chip 2 label', l10n: { es: 'Escalar' }, font: 'Inter', weight: 700, size: 36, fill: INK, align: 'center', x: 230, y: 24, width: 210 }),
          shape('rect', { name: 'Chip 3', x: 115, y: 112, width: 210, height: 92, radius: 46, fill: 'rgba(255,255,255,0.12)' }),
          text('Rotate', { name: 'Chip 3 label', l10n: { es: 'Rotar' }, font: 'Inter', weight: 700, size: 36, fill: INK, align: 'center', x: 115, y: 136, width: 210 }),
        ], { name: 'Group sample', x: cell(7).x, y: cell(7).y + 68 }),
        ...cta.layers,
      ]))
    }

    // 04 ── Style & Brand Kit ────────────────────────────────────────────────
    {
      const copy = body([
        ['One text box can mix {{weights}}, {{colors}}\nand {{gradients}}. Select a few words\nand restyle only those.', 'Una caja de texto mezcla {{grosores}},\n{{colores}} y {{degradados}}. Selecciona\nunas palabras y cambia solo esas.', [B, { fontWeight: 500, fill: TEAL }, { fontWeight: 700, fill: GRAD }]],
        ['{{Brand Kit}} colors are linked, not\ncopied: change one and every layer\nusing it updates.', 'Los colores del {{Brand Kit}} están\nenlazados, no copiados: cambia uno\ny se actualiza en todas las capas.', [V]],
      ])
      const cta = tryIt('Open Brand Kit (top bar) and change\n“Accent”. All four pieces follow.', 'Abre Brand Kit (barra superior) y cambia\n«Accent». Las cuatro piezas le siguen.')
      const token = '{brand:pdaccent}'
      const panelH = 560
      const sampleH = 250
      const top = centred(copy, cta, sampleH + 60 + panelH)
      const panelY = top + sampleH + 60
      slides.push(slide('Style & Brand Kit', [
        tourBg('violet'),
        step('04', 'STYLE & BRAND KIT', 'ESTILO Y BRAND KIT'),
        title('Style once,\n{{reuse it}}', 'Un estilo,\n{{mil usos}}'),
        ...copy.layers,
        text('{{Bold.}} {{Italic.}}\n{{Gradient.}} Plain.', {
          name: 'Rich text sample', l10n: { es: '{{Negrita.}} {{Cursiva.}}\n{{Degradado.}} Normal.' }, font: 'Sora', weight: 400, size: 100, leading: 1.2, spacing: -3, fill: BODY,
          x: M, y: top, width: CW, mark: [{ fontWeight: 800, fill: INK }, { italic: true, fill: TEAL }, { fontWeight: 800, fill: GRAD }],
        }),
        shape('rect', { name: 'Brand panel', x: M, y: panelY, width: CW, height: panelH, radius: 48, fill: 'rgba(255,255,255,0.05)', stroke: 'rgba(255,255,255,0.14)', strokeWidth: 2 }),
        text('Linked to {{Accent}}', { name: 'Brand caption', l10n: { es: 'Enlazado a {{Accent}}' }, font: 'Sora', weight: 700, size: 76, spacing: -2, fill: INK, x: M + 64, y: panelY + 66, width: CW - 128, mark: { fill: token } }),
        shape('rect', { name: 'Accent square', x: M + 64, y: panelY + 226, width: 250, height: 250, radius: 56, fill: token }),
        shape('ellipse', { name: 'Accent circle', x: M + 64 + 300, y: panelY + 226, width: 250, height: 250, fill: token }),
        shape('star', { name: 'Accent star', x: M + 64 + 600, y: panelY + 216, width: 270, height: 270, fill: token }),
        ...cta.layers,
      ]))
    }

    // 05 ── Formats: Base vs export formats ──────────────────────────────────
    {
      const copy = body([
        ['{{Base}} is your master canvas. You\ndesign here. It is never exported.', '{{Base}} es tu lienzo maestro. Diseñas\naquí. Nunca se exporta.', [V]],
        ['{{iPhone}} and {{Android}} are formats: the\nexact sizes each store asks for.', '{{iPhone}} y {{Android}} son formatos: los\ntamaños exactos que pide cada tienda.', [A, A]],
        ['Every format scales itself from Base,\nso you only design once.', 'Cada formato se escala solo desde\nBase: solo diseñas una vez.'],
        ['The {{+}} next to the tabs adds more:\niPad, Watch, Mac, TV or a custom size.', 'El {{+}} junto a las pestañas añade más:\niPad, Watch, Mac, TV o tamaño propio.', [A]],
      ])
      const cta = tryIt('Click the iPhone and Android tabs\nabove the canvas. Watch the pill.', 'Pulsa las pestañas iPhone y Android\nsobre el lienzo. Fíjate en la etiqueta.', { color: AMBER })
      const k = CW / 600
      const diagramH = 340 * k
      const diagramY = centred(copy, cta, diagramH + 40 + 96)
      const noteY = diagramY + diagramH + 40
      slides.push(slide('Formats', [
        tourBg('amber'),
        step('05', 'FORMATS', 'FORMATOS', { fill: AMBER }),
        title('One design,\n{{every size}}', 'Un diseño,\n{{cada tamaño}}'),
        ...copy.layers,
        art(a.formats, { name: 'Formats diagram', ...esImg(a.formats, a.formatsEs), x: M, y: diagramY, k }),
        ...formatNote('You are on BASE · 1290 × 2796', 'Estás en BASE · 1290 × 2796', noteY, ONLY_BASE, VIOLET),
        ...formatNote('You are on iPHONE · 1320 × 2868', 'Estás en iPHONE · 1320 × 2868', noteY, onlyIn('iphone-69'), AMBER),
        ...formatNote('You are on ANDROID · 1080 × 1920', 'Estás en ANDROID · 1080 × 1920', noteY, onlyIn('android-phone'), AMBER),
        ...cta.layers,
      ]))
    }

    // 06 ── Formats: per-format adjustments ──────────────────────────────────
    {
      const copy = body([
        ['Move or resize a layer while a format\ntab is active and the change is\n{{pinned to that format}} only.', 'Mueve o redimensiona una capa con\nuna pestaña de formato activa y el\ncambio queda {{fijado a ese formato}}.', [A]],
        ['Base and the other formats stay put.\nText, colors and images stay shared.', 'Base y los demás formatos no cambian.\nTexto, colores e imágenes se comparten.'],
        ['An {{amber}} frame means you are\nediting one format.', 'Un marco {{ámbar}} indica que editas\nun solo formato.', [A]],
      ])
      const cta = tryIt('On Android, drag the phone. Back on\nBase it has not moved. “Reset format\nlayout” undoes it.', 'En Android, arrastra el móvil. En Base\nno se ha movido. «Reset format\nlayout» lo deshace.', { color: AMBER })
      const scale = 1.25
      const size = phoneSize(scale)
      const y = copy.end + 90
      // Pinned on Android: larger and on the right (absolute values in Android's own canvas).
      const pinned = toAndroid(W - M - size.w * 1.12, y - 40)
      slides.push(slide('Format adjustments', [
        tourBg('amber'),
        step('06', 'FORMATS', 'FORMATOS', { fill: AMBER }),
        title('Fine-tune\n{{each format}}', 'Ajusta\n{{cada formato}}'),
        ...copy.layers,
        phone({
          name: 'Pinned phone', screen: a.home.key, l10n: { es: a.homeEs.key }, statusBar: 'light', x: M + 20, y, scale, rotation: -5, shadow: deviceShadow,
          formatOverrides: { 'android-phone': { x: pinned.x, y: pinned.y, scale: scale * ANDROID_F * 1.12, rotation: 6 } },
        }),
        text('On Base and iPhone this\nphone sits on the left.', {
          name: 'Base note', l10n: { es: 'En Base y en iPhone este\nmóvil está a la izquierda.' }, font: 'Inter', weight: 600, size: 42, leading: 1.25, fill: BODY,
          x: M + size.w + 90, y: y + 260, width: CW - size.w - 90, formatVisibility: { 'android-phone': false },
        }),
        text('On Android it is pinned\nto the right, and bigger.', {
          name: 'Android note', l10n: { es: 'En Android está fijado a\nla derecha y es mayor.' }, font: 'Inter', weight: 700, size: 42, leading: 1.25, fill: AMBER,
          x: M, y: y + 260, width: 560, ...onlyIn('android-phone'),
        }),
        ...cta.layers,
      ]))
    }

    // 07 ── Localization: locales ────────────────────────────────────────────
    {
      const copy = body([
        ['A {{locale}} is a language version of\nyour project. One is the {{Default}}:\nthe source the others start from.', 'Un {{locale}} es una versión de tu\nproyecto en un idioma. Uno es el\n{{Default}}: la fuente de los demás.', [T, T]],
        ['This tour has English (Default) and\nSpanish. Switch, and the text {{and the\nscreenshot}} change together.', 'Esta visita tiene inglés (Default) y\nespañol. Cambia, y el texto {{y la\ncaptura}} cambian a la vez.', [B]],
      ])
      const cta = tryIt('Click “Spanish” in the locale tabs,\nright of the format tabs.', 'Pulsa «Default» en las pestañas de\nidioma, junto a las de formato.', { color: TEAL })
      const y = copy.end + 70
      const scale = Math.min(1.7, (cta.top - 60 - y) / 844)
      slides.push(slide('Locales', [
        tourBg('teal'),
        step('07', 'LOCALIZATION', 'LOCALIZACIÓN', { fill: TEAL }),
        title('Speak every\n{{language}}', 'Habla todos\n{{los idiomas}}'),
        ...copy.layers,
        phone({ name: 'Localized phone', screen: a.home.key, l10n: { es: a.homeEs.key }, statusBar: 'light', cx: W / 2, y, scale, shadow: deviceShadow }),
        ...cta.layers,
      ]))
    }

    // 08 ── Localization: the Localization view ──────────────────────────────
    {
      const copy = body([
        ['{{Localization}} (top right) is a table:\none row per text, one column per\nlanguage.', '{{Localization}} (arriba a la derecha)\nes una tabla: una fila por texto y\nuna columna por idioma.', [T]],
        ['Type or paste translations, or let\nAI translate with your own API key.', 'Escribe o pega traducciones, o deja\nque la IA traduzca con tu clave API.'],
        ['Phones and images can use a\ndifferent file per language too.', 'Los móviles y las imágenes pueden\nusar un archivo distinto por idioma.'],
        ['On the canvas you edit the Default\ntext. Other languages are edited\nin Localization.', 'En el lienzo editas el texto Default.\nLos demás idiomas se editan en\nLocalization.'],
      ])
      const cta = tryIt('Open Localization and change\na Spanish cell.', 'Abre Localization y cambia una\ncelda de Spanish.', { color: TEAL })
      const k = CW / 430
      slides.push(slide('Translate', [
        tourBg('teal'),
        step('08', 'LOCALIZATION', 'LOCALIZACIÓN', { fill: TEAL }),
        title('Translate in\n{{one place}}', 'Traduce en\n{{un solo lugar}}'),
        ...copy.layers,
        art(a.table, { name: 'Localization table', ...esImg(a.table, a.tableEs), x: M, y: centred(copy, cta, 262 * k), k }),
        ...cta.layers,
      ]))
    }

    // 09 ── Format × Locale ──────────────────────────────────────────────────
    {
      const copy = body([
        ['Translations run longer. Resize or\nmove a layer for {{one language}} and\nthe others do not change.', 'Las traducciones ocupan más. Cambia\nuna capa para {{un solo idioma}} y los\ndemás no cambian.', [T]],
        ['On {{Base}} + Spanish, the tweak follows\nSpanish into every format.', 'En {{Base}} + Spanish, el ajuste sigue\nal español en todos los formatos.', [V]],
        ['On {{Android}} + Spanish, it applies\nto that pairing only.', 'En {{Android}} + Spanish, se aplica\nsolo a esa combinación.', [A]],
        ['{{Formats pin.}} {{Locales adjust}} on top.', '{{El formato fija.}} {{El idioma ajusta.}}', [A, T]],
      ])
      const cta = tryIt('Switch to Spanish: this headline is\n12% smaller there, and only there.', 'Vuelve a Default: allí este titular\nes más grande. El ajuste es solo aquí.', { color: TEAL })
      const k = CW / 420
      slides.push(slide('Format × Locale', [
        tourBg('both'),
        step('09', 'FORMAT × LOCALE', 'FORMATO × IDIOMA', { fill: TEAL }),
        title('Adjust layout\n{{per language}}', 'Ajusta el diseño\n{{para cada idioma}}', { localeAdjust: { es: { base: { mFontSize: 0.88 } } } }),
        ...copy.layers,
        art(a.tiers, { name: 'Tiers diagram', ...esImg(a.tiers, a.tiersEs), x: M, y: centred(copy, cta, 250 * k), k }),
        ...cta.layers,
      ]))
    }

    // 10 ── Templates & assets ───────────────────────────────────────────────
    {
      const copy = body([
        ['{{Templates}} (top bar) has ready-made\nsets for the most popular app types.', '{{Templates}} (barra superior) trae\nconjuntos listos para apps populares.', [V]],
        ['Use one as a new project, then drop\nyour own screenshots on the phones.', 'Úsalo como proyecto nuevo y suelta\ntus capturas sobre los móviles.'],
        ['{{Assets}} (left) holds your images.\nDrag one onto the canvas, or select\na phone and click the image.', '{{Assets}} (izquierda) guarda tus\nimágenes. Arrastra una al lienzo, o\nselecciona un móvil y haz clic en ella.', [V]],
      ])
      const cta = tryIt('Open Templates and press\n“Use template”.', 'Abre Templates y pulsa\n«Use template».')
      const k = CW / 640
      slides.push(slide('Templates', [
        tourBg('violet'),
        step('10', 'TEMPLATES & ASSETS', 'PLANTILLAS Y ASSETS'),
        title('Start from a\n{{template}}', 'Empieza con\n{{una plantilla}}'),
        ...copy.layers,
        art(a.gallery, { name: 'Template gallery', x: M, y: centred(copy, cta, 250 * k), k }),
        ...cta.layers,
      ]))
    }

    // 11 ── Export ───────────────────────────────────────────────────────────
    {
      const perCell = late?.screenshots ?? 0
      const total = perCell * LOCALES.length * FORMATS.length
      const copy = body([
        ['Export renders every {{locale}} ×\n{{format}} × slide as its own PNG.', 'Export genera un PNG por cada\n{{idioma}} × {{formato}} × diapositiva.', [T, A]],
        [`This tour: 2 languages × 2 formats\n× ${perCell} screenshots = {{${total} files}}.`, `Esta visita: 2 idiomas × 2 formatos\n× ${perCell} capturas = {{${total} archivos}}.`, [B]],
        ['Base is not exported. A pano is split\ninto one PNG per screenshot.', 'Base no se exporta. Un pano se divide\nen un PNG por captura.'],
        ['Download a ZIP, pick a folder, or\nautomate it with the CLI.', 'Descarga un ZIP, elige una carpeta\no automatízalo con la CLI.'],
      ])
      const cta = tryIt('Press Export (bottom right).', 'Pulsa Export (abajo a la derecha).')
      const k = CW / 560
      slides.push(slide('Export', [
        tourBg('both'),
        step('11', 'EXPORT', 'EXPORTAR'),
        title('Export it all\n{{in one click}}', 'Expórtalo todo\n{{en un clic}}'),
        ...copy.layers,
        ...(late?.matrix ? [art(late.matrix, { name: 'Export matrix', x: M, y: centred(copy, cta, 330 * k), k })] : []),
        ...cta.layers,
      ]))
    }

    // 12 ── Next steps ───────────────────────────────────────────────────────
    {
      const copy = body([
        ['{{1}}  Projects → New project starts\n     from a blank canvas.', '{{1}}  Projects → New project empieza\n     con un lienzo en blanco.', [V]],
        ['{{2}}  Templates → Use template starts\n     from a finished design.', '{{2}}  Templates → Use template parte\n     de un diseño terminado.', [V]],
        ['{{3}}  Help (top right) covers every\n     panel and shortcut.', '{{3}}  Help (arriba a la derecha)\n     explica cada panel y atajo.', [V]],
      ], { y: 520 })
      const cta = tryIt('This tour is a normal project.\nKeep it, or delete it in Projects.', 'Esta visita es un proyecto normal.\nConsérvala o bórrala en Projects.', { label: ['GOOD TO KNOW', 'A SABER'], color: BODY })
      const logoK = 3.4
      const logoW = 136 * logoK
      slides.push(slide('Next steps', [
        tourBg('violet', { accents: [glow('#7C5CF6', 50, 62, 1000, 900, 0.36), glow('#EC4899', 96, 96, 800, 760, 0.16)] }),
        step('12', 'NEXT STEPS', 'SIGUIENTES PASOS'),
        title("You're\n{{ready}}", 'Ya está\n{{todo listo}}'),
        ...copy.layers,
        art(a.logo, { name: 'PixelDeck mark', x: W / 2 - logoW / 2, y: copy.end + (cta.top - copy.end - 144 * logoK) / 2, k: logoK, shadow: shadow('#7C5CF6', 120, 0, 0.55) }),
        ...cta.layers,
      ]))
    }

    return slides
  },
}

// `image` is re-exported for sources that extend this file with plain image layers.
export { image }
