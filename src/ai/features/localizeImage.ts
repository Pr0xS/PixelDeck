import { chat } from '@/ai/client'
import { buildDesignContext } from '@/ai/context'
import { buildImageLocalizationPrompt, IMAGE_LOCALIZATION_SYSTEM_PROMPT } from '@/ai/prompts'
import type { Project, SlideGroup } from '@/types'
import type { AiAuth } from '@/ai/features/translateText'

/**
 * Analyze an image (app screenshot or decorative image) for localization.
 * The model sees the image plus the full design context, detects visible
 * text, and suggests translations. Returns a short human-readable brief.
 *
 * Requires a vision-capable model (most defaults are: gpt-4o-mini,
 * claude-haiku, gemini-flash). Non-vision models will return an API error
 * which surfaces in the UI.
 */
export async function suggestImageLocalization(args: {
  auth: AiAuth
  project: Project
  slideGroup: SlideGroup
  imageDataUrl: string
  layerName: string
  targetLocale: string
}): Promise<string> {
  const context = buildDesignContext(args.project, args.slideGroup)
  return chat({
    ...args.auth,
    maxTokens: 1024,
    messages: [
      { role: 'system', content: IMAGE_LOCALIZATION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: buildImageLocalizationPrompt({
              targetLocale: args.targetLocale,
              designContext: context.text,
              layerName: args.layerName,
            }),
          },
          { type: 'image', dataUrl: args.imageDataUrl },
        ],
      },
    ],
  })
}
