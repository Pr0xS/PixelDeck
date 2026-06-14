# PixelDeck — Help Guide

PixelDeck is a visual editor for designing App Store screenshot layouts. Build multi-slide screenshot sets, add device mockups, text, shapes, and images — then export as PNG or share as a project file.

---

## Getting Started

### Projects
- **New project**: Click the project name in the top-left to open the Projects panel. Create a new project or switch between existing ones.
- **Import project**: Click **Import Project** (top-right) to load a `.json` project file.
- **Export project**: Click **Export Project** (top-right) to download your project as a `.json` file you can share or back up.

### Slides & Slide Groups
- A **Slide Group** is a set of slides that share the same layers and dimensions (e.g. "iPhone 6.7" screenshots).
- Use the **Slide Navigator** at the bottom to switch between slides and slide groups.
- Each slide group can have multiple slides — useful for panoramic layouts where layers span across slides.

### Canvas
- **Zoom**: Use the zoom controls in the bottom-left of the canvas, or scroll with the mouse wheel.
- **Pan**: Hold **Space** and drag to pan the canvas.
- **Fit to view**: Press **Ctrl+0** (or **Cmd+0** on Mac) to fit the canvas to the window.
- **100% zoom**: Press **Ctrl+1** (or **Cmd+1** on Mac).

---

## Layers

### Adding Layers
Use the toolbar buttons to add layers:
- **Phone** — Device mockup frame with a screenshot slot
- **Text** — Text block with rich formatting
- **Image** — Import an image file
- **Shape** — Rectangle, ellipse, or other shapes
- **Chips** — Tag/chip label elements
- **Brand** — Brand kit elements

### Selecting Layers
- Click a layer on the canvas or in the **Layers Panel** (left sidebar) to select it.
- Hold **Shift** and click to select multiple layers.
- Click an empty area on the canvas to deselect.

### Moving & Resizing
- Drag a selected layer to move it.
- Drag the handles around a selected layer to resize it.
- Use **Arrow Keys** to nudge a layer by 1px. Hold **Shift** for 10px nudges.

### Layer Order
- Drag layers up or down in the **Layers Panel** to change their stacking order.

### Groups
- Select 2 or more layers and press **Ctrl+G** (or **Cmd+G**) to group them.
- Click into a group to edit individual layers inside it.
- Press **Escape** to exit group editing mode.
- Press **Ctrl+Shift+G** (or **Cmd+Shift+G**) to dissolve a group back into individual layers.

---

## Properties Panel

The **Properties Panel** (right sidebar) shows options for the selected layer:

- **Position & Size** — X, Y, width, height, rotation
- **Opacity & Visibility** — Toggle layer visibility, adjust opacity
- **Fill** — Solid color or gradient fill
- **Shadow & Blur** — Drop shadow and blur effects
- **Text** (text layers) — Font, size, weight, alignment, color, rich formatting
- **Phone** (phone layers) — Device model, screenshot image, fit mode (cover/contain/fill)

---

## Exporting

### Export as PNG
Click the **Export PNG** button in the canvas area to export the current slide group as a PNG image.

### Export Project
Click **Export Project** in the top-right toolbar to save your entire project (all slide groups, layers, and settings) as a `.json` file.

### CLI Export (headless)
For automated exports, use the CLI:
```bash
npm run build
node cli/index.mjs --help
```
See `cli/README.md` for full CLI documentation.

---

## Localization

Click **Localization** in the top-right toolbar to switch to localization mode. This lets you manage translated text content for each slide group across multiple locales.

---

## AI Features

Click **⚙ AI Settings** in the top-right toolbar to configure your AI provider and API keys. AI features include:
- **Text translation** — Translate text layers across locales
- **Image generation** — Generate or edit images using AI

---

## Keyboard Shortcuts

### Canvas & View

| Shortcut | Action |
|---|---|
| `Space` + Drag | Pan the canvas |
| `Ctrl+0` / `Cmd+0` | Fit canvas to window |
| `Ctrl+1` / `Cmd+1` | Zoom to 100% |

### Layers

| Shortcut | Action |
|---|---|
| `Arrow Keys` | Nudge selected layer 1px |
| `Shift+Arrow Keys` | Nudge selected layer 10px |
| `Delete` / `Backspace` | Remove selected layer(s) |
| `Ctrl+D` / `Cmd+D` | Duplicate selected layer |

### Copy & Paste

| Shortcut | Action |
|---|---|
| `Ctrl+C` / `Cmd+C` | Copy selected layer(s) |
| `Ctrl+X` / `Cmd+X` | Cut selected layer(s) |
| `Ctrl+V` / `Cmd+V` | Paste layer(s) |
| `Ctrl+Alt+C` / `Cmd+Alt+C` | Copy layer style |
| `Ctrl+Alt+V` / `Cmd+Alt+V` | Paste layer style |

### Groups

| Shortcut | Action |
|---|---|
| `Ctrl+G` / `Cmd+G` | Group selected layers |
| `Ctrl+Shift+G` / `Cmd+Shift+G` | Dissolve group |
| `Escape` | Exit group editing mode |

### History

| Shortcut | Action |
|---|---|
| `Ctrl+Z` / `Cmd+Z` | Undo |
| `Ctrl+Shift+Z` / `Cmd+Shift+Z` | Redo |
| `Ctrl+Y` / `Cmd+Y` | Redo (alternative) |

---

## Tips & Tricks

- **Panoramic slides**: Set `numSlides > 1` in a slide group to create a wide panoramic canvas. Layers in "slide 2" space have `x > slideWidth`.
- **Gradient text**: Text layers support gradient fills via an offscreen canvas technique — works even though Konva doesn't natively support it.
- **Asset references**: Images are stored by filename reference in the asset store, not embedded inline. Re-importing a project requires re-importing the same image assets.
- **Undo history**: Asset imports (images) are intentionally NOT undoable — they are file-system side effects.
- **Seam guides**: Dashed vertical lines on the canvas mark slide boundaries in panoramic groups. They are visual-only and not included in exports.
