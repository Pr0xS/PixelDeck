# PixelDeck Architecture

## Overview

PixelDeck is a single-page React application that serves two runtime modes:

1. **Editor mode**: interactive GUI for designing App Store screenshot layouts
2. **Headless export mode**: triggered by the CLI; renders slides and captures PNGs without user interaction

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (Vite SPA)                   │
│                                                          │
│  ┌──────────┐  ┌────────────────────┐  ┌─────────────┐  │
│  │ Layers   │  │   Konva Canvas     │  │ Properties  │  │
│  │ Panel    │  │   (StageCanvas)    │  │ Panel       │  │
│  └──────────┘  └────────────────────┘  └─────────────┘  │
│        ↕                  ↕                   ↕          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │          Zustand Stores (index.ts, projects.ts)     │ │
│  │  project · slideGroups · layers · selection · undo  │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                   CLI (Node.js / ESM)                    │
│                                                          │
│  cli/index.mjs  →  cli/export.mjs                        │
│       │                  │                               │
│       │         ┌────────▼──────────┐                   │
│       │         │  Static server    │                    │
│       │         │  (serves dist/)   │                    │
│       │         └────────┬──────────┘                   │
│       │                  │  injects window.__EXPORT_CONFIG__
│       │         ┌────────▼──────────┐                   │
│       │         │  Playwright page  │                    │
│       │         │  → ExportApp.tsx  │                    │
│       │         │  → stage.toDataURL│                    │
│       │         └────────┬──────────┘                   │
│       └─────────→  PNG files to disk                     │
└──────────────────────────────────────────────────────────┘
```

---

## Data Model

All types are defined in `src/types/index.ts`.

### Project hierarchy

```
Project
└── slideGroups: SlideGroup[]
    └── layers: Layer[]
        ├── BackgroundLayer     (always layers[0], locked)
        ├── PhoneLayer
        ├── TextLayer
        ├── ImageLayer
        ├── ShapeLayer
        ├── ChipsLayer
        ├── BrandLayer
        └── GroupLayer (recursive; children: Layer[])
```

### Key types

| Type | Description |
|---|---|
| `Project` | Root document. Contains settings + array of `SlideGroup`. |
| `SlideGroup` | One canvas shared across 1-N adjacent output slides. Width = `slideWidth × numSlides`. |
| `Layer` | Union of all layer variant types. Discriminated by `type` field. |
| `BaseLayer` | Shared fields: `id`, `name`, `x`, `y`, `rotation`, `opacity`, `visible`, `locked`, `blur`, `shadow`. |
| `BackgroundLayer` | Always `layers[0]`. Holds the slide's `fill` (solid/gradient). Cannot be moved or deleted. |
| `TextLayer` | Text with optional `marks: TextMark[]` for rich per-range styling. |
| `TextMark` | `{ start, end, fill?, fontWeight?, italic?, underline?, strikethrough? }`; styled range over `text` (char offsets, end exclusive). |
| `FillValue` | `string` (hex/CSS color) \| `LinearGradient` \| `RadialGradient` |
| `PhoneModelSpec` | Physical dimensions + screen rect for a device frame (in SVG canvas coordinates). |

### SlideGroup canvas model

A `SlideGroup` with `numSlides: 2` and `slideWidth: 1290` renders on a **2580 px wide canvas**. The CLI crops this into two 1290 px PNGs named by `slideNames[0]` and `slideNames[1]`. This enables the "pano" effect where a phone layer sits at `x ≈ slideWidth - overlap` crossing the seam.

---

## State Management

### Editor store

**Files:** `src/store/index.ts` (assembly + persistence), `src/store/types.ts` (EditorStore interface), `src/store/helpers.ts` (pure helpers/factories), `src/store/slices/*.ts` (domain slices: selection, locale, format, slideGroup, layer, group, clipboard, project)

Uses **Zustand 5** with **zundo** for temporal undo/redo. `index.ts` composes the slices inside the `temporal()` wrapper; each slice owns one domain of actions.

```ts
{
  project: Project,
  activeSlideGroupId: string,
  selection: Selection,         // { slideGroupId, layerId | null }
  editingGroupId: string | null,

  // Actions
  addSlideGroup, removeSlideGroup, updateSlideGroup,
  addLayer, removeLayer, updateLayer, moveLayer,
  setSelection, selectSlideGroup,
  importProject, exportProject, resetProject,
  setProjectName,
  undo, redo,
}
```

### Projects store

**File:** `src/store/projects.ts`

Separate Zustand store (not part of undo history) that manages the project list with **localStorage persistence**.

```
Storage keys:
  pd:project-list     → JSON array of ProjectMeta (id, name, timestamps)
  pd:project:{id}     → full serialized Project JSON
  pd:active-project   → ID of last open project
```

Key behaviors:
- **Auto-save**: subscribes to the editor store and debounces saves (1.5 s after last change)
- **Auto-init**: loads the last active project on app startup
- **createProject**: saves current first, then resets editor to a blank project
- **deleteProject**: falls back to another project or creates a blank one

### Asset store

**File:** `src/store/assets.ts`

Separate Zustand store (not tracked by undo) holding `Map<filename, dataURL>` for imported screenshots. Phone layers reference assets by `screenshotPath` (filename key), falling back to inline `screenshotDataUrl` for backwards compatibility.

---

## Canvas Rendering

### Component hierarchy

```
StageCanvas (src/components/canvas/StageCanvas.tsx)
  └── Konva.Stage
      └── Konva.Layer
          ├── BackgroundNode  (always first; src/components/canvas/BackgroundNode.tsx)
          ├── LayerNode × N   (src/components/canvas/LayerNode.tsx)
          │   ├── PhoneNode      → SVG frame + clipped screenshot image
          │   ├── TextNode       → rich spans renderer + gradient fill support
          │   ├── ImageNode      → Konva.Image with corner radius
          │   ├── ShapeNode      → Konva.Rect / Konva.Ellipse / Konva.Line
          │   ├── ChipsNode      → Konva.Group with chip rectangles + labels
          │   ├── BrandNode      → logo + app name lockup
          │   └── GroupNode      → recursive LayerNode children
          └── Transformer        → selection handles (resize/rotate)
```

### Coordinate system

- Canvas origin (0, 0) = top-left corner of the slide group canvas
- Layer `x`, `y` = absolute position in canvas pixels
- For a 2-slide pano, slide 2 content starts at `x = slideWidth`
- Zoom is handled by Konva `Stage.scale`, not by transforming layer coordinates

### Gradient rendering

`src/utils/gradients.ts` converts `FillValue` to:
- **Konva fill props** (`fillLinearGradientColorStops`, etc.) for canvas nodes
- **CSS `background`** value for HTML overlays
- **Canvas `CanvasGradient`** for raw 2D context operations (export path, text rendering)

---

## Layer System

### Layer types

| Type | Component | Key props |
|---|---|---|
| `background` | `BackgroundNode` | `fill` (FillValue); always `layers[0]`, locked |
| `phone` | `PhoneNode` | `model`, `scale`, `screenshotPath`, `screenshotFit`, offsets |
| `text` | `TextNode` | `text`, `marks[]`, `fontFamily`, `fontSize`, `fill` (FillValue), `align`, `width` |
| `image` | `ImageNode` | `src` (data URI), `width`, `height`, `cornerRadius` |
| `shape` | `ShapeNode` | `shapeType` (rect/ellipse/line), `fill`, `stroke`, `cornerRadius` |
| `chips` | `ChipsNode` | `items[]` with `label`+`primary`, gradient config, `direction` |
| `brand` | `BrandNode` | `appName`, `logoDataUrl`, sizes, colors, `direction` |
| `group` | `GroupNode` | `children: Layer[]` |

### Rich text (TextMark)

`TextLayer` supports an optional `marks: TextMark[]` array for mixed-style text within a single layer. Each mark is a range over the layer's `text` string (start/end char offsets, end exclusive — same semantics as `String.slice`). When marks are present, the text is rendered off-screen using `renderSpansToCanvas()` (`src/utils/textRendering.ts`) and composited onto the Konva stage as an image pattern.

Each `TextMark` can override:
- `fill`: any `FillValue` (solid color or gradient)
- `fontWeight`: e.g. `700` for bold within a sentence
- `italic`: boolean
- `underline`: boolean
- `strikethrough`: boolean

If `marks` is empty or absent, `TextNode` falls back to standard Konva text rendering.

> **Legacy:** `spans: TextSpan[]` (segment-based, each span carries its own `text` string) is still read for backwards compatibility with old project files and is automatically migrated to `marks` on import. Do not write `spans` in new code.

### Adding a new layer type

1. Add the type literal to `LayerType` union in `src/types/index.ts`
2. Define the interface extending `BaseLayer`
3. Add to the `Layer` union type
4. Add a factory function in `src/store/index.ts`
5. Create `src/components/canvas/MyTypeNode.tsx`
6. Add a `case 'mytype'` branch in `LayerNode.tsx`
7. Add a properties panel section in `PropertiesPanel.tsx`
8. Add an "Add layer" action in `Toolbar.tsx`

---

## Export Pipeline

### Browser export

**File:** `src/utils/export.ts`

1. `StageCanvas` exposes the Konva `Stage` ref
2. For each slide in a group: `stage.toDataURL({ x, y, width, height })` crops to the slide region
3. Returns a blob URL → triggered as `<a download>` click

### CLI headless export

**Files:** `cli/index.mjs`, `cli/export.mjs`

```
1. Parse args (or YAML batch config)
2. For each job:
   a. Start a local static file server serving dist/
   b. Load project JSON + resolve screenshot file paths → data URLs
   c. Open Playwright page, inject window.__EXPORT_CONFIG__ = { project, assets }
   d. Navigate to http://localhost:<port>/?export=1
   e. main.tsx detects window.__EXPORT_CONFIG__ → mounts ExportApp instead of App
   f. ExportApp renders all slide groups on hidden Konva stages
   g. Calls captureSlide() for each slide → stage.toDataURL() → base64 PNG
   h. CLI receives PNG data via page.evaluate() / CDP
   i. Writes files to --output directory
```

### ExportApp.tsx

Hidden full-canvas renderer for CLI use. Mounts all slide groups simultaneously (not just the active one), waits for all assets to load, then signals readiness. The CLI polls for a `window.__EXPORT_DONE__` flag or listens to a custom event.

---

## Component Architecture

### Editor layout (App.tsx)

```
App
├── Toolbar          (top bar: add layers, import, export, projects, save/load)
├── LayersPanel      (left: layer list with dnd-kit sortable, visibility, lock)
├── StageCanvas      (center: Konva canvas with zoom, grid, seam guides)
├── PropertiesPanel  (right: layer/project inspector)
└── SlideNavigator   (bottom: slide group tabs with add/delete/rename)

[modal overlay]
└── ProjectsModal    (triggered from Toolbar: list/create/delete projects)
```

### Shared property controls

**File:** `src/components/properties/PropertyControls.tsx`

All fill/gradient editing uses a single shared component set: `FillControl`, `GradientEditor`, `ColorField`, `SliderField`. This ensures consistent behavior across background, shape, text, and brand layer fill editors in `PropertiesPanel.tsx`.

### Panel communication

All panels read from and write to the Zustand store directly; no prop drilling. The store is the single source of truth.

---

## Utility Modules

| File | Purpose |
|---|---|
| `src/utils/export.ts` | Browser PNG export; crops Konva stage per slide |
| `src/utils/gradients.ts` | `FillValue` → Konva fill props / CSS / `CanvasGradient` |
| `src/utils/files.ts` | File → data URL helpers for imports |
| `src/utils/fonts.ts` | `FONT_LIST` registry (80+ Google Fonts) + `loadGoogleFonts()` |
| `src/utils/textRendering.ts` | `renderSpansToCanvas()`: off-screen canvas for rich text spans |

---

## Conventions

- **Path alias:** `@/` maps to `src/` (configured in `vite.config.ts` and `tsconfig.app.json`)
- **Component naming:** PascalCase files matching the component name
- **Store actions:** camelCase verbs: `addLayer`, `updateLayer`, `removeLayer`
- **Layer IDs:** `nanoid()` (short random strings)
- **FillValue:** always check `typeof fill === 'string'` before treating as gradient
- **Asset references:** prefer `screenshotPath` (store key) over inline `screenshotDataUrl`
- **ESM only:** `package.json` has `"type": "module"`; CLI files use `.mjs` extension
- **No CSS modules:** Global Tailwind v4 + `src/index.css` theme vars only

---

## Device Mockups

**Files:** `src/assets/mockups/`

- `specs.ts`: exports `PHONE_SPECS: Record<PhoneModel, PhoneModelSpec>` with frame dimensions and screen rect
- `iphone-16-pro.ts`, `pixel-9.ts`: export the SVG string as a named constant
- `PhoneNode` uses `PHONE_SPECS` to position and clip the screenshot inside the frame
- To add a new device: add a spec entry, add an SVG file, add the model to the `PhoneModel` union type

---

## Group System

Groups use PowerPoint-style editing:

1. **Single click on a group**: selects the group as a whole (moves/resizes all children)
2. **Double-click (or Enter)**: enters group edit mode; individual children become selectable/draggable
3. **Click outside / Escape**: exits group edit mode
4. **Ctrl/Cmd+G**: groups selected layers; **Ctrl/Cmd+Shift+G**: ungroups

In group edit mode `selection.layerId` is the child layer's id (not the group id). The group id is tracked via `editingGroupId` in the store. Children of non-edit-mode groups are never draggable independently.
