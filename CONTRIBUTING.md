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

## Branching & releases

PixelDeck follows **GitHub Flow** — `main` is the only long-lived branch (there is no `dev`).

- Create a short-lived branch per change, open a PR against `main`, delete the branch after merge.
- `main` is protected: PRs only, no direct pushes (no exceptions, including for maintainers). Required checks: `Quality · Node 20.x`/`22.x` (lint, typecheck, build, test) and `CLI smoke test`. Linear history is required, so PRs are **squash-merged** using the PR title as the resulting commit message — keep PR titles as valid Conventional Commits (`feat: ...`, `fix: ...`, etc.), the same rule as [Commit style](#commit-style) above. This is enforced automatically by `.github/workflows/pr-title-lint.yml` (kept as a lightweight convention check, independent of any release tooling).
- **Releases are manual.** There is no release automation — you cut a release yourself:
  1. Open a PR that bumps `"version"` in `package.json` to the next semver value: `feat:` commits since the last tag → bump minor; only `fix:`/`chore:`/etc. → bump patch; a breaking change → bump major.
  2. In that same PR, add a new `## [X.Y.Z] - YYYY-MM-DD` section at the top of `CHANGELOG.md` (under `## [Unreleased]`), following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format, summarizing what's notable since the last release.
  3. Merge the PR to `main`.
  4. Tag and publish from `main`:
     ```bash
     git checkout main && git pull
     git tag vX.Y.Z
     git push origin vX.Y.Z
     gh release create vX.Y.Z --title "vX.Y.Z" --notes-from-tag
     ```
     (or via the GitHub UI: **Releases → Draft a new release**, pick the tag, paste in the CHANGELOG entry as notes.)
- **Dependabot** (`.github/dependabot.yml`) opens grouped update PRs: `npm` weekly, `github-actions` monthly. Major version bumps are never opened automatically — upgrade those manually when ready.
  - `dependency-type: development` patch/minor updates auto-merge once CI is green (`.github/workflows/dependabot-auto-merge.yml`).
  - `dependency-type: production` updates — including Dependabot security updates — always require manual review and merge. The app has no automated visual-regression coverage for the Konva canvas, so a blind auto-merge on a runtime dependency (Konva, React, etc.) is not considered safe, even for a patch-level security fix.

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
