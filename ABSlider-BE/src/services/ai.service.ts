import { env } from '@/config/env'
import { logger } from '@/lib/logger'
import { AppError } from '@/utils/AppError'

const GEMINI_API_BASE =
  'https://generativelanguage.googleapis.com/v1beta/models'
const DEFAULT_GEMINI_MODEL = 'gemini-1.5-flash'

export interface OutlineSection {
  heading: string
  bullets: string[]
}

export interface GeneratedOutline {
  title: string
  sections: OutlineSection[]
}

/**
 * Gọi Google Gemini API để sinh dàn ý bài giảng từ prompt.
 * Nếu chưa cấu hình GEMINI_API_KEY, ném lỗi AppError trực tiếp về phía client.
 */
export const generateOutlineFromPrompt = async (
  prompt: string
): Promise<GeneratedOutline> => {
  const apiKey = env.GEMINI_API_KEY?.trim()

  if (!apiKey) {
    throw new AppError(
      'Hệ thống chưa được cấu hình GEMINI_API_KEY. Vui lòng thêm API key vào file .env.',
      500
    )
  }

  try {
    const url = `${GEMINI_API_BASE}/${DEFAULT_GEMINI_MODEL}:generateContent?key=${apiKey}`
    const systemInstruction =
      'Bạn là một trợ lý AI chuyên nghiệp về thiết kế bài giảng và slide thuyết trình. ' +
      'Hãy phân tích chủ đề của người dùng và tạo một dàn ý bài giảng có cấu trúc logic gồm từ 3 đến 6 phần (sections). ' +
      'Mỗi phần cần có tiêu đề rõ ràng (heading) và từ 2 đến 4 ý chính (bullets) súc tích, đắt giá. ' +
      'Phản hồi BẮT BUỘC phải là JSON hợp lệ theo đúng cấu trúc: { "title": string, "sections": [ { "heading": string, "bullets": string[] } ] }.'

    const userContent = `Hãy tạo dàn ý bài giảng chi tiết, logic và hấp dẫn cho chủ đề sau:\n"${prompt}"`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: userContent }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          temperature: 0.7,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              title: { type: 'STRING' },
              sections: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    heading: { type: 'STRING' },
                    bullets: {
                      type: 'ARRAY',
                      items: { type: 'STRING' }
                    }
                  },
                  required: ['heading', 'bullets']
                }
              }
            },
            required: ['title', 'sections']
          }
        }
      })
    })

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as {
        error?: { message?: string }
      }
      const message =
        errorData.error?.message || `Gemini API lỗi mã ${response.status}`
      logger.error({ err: message }, 'gemini.generateOutline failed')
      throw new AppError(`Không thể sinh dàn ý từ AI: ${message}`, 502)
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>
        }
      }>
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!rawText) {
      logger.error(
        { err: 'Không nhận được nội dung từ Gemini' },
        'gemini.generateOutline failed'
      )
      throw new AppError('AI không trả về nội dung hợp lệ', 502)
    }

    const cleanText = rawText
      .replace(/^```json\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()
    const parsed = JSON.parse(cleanText) as GeneratedOutline

    if (
      !parsed.title ||
      !Array.isArray(parsed.sections) ||
      parsed.sections.length === 0
    ) {
      throw new AppError('Cấu trúc dàn ý trả về không đúng định dạng', 502)
    }

    return {
      title: parsed.title.trim(),
      sections: parsed.sections.map((s) => ({
        heading: s.heading || 'Nội dung',
        bullets: Array.isArray(s.bullets)
          ? s.bullets.map(String).filter(Boolean)
          : []
      }))
    }
  } catch (err) {
    if (err instanceof AppError) throw err
    logger.error({ err }, 'gemini.generateOutline failed')
    throw new AppError('Lỗi kết nối tới dịch vụ AI của Google', 502)
  }
}

export const buildSlidesFromOutline = (
  outline: GeneratedOutline,
  pattern: string
) => {
  return outline.sections.map((section) => ({
    id: `slide-${crypto.randomUUID()}`,
    pattern,
    title: section.heading,
    bullets: section.bullets,
    subtitle: '',
    layout: 'standard' as const,
    titleAlign: 'left' as const,
    titleSize: 'md' as const,
    bulletStyle: 'disc' as const,
    components: [],
    speakerNotes: ''
  }))
}

/**
 * Gọi Google Gemini API để chỉnh sửa slide theo chỉ dẫn của người dùng.
 * Nếu chưa cấu hình GEMINI_API_KEY, ném lỗi AppError trực tiếp về phía client.
 */
export const editSlideWithInstruction = async <
  T extends Record<string, unknown>
>(
  slide: T,
  instruction: string
): Promise<T> => {
  const normalizedInstruction = instruction.trim()
  const apiKey = env.GEMINI_API_KEY?.trim()

  if (!apiKey) {
    throw new AppError(
      'Hệ thống chưa được cấu hình GEMINI_API_KEY. Vui lòng thêm API key vào file .env.',
      500
    )
  }

  try {
    const url = `${GEMINI_API_BASE}/${DEFAULT_GEMINI_MODEL}:generateContent?key=${apiKey}`
    const systemInstruction =
      'Bạn là một trợ lý AI chuyên nghiệp về thiết kế và tinh chỉnh slide thuyết trình. ' +
      'Bạn nhận được thông tin một slide hiện tại (gồm title, bullets, subtitle, layout, speakerNotes) ' +
      'và một yêu cầu chỉnh sửa từ người dùng. ' +
      'Nhiệm vụ của bạn là thực hiện yêu cầu đó và trả về đối tượng JSON của slide sau khi chỉnh sửa. ' +
      'BẮT BUỘC giữ nguyên trường "id" và "pattern" của slide gốc. ' +
      'Chỉ trả về JSON thuần túy, không kèm bất kỳ giải thích nào.'

    const userContent =
      `Slide hiện tại:\n${JSON.stringify(slide, null, 2)}\n\n` +
      `Yêu cầu chỉnh sửa của người dùng: "${normalizedInstruction}"\n\n` +
      'Hãy cập nhật slide theo yêu cầu và trả về kết quả dưới dạng JSON hoàn chỉnh.'

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: userContent }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          temperature: 0.4,
          responseMimeType: 'application/json'
        }
      })
    })

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as {
        error?: { message?: string }
      }
      const message =
        errorData.error?.message || `Gemini API lỗi mã ${response.status}`
      logger.error({ err: message }, 'gemini.editSlide failed')
      throw new AppError(`Không thể chỉnh sửa slide bằng AI: ${message}`, 502)
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>
        }
      }>
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!rawText) {
      throw new AppError('AI không trả về nội dung chỉnh sửa slide', 502)
    }

    const cleanText = rawText
      .replace(/^```json\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()
    const parsed = JSON.parse(cleanText) as Record<string, unknown>

    return {
      ...slide,
      ...parsed,
      id: slide.id,
      pattern: slide.pattern ?? parsed.pattern
    }
  } catch (err) {
    if (err instanceof AppError) throw err
    logger.error({ err }, 'gemini.editSlide failed')
    throw new AppError('Lỗi kết nối tới dịch vụ AI của Google', 502)
  }
}
