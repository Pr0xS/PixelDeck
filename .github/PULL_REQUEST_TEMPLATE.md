## What & why
<!-- One paragraph. Link the issue this closes, if any: Closes #___ -->

## How was this built?
- [ ] Hand-written
- [ ] AI-assisted (tool: ________)
- [ ] Mostly AI-generated, human-reviewed

## Verification — paste actual output, don't just check the boxes

<details>
<summary>Command output</summary>

```
$ npm run lint

$ npm run typecheck

$ npm run build
```

</details>

- [ ] `npm run lint` clean (no errors or warnings)
- [ ] `npm run typecheck` clean
- [ ] `npm run build` succeeds
- [ ] Tested manually in the editor (`npm run dev`) — describe what you exercised below
- [ ] CLI export path still works if touched (`node cli/index.mjs export ...`)

**Manual test description:**
<!-- What did you actually click/use in the editor to verify this change? -->

## Scope check
- [ ] Only touches files relevant to this change (no drive-by reformatting or import churn)
- [ ] No unrelated dependency bumps
- [ ] If I added a new layer type, I completed ALL 6 steps in AGENTS.md
- [ ] I did not "simplify" anything in the AGENTS.md "DO NOT SIMPLIFY" section

## Visual change?
<!-- Required for any canvas or render change: attach a before/after screenshot or GIF -->

## AI self-audit *(fill in if AI-assisted)*
- [ ] Every store action / API I call exists in `src/store/index.ts` — I didn't invent method names
- [ ] I followed existing patterns (layer IDs via `nanoid()`, `@/` path alias, FillValue guard, etc.)
- [ ] I did not add tests against a framework that isn't installed in the project
