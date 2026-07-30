import { beforeEach, describe, expect, it, vi } from 'vitest'
import { chat, editImage } from '@/ai/client'
import { getPixelDeckConfig } from '@/config'
import { transportChat, transportEditImage } from './transport'
import type { AiTransport } from './transport'

vi.mock('@/ai/client', () => ({
  chat: vi.fn(),
  editImage: vi.fn(),
}))

vi.mock('@/config', () => ({
  getPixelDeckConfig: vi.fn(),
}))

const mockedChat = vi.mocked(chat)
const mockedEditImage = vi.mocked(editImage)
const mockedGetPixelDeckConfig = vi.mocked(getPixelDeckConfig)

const chatOptions = {
  provider: 'openai' as const,
  apiKey: 'test-key',
  messages: [{ role: 'user' as const, content: 'Hello' }],
}

const imageEditOptions = {
  provider: 'openai' as const,
  apiKey: 'test-key',
  prompt: 'Translate the image text.',
  imageDataUrl: 'data:image/png;base64,test',
}

beforeEach(() => {
  mockedChat.mockReset()
  mockedEditImage.mockReset()
  mockedGetPixelDeckConfig.mockReset()
  mockedGetPixelDeckConfig.mockReturnValue({})
})

describe('AI transport', () => {
  it('delegates to the client transport when no override is configured', async () => {
    mockedChat.mockResolvedValue('chat result')
    mockedEditImage.mockResolvedValue('image result')

    await expect(transportChat(chatOptions)).resolves.toBe('chat result')
    await expect(transportEditImage(imageEditOptions)).resolves.toBe('image result')

    expect(mockedChat).toHaveBeenCalledWith(chatOptions)
    expect(mockedEditImage).toHaveBeenCalledWith(imageEditOptions)
  })

  it('uses an injected transport for chat and image editing', async () => {
    const injectedTransport: AiTransport = {
      chat: vi.fn().mockResolvedValue('injected chat'),
      editImage: vi.fn().mockResolvedValue('injected image'),
    }
    mockedGetPixelDeckConfig.mockReturnValue({ aiTransport: injectedTransport })

    await expect(transportChat(chatOptions)).resolves.toBe('injected chat')
    await expect(transportEditImage(imageEditOptions)).resolves.toBe('injected image')

    expect(injectedTransport.chat).toHaveBeenCalledWith(chatOptions)
    expect(injectedTransport.editImage).toHaveBeenCalledWith(imageEditOptions)
    expect(mockedChat).not.toHaveBeenCalled()
    expect(mockedEditImage).not.toHaveBeenCalled()
  })

  it('propagates errors from the resolved transport unchanged', async () => {
    const error = new Error('Transport unavailable')
    const injectedTransport: AiTransport = {
      chat: vi.fn().mockRejectedValue(error),
      editImage: vi.fn(),
    }
    mockedGetPixelDeckConfig.mockReturnValue({ aiTransport: injectedTransport })

    await expect(transportChat(chatOptions)).rejects.toBe(error)
  })
})
