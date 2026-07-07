# Changelog

All notable changes to PixelDeck are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0](https://github.com/Pr0xS/PixelDeck/compare/pixeldeck-v0.3.3...pixeldeck-v0.4.0) (2026-07-07)


### Features

* add checkmark shape type ([170f1b9](https://github.com/Pr0xS/PixelDeck/commit/170f1b9d10c22766ba815133ccd192ab942a0017))
* **ai:** add provider model selection ([f07b172](https://github.com/Pr0xS/PixelDeck/commit/f07b17267477ef06c1b6c62a2810a1dddcf1d8e9))
* **ai:** harden client, modularize headers/urls/errors, fix image path ([c4c3eab](https://github.com/Pr0xS/PixelDeck/commit/c4c3eabf1cd75819ed112d9ad36786d38f7452df))
* **ai:** multimodal client, dynamic model list, context-aware prompts ([0f1959f](https://github.com/Pr0xS/PixelDeck/commit/0f1959fce7ecb8ddb9a5f7ad32582d867c5fd783))
* **app:** 5 new templates, code splitting, lazy loading, JSZip dep ([c43b2b6](https://github.com/Pr0xS/PixelDeck/commit/c43b2b6794f34d1c34e05594ef089143beff9006))
* **canvas:** blur/shadow effects, group scaling, brand node, background image mode ([cde7bb0](https://github.com/Pr0xS/PixelDeck/commit/cde7bb0775271da7278bdd7b590416cfcb6faa18))
* **canvas:** canvas format system, seam guides, type extensions ([a41ba9b](https://github.com/Pr0xS/PixelDeck/commit/a41ba9b4711e5448fd01278b5544bd40c67826f1))
* **ci:** add Battlellama security/SAST and GitHub Pages deploy ([72f265e](https://github.com/Pr0xS/PixelDeck/commit/72f265ec6fef0735dcd366319fa4631eabad8bc0))
* **editor:** add format tabs and in-canvas text editing ([7fec597](https://github.com/Pr0xS/PixelDeck/commit/7fec597804dc26b21688fb9fa1c951da86f1895b))
* layer alignment controls in Properties panel ([7d2e2dc](https://github.com/Pr0xS/PixelDeck/commit/7d2e2dc9748c3c1a1e92b342112d0b8b80091818))
* **localization:** WYSIWYG locale cells, docked styling panel, portaled selectors ([88b6718](https://github.com/Pr0xS/PixelDeck/commit/88b671849f4198102906da28fcbad89797d1ceb7))
* **panels:** layer rename, brand kit controls, properties panel overhaul ([7c50250](https://github.com/Pr0xS/PixelDeck/commit/7c502506bf35cf06b61f1b51f2c23f1611c702fe))
* polish release workflow and export settings ([e0109ec](https://github.com/Pr0xS/PixelDeck/commit/e0109ec1bf375fe728b0c645a6361574303edbaa))
* **preview:** platform+locale aware modal, fixed aspect ratio and render race ([91b2e50](https://github.com/Pr0xS/PixelDeck/commit/91b2e5077b9e7680e75dd73947238605c27ad1e8))
* replace chips layer with emoji layer, extend shapes with 7 new types ([b90e686](https://github.com/Pr0xS/PixelDeck/commit/b90e686bf1e118c87121ecd2a59e2ff3488b3527))
* show real slide background behind text previews in LocalizationView ([30fd536](https://github.com/Pr0xS/PixelDeck/commit/30fd53634aa8d8ee520ae91a08a6dbdf803cf133))
* show version and git hash in Settings footer, redesign Help/GitHub toolbar buttons ([1a34c0e](https://github.com/Pr0xS/PixelDeck/commit/1a34c0eaedb9a44a6c71df452e8b55c4aeea73b3))
* **store:** brand kit actions, group scale, copy/paste style, slide size presets ([037fa65](https://github.com/Pr0xS/PixelDeck/commit/037fa651da7790301c8fd386ed5fc49409db032a))
* **text:** rich text marks system + PowerPoint-like resize ([bbeeb04](https://github.com/Pr0xS/PixelDeck/commit/bbeeb0433f1db505001fdda8698ba3a9a65acb79))
* **toolbar:** brand kit button, API keys modal, toolbar polish ([40883f5](https://github.com/Pr0xS/PixelDeck/commit/40883f5d50ca4bab4642d4680b23b68fc40ea9d6))
* **types:** BrandColor, TextMark, PhoneBorder, background image fields ([73eccce](https://github.com/Pr0xS/PixelDeck/commit/73eccceff7046e08a6ab4345300e245d48c67691))
* **utils:** locale overrides, ZIP export, expanded font catalog ([4d2daca](https://github.com/Pr0xS/PixelDeck/commit/4d2dacabc1007059778865aa52e008f5b5ea74b7))
* **ux:** auto-focus Content tab when inserting shape or emoji ([1ff8e23](https://github.com/Pr0xS/PixelDeck/commit/1ff8e2383fd95afbf4cc47ebd43a39b31d423943))
* v0.3.0 — emoji layer, 7 new shapes, UX improvements ([7a4670f](https://github.com/Pr0xS/PixelDeck/commit/7a4670fa030c4242d882bfdcb54dbc82857b88ce))
* v0.3.0 — emoji layer, 7 new shapes, UX improvements ([7a4670f](https://github.com/Pr0xS/PixelDeck/commit/7a4670fa030c4242d882bfdcb54dbc82857b88ce))


### Bug Fixes

* address oracle review — CLI help, CHANGELOG year, package.json private, CI smoke, SECURITY path, doc consistency ([e991c72](https://github.com/Pr0xS/PixelDeck/commit/e991c728bc160bc406b786a8f610183c76857852))
* AI translation failures with reasoning models and multi-tag rich text ([5091ce7](https://github.com/Pr0xS/PixelDeck/commit/5091ce790b42e27b4201425ba0c361c3a00a369b))
* **ai:** block opencode on static deploys ([915465c](https://github.com/Pr0xS/PixelDeck/commit/915465ccb114ce56af284cddcd3500102ad7b9cf))
* **ai:** support static provider model loading ([021878a](https://github.com/Pr0xS/PixelDeck/commit/021878aeec52ddcff4d9d3f797dad7f2c518a41b))
* apply text weight through rich-text mark system with selection support ([b5e713d](https://github.com/Pr0xS/PixelDeck/commit/b5e713d515a36e2f987d8097623954429722ad71))
* arrow rotation bake-in, dead chips code, icon map, emoji slider min ([2c80106](https://github.com/Pr0xS/PixelDeck/commit/2c8010604da4653e45809c6ba37b44cf4fc27310))
* **assets:** recursive folder import + folder-grouped asset browser ([bb45e19](https://github.com/Pr0xS/PixelDeck/commit/bb45e192e86c534d5ccc3d99286fe4ffc46ffe1d))
* canvas format scaling, locale assets, AI translation, alignment, fonts ([254d3f2](https://github.com/Pr0xS/PixelDeck/commit/254d3f2a0ade6e6a9be2c1b7017b928329527977))
* **canvas:** keepRatio=false for text layers in Transformer ([c3da81e](https://github.com/Pr0xS/PixelDeck/commit/c3da81e728ad570ebc43dd81ec7d46618faedf18))
* **ci:** regenerate lockfile, use npm install for cross-node-version compat ([67033bc](https://github.com/Pr0xS/PixelDeck/commit/67033bc7ea8e6db008ceba34c5d55322529d315f))
* **clipboard:** cross-slide paste preserves exact layer position ([f41ca55](https://github.com/Pr0xS/PixelDeck/commit/f41ca550b3206bed0961ab99e279e59095ab39ae))
* correct noise toggle knob alignment in Background properties ([688f34f](https://github.com/Pr0xS/PixelDeck/commit/688f34fd5fb0a23b01e4213b49bfa17902e44871))
* fit-center uniform scaling for canvas format switch ([aefc3d7](https://github.com/Pr0xS/PixelDeck/commit/aefc3d7c24e4704e1d6af628eb6401947db778d8))
* font picker keyboard nav, web-safe font loading, Escape restore ([7f64b6c](https://github.com/Pr0xS/PixelDeck/commit/7f64b6c2df941ead78ecbdb3b6a8c7fb7a30e41f))
* import folder, cross-slide paste position, localStorage quota (v0.3.1) ([e5f48da](https://github.com/Pr0xS/PixelDeck/commit/e5f48da9149ee1bc0c78a98528ca9c230b68826c))
* locale asset key uses :: separator; show error tooltip; fix PhoneProperties upload ([67dd1dd](https://github.com/Pr0xS/PixelDeck/commit/67dd1dd3ddf1ed15c873c7bc58a7242019dbd846))
* pano export — missing slide + wrong format projection pivot ([8b3708b](https://github.com/Pr0xS/PixelDeck/commit/8b3708b9ccef61cababb4fa9bf250edff49f1fdf))
* pano export missing slide due to duplicate slideNames ([883cd0c](https://github.com/Pr0xS/PixelDeck/commit/883cd0c846710745c882db450291af96ff320149))
* pano format projection uses wrong canvas centre pivot ([6daa7f6](https://github.com/Pr0xS/PixelDeck/commit/6daa7f6b196bf924ccbb09226773bf635ddb87f8))
* **persistence:** strip inline base64 dataUrls before localStorage save ([8bcc6f2](https://github.com/Pr0xS/PixelDeck/commit/8bcc6f2c79cccf54ed039f59a2d046c7126e385c))
* regenerate lockfile with npm 10 for CI compatibility ([c8764b1](https://github.com/Pr0xS/PixelDeck/commit/c8764b11f6c48c42d2c60c19c9dc7e5e811e6ba7))
* **security:** render rich text preview without innerHTML ([034d89b](https://github.com/Pr0xS/PixelDeck/commit/034d89be7c3ad1213b30a8051fc68a1d31bd504e))
* sync package-lock.json so npm ci passes in CI ([b600d18](https://github.com/Pr0xS/PixelDeck/commit/b600d189be3e0d7034079cfb7a3cfe5f16e28292))
* **thumbnails:** auto-capture on load, restore viewport, loading overlay ([33cd16e](https://github.com/Pr0xS/PixelDeck/commit/33cd16e737d88708e43f9b27bb213fb8ddacd16f))
* **ui:** align emoji picker grid cells with aspect-square flex centering ([9b5a277](https://github.com/Pr0xS/PixelDeck/commit/9b5a2776bc2e025e8ec1cbbe76f6605b684161b1))

## [Unreleased]

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

[Unreleased]: https://github.com/Pr0xS/PixelDeck/compare/v0.2.2...HEAD
[0.2.2]: https://github.com/Pr0xS/PixelDeck/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/Pr0xS/PixelDeck/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/Pr0xS/PixelDeck/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Pr0xS/PixelDeck/releases/tag/v0.1.0
