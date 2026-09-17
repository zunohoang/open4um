import { env } from '@/config/env'
import { logger } from '@/lib/logger'
import { AppError } from '@/utils/AppError'

const AI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const DEFAULT_AI_MODEL = 'gemini-3.5-flash'

export interface OutlineSection {
  heading: string
  bullets: string[]
}

export interface GeneratedOutline {
  title: string
  sections: OutlineSection[]
}

/**
 * Sinh dàn ý bài giảng từ prompt.
 */
export const generateOutlineFromPrompt = async (
  prompt: string
): Promise<GeneratedOutline> => {
  const apiKey = env.GEMINI_API_KEY

  if (!apiKey) {
    logger.error({ err: 'Thiếu API key.' }, 'ai.generateOutline failed')
    throw new AppError(
      'Tính năng hiện chưa khả dụng. Vui lòng liên hệ quản trị viên.',
      503
    )
  }

  try {
    const url = `${AI_API_BASE}/${DEFAULT_AI_MODEL}:generateContent?key=${apiKey}`
    const systemInstruction =
      'Bạn là một trợ lý AI chuyên nghiệp về thiết kế bài giảng và slide thuyết trình. ' +
      'Hãy phân tích chủ đề của người dùng và tạo một dàn ý bài giảng có cấu trúc logic gồm từ 3 đến 6 chương/phần chính (sections). ' +
      'Mỗi phần cần có tiêu đề rõ ràng (heading, không ghi số thứ tự ở đầu tiêu đề như "1." hay "Chương 1:") và từ 2 đến 4 ý chính (bullets) súc tích, bao quát các điểm trọng tâm của chương đó. ' +
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
        errorData.error?.message || `AI API lỗi mã ${response.status}`
      logger.error({ err: message }, 'ai.generateOutline failed')
      throw new AppError(
        'Dịch vụ này tạm thời bị gián đoạn. Vui lòng thử lại sau.',
        502
      )
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
        { err: 'Không nhận được nội dung từ AI' },
        'ai.generateOutline failed'
      )
      throw new AppError(
        'Dịch vụ này tạm thời bị gián đoạn. Vui lòng thử lại sau.',
        502
      )
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
      logger.error(
        { err: 'Outline không đúng định dạng' },
        'ai.generateOutline failed'
      )
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
    logger.error({ err }, 'ai.generateOutline failed')
    throw new AppError(
      'Dịch vụ này tạm thời bị gián đoạn. Vui lòng thử lại sau.',
      502
    )
  }
}

/**
 * Tinh chỉnh lại dàn ý dựa trên Feedback của người dùng.
 */
export const refineOutlineWithFeedback = async (
  currentOutline: GeneratedOutline,
  originalPrompt: string,
  feedback: string
): Promise<GeneratedOutline> => {
  const apiKey = env.GEMINI_API_KEY

  if (!apiKey) {
    logger.error({ err: 'Thiếu API key.' }, 'ai.refineOutline failed')
    throw new AppError(
      'Tính năng hiện chưa khả dụng. Vui lòng liên hệ quản trị viên.',
      503
    )
  }

  try {
    const url = `${AI_API_BASE}/${DEFAULT_AI_MODEL}:generateContent?key=${apiKey}`
    const systemInstruction =
      'Bạn là một trợ lý AI chuyên nghiệp về thiết kế bài giảng và slide thuyết trình. ' +
      'Nhiệm vụ của bạn là nhận vào chủ đề bài giảng, dàn ý hiện tại và ý kiến góp ý điều chỉnh của người dùng, ' +
      'sau đó cập nhật và hoàn thiện lại dàn ý có cấu trúc logic gồm từ 3 đến 6 chương/phần chính (sections). ' +
      'Mỗi phần cần có tiêu đề rõ ràng (heading, không ghi số thứ tự ở đầu như "1." hay "Chương 1:") và từ 2 đến 4 ý chính (bullets) súc tích. ' +
      'Phản hồi BẮT BUỘC phải là JSON hợp lệ theo đúng cấu trúc: { "title": string, "sections": [ { "heading": string, "bullets": string[] } ] }.'

    const outlineSummary = currentOutline.sections
      .map(
        (sec, idx) =>
          `Phần ${idx + 1}: ${sec.heading}\nÝ chính: ${sec.bullets.join('; ')}`
      )
      .join('\n\n')

    const userContent =
      `Chủ đề bài giảng ban đầu: "${originalPrompt}"\n` +
      `Tiêu đề hiện tại: "${currentOutline.title}"\n\n` +
      `Dàn ý hiện tại:\n${outlineSummary}\n\n` +
      `Ý kiến / Yêu cầu điều chỉnh của người dùng:\n"${feedback}"\n\n` +
      'Hãy cập nhật và tinh chỉnh lại dàn ý theo đúng ý kiến đóng góp của người dùng.'

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
          responseMimeType: 'application/json'
        }
      })
    })

    if (!response.ok) {
      throw new AppError(
        'Dịch vụ này tạm thời bị gián đoạn. Vui lòng thử lại sau.',
        502
      )
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
      throw new AppError(
        'Dịch vụ này tạm thời bị gián đoạn. Vui lòng thử lại sau.',
        502
      )
    }

    const cleanText = rawText
      .replace(/^```json\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()
    const parsed = JSON.parse(cleanText) as GeneratedOutline

    return {
      title: parsed.title?.trim() || currentOutline.title,
      sections: (parsed.sections || []).map((s) => ({
        heading: s.heading || 'Nội dung',
        bullets: Array.isArray(s.bullets)
          ? s.bullets.map(String).filter(Boolean)
          : []
      }))
    }
  } catch (err) {
    if (err instanceof AppError) throw err
    logger.error({ err }, 'ai.refineOutline failed')
    throw new AppError(
      'Dịch vụ này tạm thời bị gián đoạn. Vui lòng thử lại sau.',
      502
    )
  }
}

export interface GeneratedSlideData {
  title: string
  subtitle?: string
  bullets: string[]
  layout?: 'standard' | 'two-column' | 'quote' | 'headline'
  titleAlign?: 'left' | 'center' | 'right'
  titleSize?: 'sm' | 'md' | 'lg' | 'xl'
  bulletStyle?: 'disc' | 'decimal' | 'dash' | 'none'
  speakerNotes?: string
}

/**
 * Sinh danh sách slide chi tiết từ dàn ý và prompt ban đầu (Giai đoạn 2).
 * Mỗi chương/section trong outline sẽ được AI mở rộng thành 2-3 slide có chiều sâu (lý thuyết, ví dụ, câu hỏi tương tác)
 * cùng với slide mở đầu (intro) và slide tổng kết (summary).
 */
export const generateSlidesFromOutline = async (
  outline: GeneratedOutline,
  prompt: string
): Promise<Array<Record<string, unknown>>> => {
  const apiKey = env.GEMINI_API_KEY

  if (!apiKey) {
    logger.error({ err: 'Thiếu API key.' }, 'ai.generateSlides failed')
    throw new AppError(
      'Tính năng hiện chưa khả dụng. Vui lòng liên hệ quản trị viên.',
      503
    )
  }

  try {
    const url = `${AI_API_BASE}/${DEFAULT_AI_MODEL}:generateContent?key=${apiKey}`
    const systemInstruction =
      'Bạn là một chuyên gia sư phạm và nhà thiết kế bài giảng trình chiếu chuyên nghiệp hàng đầu. ' +
      'Nhiệm vụ của bạn là nhận vào dàn ý bài giảng (tiêu đề và các chương chính) cùng chủ đề của người dùng, ' +
      'sau đó phát triển thành một bộ bài giảng (slides) hoàn chỉnh, mạch lạc và có chiều sâu sư phạm.\n' +
      'Cấu trúc bộ slide BẮT BUỘC bao gồm:\n' +
      '1. Slide mở đầu (Intro/Headline): Giới thiệu chủ đề, mục tiêu bài học hoặc câu hỏi kích thích tư duy.\n' +
      '2. Các slides nội dung chính: Với MỖI chương/phần (section) trong dàn ý, hãy triển khai thành 2 đến 3 slides chi tiết:\n' +
      '   - Slide lý thuyết cốt lõi: Giải thích bản chất, định nghĩa hoặc quy luật.\n' +
      '   - Slide ví dụ thực tế / phân tích tình huống / minh họa trực quan.\n' +
      '   - Slide thực hành / so sánh / câu hỏi tương tác gợi mở cho người học.\n' +
      '3. Slide tổng kết (Summary): Đúc kết các điểm trọng tâm cần nhớ (Key takeaways) và lời khuyên áp dụng.\n\n' +
      'Mỗi slide phải có:\n' +
      '- title: Tiêu đề súc tích, hấp dẫn\n' +
      '- subtitle: Phụ đề hoặc ngữ cảnh mở rộng\n' +
      '- bullets: Mảng từ 2 đến 5 ý chính rõ ràng, sắc nét\n' +
      '- layout: Chọn phù hợp giữa "standard" | "two-column" | "quote" | "headline"\n' +
      '- titleAlign: "left" | "center"\n' +
      '- titleSize: "sm" | "md" | "lg" | "xl"\n' +
      '- bulletStyle: "disc" | "decimal" | "dash"\n' +
      '- speakerNotes: Lời thoại hoặc hướng dẫn giảng dạy chi tiết cho giảng viên.'

    const outlineSummary = outline.sections
      .map(
        (sec, idx) =>
          `Phần ${idx + 1}: ${sec.heading}\nCác ý chính: ${sec.bullets.join('; ')}`
      )
      .join('\n\n')

    const userContent =
      `Chủ đề yêu cầu ban đầu: "${prompt || outline.title}"\n` +
      `Tiêu đề bài giảng: "${outline.title}"\n\n` +
      `Dàn ý các chương/phần chính:\n${outlineSummary}\n\n` +
      'Hãy phát triển thành một bộ slide hoàn chỉnh, giàu kiến thức và giá trị thực tế.'

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
              slides: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    title: { type: 'STRING' },
                    subtitle: { type: 'STRING' },
                    bullets: {
                      type: 'ARRAY',
                      items: { type: 'STRING' }
                    },
                    layout: { type: 'STRING' },
                    titleAlign: { type: 'STRING' },
                    titleSize: { type: 'STRING' },
                    bulletStyle: { type: 'STRING' },
                    speakerNotes: { type: 'STRING' }
                  },
                  required: ['title', 'bullets']
                }
              }
            },
            required: ['slides']
          }
        }
      })
    })

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as {
        error?: { message?: string }
      }
      const message =
        errorData.error?.message || `AI API lỗi mã ${response.status}`
      logger.error({ err: message }, 'ai.generateSlides failed')
      throw new AppError(
        'Dịch vụ này tạm thời bị gián đoạn. Vui lòng thử lại sau.',
        502
      )
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
        { err: 'Không nhận được nội dung từ AI' },
        'ai.generateSlides failed'
      )
      throw new AppError(
        'Dịch vụ này tạm thời bị gián đoạn. Vui lòng thử lại sau.',
        502
      )
    }

    const cleanText = rawText
      .replace(/^```json\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()
    const parsed = JSON.parse(cleanText) as { slides?: GeneratedSlideData[] }

    if (
      !parsed.slides ||
      !Array.isArray(parsed.slides) ||
      parsed.slides.length === 0
    ) {
      logger.error(
        { err: 'Slides trả về không đúng định dạng' },
        'ai.generateSlides failed'
      )
      throw new AppError('Cấu trúc slide trả về không đúng định dạng', 502)
    }

    return parsed.slides.map((s) => ({
      id: `slide-${crypto.randomUUID()}`,
      title: s.title || 'Slide nội dung',
      subtitle: s.subtitle || '',
      bullets: Array.isArray(s.bullets) ? s.bullets : [],
      layout: s.layout || 'standard',
      titleAlign: s.titleAlign || 'left',
      titleSize: s.titleSize || 'md',
      bulletStyle: s.bulletStyle || 'disc',
      components: [],
      speakerNotes: s.speakerNotes || ''
    }))
  } catch (err) {
    if (err instanceof AppError) throw err
    logger.error({ err }, 'ai.generateSlides failed')
    throw new AppError(
      'Dịch vụ này tạm thời bị gián đoạn. Vui lòng thử lại sau.',
      502
    )
  }
}

/**
 * Chỉnh sửa slide theo chỉ dẫn của người dùng.
 */
export const editSlideWithInstruction = async <
  T extends Record<string, unknown>
>(
  slide: T,
  instruction: string
): Promise<T> => {
  const normalizedInstruction = instruction.trim()
  const apiKey = env.GEMINI_API_KEY

  if (!apiKey) {
    logger.error({ err: 'Thiếu API key.' }, 'ai.generateOutline failed')
    throw new AppError(
      'Tính năng hiện chưa khả dụng. Vui lòng liên hệ quản trị viên.',
      503
    )
  }

  try {
    const url = `${AI_API_BASE}/${DEFAULT_AI_MODEL}:generateContent?key=${apiKey}`
    const systemInstruction =
      'Bạn là một trợ lý AI chuyên nghiệp về thiết kế và tinh chỉnh slide thuyết trình. ' +
      'Bạn nhận được thông tin một slide hiện tại (gồm title, bullets, subtitle, layout, speakerNotes) ' +
      'và một yêu cầu chỉnh sửa từ người dùng. ' +
      'Nhiệm vụ của bạn là thực hiện yêu cầu đó và trả về đối tượng JSON của slide sau khi chỉnh sửa. ' +
      'BẮT BUỘC giữ nguyên trường "id" của slide gốc. ' +
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
        errorData.error?.message || `AI API lỗi mã ${response.status}`
      logger.error({ err: message }, 'ai.editSlide failed')
      throw new AppError(
        'Dịch vụ này tạm thời bị gián đoạn. Vui lòng thử lại sau.',
        502
      )
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
        { err: 'Không nhận được nội dung từ AI' },
        'ai.editSlide failed'
      )
      throw new AppError(
        'Dịch vụ này tạm thời bị gián đoạn. Vui lòng thử lại sau.',
        502
      )
    }

    const cleanText = rawText
      .replace(/^```json\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()
    const parsed = JSON.parse(cleanText) as Record<string, unknown>

    return {
      ...slide,
      ...parsed,
      id: slide.id
    }
  } catch (err) {
    if (err instanceof AppError) throw err
    logger.error({ err }, 'ai.editSlide failed')
    throw new AppError('Lỗi kết nối tới dịch vụ AI của Google', 502)
  }
}
