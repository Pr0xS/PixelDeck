#!/usr/bin/env node
import { parseArgs } from './args.mjs'

/**
 * PixelDeck CLI
 * 
 * Usage:
 *   pixeldeck export --project=<path> --screenshots=<dir> --output=<dir>
 *   pixeldeck export --config=<batch.yaml>
 *   pixeldeck serve  # serve dist/ for development
 */
async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  // --help / -h anywhere → print help and exit successfully
  if (args.includes('--help') || args.includes('-h') || !command) {
    printHelp()
    return
  }

  switch (command) {
    case 'export': {
      const opts = parseArgs(args.slice(1))
      const { runExport } = await import('./export.mjs')
      await runExport(opts)
      break
    }

    case 'locale-manifest': {
      const opts = parseArgs(args.slice(1))
      const { runLocaleManifest } = await import('./locale.mjs')
      await runLocaleManifest(opts)
      break
    }

    case 'locale-import': {
      const opts = parseArgs(args.slice(1))
      const { runLocaleImport } = await import('./locale.mjs')
      await runLocaleImport(opts)
      break
    }

    default:
      throw new Error(`Unknown command: ${command}. Run with --help to see available commands.`)
  }
}

function printHelp() {
  console.log(`
PixelDeck CLI

Commands:
  export          Export a project to PNG files
  locale-manifest Export a locale manifest JSON from a project
  locale-import   Import a locale manifest JSON into a project

Options for export:
  --project=<path>      Project file: raw project JSON, project-export JSON bundle
                        (v1/v2), or a .zip project export
  --screenshots=<dir>   Directory of screenshot images. Files are matched by original
                        file name and OVERRIDE images embedded in a bundle/zip
  --output=<dir>        Output directory for composed PNGs
  --format=<id>         Export a format id; repeat or use comma-separated ids.
                        Defaults to the project's active export formats.
  --allow-missing       Continue (with placeholders) if referenced images are missing;
                        by default the export fails and lists the missing images
  --locale=<code>       Export only this locale (e.g. --locale=es)
  --all-locales         Export all locales defined in the project
  --config=<path>       Batch config YAML (alternative to single project)
  --port=<n>            Port for the local server (default: 4321)
  --timeout=<ms>        Max wait for export (default: 60000)

Options for locale-manifest:
  --project=<path>      Path to project JSON file
  --output=<path>       Output path for manifest JSON (default: locale-manifest.json)

Options for locale-import:
  --project=<path>      Path to project JSON file
  --manifest=<path>     Path to locale manifest JSON to import
  --output=<path>       Output path for updated project JSON (default: overwrites --project)

Examples:
  node cli/index.mjs export --project=./project.json --output=./output
  node cli/index.mjs export --project=./project.json --output=./output --locale=es
  node cli/index.mjs export --project=./project.json --output=./output --all-locales
  node cli/index.mjs export --project=./project.json --output=./output --format=iphone-69 --format=ipad-13
  node cli/index.mjs locale-manifest --project=./project.json --output=./locales.json
  node cli/index.mjs locale-import --project=./project.json --manifest=./locales.json
`)
}

try {
  await main()
} catch (error) {
  const verbose = process.argv.includes('--verbose') || Boolean(process.env.DEBUG)
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[PixelDeck CLI] ${verbose && error instanceof Error ? error.stack ?? message : message}`)
  process.exitCode = 1
}
