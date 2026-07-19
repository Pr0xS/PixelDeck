# Changelog

All notable changes to PixelDeck are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.2](https://github.com/Pr0xS/PixelDeck/compare/v0.5.1...v0.5.2) - 2026-07-19

### Added

- Project-scoped asset library: images are now stored per-project in IndexedDB instead of one shared global store, preventing cross-project asset collisions.
- Self-contained project export/import — exported project JSON now embeds every referenced image, so imported projects are portable across profiles/machines.
- Shared UI primitives for modals, numeric inputs, toggles, segmented controls, file uploads, and inline labels.
- Reusable layer-tree walkers, Konva fill conversion, layer interaction/effect hooks, and a pure browser/headless export plan.
- AI transport and export-plan tests covering timeouts, retries, collision-safe filenames, nested layers, and gradients.

### Changed

- Split the canvas stage into focused viewport, selection, drop-target, transformer, geometry, and overlay modules.
- Unified browser and headless export enumeration and made CLI output names collision-safe with `<group>__<slide>.png` naming.
- Improved rich-text segmentation from quadratic scans to a sweep-line implementation and cached text measurements.
- Narrowed Zustand selectors and consolidated repeated layer, property-panel, and modal behavior.

### Fixed

- Prevented deleting the active project from resurrecting it via a stale replacement-load race.
- Fixed image-layer base-locale preview not rendering in the Localization panel (asset-store key wasn't resolved to a data URL).
- Added AI request timeouts and transient retries while preventing non-idempotent image generation from retrying after transport failures.
- Added consistent CLI validation and error reporting with non-zero exit codes.
- Preserved project update timestamps when clearing format-specific state.

## [0.5.1](https://github.com/Pr0xS/PixelDeck/compare/v0.4.1...v0.5.1) - 2026-07-16

### Added

- Editable background accent glows with independent color, opacity, blur, position, size, direct canvas manipulation, and overlap-aware selection.
- OpenAI-compatible custom provider support with shared provider/model settings for OpenAI, OpenRouter, Google Gemini, and custom endpoints.
- Four new bundled template sets for nutrition, finance, travel, and productivity.

### Changed

- Template phone screenshots are extracted into the IndexedDB asset store during import to avoid localStorage quota failures.
- AI requests now use a unified OpenAI-compatible client and Google Gemini's compatibility endpoint.
- Background and content interaction layers are separated while editing accents, preserving visual stacking and direct manipulation.

### Fixed

- Removed clipped edges and white halos from blurred canvas elements by padding filter caches and using native canvas blur filters.
- Preserved project export filenames that already include non-PNG extensions.
- Prevented project-library saves from persisting large inline screenshot data URLs.
- Prevented template exports from including project screenshots, image layers, background images, or brand logos.

## [0.4.1](https://github.com/Pr0xS/PixelDeck/compare/v0.4.0...v0.4.1) (2026-07-12)

### Bug Fixes

* support multiple simultaneous custom canvas formats ([#37](https://github.com/Pr0xS/PixelDeck/pull/37)) ([f3e8280](https://github.com/Pr0xS/PixelDeck/commit/f3e8280a0b9074e7704486592ad48aacc255f8f2))

## [0.4.0](https://github.com/Pr0xS/PixelDeck/compare/v0.3.3...v0.4.0) (2026-07-07)


### Features

* add checkmark shape type ([170f1b9](https://github.com/Pr0xS/PixelDeck/commit/170f1b9d10c22766ba815133ccd192ab942a0017))
* show real slide background behind text previews in LocalizationView ([30fd536](https://github.com/Pr0xS/PixelDeck/commit/30fd53634aa8d8ee520ae91a08a6dbdf803cf133))


### Bug Fixes

* apply text weight through rich-text mark system with selection support ([b5e713d](https://github.com/Pr0xS/PixelDeck/commit/b5e713d515a36e2f987d8097623954429722ad71))
* correct noise toggle knob alignment in Background properties ([688f34f](https://github.com/Pr0xS/PixelDeck/commit/688f34fd5fb0a23b01e4213b49bfa17902e44871))
* cross-slide paste offset cascade + add test coverage for export/import and geometry ([#35](https://github.com/Pr0xS/PixelDeck/issues/35)) ([5b048e5](https://github.com/Pr0xS/PixelDeck/commit/5b048e53ccd6f407e3afdf42b154d22dd17b0eac))
* keep release-please tags on bare vX.Y.Z format ([#33](https://github.com/Pr0xS/PixelDeck/issues/33)) ([1459d94](https://github.com/Pr0xS/PixelDeck/commit/1459d94465c7b6f5975fa20c1e69228b339dc183))

## [0.2.3] - 2026-06-14

### Added

- Logo and favicon: new SVG brand mark (two portrait screenshot cards with purple→pink gradient) replaces the generic bolt icon; added `public/logo.svg` wordmark for use in README and OG metadata.
- Current project name displayed in the toolbar between the logo and the Projects button — click to rename inline (Enter to confirm, Escape to cancel).
- README now shows the PixelDeck logo at the top, linked to the live demo.
- Richer `index.html` metadata: page title, description, theme-color, Open Graph, and Twitter/X card tags.

### Fixed

- Infinite render loop (`Maximum update depth exceeded`) caused by `useProjectsStore` selector returning a new object on every render; fixed by wrapping with `useShallow`.

## [0.2.2] - 2026-06-14

### Fixed

- OpenCode Go is now explicitly blocked in GitHub Pages/no-proxy production builds before any browser request is attempted, avoiding CORS console errors for both model loading and chat/image calls.
- Removed the hardcoded OpenCode model list from static production mode; unsupported providers now show a clear error instead of exposing models that cannot run.

### Changed

- Image-editing capability hints now treat OpenCode as unavailable in no-proxy static builds.

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

[Unreleased]: https://github.com/Pr0xS/PixelDeck/compare/v0.5.1...HEAD
[0.2.2]: https://github.com/Pr0xS/PixelDeck/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/Pr0xS/PixelDeck/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/Pr0xS/PixelDeck/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Pr0xS/PixelDeck/releases/tag/v0.1.0
