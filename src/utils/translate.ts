import { chat } from '@/ai/client'
import type { AiProvider } from '@/store/apiKeys'

/**
 * Translate `text` to `targetLocale` using the specified AI provider/key/model.
 * Returns the translated text and throws on API errors.
 */
export async function translateText(
  text: string,
  targetLocale: string,
  provider: AiProvider,
  apiKey: string,
  model?: string,
): Promise<string> {
  return chat({
    provider,
    apiKey,
    model,
    maxTokens: 1024,
    messages: [
      {
        role: 'system',
        content:
          'You are a precise localization assistant. Return only the translated text with no explanation or extra formatting.',
      },
      {
        role: 'user',
        content: `Translate the following text to the locale "${targetLocale}":\n\n${text}`,
      },
    ],
  })
}
