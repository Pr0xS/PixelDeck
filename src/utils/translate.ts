import type { AiProvider } from '@/store/apiKeys'

/**
 * Translate `text` to `targetLocale` using the specified AI provider and key.
 * Returns the translated text.
 * Throws on API error.
 */
export async function translateText(
  text: string,
  targetLocale: string,
  provider: AiProvider,
  apiKey: string,
): Promise<string> {
  if (!apiKey.trim()) throw new Error('No API key configured. Open AI Settings in the toolbar.')
  const prompt = `Translate the following text to the locale "${targetLocale}". Return ONLY the translated text with no explanation or extra formatting:\n\n${text}`
  switch (provider) {
    case 'anthropic':
      return translateWithClaude(prompt, apiKey)
    case 'openai':
      return translateWithOpenAI(prompt, apiKey)
    case 'google':
      return translateWithGoogle(prompt, apiKey)
  }
}

async function translateWithClaude(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Claude API error ${res.status}: ${err}`)
  }
  const data = await res.json()
  return (data.content[0].text as string).trim()
}

async function translateWithOpenAI(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI API error ${res.status}: ${err}`)
  }
  const data = await res.json()
  return (data.choices[0].message.content as string).trim()
}

async function translateWithGoogle(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    },
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google AI API error ${res.status}: ${err}`)
  }
  const data = await res.json()
  return (data.candidates[0].content.parts[0].text as string).trim()
}
