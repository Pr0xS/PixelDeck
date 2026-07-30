/**
 * P0 safety net for the current 3-tier locale layout system: base (authored)
 * -> auto-scaled per format -> formatOverrides[F] (absolute, pinned, per-format
 * only) -> + localeAdjust[locale][scope] (delta-valued, composes rather than
 * wins; scope is either BASE_CANVAS_FORMAT, which composes at every format —
 * additive dx/dy scaled by that format's factor `f`, dRotation and the
 * multiplicative keys applied unscaled — or a specific CanvasFormatId, which
 * composes only at that exact format, always unscaled). One-line mental
 * model: the format axis pins, the locale axis adjusts. See AGENTS.md's
 * "Locale Layout Adjustment Model" section for the reference table.
 *
 * This file predates the 3-tier model — it was written as the P0 golden-master
 * net for the rework FROM the older 4-tier system (base -> formatOverrides[F]
 * -> localeBaseDelta[locale] -> localeLayoutOverrides[locale][F], with
 * most-specific-cell-wins precedence) TO the current one. That migration
 * (P0-P4) is complete and shipped; `localeAdjust` is the sole storage for
 * per-locale layout adjustments now — the legacy `localeBaseDelta`/
 * `localeLayoutOverrides` fields were deleted from `BaseLayer` (P4). They
 * survive only as an internal-only `LegacyLocaleLayoutFields` read used by
 * `migrateProjectToLocaleAdjust` to still fold old project files on disk
 * (Part 1b below pins exactly that path).
 *
 * Everything in Parts 1, 1b, and 2 below is written and read through the
 * PUBLIC API only: store actions (updateLayer / updateChildLayer /
 * setActiveLocale / setActiveCanvasFormat / updateSettings / importProject /
 * ...) for writes, and resolveProjectView() for reads. No internal field
 * name (localeAdjust, formatOverrides) is read or asserted against directly
 * anywhere in those parts — they must survive a future rewrite of the
 * internal data model unchanged. The migration-gate describes at the end of
 * this file are the deliberate exception: they hand-build legacy-shaped
 * fixtures and assert `localeAdjust` internals directly, because they exist
 * specifically to test the migration itself.
 *
 * Part 1: a golden-master render-identity corpus, built live through the
 * store. Reused unchanged across phases to prove an internal rewrite doesn't
 * shift a single resolved value.
 *
 * Part 1b: a FIXED legacy-JSON migration snapshot (`legacy-4tier-project.json`,
 * frozen 4-tier-shaped data captured before the legacy fields were deleted).
 * The live corpus above is built via store actions every test run and never
 * passes through migrateProject (only importProject/hydration paths run it)
 * — being live/self-consistent means a symmetric write-bug + read-bug pair
 * could cancel out and stay invisible. This snapshot decouples the frozen
 * input from whatever the live write path does at any given time, and is
 * the permanent proof that old project files still migrate correctly now
 * that the legacy fields are gone from `BaseLayer`'s type.
 *
 * Part 2: a per-authoring-context write/read mirror test — one case per
 * (locale, format) authoring context, proving a write in one context cannot
 * leak into another. This is the invariant class the shipped OverrideDot
 * wiring bug violated. Originally split into an INVARIANT describe (must
 * never change) and a separate BEHAVIOR describe holding two assertions
 * that encoded a stale-pin defect in the old 4-tier model and were expected
 * to flip once the unification shipped. That flip already happened (P3):
 * both assertions were moved out of the old BEHAVIOR describe into their
 * permanent home as cases (b) and (c) inside the "locale layout write
 * isolation across the 4 authoring contexts" describe below (Part 2), now
 * inside the top-level INVARIANT describe like everything else in this
 * file — there is no more separate BEHAVIOR describe.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { CanvasFormatId, GroupLayer, Layer, LegacyLocaleLayoutFields, PhoneLayer, Project, TextLayer } from '@/types'
import { getPhoneSpec } from '@/assets/mockups/specs'
import { resolveGroupView, resolveProjectView } from '@/utils/canvasFormats'
import { migrateProjectToLocaleAdjust, migrateProject } from './helpers'
import { useEditorStore } from './index'

const BASE_FORMAT = 'base' as const
const ANDROID_FORMAT = 'android-phone' as const

function activeGroup() {
  const { project, activeSlideGroupId } = useEditorStore.getState()
  return project.slideGroups.find((g) => g.id === activeSlideGroupId)!
}

function lastLayerId(): string {
  const layers = activeGroup().layers
  return layers[layers.length - 1].id
}

function findLayerInProject(project: Project, layerId: string): Layer {
  for (const group of project.slideGroups) {
    for (const layer of group.layers) {
      if (layer.id === layerId) return layer
      if (layer.type === 'group') {
        const child = (layer as GroupLayer).children.find((c) => c.id === layerId)
        if (child) return child
      }
    }
  }
  throw new Error(`layer ${layerId} not found in project`)
}

function resolvedLayer(project: Project, locale: string, format: CanvasFormatId, layerId: string): Layer {
  if (resolutionPath === 'project') return findLayerInProject(resolveProjectView(project, locale, format), layerId)
  for (const group of project.slideGroups) {
    try {
      findLayerInProject({ ...project, slideGroups: [group] }, layerId)
      return findLayerInProject({ ...project, slideGroups: [resolveGroupView(group, project.settings, locale, format)] }, layerId)
    } catch {
      // Try the next group.
    }
  }
  throw new Error(`layer ${layerId} not found in project`)
}

function resetStore() {
  useEditorStore.getState().resetProject()
  useEditorStore.setState({
    activeLocale: 'en',
    activeCanvasFormat: BASE_FORMAT,
    editingGroupId: null,
    selectedLayerIds: [],
    selection: null,
  })
  useEditorStore.temporal.getState().clear()
}

// Fit-center scale factor from a 1320x2868 authoring canvas to the
// android-phone preset (1080x1920). Computed once, reused for every
// expected-value formula below (same pattern as canvasFormats.test.ts).
const s = Math.min(1080 / 1320, 1920 / 2868)
// The phone fixture's iPhone is auto-swapped to Pixel in android-phone. Its
// area-preserving model rebase applies before fit-centre and locale scaling.
const phoneSwapScale = Math.sqrt(
  (getPhoneSpec('iphone-16-pro').frameWidth * getPhoneSpec('iphone-16-pro').frameHeight)
  / (getPhoneSpec('pixel-9').frameWidth * getPhoneSpec('pixel-9').frameHeight),
)

let resolutionPath: 'project' | 'group'

describe.each(['project', 'group'] as const)('%s resolution path', (path) => {
  beforeEach(() => { resolutionPath = path })
  describe('INVARIANT — must never change through the rework', () => {
  // ───────────────────────────────────────────────────────────────────────
  // Part 1: golden-master render-identity corpus
  // ───────────────────────────────────────────────────────────────────────
  describe('locale layout golden-master corpus', () => {
    let project: Project

    let plainId: string
    let formatOnlyId: string
    let baseDeltaOnlyId: string
    let formatScopedOnlyId: string
    let allThreeId: string
    let groupId: string
    let childId: string
    let childOriginalX: number
    let panoLayerId: string

    // B2 additions: multiplicative-tier coverage (width/height/fontSize/scale)
    let multBaseDeltaId: string // base-scoped multiplicative delta (width, fontSize) + dy
    let allThreeMultId: string // formatOverride.width + base-scoped mWidth composed
    let phoneScaleId: string // scale field, non-group layer, base-scoped delta
    let group2Id: string
    let child2Id: string
    let child2OriginalX: number

    // [Oracle P0 follow-in, mandatory before P1 starts]: a formatOverrides
    // anchor composed with a base-scoped multiplicative+additive delta, with
    // NO localeLayoutOverrides cell shadowing it on top. Without this, a
    // wrong migration-derived R can cancel against the read path and still
    // pass (self-certifying, not proof) whenever an `lf` cell is present —
    // this is the multiplicative analogue of T1.
    let unshadowedAnchorDeltaId: string

    beforeAll(() => {
      resetStore()
      const store = useEditorStore.getState()
      store.addLocale('de') // side effect: also sets activeLocale to 'de'
      store.setActiveLocale('en')
      store.updateSettings({ activeFormats: [ANDROID_FORMAT] })

      // ── Main (non-pano) slide group ──────────────────────────────────────
      store.addSlideGroup()
      const mainGroupId = activeGroup().id
      store.updateSlideGroup(mainGroupId, { slideWidth: 1320, slideHeight: 2868 })

      // 1. Plain layer: no overrides of any kind.
      store.addText()
      plainId = lastLayerId()

      // 2. formatOverrides[android] alone.
      store.addText()
      formatOnlyId = lastLayerId()
      store.setActiveCanvasFormat(ANDROID_FORMAT)
      store.updateLayer(formatOnlyId, { x: 300, fontSize: 60 })
      store.setActiveCanvasFormat(BASE_FORMAT)

      // 3. localeBaseDelta['de'] alone.
      store.addText()
      baseDeltaOnlyId = lastLayerId()
      store.setActiveLocale('de')
      store.updateLayer(baseDeltaOnlyId, { x: 140 }) // dx = 40 (base x is 100)
      store.setActiveLocale('en')

      // 4. localeLayoutOverrides['de']['android-phone'] alone.
      store.addText()
      formatScopedOnlyId = lastLayerId()
      store.setActiveLocale('de')
      store.setActiveCanvasFormat(ANDROID_FORMAT)
      store.updateLayer(formatScopedOnlyId, { x: 777 })
      store.setActiveLocale('en')
      store.setActiveCanvasFormat(BASE_FORMAT)

      // 5. All three tiers present simultaneously on the same layer.
      store.addText()
      allThreeId = lastLayerId()
      store.setActiveCanvasFormat(ANDROID_FORMAT)
      store.updateLayer(allThreeId, { x: 500, fontSize: 50 })
      store.setActiveCanvasFormat(BASE_FORMAT)
      store.setActiveLocale('de')
      store.updateLayer(allThreeId, { x: 160, rotation: 15 }) // dx = 60, dRotation = 15
      store.setActiveCanvasFormat(ANDROID_FORMAT)
      store.updateLayer(allThreeId, { x: 900 })
      store.setActiveLocale('en')
      store.setActiveCanvasFormat(BASE_FORMAT)

      // 6. Group + child layer, to exercise the origin-anchored child scaling
      // path. Child gets a locale/format override on x.
      store.addText()
      const childSeedId = lastLayerId()
      store.addShape()
      const shapeSeedId = lastLayerId()
      store.createGroup([childSeedId, shapeSeedId])
      const group = activeGroup().layers.find((l) => l.type === 'group') as GroupLayer
      groupId = group.id
      childId = childSeedId
      childOriginalX = group.children.find((c) => c.id === childId)!.x
      store.setActiveLocale('de')
      store.setActiveCanvasFormat(ANDROID_FORMAT)
      store.updateChildLayer(groupId, childId, { x: childOriginalX + 30 })
      store.setActiveLocale('en')
      store.setActiveCanvasFormat(BASE_FORMAT)

      // 7. [B2] Base-scoped MULTIPLICATIVE delta: width + fontSize, plus a dy
      // (additive, previously untested) thrown in cheaply on the same layer.
      store.addText()
      multBaseDeltaId = lastLayerId()
      store.setActiveLocale('de')
      store.updateLayer(multBaseDeltaId, { width: 1500, fontSize: 150, y: 250 })
      // mWidth = 1500/1000 = 1.5, mFontSize = 150/100 = 1.5, dy = 50
      store.setActiveLocale('en')

      // 8. [B2] Multiplicative TWIN of the allThree fixture: all three tiers
      // present on the SAME key (width) — formatOverrides[android].width,
      // localeBaseDelta['de'].mWidth, and localeLayoutOverrides['de']['android'].width
      // — so the (de, android) cell exercises the absolute override winning
      // over the composed formatOverride+baseDelta value, mirroring the
      // additive allThree fixture's (de, android) case exactly.
      store.addText()
      allThreeMultId = lastLayerId()
      store.setActiveCanvasFormat(ANDROID_FORMAT)
      store.updateLayer(allThreeMultId, { width: 700 }) // formatOverrides[android].width = 700
      store.setActiveCanvasFormat(BASE_FORMAT)
      store.setActiveLocale('de')
      store.updateLayer(allThreeMultId, { width: 2000 }) // mWidth = 2000/1000 = 2 (base width is 1000)
      store.setActiveCanvasFormat(ANDROID_FORMAT)
      store.updateLayer(allThreeMultId, { width: 1800 }) // localeLayoutOverrides[de][android].width
      store.setActiveLocale('en')
      store.setActiveCanvasFormat(BASE_FORMAT)

      // 9. [B2] `scale` field on a non-group layer (phone), base-scoped delta.
      store.addPhone()
      phoneScaleId = lastLayerId()
      store.setActiveLocale('de')
      store.updateLayer(phoneScaleId, { scale: 1.5 }) // mScale = 1.5/1.0 = 1.5 (fit-centred default scale is 1.0)
      store.setActiveLocale('en')

      // 10. [Recommended #1] Group CHILD with a BASE-SCOPED delta (the fixture
      // above only covers a format-scoped override on the child).
      store.addText()
      const childSeed2Id = lastLayerId()
      store.addShape()
      const shapeSeed2Id = lastLayerId()
      store.createGroup([childSeed2Id, shapeSeed2Id])
      const group2 = activeGroup().layers.find((l) => l.type === 'group' && l.id !== groupId) as GroupLayer
      group2Id = group2.id
      child2Id = childSeed2Id
      child2OriginalX = group2.children.find((c) => c.id === child2Id)!.x
      store.setActiveLocale('de')
      store.updateChildLayer(group2Id, child2Id, { x: child2OriginalX + 20 }) // base-scoped delta, dx = 20
      store.setActiveLocale('en')

      // 11. [Oracle P0 follow-in] formatOverrides[android] anchor (x=600,
      // width=700) composed with a base-scoped multiplicative+additive
      // delta (dx=30, mWidth=2), NO localeLayoutOverrides cell on top.
      store.addText()
      unshadowedAnchorDeltaId = lastLayerId()
      store.setActiveCanvasFormat(ANDROID_FORMAT)
      store.updateLayer(unshadowedAnchorDeltaId, { x: 600, width: 700 }) // formatOverrides[android]
      store.setActiveCanvasFormat(BASE_FORMAT)
      store.setActiveLocale('de')
      store.updateLayer(unshadowedAnchorDeltaId, { x: 130, width: 2000 }) // dx = 30 (base x 100), mWidth = 2 (base width 1000)
      store.setActiveLocale('en')

      // ── Pano slide group (numSlides: 2) ──────────────────────────────────
      store.addSlideGroup()
      const panoGroupId = activeGroup().id
      store.updateSlideGroup(panoGroupId, { slideWidth: 1320, slideHeight: 2868, numSlides: 2 })
      store.addText()
      panoLayerId = lastLayerId()
      // Move into slide-2 authoring space (x > slideWidth), still default context.
      store.updateLayer(panoLayerId, { x: 1720 })
      store.setActiveLocale('de')
      store.updateLayer(panoLayerId, { x: 1770 }) // dx = 50
      store.setActiveLocale('en')

      project = useEditorStore.getState().project
    })

    it('plain layer auto-scales uniformly with no locale/format divergence', () => {
      const enBase = resolvedLayer(project, 'en', BASE_FORMAT, plainId) as TextLayer
      const enAndroid = resolvedLayer(project, 'en', ANDROID_FORMAT, plainId) as TextLayer
      const deBase = resolvedLayer(project, 'de', BASE_FORMAT, plainId) as TextLayer
      const deAndroid = resolvedLayer(project, 'de', ANDROID_FORMAT, plainId) as TextLayer

      expect(enBase.x).toBe(100)
      expect(enBase.y).toBe(200)
      expect(enBase.fontSize).toBe(100)

      expect(enAndroid.x).toBeCloseTo(540 + (100 - 660) * s)
      expect(enAndroid.y).toBeCloseTo(960 + (200 - 1434) * s)
      // [B3 item 3] Pinned to a literal computed value (not self-referential
      // against enBase.width) so it can't silently drift with itself.
      expect(enAndroid.width).toBeCloseTo(1000 * s)
      expect(enAndroid.fontSize).toBeCloseTo(100 * s)

      // No locale content/layout applies to this layer: 'de' mirrors 'en' exactly.
      expect(deBase).toMatchObject({ x: enBase.x, y: enBase.y, fontSize: enBase.fontSize })
      expect(deAndroid).toMatchObject({ x: enAndroid.x, y: enAndroid.y, fontSize: enAndroid.fontSize })
    })

    it('formatOverrides[android] alone wins in android for both locales, base view untouched', () => {
      expect((resolvedLayer(project, 'en', BASE_FORMAT, formatOnlyId) as TextLayer).x).toBe(100)
      expect((resolvedLayer(project, 'en', BASE_FORMAT, formatOnlyId) as TextLayer).fontSize).toBe(100)
      expect((resolvedLayer(project, 'en', ANDROID_FORMAT, formatOnlyId) as TextLayer).x).toBe(300)
      expect((resolvedLayer(project, 'en', ANDROID_FORMAT, formatOnlyId) as TextLayer).fontSize).toBe(60)
      expect((resolvedLayer(project, 'de', BASE_FORMAT, formatOnlyId) as TextLayer).x).toBe(100)
      expect((resolvedLayer(project, 'de', ANDROID_FORMAT, formatOnlyId) as TextLayer).x).toBe(300)
      expect((resolvedLayer(project, 'de', ANDROID_FORMAT, formatOnlyId) as TextLayer).fontSize).toBe(60)
    })

    it('base-scoped locale adjustment alone (de) shifts base and cascades scaled into android', () => {
      expect((resolvedLayer(project, 'en', BASE_FORMAT, baseDeltaOnlyId) as TextLayer).x).toBe(100)
      expect((resolvedLayer(project, 'en', ANDROID_FORMAT, baseDeltaOnlyId) as TextLayer).x)
        .toBeCloseTo(540 + (100 - 660) * s)
      expect((resolvedLayer(project, 'de', BASE_FORMAT, baseDeltaOnlyId) as TextLayer).x).toBe(140)
      expect((resolvedLayer(project, 'de', ANDROID_FORMAT, baseDeltaOnlyId) as TextLayer).x)
        .toBeCloseTo(540 + (100 - 660) * s + 40 * s)
    })

    it('format-scoped locale adjustment alone (de, android) only applies for that exact (locale, format) cell', () => {
      expect((resolvedLayer(project, 'en', BASE_FORMAT, formatScopedOnlyId) as TextLayer).x).toBe(100)
      expect((resolvedLayer(project, 'en', ANDROID_FORMAT, formatScopedOnlyId) as TextLayer).x)
        .toBeCloseTo(540 + (100 - 660) * s)
      expect((resolvedLayer(project, 'de', BASE_FORMAT, formatScopedOnlyId) as TextLayer).x).toBe(100)
      expect((resolvedLayer(project, 'de', ANDROID_FORMAT, formatScopedOnlyId) as TextLayer).x).toBe(777)
    })

    it('composes all three tiers on the same key: format override wins in (en,android), base delta cascades into (de,base), locale/format override wins in (de,android)', () => {
      const enBase = resolvedLayer(project, 'en', BASE_FORMAT, allThreeId) as TextLayer
      const enAndroid = resolvedLayer(project, 'en', ANDROID_FORMAT, allThreeId) as TextLayer
      const deBase = resolvedLayer(project, 'de', BASE_FORMAT, allThreeId) as TextLayer
      const deAndroid = resolvedLayer(project, 'de', ANDROID_FORMAT, allThreeId) as TextLayer

      expect(enBase).toMatchObject({ x: 100, fontSize: 100, rotation: 0 })
      expect(enAndroid).toMatchObject({ x: 500, fontSize: 50, rotation: 0 })
      expect(deBase).toMatchObject({ x: 160, fontSize: 100, rotation: 15 })
      expect(deAndroid).toMatchObject({ x: 900, fontSize: 50, rotation: 15 })
    })

    it('group child scales from its group-local origin and its locale/format override pins the resolved value', () => {
      const groupEnBase = resolvedLayer(project, 'en', BASE_FORMAT, groupId) as GroupLayer
      const groupEnAndroid = resolvedLayer(project, 'en', ANDROID_FORMAT, groupId) as GroupLayer
      const groupDeBase = resolvedLayer(project, 'de', BASE_FORMAT, groupId) as GroupLayer
      const groupDeAndroid = resolvedLayer(project, 'de', ANDROID_FORMAT, groupId) as GroupLayer

      const childEnBase = groupEnBase.children.find((c) => c.id === childId)!
      const childEnAndroid = groupEnAndroid.children.find((c) => c.id === childId)!
      const childDeBase = groupDeBase.children.find((c) => c.id === childId)!
      const childDeAndroid = groupDeAndroid.children.find((c) => c.id === childId)!

      expect(childEnBase.x).toBe(childOriginalX)
      // Group children are Konva-local coordinates, so they use an origin
      // anchor instead of the canvas-centre translation used by top-level layers.
      expect(childEnAndroid.x).toBeCloseTo(childOriginalX * s)
      expect(childDeBase.x).toBe(childOriginalX) // no base delta on the child
      expect(childDeAndroid.x).toBe(childOriginalX + 30) // locale/format override wins, absolute
    })

    it('pano group (numSlides: 2) scales slide-2 positions and cascades the locale base delta by the same fit-center factor', () => {
      // Pano fit-center transform anchors to the *full* pano canvas width
      // (slideWidth * numSlides), per applyCanvasFormatToGroup. For numSlides=2:
      // fromW = 2640, toW = 2160, so newX = 1080 + (x - 1320) * s.
      expect((resolvedLayer(project, 'en', BASE_FORMAT, panoLayerId) as TextLayer).x).toBe(1720)
      expect((resolvedLayer(project, 'en', ANDROID_FORMAT, panoLayerId) as TextLayer).x)
        .toBeCloseTo(1080 + (1720 - 1320) * s)
      expect((resolvedLayer(project, 'de', BASE_FORMAT, panoLayerId) as TextLayer).x).toBe(1770)
      expect((resolvedLayer(project, 'de', ANDROID_FORMAT, panoLayerId) as TextLayer).x)
        .toBeCloseTo(1080 + (1720 - 1320) * s + 50 * s)
    })

    // ─────────────────────────────────────────────────────────────────────
    // [B2] Multiplicative half of the delta model: width / height / fontSize
    // / scale. Every fixture above only exercised additive keys (x, rotation).
    // ─────────────────────────────────────────────────────────────────────

    it('[B2] base-scoped multiplicative delta (width, fontSize) plus dy composes correctly across formats', () => {
      const enBase = resolvedLayer(project, 'en', BASE_FORMAT, multBaseDeltaId) as TextLayer
      const enAndroid = resolvedLayer(project, 'en', ANDROID_FORMAT, multBaseDeltaId) as TextLayer
      const deBase = resolvedLayer(project, 'de', BASE_FORMAT, multBaseDeltaId) as TextLayer
      const deAndroid = resolvedLayer(project, 'de', ANDROID_FORMAT, multBaseDeltaId) as TextLayer

      expect(enBase).toMatchObject({ y: 200, width: 1000, fontSize: 100 })
      expect(enAndroid.y).toBeCloseTo(960 + (200 - 1434) * s)
      expect(enAndroid.width).toBeCloseTo(1000 * s)
      expect(enAndroid.fontSize).toBeCloseTo(100 * s)

      // Multiplicative deltas multiply the already-resolved (format-scaled)
      // value directly by the stored ratio — they do NOT get scaled by `f`
      // themselves. Only additive dx/dy scale by `f`; dRotation applies
      // unscaled too (rotation is not a distance). See applyLayoutDelta in
      // canvasFormats.ts.
      expect(deBase).toMatchObject({ y: 250, width: 1500, fontSize: 150 })
      expect(deAndroid.y).toBeCloseTo(960 + (200 - 1434) * s + 50 * s) // dy IS scaled by f
      expect(deAndroid.width).toBeCloseTo(1000 * s * 1.5)
      expect(deAndroid.fontSize).toBeCloseTo(100 * s * 1.5)
    })

    it('[B2] multiplicative TWIN of allThree: format override, base delta, and locale/format override compose on the same key (width)', () => {
      const enBase = resolvedLayer(project, 'en', BASE_FORMAT, allThreeMultId) as TextLayer
      const enAndroid = resolvedLayer(project, 'en', ANDROID_FORMAT, allThreeMultId) as TextLayer
      const deBase = resolvedLayer(project, 'de', BASE_FORMAT, allThreeMultId) as TextLayer
      const deAndroid = resolvedLayer(project, 'de', ANDROID_FORMAT, allThreeMultId) as TextLayer

      expect(enBase.width).toBe(1000)
      expect(enAndroid.width).toBe(700) // formatOverride wins, absolute (not further scaled)
      expect(deBase.width).toBe(2000) // base delta: 1000 * mWidth(2)
      // (de, android) has its own absolute localeLayoutOverrides cell for this
      // key, so it wins outright over the composed formatOverride+baseDelta
      // value (700 * 2 = 1400) — same precedence as the additive allThree
      // fixture's (de, android) case, where the absolute override (900) wins
      // over its own composed base+delta value.
      // P3: read path now goes through the delta-valued `localeAdjust` tier
      // (migration derives m = V/R, read multiplies R*m back) — a
      // divide-then-multiply round trip that is exact in the legacy
      // absolute-spread path but picks up a float ULP here (1800.0000000000002).
      // toBeCloseTo, not toBe: this is expected floating-point behavior of
      // the delta model, not a regression.
      expect(deAndroid.width).toBeCloseTo(1800)
    })

    it('[B2] `scale` field adjustment on a non-group layer (phone) exercises the layer.type !== "group" branch', () => {
      const enBase = resolvedLayer(project, 'en', BASE_FORMAT, phoneScaleId) as PhoneLayer
      const enAndroid = resolvedLayer(project, 'en', ANDROID_FORMAT, phoneScaleId) as PhoneLayer
      const deBase = resolvedLayer(project, 'de', BASE_FORMAT, phoneScaleId) as PhoneLayer
      const deAndroid = resolvedLayer(project, 'de', ANDROID_FORMAT, phoneScaleId) as PhoneLayer

      expect(enBase.scale).toBe(1.0)
      expect(enAndroid.scale).toBeCloseTo(s * phoneSwapScale)
      expect(deBase.scale).toBeCloseTo(1.5) // 1.0 * mScale(1.5)
      expect(deAndroid.scale).toBeCloseTo(s * phoneSwapScale * 1.5)
    })

    it('[Recommended #1] group child with a BASE-SCOPED delta (not just a format-scoped override) cascades scaled into android', () => {
      const group2EnBase = resolvedLayer(project, 'en', BASE_FORMAT, group2Id) as GroupLayer
      const group2EnAndroid = resolvedLayer(project, 'en', ANDROID_FORMAT, group2Id) as GroupLayer
      const group2DeBase = resolvedLayer(project, 'de', BASE_FORMAT, group2Id) as GroupLayer
      const group2DeAndroid = resolvedLayer(project, 'de', ANDROID_FORMAT, group2Id) as GroupLayer

      const child2EnBase = group2EnBase.children.find((c) => c.id === child2Id)!
      const child2EnAndroid = group2EnAndroid.children.find((c) => c.id === child2Id)!
      const child2DeBase = group2DeBase.children.find((c) => c.id === child2Id)!
      const child2DeAndroid = group2DeAndroid.children.find((c) => c.id === child2Id)!

      expect(child2EnBase.x).toBe(child2OriginalX)
      expect(child2EnAndroid.x).toBeCloseTo(child2OriginalX * s)
      expect(child2DeBase.x).toBe(child2OriginalX + 20) // base delta applies at scaleFactor=1 in base format
      expect(child2DeAndroid.x).toBeCloseTo((child2OriginalX + 20) * s) // local coordinate and delta both scale from origin
    })

    it('[Oracle P0 follow-in] a formatOverrides anchor composes with an unshadowed base-scoped multiplicative+additive delta (multiplicative analogue of T1)', () => {
      const deAndroid = resolvedLayer(project, 'de', ANDROID_FORMAT, unshadowedAnchorDeltaId) as TextLayer
      expect(deAndroid.x).toBeCloseTo(600 + 30 * s)
      expect(deAndroid.width).toBe(1400) // 700 (formatOverride anchor) * mWidth(2)
    })
  })

  // ───────────────────────────────────────────────────────────────────────
  // Part 1b [B1]: fixed legacy-JSON migration snapshot
  // ───────────────────────────────────────────────────────────────────────
  describe('legacy 4-tier JSON fixture reproduces the golden-master corpus through importProject', () => {
    // Frozen JSON captured (once) by exporting the exact corpus built above
    // via the public exportProject() API, BEFORE this suite's assertions
    // ever depend on it. Committed as a static fixture so this test exercises
    // the migrateProject/importProject hydration path (which the live corpus
    // above never does) against input that cannot silently change alongside
    // the write path. A future migration phase must reproduce these exact
    // numbers from this exact frozen JSON, independent of whatever the live
    // write path does at that time. The internal 4-tier field names inside
    // this JSON are legacy shape and will be renamed by a later phase — this
    // test only asserts through resolveProjectView() (public API), so it
    // stays valid regardless.
    const fixturePath = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__', 'legacy-4tier-project.json')
    const legacyJson = readFileSync(fixturePath, 'utf-8')

    // Ids captured at fixture-generation time (frozen — do not regenerate
    // casually; if the fixture JSON is ever regenerated, these must be
    // updated to match the newly assigned nanoids).
    const ids = {
      plainId: 'VqSHfzrTqF',
      formatOnlyId: '-GI9Dnn22Q',
      baseDeltaOnlyId: '5OKvRKZ2b3',
      formatScopedOnlyId: 'jLQBvXScqW',
      allThreeId: 'uYydwfERLH',
      groupId: 'NXcdIOvm25',
      childId: 'Xf6UAm40Kd',
      childOriginalX: 0,
      panoLayerId: 'rn0_MgyAbu',
      // [B2] regenerated additions — multiplicative + scale + second group fixtures.
      multBaseDeltaId: 'ECxyq6cd4N',
      allThreeMultId: 'qrhXlk9MvH',
      phoneScaleId: 'o0K6I4LKz6',
      group2Id: 'f5DOR2KR-o',
      child2Id: '_3uf2J6fAb',
      child2OriginalX: 0,
    }

    let project: Project

    beforeAll(() => {
      resetStore()
      useEditorStore.getState().importProject(legacyJson)
      project = useEditorStore.getState().project
    })

    it('reproduces every golden literal value asserted above, for every (locale, format) combination', () => {
      const enBase = resolvedLayer(project, 'en', BASE_FORMAT, ids.plainId) as TextLayer
      const enAndroid = resolvedLayer(project, 'en', ANDROID_FORMAT, ids.plainId) as TextLayer
      const deBase = resolvedLayer(project, 'de', BASE_FORMAT, ids.plainId) as TextLayer
      const deAndroid = resolvedLayer(project, 'de', ANDROID_FORMAT, ids.plainId) as TextLayer
      expect(enBase.x).toBe(100)
      expect(enBase.y).toBe(200)
      expect(enBase.fontSize).toBe(100)
      expect(enAndroid.x).toBeCloseTo(540 + (100 - 660) * s)
      expect(enAndroid.y).toBeCloseTo(960 + (200 - 1434) * s)
      expect(enAndroid.width).toBeCloseTo(1000 * s)
      expect(enAndroid.fontSize).toBeCloseTo(100 * s)
      expect(deBase).toMatchObject({ x: enBase.x, y: enBase.y, fontSize: enBase.fontSize })
      expect(deAndroid).toMatchObject({ x: enAndroid.x, y: enAndroid.y, fontSize: enAndroid.fontSize })

      expect((resolvedLayer(project, 'en', BASE_FORMAT, ids.formatOnlyId) as TextLayer).x).toBe(100)
      expect((resolvedLayer(project, 'en', BASE_FORMAT, ids.formatOnlyId) as TextLayer).fontSize).toBe(100)
      expect((resolvedLayer(project, 'en', ANDROID_FORMAT, ids.formatOnlyId) as TextLayer).x).toBe(300)
      expect((resolvedLayer(project, 'en', ANDROID_FORMAT, ids.formatOnlyId) as TextLayer).fontSize).toBe(60)
      expect((resolvedLayer(project, 'de', BASE_FORMAT, ids.formatOnlyId) as TextLayer).x).toBe(100)
      expect((resolvedLayer(project, 'de', ANDROID_FORMAT, ids.formatOnlyId) as TextLayer).x).toBe(300)
      expect((resolvedLayer(project, 'de', ANDROID_FORMAT, ids.formatOnlyId) as TextLayer).fontSize).toBe(60)

      expect((resolvedLayer(project, 'en', BASE_FORMAT, ids.baseDeltaOnlyId) as TextLayer).x).toBe(100)
      expect((resolvedLayer(project, 'en', ANDROID_FORMAT, ids.baseDeltaOnlyId) as TextLayer).x)
        .toBeCloseTo(540 + (100 - 660) * s)
      expect((resolvedLayer(project, 'de', BASE_FORMAT, ids.baseDeltaOnlyId) as TextLayer).x).toBe(140)
      expect((resolvedLayer(project, 'de', ANDROID_FORMAT, ids.baseDeltaOnlyId) as TextLayer).x)
        .toBeCloseTo(540 + (100 - 660) * s + 40 * s)

      expect((resolvedLayer(project, 'en', BASE_FORMAT, ids.formatScopedOnlyId) as TextLayer).x).toBe(100)
      expect((resolvedLayer(project, 'en', ANDROID_FORMAT, ids.formatScopedOnlyId) as TextLayer).x)
        .toBeCloseTo(540 + (100 - 660) * s)
      expect((resolvedLayer(project, 'de', BASE_FORMAT, ids.formatScopedOnlyId) as TextLayer).x).toBe(100)
      expect((resolvedLayer(project, 'de', ANDROID_FORMAT, ids.formatScopedOnlyId) as TextLayer).x).toBe(777)

      const a3EnBase = resolvedLayer(project, 'en', BASE_FORMAT, ids.allThreeId) as TextLayer
      const a3EnAndroid = resolvedLayer(project, 'en', ANDROID_FORMAT, ids.allThreeId) as TextLayer
      const a3DeBase = resolvedLayer(project, 'de', BASE_FORMAT, ids.allThreeId) as TextLayer
      const a3DeAndroid = resolvedLayer(project, 'de', ANDROID_FORMAT, ids.allThreeId) as TextLayer
      expect(a3EnBase).toMatchObject({ x: 100, fontSize: 100, rotation: 0 })
      expect(a3EnAndroid).toMatchObject({ x: 500, fontSize: 50, rotation: 0 })
      expect(a3DeBase).toMatchObject({ x: 160, fontSize: 100, rotation: 15 })
      expect(a3DeAndroid).toMatchObject({ x: 900, fontSize: 50, rotation: 15 })

      const groupEnBase = resolvedLayer(project, 'en', BASE_FORMAT, ids.groupId) as GroupLayer
      const groupEnAndroid = resolvedLayer(project, 'en', ANDROID_FORMAT, ids.groupId) as GroupLayer
      const groupDeBase = resolvedLayer(project, 'de', BASE_FORMAT, ids.groupId) as GroupLayer
      const groupDeAndroid = resolvedLayer(project, 'de', ANDROID_FORMAT, ids.groupId) as GroupLayer
      const childEnBase = groupEnBase.children.find((c) => c.id === ids.childId)!
      const childEnAndroid = groupEnAndroid.children.find((c) => c.id === ids.childId)!
      const childDeBase = groupDeBase.children.find((c) => c.id === ids.childId)!
      const childDeAndroid = groupDeAndroid.children.find((c) => c.id === ids.childId)!
      expect(childEnBase.x).toBe(ids.childOriginalX)
      expect(childEnAndroid.x).toBeCloseTo(ids.childOriginalX * s)
      expect(childDeBase.x).toBe(ids.childOriginalX)
      expect(childDeAndroid.x).toBe(ids.childOriginalX + 30)

      expect((resolvedLayer(project, 'en', BASE_FORMAT, ids.panoLayerId) as TextLayer).x).toBe(1720)
      expect((resolvedLayer(project, 'en', ANDROID_FORMAT, ids.panoLayerId) as TextLayer).x)
        .toBeCloseTo(1080 + (1720 - 1320) * s)
      expect((resolvedLayer(project, 'de', BASE_FORMAT, ids.panoLayerId) as TextLayer).x).toBe(1770)
      expect((resolvedLayer(project, 'de', ANDROID_FORMAT, ids.panoLayerId) as TextLayer).x)
        .toBeCloseTo(1080 + (1720 - 1320) * s + 50 * s)

      // [B2] multiplicative fixtures — mirrors the live-corpus assertions above.
      const mdEnBase = resolvedLayer(project, 'en', BASE_FORMAT, ids.multBaseDeltaId) as TextLayer
      const mdEnAndroid = resolvedLayer(project, 'en', ANDROID_FORMAT, ids.multBaseDeltaId) as TextLayer
      const mdDeBase = resolvedLayer(project, 'de', BASE_FORMAT, ids.multBaseDeltaId) as TextLayer
      const mdDeAndroid = resolvedLayer(project, 'de', ANDROID_FORMAT, ids.multBaseDeltaId) as TextLayer
      expect(mdEnBase).toMatchObject({ y: 200, width: 1000, fontSize: 100 })
      expect(mdEnAndroid.y).toBeCloseTo(960 + (200 - 1434) * s)
      expect(mdEnAndroid.width).toBeCloseTo(1000 * s)
      expect(mdEnAndroid.fontSize).toBeCloseTo(100 * s)
      expect(mdDeBase).toMatchObject({ y: 250, width: 1500, fontSize: 150 })
      expect(mdDeAndroid.y).toBeCloseTo(960 + (200 - 1434) * s + 50 * s)
      expect(mdDeAndroid.width).toBeCloseTo(1000 * s * 1.5)
      expect(mdDeAndroid.fontSize).toBeCloseTo(100 * s * 1.5)

      expect((resolvedLayer(project, 'en', BASE_FORMAT, ids.allThreeMultId) as TextLayer).width).toBe(1000)
      expect((resolvedLayer(project, 'en', ANDROID_FORMAT, ids.allThreeMultId) as TextLayer).width).toBe(700)
      expect((resolvedLayer(project, 'de', BASE_FORMAT, ids.allThreeMultId) as TextLayer).width).toBe(2000)
      // See the [B2] fixture test above for why this is toBeCloseTo, not toBe
      // (float ULP from the delta model's divide-then-multiply round trip).
      expect((resolvedLayer(project, 'de', ANDROID_FORMAT, ids.allThreeMultId) as TextLayer).width).toBeCloseTo(1800)

      const phEnBase = resolvedLayer(project, 'en', BASE_FORMAT, ids.phoneScaleId) as PhoneLayer
      const phEnAndroid = resolvedLayer(project, 'en', ANDROID_FORMAT, ids.phoneScaleId) as PhoneLayer
      const phDeBase = resolvedLayer(project, 'de', BASE_FORMAT, ids.phoneScaleId) as PhoneLayer
      const phDeAndroid = resolvedLayer(project, 'de', ANDROID_FORMAT, ids.phoneScaleId) as PhoneLayer
      expect(phEnBase.scale).toBe(2.0)
      expect(phEnAndroid.scale).toBeCloseTo(2.0 * s * phoneSwapScale)
      expect(phDeBase.scale).toBeCloseTo(3.0)
      expect(phDeAndroid.scale).toBeCloseTo(2.0 * s * phoneSwapScale * 1.5)

      const group2EnBase = resolvedLayer(project, 'en', BASE_FORMAT, ids.group2Id) as GroupLayer
      const group2EnAndroid = resolvedLayer(project, 'en', ANDROID_FORMAT, ids.group2Id) as GroupLayer
      const group2DeBase = resolvedLayer(project, 'de', BASE_FORMAT, ids.group2Id) as GroupLayer
      const group2DeAndroid = resolvedLayer(project, 'de', ANDROID_FORMAT, ids.group2Id) as GroupLayer
      const child2EnBase = group2EnBase.children.find((c) => c.id === ids.child2Id)!
      const child2EnAndroid = group2EnAndroid.children.find((c) => c.id === ids.child2Id)!
      const child2DeBase = group2DeBase.children.find((c) => c.id === ids.child2Id)!
      const child2DeAndroid = group2DeAndroid.children.find((c) => c.id === ids.child2Id)!
      expect(child2EnBase.x).toBe(ids.child2OriginalX)
      expect(child2EnAndroid.x).toBeCloseTo(ids.child2OriginalX * s)
      expect(child2DeBase.x).toBe(ids.child2OriginalX + 20)
      expect(child2DeAndroid.x).toBeCloseTo((ids.child2OriginalX + 20) * s)
    })
  })

  // ───────────────────────────────────────────────────────────────────────
  // Part 2: per-authoring-context write/read mirror (cross-tier isolation)
  // Contexts (a) and (d) assert only invariant, never-changes behavior.
  // Contexts (b) and (c) also assert one value each (the stale-pin ->
  // composes-and-tracks flip, see the BEHAVIOR->INVARIANT note in the file
  // header) that was originally quarantined in a separate BEHAVIOR describe
  // pre-P3 and now lives here permanently, post-flip.
  // ───────────────────────────────────────────────────────────────────────
  describe('locale layout write isolation across the 4 authoring contexts', () => {
    beforeEach(() => {
      resetStore()
      useEditorStore.getState().addLocale('de') // side effect: also sets activeLocale to 'de'
      useEditorStore.getState().setActiveLocale('en')
      useEditorStore.getState().updateSettings({ activeFormats: [ANDROID_FORMAT] })
    })

    it('(a) default locale + base format: writing the shared base value only affects contexts that are not pinned by an absolute override', () => {
      const store = useEditorStore.getState()
      store.addText()
      const id = useEditorStore.getState().project.slideGroups[0].layers.at(-1)!.id

      // Pin (en, android) and (de, android) with absolute overrides on x, set up
      // BEFORE the case's write, from their own authoring contexts.
      store.setActiveCanvasFormat(ANDROID_FORMAT)
      store.updateLayer(id, { x: 500 })
      store.setActiveLocale('de')
      store.updateLayer(id, { x: 900 })
      store.setActiveLocale('en')
      store.setActiveCanvasFormat(BASE_FORMAT)

      const before = (locale: string, format: CanvasFormatId) =>
        (resolvedLayer(useEditorStore.getState().project, locale, format, id) as TextLayer).x
      const beforeEnAndroid = before('en', ANDROID_FORMAT)
      const beforeDeAndroid = before('de', ANDROID_FORMAT)
      const beforeDeBase = before('de', BASE_FORMAT) // no locale delta yet: mirrors shared base

      store.updateLayer(id, { x: 260 })

      const project = useEditorStore.getState().project
      expect((resolvedLayer(project, 'en', BASE_FORMAT, id) as TextLayer).x).toBe(260) // written context
      expect((resolvedLayer(project, 'en', ANDROID_FORMAT, id) as TextLayer).x).toBe(beforeEnAndroid) // pinned, unaffected
      // Load-bearing: this "(de, android) unaffected" classification depends on
      // the formatOverrides[android].x = 500 pin set up above still existing.
      // If that pin is ever removed from this test's setup, (de, android) would
      // no longer be an absolute cell and this assertion would need to move to
      // the BEHAVIOR describe instead (same stale-pin class as (b)/(c) below).
      expect((resolvedLayer(project, 'de', ANDROID_FORMAT, id) as TextLayer).x).toBe(beforeDeAndroid) // pinned, unaffected
      // (de, base) has no locale base delta on this layer, so by design it mirrors
      // the shared base value exactly — this is intentional cascading (the whole
      // point of the delta model), not a leak. It is NOT byte-identical to
      // `beforeDeBase` because the shared value it mirrors just changed.
      expect((resolvedLayer(project, 'de', BASE_FORMAT, id) as TextLayer).x).toBe(260)
      expect(beforeDeBase).toBe(100)
    })

    it('(b) default locale + non-base format: writing a formatOverride only affects that format for the default locale', () => {
      const store = useEditorStore.getState()
      store.addText()
      const id = useEditorStore.getState().project.slideGroups[0].layers.at(-1)!.id

      // Pin (de, android) with an absolute locale/format override up front.
      store.setActiveLocale('de')
      store.setActiveCanvasFormat(ANDROID_FORMAT)
      store.updateLayer(id, { x: 900 })
      store.setActiveLocale('en')

      const project0 = useEditorStore.getState().project
      const beforeEnBase = (resolvedLayer(project0, 'en', BASE_FORMAT, id) as TextLayer).x
      const beforeDeBase = (resolvedLayer(project0, 'de', BASE_FORMAT, id) as TextLayer).x

      store.updateLayer(id, { x: 500 })

      const project = useEditorStore.getState().project
      expect((resolvedLayer(project, 'en', ANDROID_FORMAT, id) as TextLayer).x).toBe(500) // written context
      expect((resolvedLayer(project, 'en', BASE_FORMAT, id) as TextLayer).x).toBe(beforeEnBase) // base never reads formatOverrides
      expect((resolvedLayer(project, 'de', BASE_FORMAT, id) as TextLayer).x).toBe(beforeDeBase) // base never reads formatOverrides
      // P3 (post-unification): unlike the legacy 4-tier model where an
      // already-pinned (de, android) absolute cell went stale (ignored later
      // formatOverrides[android] edits), the new localeAdjust tier is
      // DELTA-valued and TRACKS the format anchor — this is the fix this
      // rework exists to deliver, not a leak. Value derived from the model:
      // dx = 900 - R (R = the pre-write scaled base x at android, computed
      // from this test file's actual default project canvas, 1290x2796 —
      // NOT the 1320x2868 used by the Part 1 golden-master corpus above,
      // since this describe's beforeEach never resizes the slide group),
      // then re-anchored onto the new formatOverrides[android].x = 500.
      expect((resolvedLayer(project, 'de', ANDROID_FORMAT, id) as TextLayer).x).toBeCloseTo(1234.2489270386266)
    })

    it('(c) non-default locale + base format: writing a localeBaseDelta only affects that locale in base format', () => {
      const store = useEditorStore.getState()
      store.addText()
      const id = useEditorStore.getState().project.slideGroups[0].layers.at(-1)!.id

      // Pin (en, android) and (de, android) with absolute overrides up front.
      store.setActiveCanvasFormat(ANDROID_FORMAT)
      store.updateLayer(id, { x: 500 })
      store.setActiveLocale('de')
      store.updateLayer(id, { x: 900 })
      store.setActiveCanvasFormat(BASE_FORMAT)

      const project0 = useEditorStore.getState().project
      const beforeEnBase = (resolvedLayer(project0, 'en', BASE_FORMAT, id) as TextLayer).x
      const beforeEnAndroid = (resolvedLayer(project0, 'en', ANDROID_FORMAT, id) as TextLayer).x

      store.updateLayer(id, { x: 150 })

      const project = useEditorStore.getState().project
      expect((resolvedLayer(project, 'de', BASE_FORMAT, id) as TextLayer).x).toBe(150) // written context
      expect((resolvedLayer(project, 'en', BASE_FORMAT, id) as TextLayer).x).toBe(beforeEnBase) // default locale never reads localeBaseDelta
      expect((resolvedLayer(project, 'en', ANDROID_FORMAT, id) as TextLayer).x).toBe(beforeEnAndroid) // default locale, unaffected
      // P3 (post-unification): same tracking fix as case (b) above, from the
      // other write direction — a base-scoped localeAdjust delta (dx=50, from
      // the 100->150 edit) now composes on top of the already-pinned (de,
      // android) formatOverride anchor (500) scaled by this format's factor,
      // plus the existing format-scoped delta (dx=400, from the earlier
      // 500->900 edit at (de, android)): 500 + 50*s + 400.
      expect((resolvedLayer(project, 'de', ANDROID_FORMAT, id) as TextLayer).x).toBeCloseTo(934.3347639484979)
    })

    it('(d) non-default locale + non-base format: writing a localeLayoutOverride only affects that exact (locale, format) cell', () => {
      const store = useEditorStore.getState()
      store.addText()
      const id = useEditorStore.getState().project.slideGroups[0].layers.at(-1)!.id

      const project0 = useEditorStore.getState().project
      const beforeEnBase = (resolvedLayer(project0, 'en', BASE_FORMAT, id) as TextLayer).x
      const beforeEnAndroid = (resolvedLayer(project0, 'en', ANDROID_FORMAT, id) as TextLayer).x
      const beforeDeBase = (resolvedLayer(project0, 'de', BASE_FORMAT, id) as TextLayer).x

      store.setActiveLocale('de')
      store.setActiveCanvasFormat(ANDROID_FORMAT)
      store.updateLayer(id, { x: 777 })

      const project = useEditorStore.getState().project
      expect((resolvedLayer(project, 'de', ANDROID_FORMAT, id) as TextLayer).x).toBe(777) // written context
      expect((resolvedLayer(project, 'en', BASE_FORMAT, id) as TextLayer).x).toBe(beforeEnBase) // unaffected
      expect((resolvedLayer(project, 'en', ANDROID_FORMAT, id) as TextLayer).x).toBe(beforeEnAndroid) // unaffected
      expect((resolvedLayer(project, 'de', BASE_FORMAT, id) as TextLayer).x).toBe(beforeDeBase) // base never reads localeLayoutOverrides
    })
  })

  // ───────────────────────────────────────────────────────────────────────
  // [Recommended #2] The core intent-preservation guarantee this whole
  // rework exists to protect: a base-scoped delta must ride along when the
  // shared base value it's relative to is edited afterward, not get clobbered
  // or lost.
  // ───────────────────────────────────────────────────────────────────────
  describe('base-scoped delta intent preservation', () => {
    it('editing the shared base value after a locale base-delta already exists makes the delta ride along, not get clobbered', () => {
      resetStore()
      const store = useEditorStore.getState()
      store.addLocale('de')
      store.setActiveLocale('en')
      store.addSlideGroup()
      store.updateSlideGroup(activeGroup().id, { slideWidth: 1320, slideHeight: 2868 })
      store.addText()
      const id = lastLayerId()

      store.setActiveLocale('de')
      store.updateLayer(id, { x: 140 }) // dx = 40 (base x is 100)
      store.setActiveLocale('en')
      store.updateLayer(id, { x: 300 }) // edit the SHARED base value, default locale + base format

      const project = useEditorStore.getState().project
      expect((resolvedLayer(project, 'en', BASE_FORMAT, id) as TextLayer).x).toBe(300)
      // The delta rides along: new_base_value (300) + existing_delta (40) = 340,
      // NOT clobbered back to the old base+delta (140) and NOT lost (back to 300).
      expect((resolvedLayer(project, 'de', BASE_FORMAT, id) as TextLayer).x).toBe(340)
    })
  })
  })
})

// ─────────────────────────────────────────────────────────────────────────
// P1-gate tests (Oracle checklist, must pass before P1 is considered done):
// (a) the migration's dropped-key report (multiplicative R===0 + out-of-
//     fork-key cells), unit-tested directly since it can't be fixture-ized
//     cleanly through the public store API; (b) migrateProject idempotency
//     on the new localeAdjust conversion, matching the existing contract at
//     helpers.persistence.test.ts:281.
// ─────────────────────────────────────────────────────────────────────────
describe('P1: migrateProjectToLocaleAdjust dropped-key reporting', () => {
  function makeMinimalProject(layer: Layer): Project {
    return {
      id: 'p1',
      name: 'P1 gate project',
      createdAt: '2020-01-01T00:00:00.000Z',
      updatedAt: '2020-01-01T00:00:00.000Z',
      settings: {
        defaultSlideWidth: 1320,
        defaultSlideHeight: 2868,
        defaultLocale: 'en',
        brandName: 'App',
        baseCanvasFormat: BASE_FORMAT,
        activeFormats: [ANDROID_FORMAT],
        customFormats: [],
      },
      slideGroups: [{
        id: 'g1',
        name: 'Slide 1',
        numSlides: 1,
        slideWidth: 1320,
        slideHeight: 2868,
        slideNames: ['slide-01'],
        layers: [layer],
      }],
    }
  }

  // These P1-gate tests exercise migrateProjectToLocaleAdjust() directly with
  // hand-built RAW (pre-migration) legacy fixtures — the exact shape old
  // project files on disk still have. `localeLayoutOverrides`/`localeBaseDelta`
  // no longer exist on `BaseLayer`'s type (deleted in P4), so this helper's
  // param type intersects in `LegacyLocaleLayoutFields` (see
  // `store/helpers.ts`'s `getLegacyLocaleLayoutFields`) to accept them without
  // a blanket `any` cast — mirrors exactly how the migration itself reads them.
  function makeTextLayer(overrides: Partial<TextLayer> & LegacyLocaleLayoutFields): TextLayer {
    return {
      id: 'text1',
      name: 'Text',
      type: 'text',
      x: 100, y: 200, rotation: 0, opacity: 1, visible: true, locked: false,
      text: 'Hello',
      fontFamily: 'Inter',
      fontSize: 100,
      fontWeight: 400,
      fill: '#ffffff',
      width: 1000,
      ...overrides,
    } as TextLayer
  }

  it('drops (and counts) a multiplicative key whose R resolves to 0', () => {
    // Base width is 0 -> R for width at (de, android) resolves to 0 -> the
    // multiplicative ratio is inexpressible -> dropped, not NaN/Infinity.
    const layer = makeTextLayer({
      width: 0,
      localeLayoutOverrides: { de: { [ANDROID_FORMAT]: { width: 500 } as Partial<TextLayer> } },
    })
    const project = makeMinimalProject(layer)

    const { project: migrated, dropped } = migrateProjectToLocaleAdjust(project)

    expect(dropped).toBe(1)
    const migratedLayer = migrated.slideGroups[0].layers[0]
    expect(migratedLayer.localeAdjust?.de?.[ANDROID_FORMAT]?.mWidth).toBeUndefined()
  })

  it('drops (and counts) an out-of-fork-key cell', () => {
    // FormatLayerPatch is permissive; a legacy cell could in principle carry
    // a non-layout key. The migration must drop + count it, not crash.
    const layer = makeTextLayer({
      localeLayoutOverrides: {
        de: { [ANDROID_FORMAT]: { text: 'Bonjour' } as Partial<TextLayer> },
      },
    })
    const project = makeMinimalProject(layer)

    const { project: migrated, dropped } = migrateProjectToLocaleAdjust(project)

    expect(dropped).toBe(1)
    const migratedLayer = migrated.slideGroups[0].layers[0]
    expect(migratedLayer.localeAdjust?.de?.[ANDROID_FORMAT]).toBeUndefined()
  })

  it('drops (and counts) a dead cell at the base format (no writer ever produces one)', () => {
    // 2-key fixture: exercises that the dead-base-cell branch counts KEYS,
    // not cells (a 1-key fixture can't distinguish `dropped++` from
    // `dropped += Object.keys(patch).length`).
    const layer = makeTextLayer({
      localeLayoutOverrides: { de: { [BASE_FORMAT]: { x: 999, y: 888 } } },
    })
    const project = makeMinimalProject(layer)

    const { project: migrated, dropped } = migrateProjectToLocaleAdjust(project)

    expect(dropped).toBe(2)
    const migratedLayer = migrated.slideGroups[0].layers[0]
    expect(migratedLayer.localeAdjust?.de?.[BASE_FORMAT]).toBeUndefined()
  })

  it('does not count a successfully-converted key as dropped', () => {
    const layer = makeTextLayer({
      localeLayoutOverrides: { de: { [ANDROID_FORMAT]: { x: 900 } } },
    })
    const project = makeMinimalProject(layer)

    const { project: migrated, dropped } = migrateProjectToLocaleAdjust(project)

    expect(dropped).toBe(0)
    const migratedLayer = migrated.slideGroups[0].layers[0]
    expect(migratedLayer.localeAdjust?.de?.[ANDROID_FORMAT]?.dx).toBeDefined()
  })
})

describe('P1: migrateProject idempotency on the localeAdjust conversion', () => {
  it('is idempotent when migrateProject runs twice', () => {
    resetStore()
    const store = useEditorStore.getState()
    store.addLocale('de')
    store.setActiveLocale('en')
    store.updateSettings({ activeFormats: [ANDROID_FORMAT] })
    store.addText()
    const id = useEditorStore.getState().project.slideGroups[0].layers.at(-1)!.id
    store.setActiveCanvasFormat(ANDROID_FORMAT)
    store.updateLayer(id, { x: 500 })
    store.setActiveLocale('de')
    store.updateLayer(id, { x: 900 })
    store.setActiveCanvasFormat(BASE_FORMAT)
    store.updateLayer(id, { x: 150 })
    store.setActiveLocale('en')

    const raw = JSON.parse(useEditorStore.getState().exportProject()) as Project
    const migrated = migrateProject(raw)
    const firstResult = structuredClone(migrated)

    const migratedAgain = migrateProject(migrated)

    expect(migratedAgain).toEqual(firstResult)
  })
})

// The former "BEHAVIOR — intentionally expected to change once the
// unification ships (P2/P3)" describe block lived here. Its 2 stale-pin
// assertions ((b) and (c)) were the exact 2 cases licensed to flip once
// `resolveProjectView` moved to the new `localeAdjust` read path (P3) — that
// flip has now happened, the new composing values are permanent expected
// behavior going forward, and both assertions were folded back into their
// sibling (b)/(c) cases in the "locale layout write isolation" describe
// above (replacing the "NOTE: moved to BEHAVIOR describe" placeholder
// comments that were left there for exactly this purpose).
