---
id: localization
number: 9
title: Localization (Locales)
group: ADAPT
---

- A **locale** is a language variant of your project. One locale is your project's **Default** — the source-of-truth language everything else falls back to.
- Editing while the **Default** locale is active updates your project's base content. Editing while a **non-default** locale is active only changes that locale's translation, leaving Default untouched.
- Because of this, double-clicking to edit text directly on the canvas only works in the Default locale — for other locales, translate through the Localization view instead, so the base content stays the single reliable source.
- **Promoting a locale to Default** keeps the old default around as a regular locale, and automatically fills in anything missing in the promoted locale using the old default's content — nothing is left blank.
- The **Localization view** is a dedicated table for translating everything at once: one row per text layer, one column per locale, with bulk/AI-assisted translation, upload, and per-cell editing — instead of switching locales one at a time on the canvas.

## Hebrew and right-to-left text

Hebrew is available as `he` in the language picker; search for Hebrew, עברית, or the locale code.

Select a text layer and use **Text direction** in its properties: **Auto** detects each paragraph, **RTL** sets a right-to-left base, and **LTR** sets a left-to-right base. Direction controls reading order independently of Left / Center / Right alignment. Existing projects without a direction field default to Auto. The same direction applies in the editor, localization text editor and PNG export.

Wrapped lines retain paragraph context. Hard wrapping keeps Hebrew combining marks and joined emoji together. Complete Unicode bidi conformance and caret behavior for every script are not implied.
