# PixelDeck

[![Live Demo](https://img.shields.io/badge/demo-live-success.svg)](https://pr0xs.github.io/PixelDeck/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://img.shields.io/badge/CI-ready-lightgrey.svg)](https://github.com/Pr0xS/PixelDeck/actions)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![AI Agent Friendly](https://img.shields.io/badge/AI%20agents-welcome%20🤖-7c6ef6)](AGENTS.md)

**Design beautiful App Store & Play Store screenshots in your browser, then batch-export them from the CLI.**

PixelDeck is a free, open-source visual editor for store screenshot layouts. Drag device mockups, rich text, shapes, and gradients onto a canvas, then export production-ready PNGs. No design tool subscription, no account, no server.

### 🚀 [Try the Live Demo →](https://pr0xs.github.io/PixelDeck/)

No install, no sign-up. Everything runs in your browser.

<!--
  TODO: add a hero screenshot or GIF here once available, e.g.:
  ![PixelDeck editor](docs/media/hero.png)
-->

## Why PixelDeck?

- 🔒 **100% local-first**: no account, no backend, no telemetry. Projects auto-save to localStorage and imported screenshots persist in IndexedDB. Your work never leaves your machine.
- 🖼️ **Panoramic multi-slide layouts**: design across 2+ store slides on one canvas, so a single phone mockup can span the seam between screenshots for that premium storefront look.
- 📦 **Reusable templates**: save any project as a template and re-apply it to new apps, or share it as a JSON file.
- 🌍 **Built-in localization**: per-locale text and image overrides with a locale switcher, so one design covers every language you ship.
- 🤖 **Headless CLI export**: batch-render every slide, locale, and theme to PNG with Playwright. Perfect for CI pipelines and release automation.
- 🆓 **Free & MIT-licensed**: own your tooling. Fork it, extend it, ship it.

## Features

### 🎨 Visual editing

| | |
|---|---|
| Canvas editor | Drag, resize, rotate, and group layers with PowerPoint-style group editing |
| Layer types | Phone mockup, text, image, shape, chips, brand lockup, group |
| Layers panel | Drag-to-reorder, visibility, lock, rename, plus an always-bottom background layer |
| Inspector | Context-aware properties panel and a floating quick-actions toolbar on canvas |

### ✍️ Typography, mockups & effects

| | |
|---|---|
| Rich text | Per-span color, gradient fill, weight, and italic within a single text layer |
| Fonts | 23 curated Google Fonts (sans-serif, serif, display) loaded on demand |
| Gradients | Linear and radial fills on backgrounds, shapes, and text |
| Device frames | iPhone 16 Pro, iPhone 16 Pro (No Island), Pixel 9, Pixel 9 (No Camera) |
| Status bar | Simulated iOS / Android status bars, transparent or solid |

### 📂 Projects, assets & export

| | |
|---|---|
| Projects | Multi-project management with auto-save, full undo/redo history |
| Assets | Import screenshots by file or folder, drag to canvas, persisted in IndexedDB |
| Preview | Full-deck filmstrip preview with locale switcher and slide navigator |
| Export | Download PNGs from the browser, or batch-export headlessly via the CLI |

## Quick Start

The fastest way to try PixelDeck is the **[live demo](https://pr0xs.github.io/PixelDeck/)**, with nothing to install.

### Run locally

> Requires Node.js 20.19+.

```bash
npm install
npm run dev
```

Open <http://localhost:5173>.

### CLI batch export

Build the web app first, since the CLI renders from `dist/`:

```bash
npm run build
npx playwright install chromium   # one-time
node cli/index.mjs export \
  --project=./projects/my-app.json \
  --screenshots=./screenshots/raw \
  --output=./output/store
```

Output directories are created automatically. See [`cli/README.md`](cli/README.md) for full CLI docs, locale export, and YAML batch configuration.

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

```text
pixeldeck/
├── cli/      # Headless Playwright export CLI and batch config examples
├── public/   # Static assets and bundled templates (public/templates/)
└── src/      # React app, Zustand stores, Konva canvas, domain types, utilities
```

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the full system design, data model, and export pipeline.

## For AI Agents

PixelDeck is designed to be extended by AI coding agents. [`AGENTS.md`](AGENTS.md) maps every file, lists the 6-step recipe for adding a new layer type, documents non-obvious behaviors, and defines a verification contract. Agent contributions are explicitly welcome; see [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Contributing

Bug reports, feature ideas, docs improvements, and pull requests are welcome. Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a PR.

## License

PixelDeck is released under the [MIT License](LICENSE).
