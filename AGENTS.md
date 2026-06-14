# AGENTS.md: AI Navigation Guide

> This file is for AI coding agents. It maps the codebase so you can navigate, modify, and extend it without needing to read everything first.

## What This Codebase Does

PixelDeck is a React + TypeScript visual editor for designing App Store screenshot layouts. It has two runtime modes: an interactive GUI editor (Vite SPA), and a headless CLI export path (Playwright). Designs are stored as JSON `Project` documents and exported as PNGs.

---

## Canonical File Locations

| Task | File(s) |
|---|---|
| Domain types | `src/types/index.ts` (read this first) |
| State + actions | `src/store/index.ts` (assembly), `src/store/slices/*.ts` (domain actions), `src/store/helpers.ts` |
| Asset store | `src/store/assets.ts` |
| App entry / mode routing | `src/main.tsx` |
| Editor shell | `src/App.tsx` |
| Konva canvas | `src/components/canvas/StageCanvas.tsx` |
| Layer type router | `src/components/canvas/LayerNode.tsx` |
| Layer renderers | `src/components/canvas/*Node.tsx` |
| Properties inspector | `src/components/panels/PropertiesPanel.tsx` |
| Layer list panel | `src/components/panels/LayersPanel.tsx` |
| Slide navigator | `src/components/panels/SlideNavigator.tsx` |
| Settings modal | `src/components/panels/SettingsModal.tsx` |
| Export modal | `src/components/panels/ExportModal.tsx` |
| Projects modal | `src/components/panels/ProjectsModal.tsx` |
| Brand kit button | `src/components/toolbar/BrandKitButton.tsx` |
| Pano geometry | `src/utils/panoGeometry.ts` |
| Multi-format export | `src/utils/multiFormatExport.ts` |
| Stage capture mutex | `src/utils/stageCapture.ts` |
| Canvas formats | `src/utils/canvasFormats.ts` |
| Brand color utils | `src/utils/brandColors.ts` |
| Locale utils | `src/utils/locale.ts` |
| Top toolbar | `src/components/toolbar/Toolbar.tsx` |
| Browser PNG export | `src/utils/export.ts` |
| Gradient conversion | `src/utils/gradients.ts` |
| File/image utilities | `src/utils/files.ts` |
| Headless CLI entry | `cli/index.mjs` |
| Playwright export runner | `cli/export.mjs` |
| Headless render page | `src/pages/ExportApp.tsx` |
| Device specs | `src/assets/mockups/specs.ts` |
| Device SVGs | `src/assets/mockups/iphone-16-pro.ts`, `pixel-9.ts` |

---

## Data Model (Quick Reference)

```
Project { id, name, settings, slideGroups: SlideGroup[] }
  SlideGroup { id, name, numSlides, slideWidth, slideHeight, background, layers: Layer[], slideNames[] }
    Layer = BackgroundLayer | PhoneLayer | TextLayer | ImageLayer | ShapeLayer | ChipsLayer | BrandLayer | GroupLayer
    
    All layers extend BaseLayer: { id, name, type, x, y, rotation, opacity, visible, locked, blur?, shadow? }
    
FillValue = string | LinearGradient | RadialGradient
PanoSettings { gapPx: number; compensate: boolean }
ProjectSettings { defaultSlideWidth, defaultSlideHeight, defaultLocale, locales?, brandName, brandColors?, pano?: PanoSettings, ... }
```

Full types: `src/types/index.ts`

---

## How to Add a New Layer Type

1. **`src/types/index.ts`**
   - Add `'mytype'` to `LayerType` union
   - Define `interface MyTypeLayer extends BaseLayer { type: 'mytype'; ... }`
   - Add `| MyTypeLayer` to the `Layer` union

2. **`src/store/slices/layerSlice.ts`**
   - Add an `addMyType` factory action (see `addPhone` / `addText` for the pattern)
   - Declare it in the `EditorStore` interface in `src/store/types.ts`

3. **`src/components/canvas/MyTypeNode.tsx`** (new file)
   - Receive `layer: MyTypeLayer` as prop
   - Return a `react-konva` component tree

4. **`src/components/canvas/LayerNode.tsx`**
   - Add `case 'mytype': return <MyTypeNode layer={layer as MyTypeLayer} />`

5. **`src/components/properties/MyTypeProperties.tsx`** (new file)
   - Per-type property editor (see `ShapeProperties.tsx` for the pattern)
   - Register it in the type switch in `src/components/panels/PropertiesPanel.tsx`

6. **`src/components/toolbar/Toolbar.tsx`**
   - Add an "Add MyType" button that dispatches the factory + `addLayer`

---

## State Store API (Key Actions)

```ts
// Read
const project = useEditorStore(s => s.project)
const slideGroups = useEditorStore(s => s.project.slideGroups)
const selection = useEditorStore(s => s.selection)

// Write — layer actions operate on the ACTIVE slide group implicitly
addLayer(layer: Layer): void
updateLayer(layerId: string, patch: Partial<Layer>): void
removeLayer(layerId: string): void
duplicateLayer(layerId: string): void
moveLayerUp(layerId: string): void
moveLayerDown(layerId: string): void
reorderLayers(layerIds: string[]): void

addSlideGroup(): void                 // appends a new default group
updateSlideGroup(id: string, patch: Partial<SlideGroup>): void
removeSlideGroup(id: string): void
setActiveSlideGroup(id: string): void

select(layerId: string | null): void
deselect(): void
undo(): void                          // via useUndoRedo() hook
redo(): void
importProject(json: string): void     // takes a JSON string
exportProject(): string               // returns a JSON string

// Pano settings
updatePanoSettings(patch: Partial<PanoSettings>): void
setPanoRenderOverride(override: { gapPx: number; compensate: boolean } | null): void
```

Asset store (`src/store/assets.ts`) — persisted to IndexedDB, NOT undoable:
```ts
addAsset(filename: string, dataUrl: string): void
getAsset(filename: string): string | undefined
removeAsset(filename: string): void
clearAssets(): void
listAssets(): AssetEntry[]
```

---

## Conventions

| Convention | Rule |
|---|---|
| Path alias | `@/` → `src/` |
| Component files | PascalCase, one component per file |
| Layer IDs | `nanoid()` |
| Store actions | camelCase verbs (`addLayer`, `updateLayer`) |
| FillValue guard | Always `typeof fill === 'string'` before gradient branch |
| Asset references | Use `screenshotPath` (store key) over inline `screenshotDataUrl` |
| ESM | `package.json` `"type": "module"`; CLI files use `.mjs` |
| No CSS modules | Global Tailwind + `src/index.css` theme vars only |

---

## Runtime Mode Detection

`src/main.tsx` checks `window.__EXPORT_CONFIG__`:
- **Defined** → mounts `<ExportApp />` (headless export, CLI path)
- **Undefined** → mounts `<App />` (interactive editor)

CLI (`cli/export.mjs`) injects `window.__EXPORT_CONFIG__` before page navigation via Playwright's `page.addInitScript()`.

---

## Non-Obvious Behaviors

- **Pano canvas width**: A `SlideGroup` with `numSlides: 2` has an effective canvas width of `slideWidth × 2`. Layers in "slide 2" space have `x > slideWidth`.
- **Gradient text in Konva**: Konva doesn't natively support gradient text. `TextNode` uses an offscreen canvas pattern trick to render gradient fills on text.
- **Asset store is not undoable**: `assets.ts` is a separate Zustand store not wrapped by zundo. Asset imports don't appear in undo history.
- **Phone SVGs are TypeScript files**: Device frames are embedded as exported string constants (not `.svg` files) so they can be imported at runtime without fetch.
- **Export DPI**: `stage.toDataURL({ pixelRatio: 1 })` exports at the canvas's logical pixel size. The CLI does not upscale; match `slideWidth`/`slideHeight` to your target App Store resolution.
- **Seam guides**: `StageCanvas` renders dashed vertical lines at `x = slideWidth × i` for pano groups. These are visual-only and not included in exports.
- **`screenshotFit: 'cover'`**: The phone screenshot is clipped to the screen rect. Cover mode crops center; contain mode letterboxes.
- **Pano gap only applies when compensation is active**: `pano.gapPx` becomes visible in the canvas/preview only when `pano.compensate` is true. When `compensate` is false, pano geometry is continuous and export does not skip gap pixels.
- **Capture mutex**: `stageCapture.ts` exports `acquireCaptureLock()` / `runExclusiveCapture()` — a FIFO mutex that prevents concurrent stage mutations during thumbnail generation, preview, and export. Always use it when mutating store state and then capturing the stage.
- **Multi-format export**: `multiFormatExport.ts:exportProjectImages()` handles the full export pipeline: iterates locales × formats × groups, applies `applyLocale()` + `applyCanvasFormat()`, waits for stage settle, captures, and restores state. Use this instead of calling `exportSlide` directly.
- **Brand color tokens**: Colors can be stored as `brand:id` tokens (e.g. `brand:abc123`). Use `resolveBrandColor(value, brandColors)` from `src/utils/brandColors.ts` before passing to Konva. Never pass raw tokens to Konva.
- **Canvas formats**: `activeCanvasFormat` controls which format is being previewed/edited. `applyCanvasFormat(project, formatId)` returns a project with format overrides merged. The base format is not exported — only formats in `project.settings.activeFormats` are.
- **Localization**: `applyLocale(project, locale)` merges `localeOverrides` into layers. The base locale is `project.settings.defaultLocale`. `activeLocale` in the store controls the current preview locale.

---

## ⚠️ DO NOT SIMPLIFY: Hard-Won Decisions

- **Konva transformer rotation pivot**: Layers rotate around their visual bounding-box center via `offsetX`/`offsetY` in `GroupNode` and all transform handlers. Do NOT remove the `offsetX`/`offsetY` logic to “simplify” it. It was a deliberate fix for rotation jumping.
- **Asset store intentionally not undoable**: `src/store/assets.ts` is a separate Zustand store NOT wrapped by zundo. This is intentional: asset imports are file-system side effects and do not belong in undo history. Do not “fix” undo gaps by wrapping assets in temporal.
- **Phone SVGs as TypeScript constants**: Device frames are `.ts` files exporting SVG strings, not `.svg` files. This is intentional so they can be imported at build time without a fetch. Do not convert them to `.svg` imports.
- **Gradient text via offscreen canvas**: Konva does not natively support gradient text fills. `TextNode.tsx` uses an offscreen canvas to create a pattern. Do not replace it with a “simpler” approach without verifying gradient text still works.
- **`screenshotFit` cover/contain/fill math**: The clip rect calculation in `PhoneNode.tsx` handles aspect ratio correctly for all three modes. Do not refactor the geometry unless you are explicitly fixing and verifying that behavior.
- **Pano gap gated on compensate**: `StageCanvas.tsx` uses `effectiveCompensationPx = group && panoCompensate ? panoCompensationPx : 0` — the gap is applied to canvas geometry only while compensation is active. Do NOT make the gap always visible unless the product decision changes again.
- **Capture mutex is mandatory**: Any code that mutates `activeSlideGroupId`, `activeCanvasFormat`, `activeLocale`, or `panoRenderOverride` and then captures the stage MUST use `acquireCaptureLock()` from `stageCapture.ts`. Removing it causes race conditions between thumbnail generation and export.

---

## Common Tasks

### Change a layer's property
```ts
useEditorStore.getState().updateLayer(layerId, { fontSize: 24 })
```

### Access the current slide group
```ts
const { project, selection } = useStore.getState()
const group = project.slideGroups.find(g => g.id === selection.slideGroupId)
```

### Add a new device mockup
1. Add SVG string export to `src/assets/mockups/my-device.ts`
2. Add `PhoneModelSpec` entry to `PHONE_SPECS` in `src/assets/mockups/specs.ts`
3. Add `'my-device'` to `PhoneModel` union in `src/types/index.ts`

### Trigger a CLI export programmatically
See `cli/export.mjs`: `exportJob(jobConfig)` is the main entry. It returns a promise that resolves when all PNGs are written.

---

## Verification Contract

Every change, human or AI, must pass this gate before PR. Run and paste output in your PR description:

```bash
npm run lint       # zero warnings or errors
npm run typecheck  # zero type errors
npm run build      # must succeed, output to dist/
npm test           # all tests must pass
```

If any command fails, fix it before opening the PR. Do not open a PR with "it mostly works."

---

## Build & Dev Commands

```bash
npm run dev       # Vite dev server → http://localhost:5173
npm run build     # TypeScript + Vite build → dist/
npm run lint      # ESLint
npm run preview   # Serve dist/ locally
node cli/index.mjs --help          # CLI help
```

> CLI export requires `dist/` to exist. Always `npm run build` before using the CLI.
