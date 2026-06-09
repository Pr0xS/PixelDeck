# PixelDeck

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://img.shields.io/badge/CI-ready-lightgrey.svg)](https://github.com/your-org/pixeldeck/actions)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![AI Agent Friendly](https://img.shields.io/badge/AI%20agents-welcome%20🤖-7c6ef6)](AGENTS.md)

A React + TypeScript visual editor for designing polished App Store and Play Store screenshots, then exporting production-ready PNGs from the browser or CLI.

<!-- TODO: add hero GIF -->

**Live demo:** TODO — add hosted demo link.

## Features

### Visual Editing

- **Visual canvas editor** — drag, resize, rotate, and group layers with PowerPoint-style group editing
- **Layer types** — phone mockup, text, image, shape, chips, brand lockup, group
- **Background layer** — solid or gradient background always at the bottom of the layer stack; editable via the Layers panel
- **Pano slide groups** — canvas spanning multiple slides so a phone can cross the seam between two screenshots
- **Layer panel** — drag-to-reorder, visibility toggle, lock, rename (dnd-kit)
- **Properties inspector** — context-aware panel for the selected layer
- **Contextual toolbar** — floating quick-actions toolbar above the selected layer on canvas

### Typography, Branding, and Effects

- **Rich text** — per-span color, gradient fill, font weight, and italic within a single text layer
- **Google Fonts** — 23 curated Google Fonts (sans-serif, serif, display) loaded on demand
- **Gradient fills** — linear and radial gradients on backgrounds, shapes, and text; shared fill controls across all layer types
- **Phone mockups** — iPhone 16 Pro, iPhone 16 Pro (No Island), Pixel 9, Pixel 9 (No Camera)
- **Plain mockup variants** — no Dynamic Island or punch-hole for clean marketing shots
- **Phone status bar simulation** — iOS and Android styles with transparent or solid backgrounds

### Projects, Assets, and Localization

- **Undo/redo** — full history via zundo
- **Multi-project management** — create, open, rename, and delete projects; auto-saved to localStorage
- **Asset library** — import screenshots by file or folder, drag to canvas
- **Asset persistence** — IndexedDB storage for imported screenshots, surviving page reloads
- **Templates** — pre-made JSON project decks, plus import/export of reusable project templates
- **Localization** — per-locale text and image overrides with a locale switcher in preview
- **Preview modal** — full-project filmstrip preview with high-resolution thumbnail capture
- **Slide navigator** — thumbnail-based navigation with per-slide index

### Export

- **Browser export** — download individual slides or full groups as PNGs
- **CLI batch export** — headless Playwright export for automation pipelines

## Quick Start

> Requires Node.js 20.19+.

### GUI Editor

```bash
npm install
npx playwright install chromium   # required for CLI export (one-time)
npm run dev
```

Open <http://localhost:5173>.

### CLI Batch Export

Build the web app first — the CLI renders from `dist/`.

```bash
npm run build
node cli/index.mjs export --help
```

Example export:

```bash
node cli/index.mjs export \
  --project=./projects/my-app.json \
  --screenshots=./screenshots/raw \
  --output=./screenshots/store
```

See [`cli/README.md`](cli/README.md) for full CLI docs and YAML batch configuration.

## Tech Stack

| Layer | Technology |
|---|---|
| UI framework | React 19 + TypeScript |
| Build tool | Vite 8 |
| Styling | Tailwind CSS v4 |
| Canvas rendering | Konva 10 / react-konva |
| State management | Zustand 5 + zundo (undo/redo) |
| Drag & drop | dnd-kit |
| Headless export | Playwright (Chromium) |
| Typography | Google Fonts (23 curated families) |

## Project Structure

Top-level directories only. See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the full system design, data model, and export pipeline.

```text
pixeldeck/
├── cli/          # Headless Playwright export CLI and batch config examples
├── public/       # Static browser assets
├── src/          # React app, Zustand stores, Konva canvas, domain types, utilities
├── templates/    # Reusable sample project decks
├── projects/     # Local saved project JSON files (development/workspace data)
├── screenshots/  # Raw screenshots and exported store images
└── output/       # Default CLI export output
```

## For AI Agents

PixelDeck is designed to be extended by AI coding agents. [`AGENTS.md`](AGENTS.md) maps every file, lists the 6-step recipe for adding a new layer type, documents non-obvious behaviors, and defines a verification contract. Agent contributions are explicitly welcome — see [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Contributing

Bug reports, feature ideas, docs improvements, and pull requests are welcome. Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a PR.

## License

PixelDeck is released under the [MIT License](LICENSE).
