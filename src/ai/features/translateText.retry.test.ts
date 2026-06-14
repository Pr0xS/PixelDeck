import { beforeEach, describe, expect, it, vi } from 'vitest'
import { chat } from '@/ai/client'
import { translateGroupTexts, translateLayerText } from './translateText'
import type { Project, SlideGroup } from '@/types'

vi.mock('@/ai/client', () => ({
  chat: vi.fn(),
}))

const mockedChat = vi.mocked(chat)

const slideGroup: SlideGroup = {
  id: 'g1',
  name: 'Main set',
  numSlides: 1,
  slideWidth: 1000,
  slideHeight: 2000,
  slideNames: ['Slide 1'],
  layers: [],
}

const project: Project = {
  id: 'p1',
  name: 'Food App',
  settings: {
    defaultSlideWidth: 1000,
    defaultSlideHeight: 2000,
    defaultLocale: 'es',
    brandName: 'Food App',
  },
  slideGroups: [slideGroup],
} as Project

const auth = { provider: 'opencode' as const, apiKey: 'sk-test', model: 'kimi-k2.6' }

beforeEach(() => {
  mockedChat.mockReset()
})

describe('translateLayerText JSON retry', () => {
  it('retries once when the first response is plain text instead of JSON', async () => {
    mockedChat
      .mockResolvedValueOnce('Your food understood')
      .mockResolvedValueOnce('{"translation":"Your food understood"}')

    const result = await translateLayerText({
      auth,
      project,
      slideGroup,
      layerId: 'txt1',
      text: 'Tu comida entendida',
      targetLocale: 'en',
    })

    expect(result.text).toBe('Your food understood')
    expect(mockedChat).toHaveBeenCalledTimes(2)
    expect(mockedChat.mock.calls[1][0].messages.at(-1)?.content).toContain('previous answer')
    expect(mockedChat.mock.calls[1][0].messages.at(-1)?.content).toContain('valid JSON')
  })

  it('throws a clearer error when both attempts are invalid', async () => {
    mockedChat
      .mockResolvedValueOnce('Here is the translation: Your food understood')
      .mockResolvedValueOnce('Still not JSON')

    await expect(
      translateLayerText({
        auth,
        project,
        slideGroup,
        layerId: 'txt1',
        text: 'Tu comida entendida',
        targetLocale: 'en',
      }),
    ).rejects.toThrow(/invalid translation JSON after retry/i)

    expect(mockedChat).toHaveBeenCalledTimes(2)
  })
})

describe('translateGroupTexts JSON retry', () => {
  it('retries when the batch response is partial, then accepts complete JSON', async () => {
    mockedChat
      .mockResolvedValueOnce('{"a":"First"}')
      .mockResolvedValueOnce('{"a":"First","b":"Second"}')

    const result = await translateGroupTexts({
      auth,
      project,
      slideGroup,
      targetLocale: 'en',
      items: [
        { id: 'a', text: 'Primero' },
        { id: 'b', text: 'Segundo' },
      ],
    })

    expect(result.a.text).toBe('First')
    expect(result.b.text).toBe('Second')
    expect(mockedChat).toHaveBeenCalledTimes(2)
    expect(mockedChat.mock.calls[1][0].messages.at(-1)?.content).toContain('Required ids: "a", "b"')
  })
})
