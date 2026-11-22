import { EventEmitter } from 'node:events'
import type { Request, Response } from 'express'
import type { GoogleGenAI } from '@google/genai'
import { env } from '@/config/env'
import { requestContext } from '@/middlewares/requestContext.middleware'
import {
  AI_BUSY_MESSAGE,
  QA_INVALID_OUTPUT,
  generateOutlineFromPrompt,
  generateTextWithRetry
} from '@/services/ai.service'
import { withAiRequest } from '@/utils/aiRequest'
import { isExplicitChatOnlyRequest } from '@/utils/aiChatContext'

const mockRead = jest.fn()
const mockWrite = jest.fn()
jest.mock('@/lib/redis', () => ({
  redis: {
    get: (...args: unknown[]) => mockRead(...args),
    set: (...args: unknown[]) => mockWrite(...args)
  }
}))
const provider = jest.fn()
const ai = { models: { generateContent: provider } } as unknown as GoogleGenAI
const originalTimeout = env.AI_REQUEST_TIMEOUT_MS
const originalFallback = env.GEMINI_FALLBACK_MODEL
function call(userId: string, extraConfig: Record<string, unknown> = {}) {
  const req = Object.assign(new EventEmitter(), {
    user: { id: userId }
  }) as Request
  const res = Object.assign(new EventEmitter(), {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: () => res.emit('finish')
  }) as unknown as Response
  const work = requestContext.run({ requestId: 'task-' + userId, userId }, () =>
    withAiRequest(req, res, 'outline', (signal) =>
      generateTextWithRetry(
        ai,
        {
          model: 'primary',
          contents: 'chủ đề',
          config: { abortSignal: signal, ...extraConfig }
        },
        'test',
        0
      )
    )
  )
  return { work, res }
}
describe('theo dõi yêu cầu AI', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    env.QA_FAULTS_ENABLED = true
    env.AI_REQUEST_TIMEOUT_MS = 20
    env.GEMINI_FALLBACK_MODEL = undefined
    mockWrite.mockResolvedValue('OK')
    provider.mockResolvedValue({ text: 'Kết quả' })
  })
  afterEach(() => {
    env.QA_FAULTS_ENABLED = false
    env.AI_REQUEST_TIMEOUT_MS = originalTimeout
    env.GEMINI_FALLBACK_MODEL = originalFallback
  })
  it('app timeout trả 504; người dùng khác hoàn thành bình thường', async () => {
    mockRead.mockImplementation(async (key) =>
      key === 'qa:fault:ai_delay:A'
        ? JSON.stringify({
            fault: 'ai_delay',
            targetEmail: 'qa@example.com',
            params: { delayMs: 1000 }
          })
        : null
    )
    await expect(call('A').work).rejects.toMatchObject({
      statusCode: 504,
      message:
        'AI phản hồi quá lâu. Vui lòng thử lại; yêu cầu này không bị tính credit.'
    })
    expect(provider).not.toHaveBeenCalled()
    expect(JSON.parse(mockWrite.mock.calls.at(-1)![1])).toMatchObject({
      status: 'timeout',
      creditDebited: 0
    })
    await expect(call('B').work).resolves.toBe('Kết quả')
    expect(JSON.parse(mockWrite.mock.calls.at(-1)![1])).toMatchObject({
      status: 'completed',
      userId: 'B'
    })
  })
  it('khi bỏ qua app timeout, đóng kết nối vẫn hủy được delay', async () => {
    mockRead.mockImplementation(async (key) =>
      key === 'qa:fault:ai_delay:A'
        ? JSON.stringify({
            fault: 'ai_delay',
            targetEmail: 'qa@example.com',
            params: { delayMs: 1000, bypassAppTimeout: true }
          })
        : null
    )
    const { work, res } = call('A')
    const rejected = expect(work).rejects.toMatchObject({ statusCode: 499 })
    setTimeout(() => res.emit('close'), 40)
    await rejected
    expect(provider).not.toHaveBeenCalled()
    expect(JSON.parse(mockWrite.mock.calls.at(-1)![1])).toMatchObject({
      status: 'cancelled'
    })
  })
  it('lỗi upstream theo user đi qua retry; tắt công tắc rồi gửi lại độc lập', async () => {
    mockRead.mockImplementation(async (key) =>
      key === 'qa:fault:ai_error:A'
        ? JSON.stringify({
            fault: 'ai_error',
            targetEmail: 'qa@example.com',
            params: { status: 503 }
          })
        : null
    )
    await expect(call('A').work).rejects.toMatchObject({ statusCode: 503 })
    expect(provider).not.toHaveBeenCalled()
    await expect(call('B').work).resolves.toBe('Kết quả')
    mockRead.mockResolvedValue(null)
    await expect(call('A').work).resolves.toBe('Kết quả')
  })
  const invalidOutputFor = (kind?: 'schema' | 'json') =>
    mockRead.mockImplementation(async (key) =>
      key === 'qa:fault:invalid_output:A'
        ? JSON.stringify({
            fault: 'invalid_output',
            targetEmail: 'qa@example.com',
            params: kind ? { kind } : {}
          })
        : null
    )
  const json = { responseMimeType: 'application/json' }
  it('invalid_output schema trả JSON sai cấu trúc thay cho AI, chỉ với user A', async () => {
    invalidOutputFor()
    await expect(call('A', json).work).resolves.toBe(QA_INVALID_OUTPUT.schema)
    expect(provider).not.toHaveBeenCalled()
    await expect(call('B').work).resolves.toBe('Kết quả')
  })
  it('invalid_output json đi qua retry như JSON hỏng rồi báo 503', async () => {
    invalidOutputFor('json')
    await expect(call('A', json).work).rejects.toMatchObject({
      statusCode: 503,
      message: AI_BUSY_MESSAGE
    })
    expect(provider).not.toHaveBeenCalled()
  })
  it('dàn ý gặp invalid_output báo 502 sai định dạng', async () => {
    invalidOutputFor('schema')
    await expect(
      requestContext.run({ requestId: 'outline-A', userId: 'A' }, () =>
        generateOutlineFromPrompt('chủ đề')
      )
    ).rejects.toMatchObject({
      statusCode: 502,
      message: 'Cấu trúc dàn ý trả về không đúng định dạng'
    })
  })
  it('phân biệt yêu cầu chỉ trả lời và giới hạn phạm vi chỉnh sửa', () => {
    expect(isExplicitChatOnlyRequest('Chỉ trả lời, không sửa slide.')).toBe(
      true
    )
    expect(
      isExplicitChatOnlyRequest('Đổi tiêu đề slide 1. Không sửa slide khác.')
    ).toBe(false)
    expect(
      isExplicitChatOnlyRequest(
        'Bổ sung ví dụ, không thay đổi các slide còn lại.'
      )
    ).toBe(false)
  })
})
