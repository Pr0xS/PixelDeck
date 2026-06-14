# Contributing to PixelDeck

Thanks for helping improve PixelDeck. This project welcomes thoughtful human and AI-assisted contributions that keep the editor stable, understandable, and easy to maintain.

## Quick start

```bash
git clone https://github.com/<your-username>/pixeldeck.git
cd pixeldeck
npm install
npm run dev
```

The dev server starts a Vite app, usually at `http://localhost:5173`.

## How to contribute

### Bugs

- Search existing issues first.
- Include clear reproduction steps, expected behavior, actual behavior, and screenshots or exported project JSON when useful.
- Mention browser, Node version, and whether the issue affects the GUI, CLI export path, or both.

### Features

- Open an issue before large feature work so maintainers can confirm scope and fit.
- Prefer small, incremental changes over broad rewrites.
- Reuse existing layer, store, panel, and export patterns unless there is a clear reason not to.

### Pull requests

- Keep one concern per PR.
- Explain what changed and why.
- Include before/after screenshots or exported PNGs for visual changes.
- Paste the verification output listed below.

## Verification contract

Every contributor must run this gate before opening a PR and paste the command output in the PR description:

```bash
npm run lint       # must be clean
npm run typecheck  # must be clean
npm run build      # must succeed
npm test           # all tests must pass
```

Do not open a PR with known lint, type, or build failures. “It mostly works” is not enough.

## Commit style

Use Conventional Commits. Keep messages short, imperative, and scoped to the actual change.

Examples:

- `feat: add localized export filenames`
- `fix: preserve phone screenshot crop on resize`
- `refactor: simplify layer selection helpers`
- `chore: update eslint configuration`
- `docs: document CLI export workflow`

## PR scope discipline

- One concern per PR.
- No drive-by reformatting.
- No dependency bumps inside feature PRs.
- No unrelated cleanup mixed with bug fixes.
- Avoid broad rewrites unless the issue or proposal explicitly calls for one.

## Adding a new layer type

Follow the 6-step recipe in [`AGENTS.md`](./AGENTS.md#how-to-add-a-new-layer-type). It covers the domain type, store factory/action, canvas renderer, layer router, properties panel, and toolbar entry.

Do not invent shortcuts around that flow unless the PR explains why the layer does not need one of those integration points.

## AI-assisted contributions

AI-assisted PRs are welcome and encouraged. The quality bar is exactly the same regardless of author.

If you use an AI tool:

- Note the tool in the PR description, for example: “AI assistance: GitHub Copilot” or “AI assistance: ChatGPT”.
- Verify exact API names before using them.
- Do not invent Zustand store actions. Check `src/store/index.ts` first.
- Check `AGENTS.md` before using any store method, layer convention, asset convention, or export behavior.
- Paste the same verification output required of every PR.

Anti-hallucination rules:

- Use exact filenames and exported names from the repository.
- Prefer reading the relevant source file over guessing.
- Do not add tests for a framework that is not installed.
- Do not “simplify” behavior called out as intentional in `AGENTS.md`.

## Design principles

- YAGNI: do not build future features before they are needed.
- Choose the simplest design that works.
- New abstractions must earn their keep.
- Prefer extending existing patterns over introducing new ones.
- Keep visual, export, and state changes explicit and easy to review.

## What NOT to do

- Do not “simplify” anything in the `AGENTS.md` **DO NOT SIMPLIFY** section.
- Do not add tests against a framework that is not installed.
- Do not run formatters across unrelated files.
- Do not invent store action names; check `src/store/index.ts` first.
- Do not mix dependency updates with feature or bug-fix work.
- Do not commit generated output unless maintainers requested it.

## Development notes

- CLI export requires `npm run build` before use because it serves the built `dist/` app.
- Playwright browsers may need to be installed once in a new environment.
- Use `node cli/index.mjs --help` to inspect all CLI options.
- The project uses ESM; CLI files use `.mjs`.
- The path alias `@/` points to `src/`.
