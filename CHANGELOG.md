# Changelog

All notable changes to PixelDeck are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — 2026-06-09

### Added

- Visual canvas editor with Konva — drag, resize, rotate, group layers
- Layer types: phone mockup, text, image, shape, chips (pill labels), brand lockup, group
- Background layer — solid or gradient background; always at the bottom of the stack
- Rich text — per-span color, gradient fill, font weight, italic within one text layer
- 23 curated Google Fonts loaded on demand
- Pano slide groups — canvas spanning multiple slides for phone-crossing-seam layouts
- Gradient fills — linear and radial on backgrounds, shapes, and text
- Full undo/redo via zundo
- Multi-project management — create, open, rename, delete; auto-saved to localStorage
- Layer panel — drag-to-reorder with dnd-kit, visibility toggle, lock, rename
- Properties inspector — context-aware panel per selected layer
- Contextual toolbar — floating quick-actions above selected layer
- Asset library — import screenshots by file or folder, drag to canvas
- Browser export — download individual slides or full groups as PNGs
- CLI batch export — headless Playwright export for automation pipelines
- Templates — import/export project decks as reusable JSON templates
- Localization — per-locale text and image overrides; locale switcher in preview
- Phone status bar simulation — iOS and Android styles (transparent / solid background)
- Phone mockups — iPhone 16 Pro, iPhone 16 Pro (No Island), Pixel 9, Pixel 9 (No Camera)
- Plain mockup variants without Dynamic Island / punch-hole for clean marketing shots
- Asset persistence — IndexedDB storage for imported screenshots (survives page reload)
- Preview modal — full-project filmstrip preview with high-res thumbnail capture
- Slide navigator — thumbnail-based navigation with per-slide index

[Unreleased]: https://github.com/your-org/pixeldeck/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/your-org/pixeldeck/releases/tag/v0.1.0
