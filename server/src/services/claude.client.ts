import Anthropic from '@anthropic-ai/sdk'
import { env } from '@/config/env'

/** Model có tên bắt đầu bằng "claude-" thì gọi Claude, còn lại gọi Gemini. */
export const isClaudeModel = (model: string): boolean =>
  /^claude-/i.test(model.trim())

/** Lỗi mạng hoặc hết thời gian khi gọi Claude (không có mã HTTP). */
export const isClaudeConnectionError = (err: unknown): boolean =>
  err instanceof Anthropic.APIConnectionError

/** Max tokens tối thiểu cho Claude: phần suy nghĩ cũng tính vào giới hạn này. */
const CLAUDE_MIN_MAX_TOKENS = 16000

const JSON_ONLY_INSTRUCTION =
  'Chỉ trả về đúng một JSON hợp lệ, không bọc markdown và không giải thích thêm.'

export type ClaudeTextRequest = {
  model: string
  contents: unknown
  config?: {
    abortSignal?: AbortSignal
    systemInstruction?: unknown
    maxOutputTokens?: number
    responseMimeType?: string
    responseSchema?: unknown
  }
}

/** Phản hồi rút gọn, cùng các trường mà generateTextWithRetry đọc từ Gemini. */
export type ClaudeTextResponse = {
  text: string
  candidates: Array<{ finishReason: string | null }>
  usageMetadata: Anthropic.Usage
}

let client: Anthropic | undefined

// Dùng chung key và base URL với Gemini (ShopAIKey phục vụ cả hai).
const getClaudeClient = (): Anthropic =>
  (client ??= new Anthropic({
    apiKey: env.GEMINI_API_KEY,
    baseURL: env.GEMINI_BASE_URL || undefined,
    // generateTextWithRetry tự thử lại và chuyển model dự phòng.
    maxRetries: 0
  }))

const asText = (value: unknown, field: string): string => {
  if (typeof value === 'string') return value
  throw new Error(`Claude chỉ nhận ${field} dạng chuỗi`)
}

const buildSystem = (config: ClaudeTextRequest['config']): string => {
  const parts: string[] = []
  if (config?.systemInstruction !== undefined)
    parts.push(asText(config.systemInstruction, 'systemInstruction'))
  if (config?.responseMimeType === 'application/json') {
    parts.push(JSON_ONLY_INSTRUCTION)
    if (config.responseSchema)
      parts.push(`Cấu trúc JSON: ${JSON.stringify(config.responseSchema)}`)
  }
  return parts.join('\n\n')
}

/**
 * Gọi Claude Messages API với cùng tham số như Gemini generateContent.
 * Không gửi temperature: model Claude hiện hành từ chối tham số này.
 * Claude từ chối (stop_reason "refusal") thì trả text rỗng để vòng thử lại xử lý.
 */
export const generateWithClaude = async (
  request: ClaudeTextRequest,
  timeoutMs: number
): Promise<ClaudeTextResponse> => {
  const system = buildSystem(request.config)
  const message = await getClaudeClient().messages.create(
    {
      model: request.model,
      max_tokens: Math.max(
        request.config?.maxOutputTokens ?? 0,
        CLAUDE_MIN_MAX_TOKENS
      ),
      ...(system ? { system } : {}),
      messages: [
        { role: 'user', content: asText(request.contents, 'contents') }
      ]
    },
    { signal: request.config?.abortSignal, timeout: timeoutMs }
  )

  const text =
    message.stop_reason === 'refusal'
      ? ''
      : message.content
          .filter(
            (block): block is Anthropic.TextBlock => block.type === 'text'
          )
          .map((block) => block.text)
          .join('')

  return {
    text,
    candidates: [{ finishReason: message.stop_reason }],
    usageMetadata: message.usage
  }
}
