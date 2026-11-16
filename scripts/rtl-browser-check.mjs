import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'

// Run against `npm run dev -- --host 127.0.0.1 --port 4181`.
const browser = await chromium.launch({ headless: true, ...(process.env.PIXELDECK_TEST_CHANNEL ? { channel: process.env.PIXELDECK_TEST_CHANNEL } : {}) })
try {
  const page = await browser.newPage()
  await page.goto(process.env.PIXELDECK_TEST_URL ?? 'http://127.0.0.1:4181/')
  const results = await page.evaluate(async () => {
    const { renderSpansToCanvas } = await import('/src/utils/textRendering.ts')
    return ['שָׁלוֹם עוֹלָם?', '👨‍👩‍👧‍👦', '👍🏽', '🇮🇱'].flatMap((text) => [0, 2].map((letterSpacing) => {
      const layer = { id: 'proof', name: 'proof', type: 'text', x: 0, y: 0, rotation: 0, opacity: 1, visible: true, locked: false, text, fontFamily: 'Arial', fontSize: 48, fontWeight: 400, fill: '#ffffff', letterSpacing, lineHeight: 1.3, align: 'center', width: 1000, direction: 'rtl' }
      const actual = renderSpansToCanvas(layer)
      const reference = document.createElement('canvas'); reference.width = actual.width; reference.height = actual.height
      const ctx = reference.getContext('2d')
      ctx.font = 'normal 400 48px "Arial"'; ctx.letterSpacing = `${letterSpacing}px`; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#ffffff'; ctx.direction = 'rtl'; ctx.textAlign = 'right'
      const width = ctx.measureText(text).width
      ctx.fillText(text, (1000 + width) / 2, 48 * 0.9)
      const a = actual.getContext('2d').getImageData(0, 0, actual.width, actual.height).data
      const b = ctx.getImageData(0, 0, actual.width, actual.height).data
      let differences = 0; let painted = 0
      for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) differences++; if (i % 4 === 3 && a[i] > 0) painted++ }
      return { text, letterSpacing, differences, painted }
    }))
  })
  for (const result of results) { assert.equal(result.differences, 0, JSON.stringify(result)); assert.ok(result.painted > 0, JSON.stringify(result)) }
  console.log(JSON.stringify(results, null, 2))
} finally { await browser.close() }
