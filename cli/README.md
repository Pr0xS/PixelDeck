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
node cli/index.mjs export --help
```

## How it works

1. The CLI starts a local static server serving `dist/`
2. For each export job it opens a Playwright Chromium page
3. It injects `window.__EXPORT_CONFIG__` with the project JSON and screenshot data URLs
4. The app detects `__EXPORT_CONFIG__` and mounts the headless `ExportApp` renderer instead of the interactive editor
5. Each slide is captured via `stage.toDataURL()` and written to disk as a PNG

## Project file format

Save your project from the GUI using the **Save** button (or the Projects panel). The resulting `.json` file is the input for `--project`.

## Screenshots folder

The `--screenshots` folder should contain PNG files whose filenames match the `screenshotPath` values in the project layers (e.g. `01-dashboard.png`, `02-settings.png`). Filenames are matched case-sensitively.
