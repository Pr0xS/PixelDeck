import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { Callout, GuideItem, GuideList, Kbd, P, SectionHeader, Strong } from './HelpPrimitives'

/**
 * Renders one help chapter's Markdown body using the same visual language as
 * the original hand-written HelpContent.tsx, by mapping standard Markdown/GFM
 * elements onto the existing HelpPrimitives components:
 *
 *   ## heading      -> SectionHeader
 *   paragraph       -> P
 *   **bold**        -> Strong
 *   - list          -> GuideList / GuideItem (single default tone; the old
 *                      per-item amber/teal accent tones were a minor visual
 *                      nuance, dropped in the docs/help migration)
 *   > blockquote    -> Callout (single default "purple" tone — the previous
 *                      three-tone Callout system only ever had one instance,
 *                      which used the default tone)
 *   `inline code`   -> Kbd (keyboard-shortcut styling)
 *   ```code block```-> plain monospace panel
 *   | table |       -> zebra-striped rows matching the old ShortcutTable, with
 *                      the header row hidden (GFM requires a header row
 *                      syntactically; the original design never showed one)
 *
 * A couple of one-off bespoke widgets (the layer-type card grid, the
 * Format×Locale color-coded badge example) don't have a Markdown equivalent
 * and are authored as raw HTML directly inside the .md source, enabled by
 * rehype-raw. Those render with full styling here; on GitHub's raw file view
 * they show as plain unstyled boxes (Tailwind classes have no matching CSS
 * there) but remain fully readable.
 */
export function HelpMarkdown({ source }: { source: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
        h2: ({ children }) => <SectionHeader>{children}</SectionHeader>,
        p: ({ children }) => <P>{children}</P>,
        strong: ({ children }) => <Strong>{children}</Strong>,
        ul: ({ children }) => <GuideList>{children}</GuideList>,
        ol: ({ children }) => <GuideList>{children}</GuideList>,
        li: ({ children }) => <GuideItem>{children}</GuideItem>,
        blockquote: ({ children }) => <Callout tone="purple">{children}</Callout>,
        code: ({ children, className }) => {
          const value = String(children).replace(/\n$/, '')
          if (value.includes('\n')) {
            return (
              <code className={`block whitespace-pre-wrap rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0f0f13] p-3 font-mono text-[11px] leading-5 text-[#c8c3ef] ${className ?? ''}`}>
                {value}
              </code>
            )
          }
          return <Kbd>{value}</Kbd>
        },
        pre: ({ children }) => <pre className="my-4">{children}</pre>,
        table: ({ children }) => (
          <div className="overflow-hidden rounded-xl border border-[rgba(255,255,255,0.07)]">
            <table className="w-full border-collapse text-[12px]">{children}</table>
          </div>
        ),
        thead: () => null,
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => (
          <tr className="odd:bg-[rgba(255,255,255,0.022)] even:bg-transparent">{children}</tr>
        ),
        td: ({ children }) => (
          <td className="px-3 py-2.5 text-[#b6b6c3] first:w-[46%] first:border-r first:border-[rgba(255,255,255,0.045)] first:text-[#777786] sm:first:w-[42%]">
            {children}
          </td>
        ),
      }}
    >
      {source}
    </ReactMarkdown>
  )
}
