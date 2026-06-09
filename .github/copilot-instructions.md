# AI IDE Instructions

PixelDeck is a React + TypeScript visual editor for designing App Store and Play Store screenshot layouts. It uses Konva/react-konva for the canvas, Zustand/zundo for editor state and undo, a separate asset store, Vite for the GUI, and Playwright for headless CLI PNG export.

Read [`AGENTS.md`](../AGENTS.md) first before making changes. It is the canonical AI navigation guide for file locations, layer patterns, store API, export behavior, and hard-won decisions.

## Key rules

- Path alias: `@/` maps to `src/`.
- Store actions live in `src/store/index.ts`; check there before using any action name.
- Layer IDs must come from `nanoid()`.
- FillValue guard: always check `typeof fill === 'string'` before a gradient branch.
- New layer type: follow the 6-step checklist in `AGENTS.md`.
- Verification before finishing: `npm run lint && npm run typecheck && npm run build`.

## Read these docs

- [`AGENTS.md`](../AGENTS.md) — implementation map and conventions.
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — contribution, PR, and verification rules.

## DO NOT touch

- `.engram/`
- `dist/`
- `node_modules/`
- The Konva rotation pivot logic using `offsetX`/`offsetY`.
- The asset store's intentionally non-undoable design.
