# Bundled templates toolchain

The gallery templates in `public/templates/` (and the first-run Welcome project) are **generated**. Edit the sources here and rebuild; do not hand-edit the JSON.

```
scripts/templates/
  build.mjs                 build + lint + preview entry point
  showcase.mjs              README / link-preview images composed from the previews
  lib/dsl.mjs               layer factories (text, phone, art, shape, …)
  lib/render.mjs            HTML → WebP art pipeline (content-addressed assets)
  lib/preview.mjs           renders a template through the real app (headless ExportApp)
  lib/lint.mjs              layout lint (wraps, overlaps, seams, fonts)
  kit/kit.css               mock UI kit shared by every demo screen
  sources/<slug>/
    template.mjs            metadata + art list + build({ a }) → slide groups
    theme.css               kit custom properties for this template
    screens/*.html          mock app screens (400×902 body fragments)
    art/*.html              floating cards, logos (transparent)
    assets.lock.json        generated: source hash → asset file (commit it)
```

## Commands

```bash
npm run build                                          # once: previews render dist/
node scripts/templates/build.mjs <slug> --preview      # build + lint + PNGs + contact sheets
node scripts/templates/build.mjs <slug> --preview --formats=base,android-phone
node scripts/templates/build.mjs --thumbs --gc         # everything, gallery thumbnails, drop stale assets
```

`node scripts/templates/showcase.mjs` rebuilds the README images in `docs/media/` and the link-preview image `public/og.jpg` from those previews and from a live screenshot of the editor. Run it after `build.mjs --preview` whenever a template or the tour changes visibly.

Previews land in `output/templates/<slug>/` (git-ignored): `sheet-<format>-<locale>.png` is the contact sheet, `<format>-<locale>/NN.png` the full-size slides. Slides of one pano group touch in the sheet so the seam can be judged.

Set `PIXELDECK_DIST=/path/to/dist` to preview against a frozen build while `src/` is changing.

## How it fits together

- **Art** (`art` in `template.mjs`) is HTML rendered by headless Chromium to WebP and stored as `public/templates/assets/img_<hash>.webp`, the same content-hash key format the app uses for every image. `assets.lock.json` pins source → key, so an unchanged source never produces new bytes.
- **Transparent art is cropped and casts a real shadow.** A soft drop shadow baked into a transparent image is wider than the image and gets cut off in a straight line. The pipeline therefore removes blurred `box-shadow`s from the outermost painted elements, crops the image to its visible pixels (so the layer box and its hit area are tight to the card), and records the removed shadow in `assets.lock.json`. `art(a.<id>, …)` then places the cropped image exactly where the declared box would have drawn it and gives the layer that shadow, which the user can edit like any other. Hard-edged shadows (blur 0) stay in the artwork. Pass `crop: false` in the art spec for images that are swapped per locale and must share one box.
- **Layers** reference art only by key (`a.<id>.key`). The template JSON carries an `assetManifest` (key → name/mime); the app fetches `templates/assets/<key>` when the template is applied.
- **Preview** injects the template as a project into the app's headless `ExportApp`, the same path the CLI uses, so a preview is exactly what a user exports.
- **Lint** measures text with the real web font and warns about lines that wrap, text near an edge or across a pano seam, and text colliding with other text or a device. Treat warnings as bugs unless you have looked at the render and it is intentional.

## Authoring a template

`template.mjs` default-exports:

```js
export default {
  slug: 'my-app',            // must equal the folder name
  order: 30,                 // gallery position
  name, category, description,
  settings: { brandName, brandColors: [{ id, name, value }], locales? },
  art: {
    home: { file: 'screens/home.html', fonts: FONTS },                                   // phone screen
    tip:  { file: 'art/tip.html', width: 360, height: 140, transparent: true, fonts: FONTS }, // floating card
  },
  build({ a }) { return [ slide('Hero', [ bg(...), text(...), phone({ screen: a.home.key }) ]) ] },
}
```

`fonts` are Google Fonts `css2` family specs, e.g. `'family=Inter:wght@400;600;700'`.

Use `art(a.tip, { x, y, k, rotation })` for floating cards: `x`/`y`/`cx` position the declared art box and `k` scales it (k ≈ phone scale × 0.9 matches the UI inside a phone). An optional `lateArt({ screenshots })` returns art that depends on the finished set (the Welcome tour's export diagram quotes the real file count); it is passed to `build` as `late`.

### Canvas

- Base canvas is **1290×2796**. A pano group (`slide(name, layers, { slides: 2 })`) is one canvas `1290 × slides` wide; `x > 1290` is the second screenshot.
- `x`/`y` are the top-left of the unrotated box; rotation pivots on the box centre. `cx` centres a text box, phone, shape or art on that x.
- The first layer of every slide must be `bg(...)`.
- Formats auto-scale from Base. Android (1080×1920) is wider in proportion, so content is scaled to ~0.69 and centred. Check `--formats=base,android-phone`.

### Screens

- A screen is a **400×902** body fragment whose root is `<div class="screen">`. Keep the top **66px** free: the phone layer draws the status bar there. Pass `statusBar: 'light'` to `phone()` for dark icons on a light screen.
- Use kit classes (`card`, `row`, `pill`, `tile`, `list`, `bars`, `ring`, `tabbar`, …) and theme through the custom properties in `theme.css`.
- Icons: `<i class="ic">home</i>` (Material Symbols Rounded; add `fill` for solid).
- Emoji are fine inside screens and art (they are baked into the image). Avoid emoji *layers* in templates: they render with whatever emoji font the exporting machine has.

### Text

- `text('Plain {{highlighted}}', { mark: { fill } })` creates a rich-text mark for each `{{…}}` segment.
- Use fonts and weights from `src/utils/fonts.ts`; the lint rejects anything else.
- Reference brand colours as `'{brand:<id>}'` so a user can re-skin the set from the Brand Kit.
- `l10n: { es: '…' }` adds a translation; `localeAdjust` / `formatOverrides` pass straight through to the layer.
