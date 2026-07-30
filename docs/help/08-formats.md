---
id: formats
number: 8
title: Formats & Families
group: ADAPT
---

PixelDeck adapts one design along two independent axes: **format families** (which kind of device you're designing for) and **formats** (the exact canvas size within that family). Locale layers on top of both — see the next two sections.

## Format families

- A **format family** is a device category: **Phone**, **Tablet**, **Watch**, **Desktop**, **TV**, **VR**, or **Game**. Every slide group belongs to exactly one family.
- Each family has its own Base authoring canvas and its own default device mockup — switch to Tablet and Phone mockups rebase onto iPad/Android Tablet automatically; switch to Watch and they rebase onto Apple Watch/Wear OS, and so on.
- The family switcher in the editing bar swaps your whole workspace to that family's slide groups, active format, and last-viewed zoom. It never touches another family's layouts or content.
- **Creating a new family** forks your current design into it: pick a source (Base or an existing format), and PixelDeck scales a copy of those slide groups to fit the new family's anchor canvas. From then on the two families are fully independent — edit one without affecting the other.
- Slides keep a stable identity across families, so "Slide 2" in Phone and "Slide 2" in Tablet are recognized as the same conceptual slide even once their layouts diverge completely. This is what makes **Bring content from…**, below, possible.

## Formats within a family

- A **format** is the canvas size/profile you're designing for within a family: **Base** (that family's shared authoring canvas), a built-in platform preset (e.g. iPhone / Android for Phone; iPad / Android Tablet for Tablet), or a **custom size** you define.
- Base is your source of truth for that family. Activate platform formats to fine-tune how a design looks on that specific device size — only formats you've activated get exported (Base itself is never exported directly).
- Moving or resizing something while on a platform format tab (not Base) saves that change **only for that format** — Base and other formats are untouched. Switching formats auto-scales your Base layout to fit the new size, then layers any format-specific tweaks on top.
- **Ways to reset/restore a format-specific change:**
  - **Reset format layout** — wipes all position/size tweaks made for this format, reverting it to the auto-scaled Base layout. Use when a platform version has drifted too far and you want a clean slate.
  - **Reset format visibility** — clears any show/hide overrides set for this format only.
  - **Make format layers shared** — if you added new layers while working in this format, promotes them into the shared Base layer stack so they show up everywhere, not just here.
  - **Use format layout as shared** — the reverse: takes this format's current layout and makes it the new Base layout. Because this changes Base, it can also affect how other formats look, since they auto-scale from Base.

## Copying content across families

- **Bring content from…** (in the editing bar's family menu) pulls text and images from the matching slide in another family into your current slide — e.g. reuse the headlines and screenshots you already wrote for Phone while designing Tablet.
- It only touches **content** — text and images — never layout: position, size, and per-family formatting stay exactly as you've set them, so a wide Tablet layout isn't squashed into a Phone one.
- Before confirming, it previews every layer that would change; layers with no counterpart slide, or whose type/structure doesn't match, are listed as skipped rather than guessed at.
