---
id: layers
number: 6
title: Layers
group: DESIGN
---

Eight layer types:

<div class="mt-4 grid gap-2.5 sm:grid-cols-2">
  <div class="rounded-xl border border-[rgba(255,255,255,0.065)] bg-[rgba(255,255,255,0.018)] p-3.5">
    <div class="mb-1.5 flex items-center gap-2"><span class="font-mono text-[9px] text-[#6358ca]">01</span><strong class="font-semibold text-[#dedee8]">Background</strong></div>
    <p class="m-0 text-[11px] leading-5 text-[#888896]">the slide's backdrop: gradient or image fill, with optional tint overlay, blur, noise texture, and decorative glow accents. Always sits behind everything else.</p>
  </div>
  <div class="rounded-xl border border-[rgba(255,255,255,0.065)] bg-[rgba(255,255,255,0.018)] p-3.5">
    <div class="mb-1.5 flex items-center gap-2"><span class="font-mono text-[9px] text-[#6358ca]">02</span><strong class="font-semibold text-[#dedee8]">Phone</strong></div>
    <p class="m-0 text-[11px] leading-5 text-[#888896]">a device mockup (iPhone, Android, etc.) framing your screenshot. Choose the model, attach a screenshot, control how it fits the screen, optionally show a status bar.</p>
  </div>
  <div class="rounded-xl border border-[rgba(255,255,255,0.065)] bg-[rgba(255,255,255,0.018)] p-3.5">
    <div class="mb-1.5 flex items-center gap-2"><span class="font-mono text-[9px] text-[#6358ca]">03</span><strong class="font-semibold text-[#dedee8]">Text</strong></div>
    <p class="m-0 text-[11px] leading-5 text-[#888896]">an editable text box: font, size, weight, color, alignment, spacing, and rich formatting (bold/italic/underline on parts of the same text).</p>
  </div>
  <div class="rounded-xl border border-[rgba(255,255,255,0.065)] bg-[rgba(255,255,255,0.018)] p-3.5">
    <div class="mb-1.5 flex items-center gap-2"><span class="font-mono text-[9px] text-[#6358ca]">04</span><strong class="font-semibold text-[#dedee8]">Image</strong></div>
    <p class="m-0 text-[11px] leading-5 text-[#888896]">a placed image (logo, icon, illustration) — resizable, with optional rounded corners.</p>
  </div>
  <div class="rounded-xl border border-[rgba(255,255,255,0.065)] bg-[rgba(255,255,255,0.018)] p-3.5">
    <div class="mb-1.5 flex items-center gap-2"><span class="font-mono text-[9px] text-[#6358ca]">05</span><strong class="font-semibold text-[#dedee8]">Shape</strong></div>
    <p class="m-0 text-[11px] leading-5 text-[#888896]">a vector shape (rectangle, ellipse, triangle, star, arrow, etc.) with fill, stroke, and corner radius — useful for decorative blocks, dividers, or badges.</p>
  </div>
  <div class="rounded-xl border border-[rgba(255,255,255,0.065)] bg-[rgba(255,255,255,0.018)] p-3.5">
    <div class="mb-1.5 flex items-center gap-2"><span class="font-mono text-[9px] text-[#6358ca]">06</span><strong class="font-semibold text-[#dedee8]">Emoji</strong></div>
    <p class="m-0 text-[11px] leading-5 text-[#888896]">a standalone emoji rendered large, like a lightweight icon.</p>
  </div>
  <div class="rounded-xl border border-[rgba(255,255,255,0.065)] bg-[rgba(255,255,255,0.018)] p-3.5">
    <div class="mb-1.5 flex items-center gap-2"><span class="font-mono text-[9px] text-[#6358ca]">07</span><strong class="font-semibold text-[#dedee8]">Brand</strong></div>
    <p class="m-0 text-[11px] leading-5 text-[#888896]">your app's logo + name combined into one lockup, with control over layout direction, typography, and spacing.</p>
  </div>
  <div class="rounded-xl border border-[rgba(255,255,255,0.065)] bg-[rgba(255,255,255,0.018)] p-3.5">
    <div class="mb-1.5 flex items-center gap-2"><span class="font-mono text-[9px] text-[#6358ca]">08</span><strong class="font-semibold text-[#dedee8]">Group</strong></div>
    <p class="m-0 text-[11px] leading-5 text-[#888896]">a container that lets you move, scale, and rotate several layers together as one unit.</p>
  </div>
</div>

## Layers panel

Drag to reorder; drag a layer onto a group to nest it, drag out to un-nest; toggle visibility and lock per layer. Background is always present and can only be hidden, not reordered. Select 2+ layers and group them; dissolve a group back into individual layers.

## Alignment

Six one-click buttons (left/center/right, top/middle/bottom). One layer selected → aligns to the slide edges. Multiple selected → they align to each other's combined bounding box.

## Phone screenshot fit modes

- **Cover** — fills the screen area completely, cropping overflow. Best for edge-to-edge screenshots.
- **Contain** — shows the whole screenshot, with empty space if the aspect ratio doesn't match. Nothing is cropped.
- **Fill** — stretches the screenshot to exactly match the screen area. Can distort the image if aspect ratios differ.
