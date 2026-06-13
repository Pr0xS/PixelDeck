import { editImage } from '@/ai/client'
import { buildDesignContext } from '@/ai/context'
import { buildImageLocalizationPrompt, IMAGE_LOCALIZATION_SYSTEM_PROMPT } from '@/ai/prompts'
import type { Project, SlideGroup } from '@/types'
import type { AiAuth } from '@/ai/features/translateText'

/**
 * Generate a localized replacement for an image/screenshot layer.
 * The model sees the source image plus full design context and should return a
 * new image with visible user-facing text localized to the target locale.
 *
 * Requires an image-generation/editing capable model. Text-only or vision-only
 * models throw a clear error before making a provider request.
 */
export async function generateLocalizedImage(args: {
  auth: AiAuth
  project: Project
  slideGroup: SlideGroup
  imageDataUrl: string
  layerName: string
  targetLocale: string
}): Promise<string> {
  const context = buildDesignContext(args.project, args.slideGroup)
  return editImage({
    ...args.auth,
    imageDataUrl: args.imageDataUrl,
    prompt: [
      IMAGE_LOCALIZATION_SYSTEM_PROMPT,
      '',
      buildImageLocalizationPrompt({
        targetLocale: args.targetLocale,
        designContext: context.text,
        layerName: args.layerName,
      }),
    ].join('\n'),
  })
}
