# RTL rendering regression fixture

`tests/fixtures/rtl-text.json` contains synthetic Hebrew punctuation, styled text, mixed Latin/numeric content, niqqud, joined emoji, narrow wrapping, independent paragraphs and explicit direction cases.

The before/after PNGs were generated through the real CLI with the same fixture, locked dependencies and installed Chrome. The baseline is ef3328cccfe8526b0418fb154d7b7ae31c0c217f. The after image uses this patch. The temporary export runner selects the Chrome channel; it does not change rendering code.

- [Before](before.png)
- [After](after.png)

## Repeat

Run `npm run build`, then `node cli/index.mjs export --project=tests/fixtures/rtl-text.json --output=out/rtl --format=base` with Playwright Chromium installed.

For pixel checks against native canvas shaping, start `npm run dev -- --host 127.0.0.1 --port 4181`, then run `node scripts/rtl-browser-check.mjs`. Optional environment variables: PIXELDECK_TEST_CHANNEL=chrome, PIXELDECK_TEST_URL=http://127.0.0.1:4181/.

All eight native canvas comparisons passed in Chrome, for niqqud and joined/modified/flag emoji at letter spacing 0 and 2. Font and platform affect emoji artwork. This is targeted regression coverage, not full Unicode bidi conformance. Graphemes deliberately split by style boundaries and exhaustive caret behavior remain outside this validation.
