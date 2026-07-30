import type { PhoneModel, PhoneModelSpec } from '@/types'

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

export const APPLE_WATCH: PhoneModelSpec = {
  id: 'apple-watch', label: 'Apple Watch', frameWidth: 422, frameHeight: 514,
  screen: { x: 25, y: 25, width: 364, height: 464, cornerRadius: 91 },
  statusBar: { height: 0, platform: 'ios', contentY: 0 },
}

export const WEAR_OS: PhoneModelSpec = {
  id: 'wear-os', label: 'Wear OS', frameWidth: 480, frameHeight: 480,
  screen: { x: 31, y: 31, width: 418, height: 418, cornerRadius: 209 },
  statusBar: { height: 0, platform: 'android', contentY: 0 },
}

export const IPAD_13: PhoneModelSpec = {
  id: 'ipad-13', label: 'iPad', frameWidth: 420, frameHeight: 560,
  screen: { x: 12, y: 16, width: 396, height: 528, cornerRadius: 10 },
  statusBar: { height: 52, platform: 'ios', contentY: 26 },
}

export const ANDROID_TABLET: PhoneModelSpec = {
  id: 'android-tablet', label: 'Android Tablet', frameWidth: 400, frameHeight: 640,
  screen: { x: 12, y: 20, width: 376, height: 600, cornerRadius: 9 },
  statusBar: { height: 52, platform: 'android', contentY: 26 },
}

/** Empty SVG frame makes these landscape devices render as a plain screen. */
export const SCREEN_16_9: PhoneModelSpec = {
  id: 'screen-16-9', label: 'Frameless 16:9', frameWidth: 1920, frameHeight: 1080,
  screen: { x: 0, y: 0, width: 1920, height: 1080, cornerRadius: 0 },
  statusBar: { height: 0, platform: 'ios', contentY: 0 },
}

export const SCREEN_16_10: PhoneModelSpec = {
  id: 'screen-16-10', label: 'Frameless 16:10', frameWidth: 1440, frameHeight: 900,
  screen: { x: 0, y: 0, width: 1440, height: 900, cornerRadius: 0 },
  statusBar: { height: 0, platform: 'ios', contentY: 0 },
}

export const PHONE_MODELS: PhoneModelSpec[] = [
  IPHONE_16_PRO, IPHONE_16_PRO_PLAIN, PIXEL_9, PIXEL_9_PLAIN,
  APPLE_WATCH, WEAR_OS, IPAD_13, ANDROID_TABLET, SCREEN_16_9, SCREEN_16_10,
]

export function getPhoneSpec(model: string): PhoneModelSpec {
  return PHONE_MODELS.find((m) => m.id === model) ?? IPHONE_16_PRO
}

export function computePhoneFitScale(slideHeight: number, spec: PhoneModelSpec): number {
  return Math.min(1, (slideHeight * 0.8) / spec.frameHeight)
}

/** Map a phone model to its equivalent for a given platform. */
export function getModelForPlatform(model: PhoneModel, platform: 'ios' | 'android'): PhoneModel {
  const iosToAndroid: Record<string, PhoneModel> = {
    'iphone-16-pro': 'pixel-9',
    'iphone-16-pro-plain': 'pixel-9-plain',
  }
  const androidToIos: Record<string, PhoneModel> = {
    'pixel-9': 'iphone-16-pro',
    'pixel-9-plain': 'iphone-16-pro-plain',
  }
  if (platform === 'android') return iosToAndroid[model] ?? model
  return androidToIos[model] ?? model
}
