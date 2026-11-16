import { art, bg, brand, glow, lin, phone, shadow, shape, slide, text, W } from '../../lib/dsl.mjs'

const FONTS = [
  'family=Inter:wght@400;500;600;700;800',
  'family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;1,700;1,800',
]
const screen = (file) => ({ file: `screens/${file}.html`, fonts: FONTS })
const card = (file, width, height) => ({ file: `art/${file}.html`, width, height, transparent: true, fonts: FONTS })

const LIME = '#C8F53C'
const EMBER = '#FF6A2B'
const MINT = '#2BD9A8'
const INK = '#0B0D0C'

const headline = (source, o = {}) => text(source, {
  name: 'Headline', font: 'Barlow Condensed', weight: 800, italic: true, size: 178, leading: 0.9,
  spacing: -1, fill: '#FFFFFF', align: 'center', width: 1130, cx: W / 2, mark: { fill: '{brand:pulselime}' }, ...o,
})
const sub = (source, o = {}) => text(source, {
  name: 'Subtitle', font: 'Inter', weight: 500, size: 46, leading: 1.25, fill: 'rgba(244,247,242,0.72)',
  align: 'center', width: 1090, cx: W / 2, ...o,
})
const deviceShadow = shadow('#000000', 110, 60, 0.6)

export default {
  slug: 'pulse-fitness',
  order: 10,
  name: 'Pulse',
  category: 'Health & Fitness',
  description: 'High-energy dark set for workout and health trackers: neon lime on black with condensed italic headlines.',
  settings: {
    brandName: 'Pulse',
    brandColors: [
      { id: 'pulselime', name: 'Lime', value: LIME },
      { id: 'pulseink', name: 'Ink', value: INK },
      { id: 'pulseember', name: 'Ember', value: EMBER },
    ],
  },
  art: {
    home: screen('home'),
    workout: screen('workout'),
    plan: screen('plan'),
    stats: screen('stats'),
    leaders: screen('leaders'),
    awards: screen('awards'),
    prCard: card('pr-card', 380, 150),
    heart: card('heart', 380, 230),
    streak: card('streak', 380, 200),
    goal: card('goal', 280, 330),
    rank: card('rank', 380, 150),
    prLime: card('pr-lime', 380, 150),
  },
  build({ a }) {
    return [
      // 1 — Hero: centred device bleeding off the bottom
      slide('Hero', [
        bg(lin(170, '#0B0D0C', '#101512', '#0B0D0C'), {
          accents: [glow(LIME, 50, 46, 900, 760, 0.22), glow(MINT, 92, 96, 700, 700, 0.14)],
          noise: 0.05,
        }),
        brand('Pulse', { x: 96, y: 104, color: '{brand:pulselime}', font: 'Barlow Condensed', weight: 800, size: 54 }),
        headline('TRAIN SMARTER.\n{{EVERY DAY.}}', { y: 300 }),
        sub('Workouts, recovery and progress in one place', { y: 660 }),
        phone({ screen: a.home.key, cx: W / 2, y: 860, scale: 2.45, shadow: deviceShadow }),
      ]),

      // 2 — Live Workout pano: device crosses the seam, text sits above it on each side
      slide('Live Workout', [
        bg(lin(100, '#0B0D0C', '#111713', '#0B0D0C'), {
          accents: [glow(LIME, 50, 62, 1300, 900, 0.2), glow(MINT, 8, 8, 700, 700, 0.12), glow(EMBER, 96, 90, 700, 600, 0.12)],
          noise: 0.05,
        }),
        headline('EVERY REP\n{{COUNTS.}}', { y: 190, cx: W / 2, width: 1000 }),
        sub('Live coaching that adapts set by set', { y: 560, cx: W / 2, width: 1000 }),
        headline('REAL-TIME\n{{FEEDBACK.}}', { y: 190, cx: W + W / 2, width: 1000 }),
        sub('Heart rate, pace and form at a glance', { y: 560, cx: W + W / 2, width: 1000 }),
        phone({ screen: a.workout.key, cx: W, y: 800, scale: 2.6, rotation: -8, shadow: deviceShadow }),
        art(a.heart, { x: 20, y: 1900, k: 2.1, rotation: -6 }),
        art(a.prCard, { x: W + 380, y: 1500, k: 2.3, rotation: 5 }),
      ], { slides: 2 }),

      // 3 — Plan: left-aligned copy, tilted device, two cards
      slide('Plan', [
        bg(lin(200, '#0B0D0C', '#0F1511', '#0B0D0C'), {
          accents: [glow(LIME, 100, 80, 900, 900, 0.2), glow(EMBER, 0, 30, 700, 700, 0.1)],
          noise: 0.05,
        }),
        headline('A PLAN BUILT\n{{FOR YOUR BODY}}', { y: 230, align: 'left', x: 96, cx: undefined, width: 1100 }),
        sub('Sessions matched to your level and goals', { y: 590, align: 'left', x: 96, cx: undefined, width: 1000 }),
        phone({ screen: a.plan.key, cx: W / 2 - 10, y: 960, scale: 2.6, rotation: 6, shadow: deviceShadow }),
        art(a.streak, { x: 20, y: 700, k: 1.6, rotation: -6 }),
        art(a.goal, { x: 870, y: 760, k: 1.35, rotation: 6 }),
      ]),

      // 4 — Progress: two overlapping devices
      slide('Progress', [
        bg(lin(160, '#0B0D0C', '#111713', '#0B0D0C'), {
          accents: [glow(LIME, 40, 70, 1000, 900, 0.2), glow(MINT, 100, 10, 600, 600, 0.12)],
          noise: 0.05,
        }),
        headline('WATCH YOUR\n{{PROGRESS CLIMB}}', { y: 230 }),
        sub('Every record, trend and milestone in one view', { y: 590 }),
        phone({ screen: a.stats.key, cx: W / 2 + 40, y: 880, scale: 2.7, rotation: -4, shadow: deviceShadow }),
        art(a.prLime, { x: 560, y: 700, k: 1.8, rotation: 5 }),
      ]),

      // 5 — Community: full device floating, copy below
      slide('Community', [
        bg(lin(180, '#101512', '#0B0D0C', '#0B0D0C'), {
          accents: [glow(LIME, 50, 36, 950, 950, 0.2), glow(EMBER, 6, 88, 700, 600, 0.12)],
          noise: 0.05,
        }),
        phone({ screen: a.leaders.key, cx: W / 2, y: 230, scale: 2.3, rotation: 0, shadow: deviceShadow }),
        art(a.rank, { x: 652, y: 100, k: 1.7, rotation: 5 }),
        headline('COMPETE WITH\n{{YOUR CREW}}', { y: 2250 }),
        sub('Join challenges and climb the leaderboard', { y: 2610 }),
      ]),

      // 6 — Closer: social proof
      slide('Closer', [
        bg(lin(170, '#0B0D0C', '#121A12', '#0B0D0C'), {
          accents: [glow(LIME, 50, 30, 1000, 800, 0.24), glow(EMBER, 50, 100, 900, 700, 0.14)],
          noise: 0.05,
        }),
        ...[0, 1, 2, 3, 4].map((i) => shape('star', {
          name: `Star ${i + 1}`, x: 239 + i * 168, y: 250, width: 140, height: 140, fill: '{brand:pulselime}', starPoints: 5, starInnerRatio: 0.48,
        })),
        headline('JOIN 2M+\n{{ATHLETES}}', { y: 470 }),
        sub('4.9 average rating from 180,000 reviews', { y: 830 }),
        shape('rect', { name: 'CTA', cx: W / 2, y: 990, width: 720, height: 150, radius: 75, fill: '{brand:pulselime}', shadow: shadow(LIME, 70, 20, 0.35) }),
        text('Start training free', { name: 'CTA label', font: 'Inter', weight: 700, size: 52, fill: '{brand:pulseink}', align: 'center', width: 720, height: 150, valign: 'middle', cx: W / 2, y: 990 }),
        phone({ screen: a.awards.key, cx: W / 2, y: 1400, scale: 2.5, shadow: deviceShadow }),
        art(a.streak, { x: -20, y: 1190, k: 1.6, rotation: -6 }),
        art(a.heart, { x: 730, y: 1110, k: 1.4, rotation: 5 }),
      ]),
    ]
  },
}
