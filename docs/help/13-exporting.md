---
id: exporting
number: 13
title: Exporting
group: DELIVER
---

- Export produces PNGs across every combination of **locale × format × slide group × slide** you've activated (e.g. English/iPhone/Slide 1, Spanish/iPhone/Slide 1, English/Android/Slide 1, and so on).
- Only formats you've added to your active export list get exported; Base never exports directly — it's just your authoring canvas.
- For pano/strip slide groups, choose to export them as separate PNGs (one per segment) or as one combined wide image for the whole panorama.
- Export straight from the browser (ZIP or folder download), or use the CLI (`node cli/index.mjs export ...`) for scripted/automated batch exports — same rendering pipeline either way, so results match exactly.
