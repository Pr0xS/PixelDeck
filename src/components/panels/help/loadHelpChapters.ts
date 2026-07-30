import yaml from 'js-yaml'

export type HelpSectionId =
  | 'introduction' | 'shortcuts' | 'projects' | 'templates' | 'slides' | 'layers' | 'properties'
  | 'formats' | 'localization' | 'format-locale' | 'brand-kit' | 'assets' | 'exporting'
  | 'ai-features'

export type HelpGroup = 'GETTING STARTED' | 'DESIGN' | 'ADAPT' | 'DELIVER'

export interface HelpChapter {
  id: HelpSectionId
  number: number
  title: string
  group: HelpGroup
  /** Markdown body, frontmatter stripped. */
  body: string
}

interface HelpFrontmatter {
  id: HelpSectionId
  number: number
  title: string
  group: HelpGroup
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/

function parseChapter(path: string, raw: string): HelpChapter {
  const match = FRONTMATTER_RE.exec(raw)
  if (!match) throw new Error(`Help chapter "${path}" is missing YAML frontmatter`)
  const frontmatter = yaml.load(match[1]) as HelpFrontmatter
  if (!frontmatter?.id || !frontmatter.title || !frontmatter.group || typeof frontmatter.number !== 'number') {
    throw new Error(`Help chapter "${path}" has incomplete frontmatter (need id, number, title, group)`)
  }
  return { ...frontmatter, body: match[2].trim() }
}

// docs/help/*.md is the single source of truth for user-facing documentation —
// readable as plain Markdown in the repo, and rendered here for the in-app Help modal.
const modules = import.meta.glob('/docs/help/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

export const HELP_CHAPTERS: HelpChapter[] = Object.entries(modules)
  .map(([path, raw]) => parseChapter(path, raw))
  .sort((a, b) => a.number - b.number)
