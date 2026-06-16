/**
 * Singleton registry for the Konva Stage instance.
 *
 * PropertiesPanel and other non-canvas components need access to the stage
 * (e.g. to call node.getClientRect() for alignment bounding boxes) but the
 * stage lives in StageCanvas and is not in the React tree of those components.
 *
 * Instead of prop-drilling stageRef through App → PropertiesPanel, App registers
 * the ref here once on mount and any consumer can call getStage() to read it.
 *
 * This is intentionally a module-level singleton — there is only ever one stage
 * in the editor at a time.
 */

import type Konva from 'konva'

let _stage: Konva.Stage | null = null

/** Called by App.tsx after the stageRef is attached. */
export function registerStage(stage: Konva.Stage | null): void {
  _stage = stage
}

/** Returns the current Konva Stage, or null if not yet mounted. */
export function getStage(): Konva.Stage | null {
  return _stage
}
