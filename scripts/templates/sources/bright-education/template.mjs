import { art, bg, brand, glow, lin, phone, shadow, shape, slide, text, W } from '../../lib/dsl.mjs'

const FONTS = ['family=Nunito:wght@400;600;700;800;900']
const screen = (file) => ({ file: `screens/${file}.html`, fonts: FONTS })

const PURPLE = '#7C3AED'
const SUN = '#FFC93C'
const CORAL = '#FF6B5E'
const INK = '#2A1259'
const CREAM = '#FFF7E8'

const headline = (source, o = {}) => text(source, {
  name: 'Headline', font: 'Lilita One', weight: 400, size: 156, leading: 1.02, spacing: 0,
  fill: '#FFFFFF', align: 'center', width: 1110, cx: W / 2, mark: { fill: '{brand:brightsun}' }, ...o,
})
const sub = (source, o = {}) => text(source, {
  name: 'Subtitle', font: 'Nunito', weight: 800, size: 54, leading: 1.25, fill: 'rgba(255,255,255,0.88)',
  align: 'center', width: 1010, cx: W / 2, ...o,
})
const deviceShadow = shadow('#1A0840', 100, 56, 0.45)
const dark = { fill: INK, mark: { fill: '{brand:brightpurple}' } }
const darkSub = { fill: 'rgba(42,18,89,0.78)' }
const dot = (x, y, d, fill, o = {}) => shape('ellipse', { name: 'Blob', x, y, width: d, height: d, fill, ...o })

export default {
  slug: 'bright-education',
  order: 40,
  name: 'Brightly',
  category: 'Education',
  description: 'Playful, chunky set for language and learning apps: purple, sunny yellow and coral with pressable cards.',
  settings: {
    brandName: 'Brightly',
    brandColors: [
      { id: 'brightpurple', name: 'Primary purple', value: PURPLE },
      { id: 'brightsun', name: 'Sun yellow', value: SUN },
      { id: 'brightcoral', name: 'Coral', value: CORAL },
    ],
  },
  art: {
    path: screen('path'),
    lesson: screen('lesson'),
    streak: screen('streak'),
    league: screen('league'),
    review: screen('review'),
    profile: screen('profile'),
    xp: { file: 'art/xp.html', width: 300, height: 110, transparent: true, fonts: FONTS },
    streak30: { file: 'art/streak30.html', width: 290, height: 120, transparent: true, fonts: FONTS },
    complete: { file: 'art/complete.html', width: 380, height: 180, transparent: true, fonts: FONTS },
    bubble: { file: 'art/bubble.html', width: 340, height: 120, transparent: true, fonts: FONTS },
  },
  build({ a }) {
    return [
      // 1 — Hero
      slide('Hero', [
        bg(lin(165, '#8B4CF5', '#7C3AED', '#5B21C9'), {
          accents: [glow(SUN, 90, 38, 700, 600, 0.3, 160), glow(CORAL, 4, 80, 800, 700, 0.35, 180)],
          noise: 0.05,
        }),
        dot(-160, 1500, 520, 'rgba(255,255,255,0.07)'),
        shape('star', { name: 'Spark', x: 1020, y: 120, width: 120, height: 120, fill: '{brand:brightsun}', starPoints: 4, starInnerRatio: 0.38, rotation: 10 }),
        brand('Brightly', { x: 100, y: 110, color: '{brand:brightsun}', font: 'Nunito', weight: 800, size: 52, logoSize: 72 }),
        headline('Learn a language\nin {{5 minutes}} a day', { y: 310, size: 122, width: 1140 }),
        sub('Short daily lessons that fit your life', { y: 700 }),
        phone({ screen: a.path.key, cx: W / 2, y: 860, scale: 2.6, statusBar: 'light', shadow: deviceShadow }),
        art(a.streak30, { x: 40, y: 1900, k: 2.3, rotation: -7 }),
      ]),

      // 2 — Pano: lessons
      slide('Lessons', [
        bg(lin(90, '#FFF7E8', '#FFEFD0', '#FFF3DC'), {
          accents: [glow(SUN, 22, 100, 900, 700, 0.45, 160), glow('#C9A6FF', 85, 40, 900, 800, 0.45, 180)],
          noise: 0.04,
        }),
        dot(1730, 1950, 640, 'rgba(124,58,237,0.1)'),
        dot(-120, 2100, 480, 'rgba(255,201,60,0.35)'),
        headline('Bite-size\n{{lessons}}', { cx: W / 2, width: 1000, ...dark, y: 300 }),
        sub('Five minutes is all you need', { cx: W / 2, y: 640, ...darkSub }),
        headline('that actually\n{{stick}}', { cx: W + W / 2, width: 1000, ...dark, y: 300 }),
        sub('Smart reviews bring words back', { cx: W + W / 2, y: 640, width: 1000, ...darkSub }),
        phone({ screen: a.review.key, cx: W, y: 980, scale: 2.6, rotation: -6, statusBar: 'light', shadow: deviceShadow }),
        art(a.complete, { x: 90, y: 1700, k: 2.3, rotation: -5 }),
        art(a.bubble, { x: 1840, y: 1450, k: 2.4, rotation: 5 }),
      ], { slides: 2 }),

      // 3 — Practice: two devices
      slide('Practice', [
        bg(lin(170, '#FFD65C', '#FFC93C', '#FFB92E'), {
          accents: [glow('#FFFFFF', 50, 62, 900, 800, 0.5, 200), glow(CORAL, 100, 100, 800, 700, 0.3, 180)],
          noise: 0.05,
        }),
        dot(900, 150, 280, 'rgba(255,255,255,0.4)'),
        shape('star', { name: 'Spark', x: 110, y: 130, width: 90, height: 90, fill: '{brand:brightpurple}', starPoints: 4, starInnerRatio: 0.38, rotation: -8 }),
        headline('Practice makes\n{{fluent}}', { y: 300, ...dark }),
        sub('Real sentences, instant feedback', { y: 660, ...darkSub }),
        phone({ screen: a.review.key, cx: 400, y: 1330, scale: 2.3, rotation: -7, statusBar: 'light', shadow: deviceShadow }),
        phone({ screen: a.lesson.key, cx: 760, y: 960, scale: 2.45, rotation: 3, statusBar: 'light', shadow: deviceShadow }),
        art(a.xp, { x: 30, y: 860, k: 2.3, rotation: -6 }),
      ]),

      // 4 — Streaks: tilted device
      slide('Streaks', [
        bg(lin(160, '#3B1485', '#2A1259', '#1E0C45'), {
          accents: [glow(CORAL, 50, 70, 1000, 900, 0.4, 200), glow(SUN, 6, 10, 700, 600, 0.2, 180)],
          noise: 0.05,
        }),
        dot(860, 1900, 600, 'rgba(255,255,255,0.05)'),
        headline('Build a streak\nyou\'ll {{protect}}', { y: 300 }),
        sub('Goals and rewards that bring you back', { y: 700, width: 1000 }),
        phone({ screen: a.streak.key, cx: W / 2 - 10, y: 1000, scale: 2.55, rotation: 6, statusBar: 'light', shadow: shadow('#000000', 110, 60, 0.55) }),
        art(a.xp, { x: 40, y: 820, k: 2.4, rotation: -6 }),
      ]),

      // 5 — Leagues: offset device, left-aligned text
      slide('Leagues', [
        bg(lin(160, '#F3EAFF', '#E6D6FF', '#D9C3FF'), {
          accents: [glow(SUN, 8, 60, 800, 700, 0.5, 180), glow(PURPLE, 100, 90, 900, 700, 0.3, 200)],
          noise: 0.04,
        }),
        dot(-200, 1300, 640, 'rgba(255,201,60,0.4)'),
        headline('Compete with\n{{friends}}', { cx: undefined, x: 100, y: 300, width: 1100, align: 'left', ...dark }),
        sub('Climb weekly leagues, win the podium', { cx: undefined, x: 100, y: 660, width: 1000, align: 'left', ...darkSub }),
        phone({ screen: a.league.key, cx: 830, y: 1060, scale: 2.65, statusBar: 'light', shadow: deviceShadow }),
        art(a.bubble, { x: 40, y: 840, k: 2.3, rotation: -5 }),
        art(a.xp, { x: -50, y: 2000, k: 1.8, rotation: 6 }),
      ]),

      // 6 — Closer
      slide('Closer', [
        bg(lin(165, '#8B4CF5', '#7C3AED', '#5B21C9'), {
          accents: [glow(SUN, 50, 18, 900, 600, 0.3, 180), glow(CORAL, 96, 92, 800, 700, 0.35, 180)],
          noise: 0.05,
        }),
        ...[0, 1, 2, 3, 4].map((i) => shape('star', {
          name: `Star ${i + 1}`, x: 215 + i * 168, y: 230, width: 140, height: 140, fill: '{brand:brightsun}', starPoints: 5, starInnerRatio: 0.48,
          shadow: shadow('#3A0F8F', 0, 8, 0.45),
        })),
        headline('Join 10M+\n{{learners}}', { y: 430 }),
        sub('Rated 4.9 for making habits fun', { y: 780 }),
        shape('rect', { name: 'CTA', cx: W / 2, y: 940, width: 740, height: 150, radius: 75, fill: '{brand:brightsun}', shadow: shadow('#B07F00', 0, 14, 1) }),
        text('Start learning free', { name: 'CTA label', font: 'Nunito', weight: 800, size: 56, fill: INK, align: 'center', width: 740, height: 150, valign: 'middle', cx: W / 2, y: 940 }),
        phone({ screen: a.profile.key, cx: W / 2, y: 1330, scale: 2.5, statusBar: 'light', shadow: deviceShadow }),
      ]),
    ]
  },
}
