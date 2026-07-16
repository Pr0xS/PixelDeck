import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildOpenAiCompatibleHeaders, getAiRequestOrigin } from './headers'

describe('AI auth headers', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('builds OpenAI-compatible bearer headers', () => {
    expect(buildOpenAiCompatibleHeaders('openai', 'sk-test')).toEqual({
      Authorization: 'Bearer sk-test',
    })
  })

  it('adds JSON content type when requested', () => {
    expect(buildOpenAiCompatibleHeaders('openai', 'sk-test', { contentType: true })).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer sk-test',
    })
  })

  it('adds OpenRouter attribution headers', () => {
    expect(buildOpenAiCompatibleHeaders('openrouter', 'sk-or-test')).toEqual({
      Authorization: 'Bearer sk-or-test',
      'HTTP-Referer': 'http://localhost:5173',
      'X-OpenRouter-Title': 'PixelDeck',
    })
  })

  it('falls back to a stable origin outside the browser', () => {
    vi.unstubAllGlobals()
    expect(getAiRequestOrigin()).toBe('https://pixeldeck.local')
  })
})
