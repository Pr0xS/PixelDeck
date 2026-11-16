import { art, bg, brand, glow, lin, phone, shadow, shape, slide, text, W } from '../../lib/dsl.mjs'

const FONTS = [
  'family=Inter:wght@400;500;600;700;800',
  'family=Fraunces:wght@600;700;800',
]
const screen = (file) => ({ file: `screens/${file}.html`, fonts: FONTS })
const card = (file, width, height) => ({ file: `art/${file}.html`, width, height, transparent: true, fonts: FONTS })

const GREEN = '#14532D'
const TOMATO = '#F0522B'
const CREAM = '#FFF8EE'

const headline = (source, o = {}) => text(source, {
  name: 'Headline', font: 'Fraunces', weight: 700, size: 134, leading: 1.04, spacing: -2,
  fill: '{brand:basketgreen}', align: 'center', width: 1110, cx: W / 2,
  mark: { fill: '{brand:baskettomato}' }, ...o,
})
const sub = (source, o = {}) => text(source, {
  name: 'Subtitle', font: 'Inter', weight: 500, size: 50, leading: 1.25, fill: '#55655A',
  align: 'center', width: 1000, cx: W / 2, ...o,
})
const deviceShadow = shadow('#8A4B10', 120, 60, 0.3)

const lightBg = (angle, stops, accents, w) => bg(lin(angle, ...stops), { accents, noise: 0.04 })

export default {
  slug: 'basket-shopping',
  order: 50,
  name: 'Basket',
  category: 'Shopping & Food',
  description: 'Fresh, warm editorial set for grocery and food delivery apps: cream, deep green and tomato with serif headlines.',
  settings: {
    brandName: 'Basket',
    brandColors: [
      { id: 'basketgreen', name: 'Primary green', value: GREEN },
      { id: 'baskettomato', name: 'Accent tomato', value: TOMATO },
      { id: 'basketcream', name: 'Cream', value: CREAM },
      { id: 'basketgold', name: 'Star gold', value: '#FFC83D' },
    ],
  },
  art: {
    home: screen('home'),
    browse: screen('browse'),
    detail: screen('detail'),
    basket: screen('basket'),
    track: screen('track'),
    recipes: screen('recipes'),
    cold: card('cold', 400, 130),
    chip: card('chip', 400, 130),
    chip2: card('chip2', 400, 130),
    free: card('free', 300, 120),
    confirmed: card('confirmed', 380, 130),
    cherry: card('cherry', 260, 320),
  },
  build({ a }) {
    return [
      // 1 — Hero: centred device bleeding off the bottom
      slide('Hero', [
        bg(lin(165, '#FFF8EE', '#FFEFD9', '#FFE6CC'), {
          accents: [glow('#FFB27A', 12, 70, 800, 800, 0.4, 160), glow('#BFE8CB', 95, 30, 700, 800, 0.5, 160)],
          noise: 0.04,
        }),
        brand('Basket', { x: 96, y: 104, color: '{brand:basketgreen}', font: 'Fraunces', weight: 700, size: 56, logoSize: 70 }),
        headline('Fresh groceries\nin {{20 minutes}}', { y: 300 }),
        sub('Delivered to your door, fast', { y: 650 }),
        phone({ screen: a.home.key, cx: W / 2, y: 900, scale: 2.5, statusBar: 'light', shadow: deviceShadow }),
        art(a.free, { x: 30, y: 770, k: 2.2, rotation: -6, shadow: shadow('#8A4B10', 40, 24, 0.2) }),
        art(a.chip2, { x: 520, y: 2170, k: 1.9, rotation: 5, shadow: shadow('#8A4B10', 40, 24, 0.2) }),
      ]),

      // 2 — Browse pano: device crosses the seam
      slide('Browse', [
        bg(lin(100, '#FFF8EE', '#FFF1DC', '#EAF6EB'), {
          accents: [glow('#FFC9A0', 22, 85, 900, 800, 0.45, 160), glow('#BFE8CB', 80, 20, 1000, 800, 0.5, 160), glow('#E6DDF9', 50, 55, 700, 600, 0.4, 160)],
          noise: 0.04,
        }),
        headline('Everything\n{{you love}}', { y: 300, x: 96, cx: undefined, align: 'left', width: 1000 }),
        sub('Thousands of fresh picks, one tap each', { y: 640, x: 96, cx: undefined, align: 'left', width: 1000 }),
        headline('Right at\n{{your door}}', { y: 300, x: W + 96, cx: undefined, align: 'left', width: 1000 }),
        sub('Delivered cold and carefully packed', { y: 640, x: W + 96, cx: undefined, align: 'left', width: 1000 }),
        phone({ screen: a.browse.key, cx: W, y: 940, scale: 2.7, statusBar: 'light', shadow: deviceShadow }),
        art(a.chip, { x: 1640, y: 1500, k: 2.3, rotation: 6, shadow: shadow('#8A4B10', 40, 24, 0.2) }),
        art(a.cherry, { x: 70, y: 1180, k: 2.3, rotation: -7, shadow: shadow('#8A4B10', 40, 24, 0.2) }),
        art(a.free, { x: 110, y: 2160, k: 2.2, rotation: 5, shadow: shadow('#8A4B10', 40, 24, 0.2) }),
      ], { slides: 2 }),

      // 3 — Deals / detail: tilted device, left-aligned text
      slide('Deals', [
        bg(lin(200, '#FFF8EE', '#FFF3D6', '#FFE3C8'), {
          accents: [glow('#FFE08A', 85, 55, 800, 800, 0.5, 160), glow('#FFB39A', 10, 92, 700, 700, 0.35, 160)],
          noise: 0.04,
        }),
        headline('Deals picked\n{{for you}}', { y: 300, x: 96, cx: undefined, align: 'left', width: 1100 }),
        sub('Fresh savings on your favourites', { y: 650, x: 96, cx: undefined, align: 'left', width: 900 }),
        phone({ screen: a.detail.key, cx: 700, y: 1010, scale: 2.6, rotation: -7, statusBar: 'light', shadow: deviceShadow }),
        art(a.chip, { x: 560, y: 1200, k: 1.75, rotation: 6, shadow: shadow('#8A4B10', 40, 24, 0.2) }),
      ]),

      // 4 — Checkout: one device, big order-confirmed card in front
      slide('Checkout', [
        bg(lin(160, '#FFF8EE', '#FFEEDC', '#F8E3D0'), {
          accents: [glow('#FFB27A', 50, 70, 1000, 800, 0.35, 160), glow('#CDEBD7', 90, 12, 700, 700, 0.5, 160)],
          noise: 0.04,
        }),
        headline('Checkout in\n{{two taps}}', { y: 300 }),
        sub('Pick a slot, tap once, and you are done', { y: 650 }),
        phone({ screen: a.basket.key, cx: 780, y: 960, scale: 2.6, rotation: 3, statusBar: 'light', shadow: deviceShadow }),
        art(a.confirmed, { x: -10, y: 1560, k: 2.6, rotation: -5, shadow: shadow('#8A4B10', 50, 30, 0.25) }),
      ]),

      // 5 — Tracking: tilted other way, right-aligned text
      slide('Tracking', [
        bg(lin(150, '#EAF6EB', '#FFF8EE', '#FFF1DC'), {
          accents: [glow('#BFE8CB', 15, 60, 900, 900, 0.55, 160), glow('#FFC9A0', 90, 90, 800, 700, 0.45, 160)],
          noise: 0.04,
        }),
        headline('Track it to\n{{your door}}', { y: 300, x: W - 96 - 1100, cx: undefined, align: 'right', width: 1100 }),
        sub('Follow your courier live, minute by minute', { y: 650, x: W - 96 - 1000, cx: undefined, align: 'right', width: 1000 }),
        phone({ screen: a.track.key, cx: 600, y: 1000, scale: 2.6, rotation: 6, statusBar: 'light', shadow: deviceShadow }),
        art(a.cold, { x: 520, y: 1500, k: 1.9, rotation: -5, shadow: shadow('#8A4B10', 40, 24, 0.2) }),
      ]),

      // 6 — Closer: deep green, social proof + CTA
      slide('Closer', [
        bg(lin(170, '#14532D', '#0F4224', '#0B3319'), {
          accents: [glow('#2F9E5B', 50, 38, 1000, 800, 0.4, 180), glow(TOMATO, 92, 92, 700, 700, 0.28, 180)],
          noise: 0.05,
        }),
        ...[0, 1, 2, 3, 4].map((i) => shape('star', {
          name: `Star ${i + 1}`, x: 335 + i * 120, y: 230, width: 100, height: 100, fill: '{brand:basketgold}', starPoints: 5, starInnerRatio: 0.45,
        })),
        headline('Loved by\n{{1M+ shoppers}}', { y: 400, fill: '{brand:basketcream}', mark: { fill: '{brand:basketgold}' } }),
        shape('rect', { name: 'CTA', cx: W / 2, y: 780, width: 640, height: 132, radius: 66, fill: '{brand:baskettomato}', shadow: shadow('#000000', 50, 24, 0.3) }),
        text('Start shopping', { name: 'CTA label', font: 'Inter', weight: 700, size: 54, fill: '#FFFFFF', align: 'center', width: 640, cx: W / 2, y: 780, height: 132, valign: 'middle' }),
        phone({ screen: a.recipes.key, cx: W / 2, y: 1130, scale: 2.5, statusBar: 'light', shadow: shadow('#000000', 120, 60, 0.45) }),
      ]),
    ]
  },
}
