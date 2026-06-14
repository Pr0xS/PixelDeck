#!/usr/bin/env node
/**
 * PixelDeck CLI
 * 
 * Usage:
 *   pixeldeck export --project=<path> --screenshots=<dir> --output=<dir>
 *   pixeldeck export --config=<batch.yaml>
 *   pixeldeck serve  # serve dist/ for development
 */
// Parse CLI args
const args = process.argv.slice(2)
const command = args[0]

function parseArgs(rawArgs) {
  const opts = {}
  for (const arg of rawArgs) {
    if (!arg.startsWith('--')) continue
    const [key, value = 'true'] = arg.slice(2).split('=')
    opts[key] = value
  }
  return opts
}

// --help / -h anywhere → print help and exit
if (args.includes('--help') || args.includes('-h') || !command) {
  printHelp()
  process.exit(0)
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
    console.error(`Unknown command: ${command}\n`)
    printHelp()
    process.exit(1)
}

function printHelp() {
  console.log(`
PixelDeck CLI

Commands:
  export          Export a project to PNG files
  locale-manifest Export a locale manifest JSON from a project
  locale-import   Import a locale manifest JSON into a project

Options for export:
  --project=<path>      Path to project JSON file
  --screenshots=<dir>   Directory containing screenshot PNG files
  --output=<dir>        Output directory for composed PNGs
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
  node cli/index.mjs locale-manifest --project=./project.json --output=./locales.json
  node cli/index.mjs locale-import --project=./project.json --manifest=./locales.json
`)
}
