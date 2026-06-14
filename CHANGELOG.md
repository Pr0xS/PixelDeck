# Changelog

All notable changes to PixelDeck are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1] - 2026-06-14

### Fixed

- GitHub Pages AI provider compatibility: OpenCode now uses a local curated model list in no-proxy production builds instead of calling its `/models` endpoint, avoiding the browser CORS failure.
- Google AI requests now switch correctly between direct browser API-key query parameters and proxy header auth when `VITE_AI_PROXY_BASE_URL` is configured.

### Added

- Optional production AI proxy routing via `VITE_AI_PROXY_BASE_URL`, while keeping static GitHub Pages direct-provider mode as the default.
- Fallback model lists for providers when dynamic model discovery is blocked by CORS or network errors.
- Tests covering AI URL routing and OpenCode no-proxy model fallback behavior.

### Documentation

- Documented static-host AI behavior and optional proxy configuration in the README.

## [0.2.0] - 2026-06-14

### Added

- 80+ curated Google Fonts (expanded from 23; includes sans-serif, serif, display, monospace, handwriting)
- Multi-format export: one project exports to multiple platform sizes (iPhone 6.9", Android Phone, iPad 13", Android Tablet) with per-format layout and visibility overrides
- AI translation: auto-translate all text layers to any locale using OpenAI, Anthropic, or compatible APIs
- Brand color system: named brand colors with token binding (`@brand:<id>`) across all fill fields
- Gradient presets: 12 quick-pick gradient swatches in the gradient editor (Midnight, Ocean, Aurora, Candy, Sunset, Fire, Forest, Peach, Royal, Lavender, Neon, Nordic)
- Phone position presets: one-click Center / Hero / Bleed / Tilt ↺ / Tilt ↻ placement for phone mockup layers
- Text placement presets: one-click Top / Middle / Bottom positioning for text layers, pano-aware
- OS file drop on canvas: drag image files from the OS file manager directly onto the canvas to replace a phone screenshot, replace an image layer, or create a new image layer; supports multiple files
- Rich text marks system (`TextMark`): range-based per-character styling (start/end offsets) replacing the legacy `TextSpan` segment system; supports fill, fontWeight, italic, underline, strikethrough per range
- Format-aware rendering: per-format visibility and layout overrides; base format for authoring, exportable formats for each platform
- ZIP batch export from the browser: download all slides in a group as a ZIP in one click
- Locale manifest generation and import via CLI for external translation workflows
- `--locale` and `--all-locales` flags for CLI export

### Changed

- Asset store migrated from in-memory Map to IndexedDB for persistence across page reloads

## [0.1.0] - 2026-06-09

### Added

- Visual canvas editor with Konva: drag, resize, rotate, group layers
- Layer types: phone mockup, text, image, shape, chips (pill labels), brand lockup, group
- Background layer: solid or gradient background; always at the bottom of the stack
- Rich text: per-span color, gradient fill, font weight, italic within one text layer
- 23 curated Google Fonts loaded on demand
- Pano slide groups: canvas spanning multiple slides for phone-crossing-seam layouts
- Gradient fills: linear and radial on backgrounds, shapes, and text
- Full undo/redo via zundo
- Multi-project management: create, open, rename, delete; auto-saved to localStorage
- Layer panel: drag-to-reorder with dnd-kit, visibility toggle, lock, rename
- Properties inspector: context-aware panel per selected layer
- Contextual toolbar: floating quick-actions above selected layer
- Asset library: import screenshots by file or folder, drag to canvas
- Browser export: download individual slides or full groups as PNGs
- CLI batch export: headless Playwright export for automation pipelines
- Templates: import/export project decks as reusable JSON templates
- Localization: per-locale text and image overrides; locale switcher in preview
- Phone status bar simulation: iOS and Android styles (transparent / solid background)
- Phone mockups: iPhone 16 Pro, iPhone 16 Pro (No Island), Pixel 9, Pixel 9 (No Camera)
- Plain mockup variants without Dynamic Island / punch-hole for clean marketing shots
- Asset persistence: IndexedDB storage for imported screenshots (survives page reload)
- Preview modal: full-project filmstrip preview with high-res thumbnail capture
- Slide navigator: thumbnail-based navigation with per-slide index

[Unreleased]: https://github.com/Pr0xS/PixelDeck/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/Pr0xS/PixelDeck/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/Pr0xS/PixelDeck/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Pr0xS/PixelDeck/releases/tag/v0.1.0
