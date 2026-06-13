import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildAnthropicHeaders,
  buildGoogleHeaders,
  buildOpenAiCompatibleHeaders,
  getAiRequestOrigin,
} from './headers'

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

  it('builds Anthropic direct API headers', () => {
    expect(buildAnthropicHeaders('sk-ant-test', { contentType: true })).toEqual({
      'Content-Type': 'application/json',
      'x-api-key': 'sk-ant-test',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    })
  })

  it('includes Google API key only when requested', () => {
    expect(buildGoogleHeaders('AIza-test')).toEqual({})
    expect(buildGoogleHeaders('AIza-test', { includeApiKey: true })).toEqual({
      'x-goog-api-key': 'AIza-test',
    })
  })

  it('falls back to a stable origin outside the browser', () => {
    vi.unstubAllGlobals()
    expect(getAiRequestOrigin()).toBe('https://pixeldeck.local')
  })
})
