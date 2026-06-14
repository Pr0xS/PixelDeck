# PixelDeck

### App Store & Play Store Screenshot Generator — Visual Editor + CLI

[![GitHub stars](https://img.shields.io/github/stars/Pr0xS/PixelDeck?style=social)](https://github.com/Pr0xS/PixelDeck/stargazers)
[![Live Demo](https://img.shields.io/badge/demo-live-success.svg)](https://pr0xs.github.io/PixelDeck/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/Pr0xS/PixelDeck/actions/workflows/ci.yml/badge.svg)](https://github.com/Pr0xS/PixelDeck/actions)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![AI Agent Friendly](https://img.shields.io/badge/AI%20agents-welcome%20🤖-7c6ef6)](AGENTS.md)

**Design beautiful App Store and Play Store screenshots in your browser, then batch-export them from the CLI. Free, open-source, and 100% local — no account, no subscription, no server.**

PixelDeck is a free **App Store screenshot generator** and **device mockup maker** for indie developers and mobile teams. Create polished App Store and Google Play screenshots with a layer-based canvas editor — drag device mockups, headlines, gradients, and shapes onto your screens — then automate PNG export for every screen, locale, and device size from a headless CLI. Free, open-source, and 100% local.

### 🚀 [Try the Live Demo →](https://pr0xs.github.io/PixelDeck/)

No install, no sign-up. Everything runs in your browser.

<!--
  TODO: add a hero screenshot or GIF here once available, e.g.:
  ![PixelDeck App Store screenshot generator editor with device mockups and panoramic canvas](docs/media/hero.gif)
-->

---

## Who is this for?

- **Indie iOS/Android developers** shipping to the App Store or Play Store on a budget who want professional-looking screenshots without a Figma or Canva subscription.
- **Mobile teams** that need repeatable, version-controlled screenshot generation in CI — one design, every locale, every device size, automated.
- **ASO & marketing folks** who want premium store visuals with full creative control: custom gradients, panoramic multi-slide layouts, and per-locale overrides.

---

## Why PixelDeck?

Most screenshot tools give you a fixed template: one background, one phone, one headline. PixelDeck is a **full layer-based canvas editor** — the same mental model as Figma or Photoshop, purpose-built for App Store and Play Store screenshots.

- 🖼️ **Panoramic multi-slide layouts** — design across 2, 3, or more store slides on a single canvas. A phone mockup can span the seam between screenshots for that premium storefront look that no template tool can produce.
- 🎨 **Full layer system** — stack phone mockups, rich text, images, shapes, chip badges, brand lockups, and groups. Every layer is independently movable, resizable, and styleable.
- ✏️ **Truly interactive editor** — click to select, drag to move, handles to resize and rotate, double-click to edit text inline. No form-filling, no guessing — what you see is what you export.
- 🌍 **Built-in localization** — per-locale text and image overrides with a locale switcher, so one design covers every language you ship.
- 🤖 **Headless CLI export** — batch-render every slide, locale, and format to PNG with Playwright. Perfect for CI pipelines and release automation.
- 🔒 **100% local-first** — no account, no backend, no telemetry. Projects auto-save to localStorage and imported screenshots persist in IndexedDB. Your work never leaves your machine.
- 🆓 **Free & MIT-licensed** — own your tooling. Fork it, extend it, ship it.

---

## Features

### 🎨 Visual editing

| | |
|---|---|
| Canvas editor | Drag, resize, rotate, and group layers with PowerPoint-style group editing |
| Layer types | Phone mockup, text, image, shape, chips, brand lockup, group |
| Layers panel | Drag-to-reorder, visibility, lock, rename, plus an always-bottom background layer |
| Inspector | Context-aware properties panel and a floating quick-actions toolbar on canvas |
| Placement presets | One-click Top / Middle / Bottom positioning for text layers, pano-aware |
| Position presets | One-click Center / Hero / Bleed / Tilt presets for phone mockup layers |

### ✍️ Typography, mockups & effects

| | |
|---|---|
| Rich text | Per-span color, gradient fill, weight, and italic within a single text layer |
| Fonts | 80+ curated Google Fonts (sans-serif, serif, display, monospace, handwriting) loaded on demand |
| Gradients | Linear and radial fills on backgrounds, shapes, and text — with 12 quick-pick presets |
| Device frames | iPhone 16 Pro, iPhone 16 Pro (No Island), Pixel 9, Pixel 9 (No Camera) |
| Status bar | Simulated iOS / Android status bars, transparent or solid |
| Shadows & blur | Per-layer drop shadow and blur effects |
| Noise texture | Subtle noise overlay on background layers |

### 📂 Projects, assets & export

| | |
|---|---|
| Projects | Multi-project management with auto-save, full undo/redo history |
| Assets | Import screenshots by file or folder, drag from panel or drop directly from your OS onto the canvas |
| Multi-format | Export one design to multiple platform sizes (iPhone, Android, iPad, Tablet) with per-format overrides |
| Preview | Full-deck filmstrip preview with locale switcher and slide navigator |
| ZIP export | Download all slides as a ZIP in one click from the browser |
| CLI export | Batch-render headlessly via Playwright — supports locales, YAML batch configs, and CI pipelines |

### 🌍 Localization & AI

| | |
|---|---|
| Locale overrides | Per-layer text, screenshot, and image overrides per locale |
| AI translation | Auto-translate all text layers to any locale using your own API key (OpenAI, Anthropic, etc.) |
| Locale export | CLI exports each locale to its own folder in one command |

---

## Supported Devices & Screenshot Sizes

| Device | Canvas size | App Store / Play Store use |
|---|---|---|
| iPhone 16 Pro | 390 × 844 pt | iOS 6.3" — required for App Store |
| iPhone 16 Pro (No Island) | 390 × 844 pt | iOS 6.3" — classic status bar variant |
| Google Pixel 9 | 380 × 820 pt | Android 6.3" — Google Play |
| Pixel 9 (No Camera) | 380 × 820 pt | Android 6.3" — clean status bar variant |

Export at any pixel ratio via the CLI. Match `slideWidth`/`slideHeight` to your target App Store resolution (e.g. 1290 × 2796 for iPhone 6.7").

---

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

---

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
| Typography | Google Fonts (80+ curated families) |

---

## Project Structure

```text
pixeldeck/
├── cli/      # Headless Playwright export CLI and batch config examples
├── public/   # Static assets and bundled templates (public/templates/)
└── src/      # React app, Zustand stores, Konva canvas, domain types, utilities
```

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the full system design, data model, and export pipeline.

---

## FAQ

**Is PixelDeck free?**
Yes, completely. MIT-licensed, no freemium tier, no hidden limits.

**Do I need an account or internet connection?**
No account required. The editor runs entirely in your browser. An internet connection is only needed to load Google Fonts on first use.

**Does it work for Google Play screenshots?**
Yes. PixelDeck supports both App Store (iOS) and Google Play (Android) screenshot formats, with device mockups for both platforms.

**Can I use it in a CI pipeline with fastlane?**
Yes. The headless CLI (`node cli/index.mjs export`) renders PNGs via Playwright and can be integrated into any CI pipeline alongside fastlane, GitHub Actions, or Bitrise.

**What screenshot sizes does it support?**
The canvas size is fully configurable. Set `slideWidth`/`slideHeight` to any resolution — e.g. 1290 × 2796 for iPhone 6.7", 1242 × 2688 for iPhone 5.8", or 1080 × 1920 for Android. The CLI exports at the canvas's logical size.

**Can I export multiple languages/locales?**
Yes. PixelDeck has built-in localization: define per-locale text and image overrides, then the CLI exports each locale to its own folder in one command.

**Is my data private?**
Yes. Everything stays on your machine. No telemetry, no backend, no cloud sync. Projects are saved to `localStorage`; imported images are stored in IndexedDB.

**Can I self-host it?**
Yes. Run `npm run build` and serve the `dist/` folder from any static host (GitHub Pages, Netlify, Vercel, S3, etc.).

---

## For AI Agents

PixelDeck is designed to be extended by AI coding agents. [`AGENTS.md`](AGENTS.md) maps every file, lists the 6-step recipe for adding a new layer type, documents non-obvious behaviors, and defines a verification contract. Agent contributions are explicitly welcome; see [`CONTRIBUTING.md`](CONTRIBUTING.md).

---

## Contributing

Bug reports, feature ideas, docs improvements, and pull requests are welcome. Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a PR.

⭐ If PixelDeck is useful to you, consider starring the repo — it helps others find it.

---

## License

PixelDeck is released under the [MIT License](LICENSE).
