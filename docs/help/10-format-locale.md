---
id: format-locale
number: 10
title: Format × Locale editing
group: ADAPT
---

This is how PixelDeck lets you fine-tune a design for one specific platform, one specific language, or both — without affecting anything else.

- The top editing bar has two scopes: **amber = Format**, **teal = Locale**. A floating alert appears over the canvas whenever you're not on the fully shared Base + Default view, telling you exactly what's currently scoped.

<div class="my-5 rounded-xl border border-[rgba(124,110,246,0.22)] bg-[rgba(124,110,246,0.065)] px-4 py-3.5 text-[12px] leading-6 text-[#bcb5f5]">
  <div class="mb-1 text-[9px] font-bold uppercase tracking-[0.14em] opacity-80">Example</div>
  You switch to <strong>Android</strong> format and <strong>German</strong> locale, then move a text layer. That change applies <strong>only to German on Android</strong> — it does not affect English on Android, German on iPhone, or the shared Base layout.
  <div class="mt-3 flex flex-wrap items-center gap-2 text-[10px]">
    <span class="rounded-md border border-[rgba(242,184,75,0.25)] bg-[rgba(242,184,75,0.08)] px-2 py-1 text-[#e1bd68]">Android · Format</span>
    <span class="text-[#5f5f70]">×</span>
    <span class="rounded-md border border-[rgba(72,199,191,0.25)] bg-[rgba(72,199,191,0.08)] px-2 py-1 text-[#80d2cc]">German · Locale</span>
    <span class="text-[#5f5f70]">→</span>
    <span class="rounded-md border border-[rgba(124,110,246,0.28)] bg-[rgba(124,110,246,0.1)] px-2 py-1 text-[#b8afff]">German on Android only</span>
  </div>
</div>

- **Important**: layout changes don't apply while you're on Base with a non-default locale selected — switch to an actual platform format tab first to adjust position/size for that language.
- **Format-scope actions**: Reset format layout, Reset format visibility, Make format layers shared, Use format layout as shared (see **Formats & Families** for details).
- **Locale+Format-scope action**: Reset pairing layout — clears position/size adjustments for that exact locale+format combination only (e.g. just German-on-Android), leaving everything else untouched.
