import type { PhoneModelSpec } from '@/types'

// iPhone 16 Pro: 6.3" display, 1320×2868 native
// Mockup at 390×844 logical units (standard design canvas)
// Dynamic Island SVG rect: x=145,y=26,w=100,h=34 (frame coords)
// → screen-relative: x=131,y=12,w=100,h=34 — contentY = 12+17 = 29
export const IPHONE_16_PRO: PhoneModelSpec = {
  id: 'iphone-16-pro',
  label: 'iPhone 16 Pro',
  frameWidth: 390,
  frameHeight: 844,
  screen: {
    x: 14,
    y: 14,
    width: 362,
    height: 816,
    cornerRadius: 44,
  },
  statusBar: {
    height: 59,
    platform: 'ios',
    contentY: 29,   // center of Dynamic Island
  },
}

// Google Pixel 9: 6.3" display
// Mockup at 380×820 logical units
// Punch-hole SVG: cx=190,cy=42,r=12 (frame coords)
// → screen-relative: cx=176,cy=26 — contentY = 26
export const PIXEL_9: PhoneModelSpec = {
  id: 'pixel-9',
  label: 'Google Pixel 9',
  frameWidth: 380,
  frameHeight: 820,
  screen: {
    x: 14,
    y: 16,
    width: 352,
    height: 788,
    cornerRadius: 36,
  },
  statusBar: {
    height: 48,
    platform: 'android',
    contentY: 26,   // center of punch-hole camera
  },
}

// iPhone 16 Pro — no Dynamic Island variant
// Same dimensions/screen as iphone-16-pro; traditional status bar centered at y=22
export const IPHONE_16_PRO_PLAIN: PhoneModelSpec = {
  id: 'iphone-16-pro-plain',
  label: 'iPhone 16 Pro (No Island)',
  frameWidth: 390,
  frameHeight: 844,
  screen: {
    x: 14,
    y: 14,
    width: 362,
    height: 816,
    cornerRadius: 44,
  },
  statusBar: {
    height: 44,
    platform: 'ios',
    contentY: 22,   // classic iOS status bar center
  },
}

// Google Pixel 9 — no punch-hole variant
// Same dimensions/screen as pixel-9; traditional status bar centered at y=20
export const PIXEL_9_PLAIN: PhoneModelSpec = {
  id: 'pixel-9-plain',
  label: 'Pixel 9 (No Camera)',
  frameWidth: 380,
  frameHeight: 820,
  screen: {
    x: 14,
    y: 16,
    width: 352,
    height: 788,
    cornerRadius: 36,
  },
  statusBar: {
    height: 40,
    platform: 'android',
    contentY: 20,   // classic Android status bar center
  },
}

export const PHONE_MODELS: PhoneModelSpec[] = [IPHONE_16_PRO, IPHONE_16_PRO_PLAIN, PIXEL_9, PIXEL_9_PLAIN]

export function getPhoneSpec(model: string): PhoneModelSpec {
  return PHONE_MODELS.find((m) => m.id === model) ?? IPHONE_16_PRO
}
