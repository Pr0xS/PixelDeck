import type { ReactNode } from 'react'
import { Callout, GuideItem, GuideList, Kbd, Li, P, SectionHeader, ShortcutTable, Strong } from './HelpPrimitives'

export type HelpSectionId =
  | 'introduction' | 'shortcuts' | 'projects' | 'templates' | 'slides' | 'layers' | 'properties'
  | 'formats' | 'localization' | 'format-locale' | 'brand-kit' | 'assets' | 'exporting'
  | 'ai-features'

type HelpGroup = 'GETTING STARTED' | 'DESIGN' | 'ADAPT' | 'DELIVER'

interface HelpSection {
  id: HelpSectionId
  number: number
  title: string
  group: HelpGroup
  content: ReactNode
}

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'introduction', number: 1, title: 'Introduction', group: 'GETTING STARTED',
    content: (
      <P>PixelDeck is a visual editor for designing App Store and Play Store screenshot sets. You build one or more slide groups, arrange layers on them (device mockups, text, images, shapes, backgrounds), adjust per-platform formats and per-language content, then export PNGs — either from the browser or via the CLI for batch/automated pipelines.</P>
    ),
  },
  {
    id: 'shortcuts', number: 2, title: 'Keyboard Shortcuts', group: 'GETTING STARTED',
    content: (
      <div>
        <SectionHeader>Canvas &amp; View</SectionHeader>
        <ShortcutTable rows={[
          { keys: <><Kbd>Escape</Kbd></>, desc: 'Exit group-edit mode' },
          { keys: <><Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd> + <Kbd>0</Kbd></>, desc: 'Fit canvas to window' },
          { keys: <><Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd> + <Kbd>1</Kbd></>, desc: 'Zoom to 100%' },
        ]} />
        <SectionHeader>Layers</SectionHeader>
        <ShortcutTable rows={[
          { keys: <><Kbd>Arrow keys</Kbd></>, desc: 'Nudge 1px (Shift = 10px)' },
          { keys: <><Kbd>Delete</Kbd> / <Kbd>Backspace</Kbd></>, desc: 'Remove selected layer(s)' },
          { keys: <><Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd> + <Kbd>D</Kbd></>, desc: 'Duplicate selected layer' },
        ]} />
        <SectionHeader>Copy &amp; Paste</SectionHeader>
        <ShortcutTable rows={[
          { keys: <><Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd> + <Kbd>C</Kbd></>, desc: 'Copy selected layers' },
          { keys: <><Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd> + <Kbd>X</Kbd></>, desc: 'Cut' },
          { keys: <><Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd> + <Kbd>V</Kbd></>, desc: 'Paste' },
          { keys: <><Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd> + <Kbd>Alt</Kbd> + <Kbd>C</Kbd></>, desc: 'Copy layer style' },
          { keys: <><Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd> + <Kbd>Alt</Kbd> + <Kbd>V</Kbd></>, desc: 'Paste layer style' },
        ]} />
        <SectionHeader>Groups</SectionHeader>
        <ShortcutTable rows={[
          { keys: <><Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd> + <Kbd>G</Kbd></>, desc: 'Group selected layers' },
          { keys: <><Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd> + <Kbd>Shift</Kbd> + <Kbd>G</Kbd></>, desc: 'Dissolve selected group' },
        ]} />
        <SectionHeader>History</SectionHeader>
        <ShortcutTable rows={[
          { keys: <><Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd> + <Kbd>Z</Kbd></>, desc: 'Undo' },
          { keys: <><Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd> + <Kbd>Shift</Kbd> + <Kbd>Z</Kbd> or <Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd> + <Kbd>Y</Kbd></>, desc: 'Redo' },
        ]} />
      </div>
    ),
  },
  {
    id: 'projects', number: 3, title: 'Projects', group: 'GETTING STARTED',
    content: (
      <GuideList>
        <Li>A <Strong>Project</Strong> is your full working document: settings and all your slide groups. Everything you edit lives inside a project.</Li>
        <Li>Projects autosave in your browser's local storage as you work; their image assets are stored separately (IndexedDB). Projects are <Strong>not cloud-synced</Strong> — they live only on this browser/device unless you export them.</Li>
        <Li><Strong>Create</Strong>: start a new project, or duplicate an existing one from the Projects panel.</Li>
        <Li><Strong>Open / Switch</Strong>: pick any saved project from your list — PixelDeck saves your current project first, automatically.</Li>
        <Li><Strong>Rename / Delete</Strong>: renaming is instant; deleting a project is permanent and also removes its saved assets.</Li>
        <Li><Strong>Export Project</Strong>: produces a portable JSON bundle with all your images embedded, so it can be re-imported on another browser or machine without missing assets — use this for backups or moving computers.</Li>
        <Li><Strong>Import Project</Strong>: loads a project bundle (with its embedded assets) as a new project.</Li>
      </GuideList>
    ),
  },
  {
    id: 'templates', number: 4, title: 'Templates', group: 'GETTING STARTED',
    content: (
      <GuideList>
        <Li>A <Strong>Template</Strong> is a lighter, shareable version of a project's layout — meant to hand off a design's structure without your actual screenshots baked in.</Li>
        <Li><Strong>Included</Strong>: slide layout, layer positions/styles, brand colors (so brand color references keep working), and general settings like default size/locale.</Li>
        <Li><Strong>Excluded</Strong>: your actual screenshots and images — image layers come through as empty placeholders for whoever imports the template to fill in with their own.</Li>
        <Li>Turn a project into a template with <Strong>Export as Template</Strong>.</Li>
        <Li>Import a template as a <Strong>brand-new project</Strong>, or <Strong>append</Strong> a template's slide groups onto your current project — handy for pulling in one specific layout pattern without starting over.</Li>
      </GuideList>
    ),
  },
  {
    id: 'slides', number: 5, title: 'Slides & Slide Groups', group: 'GETTING STARTED',
    content: (
      <GuideList>
        <Li>A <Strong>Slide Group</Strong> is one design unit in your project. Most produce a single screenshot.</Li>
        <Li><Strong>Single (1)</Strong> = one normal screenshot. <Strong>Pano (×2)</Strong> / <Strong>Strip (×3)</Strong> = a panoramic design spanning 2 or 3 adjacent screenshots as one continuous wide image, later split into that many exported PNGs.</Li>
        <Li><Strong>Compensate / Gap px</Strong> (pano &amp; strip only): "Compensate" shows a visual gap between segments in the editor/preview, representing the physical gap between adjacent screenshots in a real App Store listing, so you can design around it. "Gap px" controls how wide that visual gap is. It's a design aid — turning compensation off treats the pano canvas as continuous.</Li>
        <Li>Drag slide groups in the navigator to reorder; rename, duplicate, or delete a group (at least one must always remain).</Li>
      </GuideList>
    ),
  },
  {
    id: 'layers', number: 6, title: 'Layers', group: 'DESIGN',
    content: (
      <div>
        <P>Eight layer types:</P>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {[
            ['Background', "the slide's backdrop: gradient or image fill, with optional tint overlay, blur, noise texture, and decorative glow accents. Always sits behind everything else."],
            ['Phone', 'a device mockup (iPhone, Android, etc.) framing your screenshot. Choose the model, attach a screenshot, control how it fits the screen, optionally show a status bar.'],
            ['Text', 'an editable text box: font, size, weight, color, alignment, spacing, and rich formatting (bold/italic/underline on parts of the same text).'],
            ['Image', 'a placed image (logo, icon, illustration) — resizable, with optional rounded corners.'],
            ['Shape', 'a vector shape (rectangle, ellipse, triangle, star, arrow, etc.) with fill, stroke, and corner radius — useful for decorative blocks, dividers, or badges.'],
            ['Emoji', 'a standalone emoji rendered large, like a lightweight icon.'],
            ['Brand', "your app's logo + name combined into one lockup, with control over layout direction, typography, and spacing."],
            ['Group', 'a container that lets you move, scale, and rotate several layers together as one unit.'],
          ].map(([name, description], index) => (
            <div key={name} className="rounded-xl border border-[rgba(255,255,255,0.065)] bg-[rgba(255,255,255,0.018)] p-3.5">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="font-mono text-[9px] text-[#6358ca]">{String(index + 1).padStart(2, '0')}</span>
                <Strong>{name}</Strong>
              </div>
              <p className="m-0 text-[11px] leading-5 text-[#888896]">{description}</p>
            </div>
          ))}
        </div>

        <SectionHeader>Layers panel</SectionHeader>
        <P>Drag to reorder; drag a layer onto a group to nest it, drag out to un-nest; toggle visibility and lock per layer. Background is always present and can only be hidden, not reordered. Select 2+ layers and group them; dissolve a group back into individual layers.</P>

        <SectionHeader>Alignment</SectionHeader>
        <P>Six one-click buttons (left/center/right, top/middle/bottom). One layer selected → aligns to the slide edges. Multiple selected → they align to each other's combined bounding box.</P>

        <SectionHeader>Phone screenshot fit modes</SectionHeader>
        <GuideList>
          <Li><Strong>Cover</Strong> — fills the screen area completely, cropping overflow. Best for edge-to-edge screenshots.</Li>
          <Li><Strong>Contain</Strong> — shows the whole screenshot, with empty space if the aspect ratio doesn't match. Nothing is cropped.</Li>
          <Li><Strong>Fill</Strong> — stretches the screenshot to exactly match the screen area. Can distort the image if aspect ratios differ.</Li>
        </GuideList>
      </div>
    ),
  },
  {
    id: 'properties', number: 7, title: 'Properties Panel', group: 'DESIGN',
    content: (
      <P>Context-sensitive: shows different controls depending on the selected layer's type, organized into Layout / Style / Content tabs. Common to most layers: position, rotation, opacity, blur, drop shadow. You can copy/paste style between layers of the same type to quickly match formatting.</P>
    ),
  },
  {
    id: 'formats', number: 8, title: 'Canvas Formats', group: 'ADAPT',
    content: (
      <GuideList>
        <Li>A <Strong>format</Strong> is the canvas size/profile you're designing for: <Strong>Base</Strong> (your shared authoring canvas), a built-in platform preset (iPhone, Android, iPad, Android Tablet), or a <Strong>custom size</Strong> you define.</Li>
        <Li>Base is your source of truth. Activate platform formats to fine-tune how a design looks on that specific device size — only formats you've activated get exported (Base itself is never exported directly).</Li>
        <Li>Moving or resizing something while on a platform format tab (not Base) saves that change <Strong>only for that format</Strong> — Base and other formats are untouched. Switching formats auto-scales your Base layout to fit the new size, then layers any format-specific tweaks on top.</Li>
        <Li>
          <Strong>Ways to reset/restore a format-specific change:</Strong>
          <ul className="mt-3 space-y-2.5 border-l border-[rgba(124,110,246,0.18)] pl-4">
            <li><Strong>Reset format layout</Strong> — wipes all position/size tweaks made for this format, reverting it to the auto-scaled Base layout. Use when a platform version has drifted too far and you want a clean slate.</li>
            <li><Strong>Reset format visibility</Strong> — clears any show/hide overrides set for this format only.</li>
            <li><Strong>Make format layers shared</Strong> — if you added new layers while working in this format, promotes them into the shared Base layer stack so they show up everywhere, not just here.</li>
            <li><Strong>Use format layout as shared</Strong> — the reverse: takes this format's current layout and makes it the new Base layout. Because this changes Base, it can also affect how other formats look, since they auto-scale from Base.</li>
          </ul>
        </Li>
      </GuideList>
    ),
  },
  {
    id: 'localization', number: 9, title: 'Localization (Locales)', group: 'ADAPT',
    content: (
      <GuideList>
        <Li>A <Strong>locale</Strong> is a language variant of your project. One locale is your project's <Strong>Default</Strong> — the source-of-truth language everything else falls back to.</Li>
        <Li>Editing while the <Strong>Default</Strong> locale is active updates your project's base content. Editing while a <Strong>non-default</Strong> locale is active only changes that locale's translation, leaving Default untouched.</Li>
        <Li>Because of this, double-clicking to edit text directly on the canvas only works in the Default locale — for other locales, translate through the Localization view instead, so the base content stays the single reliable source.</Li>
        <Li><Strong>Promoting a locale to Default</Strong> keeps the old default around as a regular locale, and automatically fills in anything missing in the promoted locale using the old default's content — nothing is left blank.</Li>
        <Li>The <Strong>Localization view</Strong> is a dedicated table for translating everything at once: one row per text layer, one column per locale, with bulk/AI-assisted translation, upload, and per-cell editing — instead of switching locales one at a time on the canvas.</Li>
      </GuideList>
    ),
  },
  {
    id: 'format-locale', number: 10, title: 'Format × Locale editing', group: 'ADAPT',
    content: (
      <div>
        <P>This is how PixelDeck lets you fine-tune a design for one specific platform, one specific language, or both — without affecting anything else.</P>
        <GuideList>
          <GuideItem tone="amber">The top editing bar has two scopes: <Strong>amber = Format</Strong>, <span className="font-semibold text-[#8ad8d2]">teal = Locale</span>. A floating alert appears over the canvas whenever you're not on the fully shared Base + Default view, telling you exactly what's currently scoped.</GuideItem>
        </GuideList>
        <Callout label="Example" tone="purple">
          You switch to <Strong>Android</Strong> format and <Strong>German</Strong> locale, then move a text layer. That change applies <Strong>only to German on Android</Strong> — it does not affect English on Android, German on iPhone, or the shared Base layout.
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]">
            <span className="rounded-md border border-[rgba(242,184,75,0.25)] bg-[rgba(242,184,75,0.08)] px-2 py-1 text-[#e1bd68]">Android · Format</span>
            <span className="text-[#5f5f70]">×</span>
            <span className="rounded-md border border-[rgba(72,199,191,0.25)] bg-[rgba(72,199,191,0.08)] px-2 py-1 text-[#80d2cc]">German · Locale</span>
            <span className="text-[#5f5f70]">→</span>
            <span className="rounded-md border border-[rgba(124,110,246,0.28)] bg-[rgba(124,110,246,0.1)] px-2 py-1 text-[#b8afff]">German on Android only</span>
          </div>
        </Callout>
        <GuideList>
          <GuideItem tone="amber"><Strong>Important</Strong>: layout changes don't apply while you're on Base with a non-default locale selected — switch to an actual platform format tab first to adjust position/size for that language.</GuideItem>
          <Li><Strong>Format-scope actions</Strong>: Reset format layout, Reset format visibility, Make format layers shared, Use format layout as shared (see section 8 for details).</Li>
          <GuideItem tone="teal"><Strong>Locale+Format-scope action</Strong>: Reset pairing layout — clears position/size adjustments for that exact locale+format combination only (e.g. just German-on-Android), leaving everything else untouched.</GuideItem>
        </GuideList>
      </div>
    ),
  },
  {
    id: 'brand-kit', number: 11, title: 'Brand Kit', group: 'ADAPT',
    content: (
      <P>Save your brand colors once, then reuse them anywhere a color picker appears (text, shapes, phone borders/status bar, backgrounds) instead of re-entering the same hex value everywhere. Change a brand color later and everything using it updates automatically, since layers reference it by a stable token rather than a raw value. Brand colors also travel with templates, so those references keep working after import.</P>
    ),
  },
  {
    id: 'assets', number: 12, title: 'Asset Library', group: 'DELIVER',
    content: (
      <P>Upload individual images, multiple files at once, or an entire folder. Assets are grouped automatically by folder name for easier browsing. Use an asset by dragging it onto the canvas, or select a layer first and click the asset — it goes to the right place: sets a phone's screenshot, replaces an image layer's picture, or adds a new image layer. Assets are stored per-project, so switching projects shows only that project's own images.</P>
    ),
  },
  {
    id: 'exporting', number: 13, title: 'Exporting', group: 'DELIVER',
    content: (
      <GuideList>
        <Li>Export produces PNGs across every combination of <Strong>locale × format × slide group × slide</Strong> you've activated (e.g. English/iPhone/Slide 1, Spanish/iPhone/Slide 1, English/Android/Slide 1, and so on).</Li>
        <Li>Only formats you've added to your active export list get exported; Base never exports directly — it's just your authoring canvas.</Li>
        <Li>For pano/strip slide groups, choose to export them as separate PNGs (one per segment) or as one combined wide image for the whole panorama.</Li>
        <Li>Export straight from the browser (ZIP or folder download), or use the CLI (<code className="rounded bg-[#0f0f13] px-1.5 py-1 font-mono text-[11px] text-[#c8c3ef]">node cli/index.mjs export ...</code>) for scripted/automated batch exports — same rendering pipeline either way, so results match exactly.</Li>
      </GuideList>
    ),
  },
  {
    id: 'ai-features', number: 14, title: 'AI Features', group: 'DELIVER',
    content: (
      <P>The Localization view includes AI-assisted translation: pick a provider (OpenAI, OpenRouter, Google Gemini, or any custom OpenAI-compatible endpoint), choose a model, and translate text layers automatically instead of typing every language by hand. You'll need your own API key for whichever provider you choose — it's stored only in your browser and sent directly to that provider, never through a PixelDeck server.</P>
    ),
  },
]
