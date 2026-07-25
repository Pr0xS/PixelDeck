import { chat } from '@/ai/client'
import type { AiAuth } from '@/ai/features/translateText'

/**
 * Minimal end-to-end connection test: asks the configured provider/model to
 * translate a short fixed string. Unlike listModels(), this exercises the
 * actual chat completion path the app uses for translation, so it catches
 * providers/models that list fine but fail (or are incompatible) at call time.
 */
export async function testAiConnection(auth: AiAuth): Promise<string> {
  const result = await chat({
    ...auth,
    // Generous budget: some models (e.g. reasoning/"thinking" models) consume
    // part of maxTokens on hidden chain-of-thought before emitting visible
    // output, which can truncate a tight budget down to 1-2 characters.
    maxTokens: 300,
    timeoutMs: 20_000,
    retries: 0,
    messages: [
      { role: 'system', content: 'You are a translation engine. Respond with ONLY the translated text, no quotes, no explanation, no markdown.' },
      { role: 'user', content: 'Translate this English text to Spanish: "Hello, world!"' },
    ],
  })
  return result.trim()
}
