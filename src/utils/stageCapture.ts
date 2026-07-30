import type Konva from 'konva'
import type { RefObject } from 'react'
import { getPendingImageLoadCount } from '@/hooks/useCachedImage'

const DEFAULT_SETTLE_QUIET_FRAMES = 10
const DEFAULT_SETTLE_TIMEOUT_MS = 15000
const IMAGELESS_GRACE_MS = 250

type ImageNodeLike = { image(): unknown }

export function classifyStageImages(nodes: ImageNodeLike[]): { pending: number; imageless: number } {
  return nodes.reduce(
    (counts, node) => {
      const image = node.image()
      if (!image) {
        counts.imageless += 1
      } else if (typeof image === 'object' && 'complete' in image && !image.complete) {
        counts.pending += 1
      }
      return counts
    },
    { pending: 0, imageless: 0 },
  )
}

export function isImagelessBlocking(imageless: number, imagelessSinceMs: number | null, nowMs: number): boolean {
  return imageless > 0 && imagelessSinceMs !== null && nowMs - imagelessSinceMs < IMAGELESS_GRACE_MS
}

export const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve))

// Shared FIFO capture mutex. The single Konva stage + global store fields
// (activeSlideGroup, panoCompensate/Px) are mutated by initial thumbnail
// capture, preview capture, and export. They must never run concurrently.
let captureChain: Promise<void> = Promise.resolve()
let pendingCaptureCount = 0

/** Whether a capture currently holds the mutex or is queued to acquire it. */
export function isCaptureLocked(): boolean {
  return pendingCaptureCount > 0
}

export function acquireCaptureLock(): Promise<() => void> {
  const prev = captureChain
  pendingCaptureCount += 1
  let release!: () => void
  const next = new Promise<void>((resolve) => {
    release = resolve
  })
  captureChain = prev.then(() => next)
  return prev.then(() => {
    let released = false
    return () => {
      if (released) return
      released = true
      pendingCaptureCount -= 1
      release()
    }
  })
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

const MIN_POLLS = 3

export async function waitForStage(
  stageRef: RefObject<Konva.Stage | null>,
  timeoutMs = DEFAULT_SETTLE_TIMEOUT_MS,
): Promise<Konva.Stage | null> {
  const start = performance.now()
  let polls = 0
  while (polls < MIN_POLLS || performance.now() - start < timeoutMs) {
    if (stageRef.current && stageRef.current.width() > 0) return stageRef.current
    await nextFrame()
    polls += 1
  }
  return stageRef.current
}

export async function waitForStageSettled(
  stage: Konva.Stage,
  options: { quietFrames?: number; timeoutMs?: number } = {},
): Promise<boolean> {
  const quietFrames = options.quietFrames ?? DEFAULT_SETTLE_QUIET_FRAMES
  const timeoutMs = options.timeoutMs ?? DEFAULT_SETTLE_TIMEOUT_MS
  const start = performance.now()
  let stableFrames = 0
  let images = stage.find('Image')
  let lastCount = images.length
  let polls = 0
  let imagelessSince: number | null = null
  let classification = classifyStageImages(images as unknown as ImageNodeLike[])

  while (polls < MIN_POLLS || performance.now() - start < timeoutMs) {
    await nextFrame()
    polls += 1
    if (polls % 3 === 1) images = stage.find('Image')
    classification = classifyStageImages(images as unknown as ImageNodeLike[])
    const now = performance.now()
    if (classification.imageless > 0) {
      imagelessSince ??= now
    } else {
      imagelessSince = null
    }
    const allLoaded = classification.pending === 0
      && getPendingImageLoadCount() === 0
      && !isImagelessBlocking(classification.imageless, imagelessSince, now)

    if (allLoaded && images.length === lastCount) {
      stableFrames += 1
      if (stableFrames >= quietFrames) return true
    } else {
      stableFrames = 0
    }
    lastCount = images.length
  }

  const unsettled = (images as unknown as Array<ImageNodeLike & Partial<Konva.Node>>)
    .filter((node) => {
      const image = node.image()
      return !image || (typeof image === 'object' && 'complete' in image && !image.complete)
    })
    .slice(0, 5)
    .map((node) => ({
      id: node.id?.(),
      name: node.name?.(),
      className: node.getClassName?.(),
    }))
  console.warn('[PixelDeck] stage did not settle before capture timeout — capturing anyway', {
    totalImages: images.length,
    ...classification,
    unsettled,
  })
  return false
}

export async function waitForStageCaptureReady(
  stage: Konva.Stage,
  options: { quietFrames?: number; timeoutMs?: number } = {},
): Promise<boolean> {
  const settled = await waitForStageSettled(stage, options)
  await nextFrame()
  await nextFrame()
  return settled
}
