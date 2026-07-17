# PixelDeck CLI

Batch-export App Store screenshots from the command line using a headless Playwright browser.

## Prerequisites

1. Build the app first (CLI uses the compiled `dist/`):
   ```bash
   npm run build
   ```

2. Install Playwright browsers (first time only):
   ```bash
   npx playwright install chromium
   ```

## Usage

### Single project export

```bash
node cli/index.mjs export \
  --project=./projects/my-app.json \
  --screenshots=./screenshots/raw \
  --output=./output/store
```

| Flag | Description |
|---|---|
| `--project` | Path to the `.json` project file saved from the GUI |
| `--screenshots` | Directory containing raw PNG screenshots (filenames must match `screenshotPath` values in the project) |
| `--output` | Directory where exported slide PNGs are written |

### Batch export via YAML config

```bash
node cli/index.mjs export --config=./cli/batch.example.yaml
```

See `cli/batch.example.yaml` for the full YAML schema. A batch config lets you export multiple projects (e.g. different locales or themes) in one command.

### Help

```bash
node cli/index.mjs --help
```

## How it works

1. The CLI starts a local static server serving `dist/`
2. For each export job it opens a Playwright Chromium page
3. It injects `window.__EXPORT_CONFIG__` with the project JSON and screenshot data URLs
4. The app detects `__EXPORT_CONFIG__` and mounts the headless `ExportApp` renderer instead of the interactive editor
5. Each slide is captured via `stage.toDataURL()` and written to disk as a PNG

## Project file format

Save your project from the GUI using the **Save** button (or the Projects panel). The resulting `.json` file is the input for `--project`.

## Output filenames

Exported PNGs are written as `<output>/<locale>/<group>__<slide>.png` (when the slide name differs from the group name; otherwise just `<slide>.png`). Names are sanitized — characters outside `a-z A-Z 0-9 . _ -` become `-` — and collisions get a numeric suffix (`-2`, `-3`, …).

> Changed in v0.4.x: filenames were previously the raw slide name (`slide-1.png`). The group prefix was added because two groups with identical slide names silently overwrote each other's files. Update any automation that matches on exact filenames.

## Locale export

Export a single locale:

```bash
node cli/index.mjs export \
  --project=./projects/my-app.json \
  --screenshots=./screenshots/raw \
  --output=./output/store \
  --locale=es
```

Export all locales defined in the project (each written to its own subfolder):

```bash
node cli/index.mjs export \
  --project=./projects/my-app.json \
  --screenshots=./screenshots/raw \
  --output=./output/store \
  --all-locales
```

## Locale manifest workflow

Generate a JSON manifest of all translatable strings in a project:

```bash
node cli/index.mjs locale-manifest \
  --project=./projects/my-app.json \
  --output=./locales/manifest.json
```

Import translated strings back into the project:

```bash
node cli/index.mjs locale-import \
  --project=./projects/my-app.json \
  --manifest=./locales/manifest.es.json \
  --locale=es \
  --output=./projects/my-app-es.json
```

## Optional flags

| Flag | Description |
|---|---|
| `--port` | Port for the local static server (default: 4321) |
| `--timeout` | Max milliseconds to wait for export completion (default: 60000) |

## Screenshots folder

The `--screenshots` folder should contain PNG files whose filenames match the `screenshotPath` values in the project layers (e.g. `01-dashboard.png`, `02-settings.png`). Filenames are matched case-sensitively.

Locale-specific screenshots can be named with a locale prefix (e.g. `es-01-dashboard.png`) and are auto-detected when exporting with `--locale`.
