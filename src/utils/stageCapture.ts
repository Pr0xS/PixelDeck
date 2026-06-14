import type Konva from 'konva'
import type { RefObject } from 'react'

const DEFAULT_SETTLE_QUIET_FRAMES = 10
const DEFAULT_SETTLE_TIMEOUT_MS = 15000

export const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve))

// Shared FIFO capture mutex. The single Konva stage + global store fields
// (activeSlideGroup, panoCompensate/Px) are mutated by initial thumbnail
// capture, preview capture, and export. They must never run concurrently.
let captureChain: Promise<void> = Promise.resolve()

export function acquireCaptureLock(): Promise<() => void> {
  const prev = captureChain
  let release!: () => void
  const next = new Promise<void>((resolve) => {
    release = resolve
  })
  captureChain = prev.then(() => next)
  return prev.then(() => release)
}

export async function runExclusiveCapture<T>(fn: () => Promise<T>): Promise<T> {
  const release = await acquireCaptureLock()
  try {
    return await fn()
  } finally {
    release()
  }
}

export function withIdentityTransform<T>(stage: Konva.Stage, fn: () => T): T {
  const prevX = stage.x()
  const prevY = stage.y()
  const prevScaleX = stage.scaleX()
  const prevScaleY = stage.scaleY()
  try {
    stage.x(0)
    stage.y(0)
    stage.scaleX(1)
    stage.scaleY(1)
    return fn()
  } finally {
    stage.x(prevX)
    stage.y(prevY)
    stage.scaleX(prevScaleX)
    stage.scaleY(prevScaleY)
  }
}

export async function waitForStage(
  stageRef: RefObject<Konva.Stage | null>,
  timeoutMs = DEFAULT_SETTLE_TIMEOUT_MS,
): Promise<Konva.Stage | null> {
  const start = performance.now()
  while (performance.now() - start < timeoutMs) {
    if (stageRef.current && stageRef.current.width() > 0) return stageRef.current
    await nextFrame()
  }
  return stageRef.current
}

export async function waitForStageSettled(
  stage: Konva.Stage,
  options: { quietFrames?: number; timeoutMs?: number } = {},
): Promise<void> {
  const quietFrames = options.quietFrames ?? DEFAULT_SETTLE_QUIET_FRAMES
  const timeoutMs = options.timeoutMs ?? DEFAULT_SETTLE_TIMEOUT_MS
  const start = performance.now()
  let stableFrames = 0
  let lastCount = -1

  while (performance.now() - start < timeoutMs) {
    await nextFrame()
    const images = stage.find('Image')
    const allLoaded = images.every((node) => {
      const img = (node as Konva.Image).image()
      if (!img) return false
      if (img instanceof HTMLImageElement) return img.complete && img.naturalWidth > 0
      return true
    })

    if (allLoaded && images.length === lastCount) {
      stableFrames += 1
      if (stableFrames >= quietFrames) return
    } else {
      stableFrames = 0
    }
    lastCount = images.length
  }

  console.warn('[PixelDeck] stage did not settle before capture timeout — capturing anyway')
}

export async function waitForStageCaptureReady(stage: Konva.Stage): Promise<void> {
  await waitForStageSettled(stage)
  await nextFrame()
  await nextFrame()
}
