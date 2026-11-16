import { art, bg, brand, glow, lin, phone, shadow, shape, slide, text, W } from '../../lib/dsl.mjs'

const FONTS = [
  'family=Inter:wght@400;500;600;700;800',
  'family=Space+Grotesk:wght@500;600;700',
]
const screen = (file) => ({ file: `screens/${file}.html`, fonts: FONTS })
const card = (file, width, height) => ({ file: `art/${file}.html`, width, height, transparent: true, fonts: FONTS })

const INK = '#0F172A'
const INDIGO = '#6366F1'
const AMBER = '#F59E0B'

const headline = (source, o = {}) => text(source, {
  name: 'Headline', font: 'Space Grotesk', weight: 700, size: 152, leading: 1.02, spacing: -4,
  fill: INK, align: 'center', width: 1110, cx: W / 2, mark: { fill: '{brand:flowindigo}' }, ...o,
})
const sub = (source, o = {}) => text(source, {
  name: 'Subtitle', font: 'Inter', weight: 500, size: 46, leading: 1.28, fill: '#475569',
  align: 'center', width: 1000, cx: W / 2, ...o,
})
const devShadow = shadow('#4F46E5', 90, 50, 0.28)
const light = (angle = 165) => lin(angle, '#F8FAFC', '#F1F4FF', '#E7EBFF')
const LIGHT_NOISE = 0.04

export default {
  slug: 'flow-productivity',
  order: 30,
  name: 'Flowly',
  category: 'Productivity',
  description: 'Clean, airy set for task, calendar and focus apps: pale lavender backgrounds with indigo and amber.',
  settings: {
    brandName: 'Flowly',
    brandColors: [
      { id: 'flowindigo', name: 'Primary', value: INDIGO },
      { id: 'flowamber', name: 'Accent', value: AMBER },
      { id: 'flowink', name: 'Ink', value: INK },
    ],
  },
  art: {
    today: screen('today'),
    calendar: screen('calendar'),
    capture: screen('capture'),
    focus: screen('focus'),
    streaks: screen('streaks'),
    reminder: card('reminder', 412, 182),
    done: card('done', 392, 222),
    calChip: card('calchip', 412, 182),
    session: card('session', 412, 182),
    streak: card('streak', 412, 182),
  },
  build({ a }) {
    return [
      // 1 — Hero: centred device bleeding off the bottom
      slide('Hero', [
        bg(light(), {
          accents: [glow(INDIGO, 50, 62, 800, 700, 0.2), glow(AMBER, 100, 12, 600, 520, 0.16), glow('#A78BFA', 0, 40, 600, 600, 0.16)],
          noise: LIGHT_NOISE,
        }),
        brand('Flowly', { x: 96, y: 110, color: '{brand:flowink}', font: 'Space Grotesk', weight: 700, size: 56, logoSize: 72 }),
        headline('Get more done,\n{{stress less}}', { y: 300 }),
        sub('Tasks, calendar and focus in one calm place', { y: 640 }),
        phone({ screen: a.today.key, cx: W / 2, y: 860, scale: 2.6, statusBar: 'light', shadow: devShadow }),
        art(a.reminder, { x: -40, y: 1250, k: 2.3, rotation: -6, name: 'Reminder card' }),
      ]),

      // 2 — Schedule pano
      slide('Schedule', [
        bg(light(100), {
          accents: [glow(INDIGO, 50, 60, 1300, 800, 0.22), glow(AMBER, 12, 96, 700, 500, 0.14), glow('#A78BFA', 92, 10, 700, 600, 0.18)],
          noise: LIGHT_NOISE,
        }),
        headline('Your day,\n{{self-organized}}', { y: 300, cx: 645, width: 1000, size: 140 }),
        sub('Time blocks that fit around your life', { y: 640, cx: 645, width: 900 }),
        headline('Focus when\nit {{matters}}', { y: 300, cx: W + 645, width: 1000, size: 140 }),
        sub('Protect your deep work', { y: 640, cx: W + 645, width: 900 }),
        phone({ screen: a.calendar.key, cx: W, y: 980, scale: 2.55, rotation: -6, statusBar: 'light', shadow: devShadow }),
        art(a.calChip, { x: 1760, y: 1150, k: 1.9, rotation: 5 }),
        art(a.session, { x: 230, y: 1880, k: 1.95, rotation: -4 }),
      ], { slides: 2 }),

      // 3 — Capture: tilted device, feature list
      slide('Capture', [
        bg(lin(200, '#FFFFFF', '#F1F4FF', '#E3E8FF'), {
          accents: [glow(AMBER, 90, 40, 700, 700, 0.18), glow(INDIGO, 20, 85, 800, 700, 0.2)],
          noise: LIGHT_NOISE,
        }),
        headline('Capture\n{{everything}}', { y: 300, align: 'left', x: 110, width: 1000 }),
        ...[
          ['Quick add from anywhere', 700],
          ['Checklists, notes and voice', 800],
          ['Smart tags and due dates', 900],
        ].flatMap(([label, y]) => [
          shape('rect', { x: 110, y: y + 2, width: 64, height: 64, radius: 20, fill: '{brand:flowindigo}', name: 'Check chip' }),
          shape('check', { x: 124, y: y + 16, width: 36, height: 36, fill: '#FFFFFF', name: 'Check' }),
          text(label, { name: 'Feature', x: 206, y: y + 8, width: 900, size: 46, weight: 600, fill: INK }),
        ]),
        phone({ screen: a.capture.key, x: 175, y: 1140, scale: 2.6, rotation: 5, statusBar: 'light', shadow: devShadow }),
        art(a.done, { x: 20, y: 2060, k: 2.25, rotation: -5 }),
      ]),

      // 4 — Focus: centred device, two lines
      slide('Focus', [
        bg(lin(180, '#EEF2FF', '#F8FAFC', '#EEF2FF'), {
          accents: [glow(INDIGO, 50, 66, 900, 800, 0.26), glow(AMBER, 6, 18, 500, 500, 0.15), glow('#A78BFA', 96, 30, 500, 600, 0.18)],
          noise: LIGHT_NOISE,
        }),
        headline('Find your\n{{deep focus}}', { y: 300 }),
        sub('A timer, a task and zero distractions', { y: 640 }),
        phone({ screen: a.focus.key, cx: W / 2 + 60, y: 900, scale: 2.7, statusBar: 'light', shadow: devShadow }),
      ]),

      // 5 — Streaks: device left bleed, cards right
      slide('Streaks', [
        bg(lin(155, '#FFFFFF', '#F4F2FF', '#FEF6E4'), {
          accents: [glow(AMBER, 88, 92, 800, 700, 0.2), glow(INDIGO, 10, 30, 700, 700, 0.18)],
          noise: LIGHT_NOISE,
        }),
        headline('Build streaks\n{{that stick}}', { y: 300, size: 144 }),
        sub('See your progress grow, day after day', { y: 620 }),
        phone({ screen: a.streaks.key, cx: 560, y: 880, scale: 2.7, rotation: -4, statusBar: 'light', shadow: devShadow }),
        art(a.streak, { x: 400, y: 2060, k: 1.95, rotation: 6 }),
      ]),

      // 6 — Closer
      slide('Closer', [
        bg(lin(170, '#4F46E5', '#3B3FC4', '#1E1B6B'), {
          accents: [glow('#A78BFA', 80, 20, 900, 800, 0.45), glow(AMBER, 6, 92, 700, 600, 0.3), glow('#818CF8', 20, 60, 700, 700, 0.3)],
          noise: 0.05,
        }),
        ...[0, 1, 2, 3, 4].map((i) => shape('star', {
          x: 345 + i * 116, y: 270, width: 96, height: 96, fill: '{brand:flowamber}', name: `Star ${i + 1}`,
          starPoints: 5, starInnerRatio: 0.48,
        })),
        headline('Find your\nflow today', { y: 450, fill: '#FFFFFF', mark: { fill: '#FCD34D' } }),
        sub('Join thousands getting more done', { y: 800, fill: 'rgba(238,242,255,0.82)' }),
        shape('rect', { cx: W / 2, y: 1040, width: 640, height: 150, radius: 75, fill: '{brand:flowamber}', name: 'CTA', shadow: shadow('#000000', 50, 24, 0.3) }),
        text('Start free today', { name: 'CTA label', font: 'Space Grotesk', weight: 700, size: 58, fill: INK, align: 'center', width: 640, cx: W / 2, y: 1078 }),
        phone({ screen: a.calendar.key, cx: W / 2, y: 1400, scale: 2.5, statusBar: 'light', shadow: shadow('#0B0A3A', 100, 50, 0.5) }),
      ]),
    ]
  },
}
