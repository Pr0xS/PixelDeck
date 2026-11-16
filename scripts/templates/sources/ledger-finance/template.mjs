import { art, bg, brand, glow, lin, phone, shadow, shape, slide, text, W } from '../../lib/dsl.mjs'

const FONTS = [
  'family=Inter:wght@400;500;600;700;800',
  'family=Sora:wght@400;600;700;800',
]
const screen = (file) => ({ file: `screens/${file}.html`, fonts: FONTS })
const float = (file, width, height) => ({ file: `art/${file}.html`, width, height, transparent: true, fonts: FONTS })

const MINT = '#34D399'
const VIOLET = '#7C3AED'
const NAVY = [[0, '#070A1F'], [0.5, '#10173A'], [1, '#1B2350']]

const MARK = { fill: '{brand:ledgrmint}' }
const headline = (source, o = {}) => text(source, {
  name: 'Headline', font: 'Sora', weight: 800, size: 118, leading: 1.06, spacing: -2,
  fill: '#FFFFFF', align: 'center', width: 1110, cx: W / 2, y: 290, mark: MARK, ...o,
})
const sub = (source, o = {}) => text(source, {
  name: 'Subtitle', font: 'Inter', weight: 500, size: 46, leading: 1.28,
  fill: 'rgba(226,231,255,0.74)', align: 'center', width: 1000, cx: W / 2, y: 590, ...o,
})
const bgFor = (angle, glows, noise = 0.045) => bg(lin(angle, ...NAVY), { accents: glows, noise })
const deviceShadow = shadow('#02030F', 120, 60, 0.65)
const cardShadow = shadow('#02030F', 60, 30, 0.45)

export default {
  slug: 'ledger-finance',
  order: 20,
  name: 'Ledgr',
  category: 'Finance',
  description: 'Calm, premium dark set for finance and investing apps: midnight navy into violet with mint highlights.',
  settings: {
    brandName: 'Ledgr',
    brandColors: [
      { id: 'ledgrviolet', name: 'Primary', value: VIOLET },
      { id: 'ledgrmint', name: 'Accent', value: MINT },
      { id: 'ledgrblue', name: 'Blue', value: '#3B82F6' },
    ],
  },
  art: {
    home: screen('home'),
    accounts: screen('accounts'),
    budgets: screen('budgets'),
    spending: screen('spending'),
    invest: screen('invest'),
    security: screen('security'),
    logo: { file: 'art/logo.html', width: 160, height: 160, transparent: true, fonts: FONTS },
    goalcard: float('goalcard', 380, 150),
    ontrack: float('ontrack', 360, 130),
    subscription: float('subscription', 380, 200),
    notif: float('notif', 400, 132),
    roundup: float('roundup', 380, 250),
    portfolio: float('portfolio', 340, 210),
    vcard: float('vcard', 360, 240),
  },
  build({ a }) {
    const check = (label, y) => [
      shape('rect', { name: 'Check badge', radius: 22, x: 100, y, width: 72, height: 72, fill: '{brand:ledgrmint}' }),
      shape('check', { name: 'Check', x: 116, y: y + 16, width: 40, height: 40, fill: '#07101F' }),
      text(label, { name: 'Feature', font: 'Inter', weight: 600, size: 50, fill: '#FFFFFF', x: 204, y: y + 8, width: 900 }),
    ]
    const star = (i) => shape('star', {
      name: `Star ${i + 1}`, x: 372 + i * 114, y: 250, width: 90, height: 90, fill: '#FBBF24', starPoints: 5, starInnerRatio: 0.48,
    })

    return [
      slide('Hero', [
        bgFor(172, [glow(VIOLET, 50, 52, 950, 800, 0.4, 160), glow('#3B82F6', 100, 100, 700, 700, 0.22, 140)]),
        brand('Ledgr', { x: 96, y: 104, color: '#FFFFFF', size: 52, logoSize: 78, logo: a.logo.key }),
        headline('Your money,\non {{autopilot}}', { y: 300 }),
        sub('Accounts, budgets and investing in one place', { y: 620, width: 1100 }),
        phone({ screen: a.home.key, cx: W / 2, y: 1010, scale: 2.5, shadow: deviceShadow }),
        art(a.notif, { x: 500, y: 860, k: 1.8, rotation: 4, shadow: cardShadow }),
      ]),

      slide('Accounts', [
        bgFor(100, [glow(VIOLET, 50, 62, 1300, 900, 0.36, 170), glow(MINT, 24, 6, 700, 520, 0.12, 140), glow('#3B82F6', 82, 12, 700, 520, 0.18, 140)]),
        headline('Every account,\none {{timeline}}', { cx: W / 2, width: 1110 }),
        sub('Checking, savings and brokerage together', { cx: W / 2, y: 620 }),
        headline('Spot every\n{{subscription}}', { cx: W + W / 2, width: 1110 }),
        sub('Recurring charges flagged before they renew', { cx: W + W / 2, y: 620 }),
        phone({ screen: a.accounts.key, cx: W, y: 980, scale: 2.55, shadow: deviceShadow }),
        art(a.vcard, { x: 190, y: 2250, k: 2.1, rotation: -8, shadow: cardShadow }),
        art(a.subscription, { x: 1700, y: 1180, k: 2.0, rotation: -5, shadow: cardShadow }),
        art(a.portfolio, { x: 1740, y: 1850, k: 1.9, rotation: 5, shadow: cardShadow }),
      ], { slides: 2 }),

      slide('Budgets', [
        bgFor(200, [glow(VIOLET, 78, 60, 900, 900, 0.38, 160), glow(MINT, 6, 94, 700, 600, 0.12, 140)]),
        headline('Budgets that\n{{adapt}} to you', { align: 'left', x: 100, width: 1090, y: 300 }),
        sub('Limits that learn from how you really spend', { align: 'left', x: 100, width: 1090, y: 620 }),
        phone({ screen: a.budgets.key, cx: 770, y: 1010, scale: 2.6, rotation: -7, shadow: deviceShadow }),
        art(a.roundup, { x: -12, y: 2390, k: 1.3, rotation: -5, shadow: cardShadow }),
      ]),

      slide('Security', [
        bgFor(155, [glow('#3B82F6', 18, 70, 800, 800, 0.26, 160), glow(VIOLET, 84, 40, 800, 800, 0.32, 160)]),
        headline('Bank-grade\n{{security}}', { align: 'left', x: 100, width: 1090, y: 300 }),
        ...check('Freeze your card in a tap', 700),
        ...check('Face ID on every login', 820),
        ...check('Instant purchase alerts', 940),
        ...check('Encrypted end to end', 1060),
        phone({ screen: a.security.key, cx: 690, y: 1260, scale: 2.6, shadow: deviceShadow }),
      ]),

      slide('Invest', [
        bgFor(168, [glow(MINT, 50, 70, 900, 700, 0.16, 170), glow(VIOLET, 14, 30, 800, 800, 0.36, 160), glow('#3B82F6', 92, 18, 600, 600, 0.2, 140)]),
        headline('Save and invest\n{{automatically}}', { y: 300 }),
        sub('Round-ups and auto-invest grow your balance', { y: 620, width: 1100 }),
        phone({ screen: a.invest.key, cx: 660, y: 1000, scale: 2.7, rotation: -6, shadow: deviceShadow }),
        art(a.portfolio, { x: 600, y: 800, k: 1.95, rotation: 5, shadow: cardShadow }),
      ]),

      slide('Closer', [
        bgFor(185, [glow(VIOLET, 50, 30, 1000, 800, 0.4, 170), glow(MINT, 50, 100, 900, 600, 0.14, 150)]),
        ...[0, 1, 2, 3, 4].map(star),
        headline('Loved by 2M+\n{{savers}}', { y: 400 }),
        sub('Join millions growing their money with Ledgr', { y: 720, width: 1060 }),
        shape('rect', { name: 'CTA', cx: W / 2, y: 880, width: 640, height: 140, radius: 70, fill: '{brand:ledgrmint}', shadow: shadow(MINT, 60, 20, 0.35) }),
        text('Get Ledgr free', { name: 'CTA label', font: 'Sora', weight: 700, size: 52, fill: '#07101F', align: 'center', width: 640, cx: W / 2, y: 880, height: 140, valign: 'middle' }),
        phone({ screen: a.spending.key, cx: 645, y: 1330, scale: 2.4, rotation: -4, shadow: deviceShadow }),
        art(a.ontrack, { x: 640, y: 1400, k: 1.7, rotation: 5, shadow: cardShadow }),
        art(a.goalcard, { x: -10, y: 2250, k: 1.8, rotation: -5, shadow: cardShadow }),
      ]),
    ]
  },
}
