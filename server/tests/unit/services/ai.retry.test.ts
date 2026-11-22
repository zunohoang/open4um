const mockGenerateContent = jest.fn()

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: (...args: any[]) => mockGenerateContent(...args)
    }
  }))
}))

const mockClaudeCreate = jest.fn()

jest.mock('@anthropic-ai/sdk', () => {
  class APIConnectionError extends Error {}
  const Anthropic = Object.assign(
    jest.fn().mockImplementation(() => ({
      messages: { create: (...args: any[]) => mockClaudeCreate(...args) }
    })),
    { APIConnectionError }
  )
  return { __esModule: true, default: Anthropic }
})

import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'
import { env } from '@/config/env'
import { logger } from '@/lib/logger'
import {
  AI_ATTEMPTS_PER_MODEL,
  AI_BUSY_MESSAGE,
  AI_CALL_TIMEOUT_MS,
  generateOutlineFromPrompt,
  generateTextWithRetry
} from '@/services/ai.service'
import { AppError } from '@/utils/AppError'

const ai = new GoogleGenAI({ apiKey: 'test' })
const params = { model: 'gemini-main', contents: 'xin chào' }
const emptyResponse = {
  text: '',
  candidates: [{ finishReason: 'MAX_TOKENS' }],
  usageMetadata: { thoughtsTokenCount: 8000 }
}
const httpError = (status: number) =>
  Object.assign(new Error(`HTTP ${status}`), { status })

describe('ai.service generateTextWithRetry', () => {
  const originalFallback = env.GEMINI_FALLBACK_MODEL

  beforeEach(() => {
    jest.clearAllMocks()
    mockGenerateContent.mockReset()
    ;(env as any).GEMINI_FALLBACK_MODEL = undefined
  })

  afterAll(() => {
    ;(env as any).GEMINI_FALLBACK_MODEL = originalFallback
  })

  it('trả text ngay ở lần gọi đầu khi AI trả nội dung', async () => {
    mockGenerateContent.mockResolvedValueOnce({ text: '{"ok":true}' })

    await expect(generateTextWithRetry(ai, params, 'test', 0)).resolves.toBe(
      '{"ok":true}'
    )
    expect(mockGenerateContent).toHaveBeenCalledTimes(1)
  })

  it('thử lại khi AI trả rỗng và ghi finishReason vào log', async () => {
    mockGenerateContent
      .mockResolvedValueOnce(emptyResponse)
      .mockResolvedValueOnce({ text: 'nội dung' })

    await expect(generateTextWithRetry(ai, params, 'test', 0)).resolves.toBe(
      'nội dung'
    )
    expect(mockGenerateContent).toHaveBeenCalledTimes(2)
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-main',
        attempt: 1,
        finishReason: 'MAX_TOKENS'
      }),
      'test: AI trả về rỗng'
    )
  })

  it('thử lại khi nhà cung cấp trả 504', async () => {
    mockGenerateContent
      .mockRejectedValueOnce(httpError(504))
      .mockResolvedValueOnce({ text: 'nội dung' })

    await expect(generateTextWithRetry(ai, params, 'test', 0)).resolves.toBe(
      'nội dung'
    )
    expect(mockGenerateContent).toHaveBeenCalledTimes(2)
  })

  it('thử lại khi lần gọi bị quá thời gian hoặc mất kết nối', async () => {
    const aborted = Object.assign(new Error('This operation was aborted'), {
      name: 'AbortError'
    })
    mockGenerateContent
      .mockRejectedValueOnce(aborted)
      .mockRejectedValueOnce(new TypeError('fetch failed'))
    ;(env as any).GEMINI_FALLBACK_MODEL = 'gemini-fallback'
    mockGenerateContent.mockResolvedValueOnce({ text: 'nội dung' })

    await expect(generateTextWithRetry(ai, params, 'test', 0)).resolves.toBe(
      'nội dung'
    )
    expect(mockGenerateContent).toHaveBeenCalledTimes(3)
  })

  it('coi phản hồi chỉ có functionCall, không có chữ, là rỗng và thử lại', async () => {
    mockGenerateContent
      .mockResolvedValueOnce({
        text: undefined,
        candidates: [
          {
            finishReason: 'STOP',
            content: { parts: [{ functionCall: { name: 'x' } }] }
          }
        ]
      })
      .mockResolvedValueOnce({ text: 'nội dung' })

    await expect(generateTextWithRetry(ai, params, 'test', 0)).resolves.toBe(
      'nội dung'
    )
    expect(mockGenerateContent).toHaveBeenCalledTimes(2)
  })

  it('ném lỗi ngay, không thử lại, khi lỗi không tạm thời như 400', async () => {
    const badRequest = httpError(400)
    mockGenerateContent.mockRejectedValueOnce(badRequest)

    await expect(generateTextWithRetry(ai, params, 'test', 0)).rejects.toBe(
      badRequest
    )
    expect(mockGenerateContent).toHaveBeenCalledTimes(1)
  })

  it('hết lượt mà không có model dự phòng thì báo 503 quá tải', async () => {
    mockGenerateContent.mockResolvedValue(emptyResponse)

    const err = await generateTextWithRetry(ai, params, 'test', 0).catch(
      (e) => e
    )
    expect(err).toBeInstanceOf(AppError)
    expect(err.statusCode ?? err.status).toBe(503)
    expect(err.message).toBe(AI_BUSY_MESSAGE)
    expect(mockGenerateContent).toHaveBeenCalledTimes(AI_ATTEMPTS_PER_MODEL)
  })

  it('chuyển sang GEMINI_FALLBACK_MODEL khi model chính hết lượt', async () => {
    ;(env as any).GEMINI_FALLBACK_MODEL = 'gemini-fallback'
    mockGenerateContent.mockImplementation(async (req: { model: string }) =>
      req.model === 'gemini-fallback' ? { text: 'từ dự phòng' } : emptyResponse
    )

    await expect(generateTextWithRetry(ai, params, 'test', 0)).resolves.toBe(
      'từ dự phòng'
    )
    const models = mockGenerateContent.mock.calls.map((c) => c[0].model)
    expect(models).toEqual([
      ...Array(AI_ATTEMPTS_PER_MODEL).fill('gemini-main'),
      'gemini-fallback'
    ])
  })

  it('không gọi model dự phòng hai lần khi trùng model chính', async () => {
    ;(env as any).GEMINI_FALLBACK_MODEL = 'gemini-main'
    mockGenerateContent.mockResolvedValue(emptyResponse)

    await expect(
      generateTextWithRetry(ai, params, 'test', 0)
    ).rejects.toBeInstanceOf(AppError)
    expect(mockGenerateContent).toHaveBeenCalledTimes(AI_ATTEMPTS_PER_MODEL)
  })

  it('không gọi AI khi request đã bị hủy trước lượt đầu', async () => {
    const controller = new AbortController()
    const reason = new AppError('Yêu cầu đã bị hủy', 499)
    controller.abort(reason)

    await expect(
      generateTextWithRetry(
        ai,
        { ...params, config: { abortSignal: controller.signal } },
        'test',
        0
      )
    ).rejects.toBe(reason)
    expect(mockGenerateContent).not.toHaveBeenCalled()
  })

  it('không retry hoặc gọi model dự phòng khi request bị hủy trong lúc gọi AI', async () => {
    const controller = new AbortController()
    const reason = new AppError('Yêu cầu đã bị hủy', 499)
    ;(env as any).GEMINI_FALLBACK_MODEL = 'gemini-fallback'
    mockGenerateContent.mockImplementationOnce(async () => {
      controller.abort(reason)
      throw Object.assign(new Error('This operation was aborted'), {
        name: 'AbortError'
      })
    })

    await expect(
      generateTextWithRetry(
        ai,
        { ...params, config: { abortSignal: controller.signal } },
        'test',
        0
      )
    ).rejects.toBe(reason)
    expect(mockGenerateContent).toHaveBeenCalledTimes(1)
    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-main',
        config: { abortSignal: controller.signal }
      })
    )
  })
})

describe('ai.service generateOutlineFromPrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(env as any).GEMINI_FALLBACK_MODEL = undefined
  })

  it('vẫn sinh được dàn ý khi lần gọi đầu AI trả rỗng', async () => {
    mockGenerateContent.mockReset()
    mockGenerateContent
      .mockResolvedValueOnce(emptyResponse)
      .mockResolvedValueOnce({
        text: JSON.stringify({
          title: 'Căn bản về NodeJS',
          sections: [{ heading: 'Giới thiệu', bullets: ['Node là gì'] }]
        })
      })

    const outline = await generateOutlineFromPrompt('Căn bản về NodeJS')

    expect(outline.title).toBe('Căn bản về NodeJS')
    expect(outline.sections).toHaveLength(1)
    expect(mockGenerateContent).toHaveBeenCalledTimes(2)
  })

  it('báo 503 quá tải khi AI rỗng ở mọi lượt', async () => {
    mockGenerateContent.mockReset()
    mockGenerateContent.mockResolvedValue(emptyResponse)

    const err = await generateOutlineFromPrompt('NJ').catch((e) => e)

    expect(err).toBeInstanceOf(AppError)
    expect(err.message).toBe(AI_BUSY_MESSAGE)
  })

  it('dừng thời gian chờ retry và giữ nguyên lỗi timeout của toàn request', async () => {
    const controller = new AbortController()
    const reason = new AppError('AI phản hồi quá lâu', 504)
    mockGenerateContent.mockReset().mockRejectedValue(httpError(503))
    const pending = generateOutlineFromPrompt(
      'Căn bản về NodeJS',
      controller.signal
    )
    const rejected = expect(pending).rejects.toBe(reason)

    try {
      await new Promise<void>((resolve) => setImmediate(resolve))
      controller.abort(reason)
      await rejected
      expect(mockGenerateContent).toHaveBeenCalledTimes(1)
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({ abortSignal: controller.signal })
        })
      )
    } finally {
      controller.abort(reason)
    }
  })
})

describe('ai.service generateTextWithRetry với Claude', () => {
  const claudeReply = (text: string, stop_reason = 'end_turn') => ({
    stop_reason,
    content: [
      { type: 'thinking', thinking: '' },
      { type: 'text', text }
    ],
    usage: { input_tokens: 1, output_tokens: 1 }
  })
  const claudeParams = { model: 'claude-opus-5-5', contents: 'xin chào' }

  beforeEach(() => {
    jest.clearAllMocks()
    mockClaudeCreate.mockReset()
    mockGenerateContent.mockReset()
    ;(env as any).GEMINI_FALLBACK_MODEL = undefined
  })

  it('gọi Claude khi model bắt đầu bằng claude-, chỉ lấy khối text', async () => {
    mockClaudeCreate.mockResolvedValueOnce(claudeReply('{"ok":true}'))
    const params = {
      ...claudeParams,
      config: {
        systemInstruction: 'Bạn là trợ lý.',
        temperature: 0.7,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
        responseSchema: { type: 'OBJECT' }
      }
    }

    await expect(
      generateTextWithRetry(ai, params as any, 'test', 0)
    ).resolves.toBe('{"ok":true}')
    expect(mockGenerateContent).not.toHaveBeenCalled()
    const [body, options] = mockClaudeCreate.mock.calls[0]
    expect(body).toMatchObject({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      messages: [{ role: 'user', content: 'xin chào' }]
    })
    expect(body).not.toHaveProperty('temperature')
    expect(body.system).toContain('Bạn là trợ lý.')
    expect(body.system).toContain('JSON hợp lệ')
    expect(body.system).toContain('"type":"OBJECT"')
    expect(options).toMatchObject({ timeout: AI_CALL_TIMEOUT_MS })
  })

  it('model Gemini vẫn gọi Gemini, không gọi Claude', async () => {
    mockGenerateContent.mockResolvedValueOnce({ text: 'từ Gemini' })

    await expect(generateTextWithRetry(ai, params, 'test', 0)).resolves.toBe(
      'từ Gemini'
    )
    expect(mockClaudeCreate).not.toHaveBeenCalled()
  })

  it('Claude từ chối thì chuyển sang model dự phòng Gemini', async () => {
    ;(env as any).GEMINI_FALLBACK_MODEL = 'gemini-fallback'
    mockClaudeCreate.mockResolvedValue(claudeReply('xin lỗi', 'refusal'))
    mockGenerateContent.mockResolvedValueOnce({ text: 'từ Gemini' })

    await expect(
      generateTextWithRetry(ai, claudeParams, 'test', 0)
    ).resolves.toBe('từ Gemini')
    expect(mockClaudeCreate).toHaveBeenCalledTimes(AI_ATTEMPTS_PER_MODEL)
    expect(mockGenerateContent.mock.calls[0][0].model).toBe('gemini-fallback')
  })

  it('thử lại khi Claude quá tải 529 hoặc mất kết nối', async () => {
    ;(env as any).GEMINI_FALLBACK_MODEL = 'claude-sonnet-5-5'
    const { APIConnectionError } = Anthropic as unknown as {
      APIConnectionError: new (message: string) => Error
    }
    mockClaudeCreate
      .mockRejectedValueOnce(httpError(529))
      .mockRejectedValueOnce(new APIConnectionError('Connection error.'))
      .mockResolvedValueOnce(claudeReply('nội dung'))

    await expect(
      generateTextWithRetry(ai, claudeParams, 'test', 0)
    ).resolves.toBe('nội dung')
    expect(mockClaudeCreate.mock.calls.map((c) => c[0].model)).toEqual([
      'claude-opus-5-5',
      'claude-opus-5-5',
      'claude-sonnet-5-5'
    ])
  })
})
