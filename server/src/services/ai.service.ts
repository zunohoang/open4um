import { GoogleGenAI } from '@google/genai'
import { env } from '@/config/env'
import { buildSlideComponents } from '@/constants/theme-options'
import { logger } from '@/lib/logger'
import { AppError } from '@/utils/AppError'

const DEFAULT_AI_MODEL = env.GEMINI_MODEL || 'gemini-2.0-flash'

const getAiClient = (): GoogleGenAI => {
  const apiKey = env.GEMINI_API_KEY
  if (!apiKey) {
    logger.error({ err: 'Thiếu API key.' }, 'ai.getAiClient failed')
    throw new AppError(
      'Tính năng hiện chưa khả dụng. Vui lòng liên hệ quản trị viên.',
      503
    )
  }

  const options: {
    apiKey: string
    httpOptions?: {
      baseUrl: string
    }
  } = {
    apiKey
  }

  if (env.GEMINI_BASE_URL) {
    options.httpOptions = {
      baseUrl: env.GEMINI_BASE_URL
    }
  }

  return new GoogleGenAI(options)
}

/**
 * Phân tích cú pháp JSON từ phản hồi AI với khả năng tự động xử lý và phục hồi lỗi:
 * 1. Bóc tách markdown code blocks và text thừa xung quanh ({ ... } hoặc [ ... ]).
 * 2. Tự động escape các ký tự điều khiển (unescaped literal newlines \n, \r, \t) bên trong string literals.
 * 3. Tự động thêm nháy kép cho unquoted keys (vd: description: "..." -> "description": "...").
 * 4. Xóa bỏ trailing commas (vd: , } hoặc , ]).
 */
export const safeParseAiJson = <T>(rawText: string): T => {
  if (!rawText || !rawText.trim()) {
    throw new Error('Chuỗi phản hồi từ AI rỗng')
  }

  let text = rawText.trim()

  text = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()

  const firstBrace = text.indexOf('{')
  const firstBracket = text.indexOf('[')
  let startIndex = -1
  let endIndex = -1

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIndex = firstBrace
    endIndex = text.lastIndexOf('}')
  } else if (firstBracket !== -1) {
    startIndex = firstBracket
    endIndex = text.lastIndexOf(']')
  }

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    text = text.substring(startIndex, endIndex + 1)
  }

  try {
    return JSON.parse(text) as T
  } catch {
    // Tiếp tục phục hồi
  }

  let sanitized = ''
  let inString = false
  let isEscaped = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (inString) {
      if (isEscaped) {
        sanitized += char
        isEscaped = false
      } else if (char === '\\') {
        sanitized += char
        isEscaped = true
      } else if (char === '"') {
        sanitized += char
        inString = false
      } else if (char === '\n') {
        sanitized += '\\n'
      } else if (char === '\r') {
        sanitized += '\\r'
      } else if (char === '\t') {
        sanitized += '\\t'
      } else if (char.charCodeAt(0) < 32) {
        // bỏ qua control char
      } else {
        sanitized += char
      }
    } else {
      if (char === '"') {
        inString = true
      }
      sanitized += char
    }
  }

  try {
    return JSON.parse(sanitized) as T
  } catch {
    // Tiếp tục phục hồi unquoted keys và trailing commas
  }

  try {
    const fixedKeys = sanitized
      .replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":')
      .replace(/,\s*([}\]])/g, '$1')
    return JSON.parse(fixedKeys) as T
  } catch {
    try {
      const evalFn = new Function(`return (${sanitized})`)
      return evalFn() as T
    } catch (finalErr) {
      logger.error(
        { err: finalErr, snippet: text.substring(0, 300) },
        'safeParseAiJson failed to parse'
      )
      throw finalErr
    }
  }
}

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
  const ai = getAiClient()

  try {
    const systemInstruction =
      'Bạn là một trợ lý AI chuyên nghiệp về thiết kế bài giảng và slide thuyết trình. ' +
      'Hãy phân tích chủ đề của người dùng và tạo một dàn ý bài giảng có cấu trúc logic gồm từ 3 đến 6 chương/phần chính (sections). ' +
      'Mỗi phần cần có tiêu đề rõ ràng (heading, không ghi số thứ tự ở đầu tiêu đề như "1." hay "Chương 1:") và từ 2 đến 4 ý chính (bullets) súc tích, bao quát các điểm trọng tâm của chương đó. ' +
      'Phản hồi BẮT BUỘC phải là JSON hợp lệ theo đúng cấu trúc: { "title": string, "sections": [ { "heading": string, "bullets": string[] } ] }.'

    const userContent = `Hãy tạo dàn ý bài giảng chi tiết, logic và hấp dẫn cho chủ đề sau:\n"${prompt}"`

    const response = await ai.models.generateContent({
      model: DEFAULT_AI_MODEL,
      contents: userContent,
      config: {
        systemInstruction,
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

    const rawText = response.text
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

    const parsed = safeParseAiJson<GeneratedOutline>(rawText)

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
  const ai = getAiClient()

  try {
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

    const response = await ai.models.generateContent({
      model: DEFAULT_AI_MODEL,
      contents: userContent,
      config: {
        systemInstruction,
        temperature: 0.7,
        responseMimeType: 'application/json'
      }
    })

    const rawText = response.text
    if (!rawText) {
      throw new AppError(
        'Dịch vụ này tạm thời bị gián đoạn. Vui lòng thử lại sau.',
        502
      )
    }

    const parsed = safeParseAiJson<GeneratedOutline>(rawText)

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

export interface GeneratedContentItem {
  title: string
  description: string
  tag?: string
  stat?: string
}

export interface GeneratedSlideData {
  header?: string
  title: string
  subtitle?: string
  footer?: string
  contentLayout?:
    'cards' | 'steps' | 'callout' | 'icon-list' | 'two-column' | 'standard'
  contentItems?: GeneratedContentItem[]
  bullets: string[]
  layout?: 'standard' | 'two-column' | 'quote' | 'headline'
  titleAlign?: 'left' | 'center' | 'right'
  titleSize?: 'sm' | 'md' | 'lg' | 'xl'
  bulletStyle?: 'disc' | 'decimal' | 'dash' | 'none'
  speakerNotes?: string
}

/**
 * Sinh danh sách slide chi tiết từ dàn ý và prompt ban đầu (Giai đoạn 2).
 * Mỗi chương/section trong outline sẽ được AI mở rộng thành 2-3 slide có chiều sâu sư phạm,
 * hỗ trợ header/footer page và luân chuyển linh hoạt giữa các bố cục: headline, quote, two-column, standard.
 */
export const generateSlidesFromOutline = async (
  outline: GeneratedOutline,
  prompt: string
): Promise<Array<Record<string, unknown>>> => {
  const ai = getAiClient()

  try {
    const systemInstruction =
      'Bạn là một chuyên gia sư phạm và nhà thiết kế bài giảng trình chiếu chuyên nghiệp hàng đầu. ' +
      'Nhiệm vụ của bạn là nhận vào dàn ý bài giảng (tiêu đề và các chương chính) cùng chủ đề của người dùng, ' +
      'sau đó phát triển thành một bộ bài giảng (slides) hoàn chỉnh, trực quan, đặc sắc và có chiều sâu sư phạm.\n\n' +
      'Quy chuẩn cấu trúc bài giảng:\n' +
      '1. Slide mở đầu (Intro): Tiêu đề lớn, câu hỏi kích thích tư duy hoặc phụ đề truyền cảm hứng, layout "headline", không cần header.\n' +
      '2. Các slides nội dung chính: Với MỖI chương trong dàn ý, triển khai 2 đến 3 slides chi tiết. BẮT BUỘC AI PHẢI PHÂN TÍCH BẢN CHẤT NỘI DUNG ĐỂ CHỦ ĐỘNG CHỌN LAYOUT ẤN TƯỢNG, LUÂN CHUYỂN LINH HOẠT giữa 7 dạng bố cục trực quan sau (TUYỆT ĐỐI KHÔNG dùng quote):\n' +
      '   - "split-highlight": Bố cục bất đối xứng hiện đại! Cột trái là 1 khối thẻ Hero lớn chiếm 45% nổi bật viền nhấn màu chủ đạo (dành cho luận điểm trọng tâm cốt lõi); Cột phải là 2 thẻ con nhỏ xếp chồng giải thích bổ trợ.\n' +
      '   - "metrics-grid": Bố cục số liệu / thống kê ấn tượng! Gồm 2 đến 3 khối hộp hiển thị con số đo lường khổng lồ (cung cấp trường "stat" như 85%, 3.5X, 10M+, 24/7) kèm tiêu đề và phân tích bên dưới.\n' +
      '   - "quad-grid": Lưới 4 ô thẻ 2x2 cân xứng hoàn hảo! Dành cho nội dung có 4 yếu tố, 4 góc nhìn, mô hình SWOT, 4 giai đoạn hoặc 4 nguyên tắc.\n' +
      '   - "horizontal-rows": 3 thanh thẻ dài nằm ngang xếp tầng từ trên xuống, mỗi thanh có huy hiệu thứ tự ở đầu, tiêu đề và giải thích trải rộng.\n' +
      '   - "two-column": 2 khối cột chữ nhật bo góc cân đối đối xứng (50-50), dành cho phân tích so sánh, đối chiếu (Ưu vs Nhược, Lý thuyết vs Thực tế).\n' +
      '   - "steps": Quy trình các bước thực hiện tuần tự 01, 02, 03 có huy hiệu số bước nổi bật, dành cho hướng dẫn kỹ thuật, luồng xử lý, lộ trình triển khai.\n' +
      '   - "cards": 3 thẻ chữ nhật đứng song song (Cards Grid kinh điển), dành cho các tính năng, đặc điểm hoặc mô đun kiến thức thông thường.\n' +
      '   Mỗi slide có thể có "header" (ví dụ: "CHƯƠNG 01 • TỔNG QUAN", "PHẦN 02 • THỰC HÀNH") và "footer" để định hình phong cách.\n' +
      '3. BẮT BUỘC VỀ DỮ LIỆU NỘI DUNG (QUAN TRỌNG NHẤT - KHÔNG ĐƯỢC BỎ TRỐNG):\n' +
      '   - MỌI slide nội dung (trừ slide mở đầu headline) BẮT BUỘC PHẢI CÓ TỪ 2 ĐẾN 4 PHẦN TỬ TRONG "contentItems" VÀ "bullets".\n' +
      '   - TUYỆT ĐỐI KHÔNG ĐƯỢC trả về mảng rỗng [] hay null cho contentItems hay bullets.\n' +
      '   - Mỗi phần tử trong "contentItems" phải có "title" (tiêu đề khối súc tích từ 3 đến 7 từ) và "description" (nội dung phân tích cô đọng chuẩn slide từ 15 đến 25 từ, đi thẳng vào trọng tâm, TUYỆT ĐỐI KHÔNG viết đoạn văn dài lê thê làm tràn hộp thẻ slide).\n' +
      '   - Với layout "split-highlight", "cards", "horizontal-rows", "steps": bắt buộc sinh 3 items.\n' +
      '   - Với layout "two-column": bắt buộc sinh 2 items đối chiếu.\n' +
      '   - Với layout "quad-grid": bắt buộc sinh 4 items (mỗi item description tối đa 15 từ).\n' +
      '   - Với layout "metrics-grid": bắt buộc sinh 2-3 items có "stat" (chỉ số, độ phức tạp Big-O, phần trăm hoặc số lượng) kèm "title" và "description".\n' +
      '4. Slide tổng kết (Summary): Đúc kết các điểm then chốt cần ghi nhớ (Key takeaways).\n\n' +
      'Mỗi slide trả về các trường:\n' +
      '- header: Nhãn chương mục ở đầu trang (hoặc để trống "").\n' +
      '- title: Tiêu đề súc tích, rõ ràng.\n' +
      '- subtitle: Phụ đề bổ trợ (nếu cần).\n' +
      '- footer: Chân trang (hoặc để trống "").\n' +
      '- layout: "split-highlight" | "metrics-grid" | "quad-grid" | "horizontal-rows" | "two-column" | "steps" | "cards" | "headline".\n' +
      '- contentItems: Bắt buộc mảng 2-4 phần tử { title: string, description: string, stat?: string, tag?: string } chứa đầy đủ kiến thức.\n' +
      '- bullets: Bắt buộc mảng 2-4 câu tóm tắt ý chính.\n' +
      '- titleAlign: "left" | "center".\n' +
      '- titleSize: "sm" | "md" | "lg" | "xl".\n' +
      '- bulletStyle: "disc" | "decimal" | "dash".\n' +
      '- speakerNotes: Lời thoại giảng dạy cho giảng viên.\n\n' +
      'BẮT BUỘC: Phản hồi duy nhất 1 JSON object chuẩn có thuộc tính "slides" là danh sách các slide. Không chèn ký tự xuống dòng thô bên trong các giá trị chuỗi.'

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
      'Hãy phát triển thành một bộ slide trực quan, sinh động với các bố cục đặc sắc đa dạng (hero highlight, metrics, quad grid, horizontal rows, cards, steps).\n' +
      'LƯU Ý ĐẶC BIỆT: Tất cả các slide nội dung đều phải được viết đầy đủ nội dung chi tiết vào mảng contentItems và bullets, tuyệt đối không để mảng rỗng!'

    const response = await ai.models.generateContent({
      model: DEFAULT_AI_MODEL,
      contents: userContent,
      config: {
        systemInstruction,
        temperature: 0.7,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            slides: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  header: { type: 'STRING' },
                  title: { type: 'STRING' },
                  subtitle: { type: 'STRING' },
                  footer: { type: 'STRING' },
                  layout: {
                    type: 'STRING',
                    enum: [
                      'split-highlight',
                      'metrics-grid',
                      'quad-grid',
                      'horizontal-rows',
                      'two-column',
                      'steps',
                      'cards',
                      'headline'
                    ]
                  },
                  contentItems: {
                    type: 'ARRAY',
                    items: {
                      type: 'OBJECT',
                      properties: {
                        title: { type: 'STRING' },
                        description: { type: 'STRING' },
                        stat: { type: 'STRING' },
                        tag: { type: 'STRING' }
                      },
                      required: ['title', 'description']
                    }
                  },
                  bullets: {
                    type: 'ARRAY',
                    items: { type: 'STRING' }
                  },
                  titleAlign: { type: 'STRING' },
                  titleSize: { type: 'STRING' },
                  bulletStyle: { type: 'STRING' },
                  speakerNotes: { type: 'STRING' }
                },
                required: ['title', 'layout', 'contentItems', 'bullets']
              }
            }
          },
          required: ['slides']
        }
      }
    })

    const rawText = response.text
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

    const parsed = safeParseAiJson<
      Record<string, unknown> | GeneratedSlideData[]
    >(rawText)

    let rawSlides: GeneratedSlideData[] = []
    if (Array.isArray(parsed)) {
      rawSlides = parsed
    } else if (Array.isArray(parsed.slides)) {
      rawSlides = parsed.slides as GeneratedSlideData[]
    } else if (Array.isArray(parsed.data)) {
      rawSlides = parsed.data as GeneratedSlideData[]
    } else if (
      Array.isArray((parsed.presentation as Record<string, unknown>)?.slides)
    ) {
      rawSlides = (parsed.presentation as Record<string, unknown>)
        .slides as GeneratedSlideData[]
    }

    if (rawSlides.length === 0) {
      logger.error(
        {
          err: 'Slides trả về không đúng định dạng',
          keys: Array.isArray(parsed) ? 'is_array_empty' : Object.keys(parsed)
        },
        'ai.generateSlides failed'
      )
      throw new AppError('Cấu trúc slide trả về không đúng định dạng', 502)
    }

    return rawSlides.map((s) => ({
      id: `slide-${crypto.randomUUID()}`,
      header: s.header || '',
      title: s.title || 'Slide nội dung',
      subtitle: s.subtitle || '',
      footer: s.footer || '',
      bullets: Array.isArray(s.bullets) ? s.bullets : [],
      contentItems: Array.isArray(s.contentItems) ? s.contentItems : undefined,
      layout: s.layout || s.contentLayout || 'cards',
      titleAlign:
        s.titleAlign ||
        (s.layout === 'headline' || s.layout === 'quote' ? 'center' : 'left'),
      titleSize: s.titleSize || (s.layout === 'headline' ? 'xl' : 'md'),
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
  const ai = getAiClient()

  try {
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

    const response = await ai.models.generateContent({
      model: DEFAULT_AI_MODEL,
      contents: userContent,
      config: {
        systemInstruction,
        temperature: 0.4,
        responseMimeType: 'application/json'
      }
    })

    const rawText = response.text
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

    const parsed = safeParseAiJson<Record<string, unknown>>(rawText)

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

export interface AiChatSlideSummary {
  slideNumber: number
  id: string
  header?: string
  title: string
  bullets: string[]
  layout: string
  contentItems?: Array<{ title?: string; description?: string }>
}

export interface AiChatContext {
  presentationTitle: string
  totalSlides: number
  currentSlideIndex: number
  currentSlide?: Record<string, unknown>
  surroundingSlides?: {
    prev?: Record<string, unknown>
    next?: Record<string, unknown>
  }
  slidesCatalog?: AiChatSlideSummary[]
  outlineOverview?: string
  contextSummary?: string
  selectedElement?: Record<string, unknown>
  sourceMaterial?: string
  history?: Array<{ role: 'user' | 'assistant'; text: string }>
  theme?: string
}

export type AiSlideAction =
  | 'UPDATE_CURRENT_SLIDE'
  | 'UPDATE_SLIDE'
  | 'CREATE_SLIDE'
  | 'BATCH_CHANGES'
  | 'CHAT_ONLY'

export interface AiSlideProposal {
  id?: string
  action: 'CREATE_SLIDE' | 'UPDATE_SLIDE'
  targetSlideIndex: number
  proposedSlide: Record<string, unknown>
  summary?: string
}

export interface AiChatResponse {
  thought?: string
  reply: string
  action: AiSlideAction
  targetSlideIndex?: number
  proposedSlide?: Record<string, unknown>
  proposals?: AiSlideProposal[]
  updatedSummary?: string
}

/**
 * Trò chuyện AI và đề xuất chỉnh sửa/tạo slide dựa trên toàn bộ ngữ cảnh bài giảng.
 */
export const chatAndProposeSlideEdit = async (
  userMessage: string,
  context: AiChatContext
): Promise<AiChatResponse> => {
  const normalizedMessage = userMessage.trim()
  const ai = getAiClient()

  try {
    const systemInstruction =
      'Bạn là một chuyên gia sư phạm, giám đốc sáng tạo và trợ lý thiết kế bài giảng trình chiếu chuyên nghiệp hàng đầu. ' +
      'Nhiệm vụ của bạn là đồng hành cùng người dùng trong giao diện Slide Editor như một Agent thông minh: hỗ trợ trao đổi, tư vấn, và thực hiện chỉnh sửa / bổ sung / tái cấu trúc bài giảng. ' +
      'Bạn có đầy đủ nhận thức ngữ cảnh (Context Awareness) bao gồm:\n' +
      '- Toàn bộ danh mục các slide trong bài giảng (slidesCatalog: gồm số thứ tự slideNumber, id, title, bullets, layout).\n' +
      '- Slide hiện tại mà người dùng đang mở (currentSlide với đầy đủ components).\n' +
      '- Tóm tắt cốt lõi bài giảng (contextSummary) duy trì tính nhất quán xuyên suốt.\n' +
      '- Slide trước/sau (surroundingSlides), thành phần đang chọn (selectedElement), tài liệu tham khảo (sourceMaterial) và lịch sử trò chuyện.\n\n' +
      'QUY TẮC NHẬN DIỆN PHẠM VI & MỤC TIÊU (SCOPE & TARGET RESOLUTION - BẮT BUỘC TUÂN THỦ):\n' +
      'Trước khi quyết định hành động, bạn BẮT BUỘC phải phân tích ý định của người dùng thuộc 1 trong 3 trường hợp sau:\n\n' +
      '1. PHẠM VI TOÀN BÀI HOẶC HÀNG LOẠT (Global / Multi-slide Scope):\n' +
      '   - Dấu hiệu nhận biết: Câu yêu cầu nhắc đến "các slide...", "toàn bộ slide", "sau các khái niệm", "mỗi phần", "tất cả", "toàn bài", "thêm ví dụ code sau định nghĩa", "đọc lại toàn bộ", hoặc tác động lên nhiều chủ đề trong bài giảng.\n' +
      '   - BẮT BUỘC phân biệt rõ 2 loại yêu cầu hàng loạt:\n' +
      '     + LOẠI 1 - CHỈNH SỬA / CẬP NHẬT HÀNG LOẠT SLIDE HIỆN CÓ (Batch Update):\n' +
      '       Khi người dùng yêu cầu: "Đọc lại toàn bộ slide, chỉnh sửa layout sao cho không bị đè chữ", "chỉnh sửa các slide", "rút gọn nội dung tất cả các slide", "đổi bố cục các slide"...\n' +
      '       -> BẮT BUỘC trả về "action": "BATCH_CHANGES".\n' +
      '       -> Mảng "proposals" chứa các đề xuất với "action": "UPDATE_SLIDE" cho từng slide tương ứng trong "slidesCatalog".\n' +
      '       -> "targetSlideIndex": là 0-indexed vị trí của chính slide cần cập nhật (Slide 1: index 0, Slide 2: index 1,...).\n' +
      '       -> TUYỆT ĐỐI KHÔNG DÙNG "CREATE_SLIDE" trong trường hợp này, vì nếu dùng CREATE_SLIDE sẽ nhân đôi slide và giữ nguyên các slide cũ bị lỗi!\n' +
      '     + LOẠI 2 - THÊM / TẠO MỚI HÀNG LOẠT SLIDE MỚI (Batch Create):\n' +
      '       Khi người dùng yêu cầu: "thêm/viết các slide ví dụ code sau các slide khái niệm", "tạo slide bài tập cho mỗi chương"...\n' +
      '       -> BẮT BUỘC trả về "action": "BATCH_CHANGES".\n' +
      '       -> Mảng "proposals" chứa các slide mới với "action": "CREATE_SLIDE" (từ 3 đến 6 slides).\n' +
      '       -> "targetSlideIndex": là vị trí của slide đứng trước vị trí cần chèn.\n\n' +
      '2. PHẠM VI CHỈ ĐỊNH RÕ RÀNG SLIDE ĐÍCH (Explicit Slide / Topic Target Scope):\n' +
      '   - Dấu hiệu nhận biết: Người dùng nhắc đến số thứ tự slide (ví dụ: "sửa slide 3", "thêm slide sau slide 5", "tạo slide sau slide 2") HOẶC nhắc đến tiêu đề/chủ đề cụ thể (ví dụ: "sửa slide về Ngăn xếp", "thêm ví dụ vào phần Biến và Kiểu dữ liệu", "viết lại phần Con trỏ").\n' +
      '   - Hành vi BẮT BUỘC: Tra cứu trong "slidesCatalog" để tìm slide có tiêu đề hoặc số thứ tự khớp nhất. Đặt "targetSlideIndex" là vị trí của slide tìm được đó trong bài giảng. TUYỆT ĐỐI KHÔNG mặc định lấy slide hiện tại (currentSlide) nếu slide người dùng nói đến khác với slide hiện tại!\n\n' +
      '3. PHẠM VI CỤC BỘ TẠI SLIDE ĐANG MỞ (Current Slide Scope):\n' +
      '   - Dấu hiệu nhận biết: Người dùng dùng từ ngữ chỉ vị trí hiện tại ("slide này", "ở đây", "tiêu đề này", "khối chữ này") HOẶC các câu lệnh chỉnh sửa chung chung ("rút ngắn lại", "viết chi tiết hơn", "đổi sang layout 3 cột", "đổi màu") mà không nhắc tới bất kỳ slide hay chủ đề nào khác.\n' +
      '   - Hành vi BẮT BUỘC: Lúc này mới áp dụng chỉnh sửa vào slide hiện tại ("targetSlideIndex": currentSlideIndex) và sử dụng các component của currentSlide để tinh chỉnh.\n\n' +
      'QUY TẮC BẮT BUỘC KHI XÁC ĐỊNH HÀNH ĐỘNG (ACTION) & ĐỀ XUẤT:\n' +
      '1. "BATCH_CHANGES" (ÁP DỤNG HÀNG LOẠT):\n' +
      '   - Phục vụ cả 2 mục đích: Cập nhật nhiều slide đã có ("action": "UPDATE_SLIDE" cho từng phần tử) HOẶC tạo thêm nhiều slide mới ("action": "CREATE_SLIDE" cho từng phần tử).\n' +
      '   - TUYỆT ĐỐI KHÔNG xuất trường "proposedSlide" ở ngoài cùng JSON khi action là "BATCH_CHANGES". Toàn bộ các slide BẮT BUỘC phải nằm trong mảng "proposals".\n' +
      '   - BẮT BUỘC sắp xếp các phần tử trong "proposals" theo thứ tự targetSlideIndex tăng dần.\n\n' +
      '2. "CREATE_SLIDE" (ĐÚNG 1 SLIDE MỚI ĐƠN LẺ):\n' +
      '   - Chỉ dùng khi người dùng yêu cầu thêm đúng 1 slide duy nhất (ví dụ: "thêm 1 slide kết luận ở cuối").\n' +
      '   - "targetSlideIndex": vị trí slide đứng trước vị trí cần chèn.\n' +
      '   - "proposedSlide": đối tượng slide mới hoàn chỉnh.\n\n' +
      '3. "UPDATE_SLIDE" (CẬP NHẬT 1 SLIDE HIỆN CÓ):\n' +
      '   - Chỉ dùng khi người dùng yêu cầu chỉnh sửa, tóm gọn, viết lại, hoặc thay đổi nội dung của một slide đã có sẵn.\n' +
      '   - TUYỆT ĐỐI KHÔNG dùng khi người dùng yêu cầu thêm slide mới hoặc viết slide sau slide khác!\n' +
      '   - "targetSlideIndex": 0-indexed vị trí slide cần cập nhật.\n' +
      '   - "proposedSlide": đối tượng slide với nội dung sau khi cập nhật.\n\n' +
      '4. "CHAT_ONLY":\n' +
      '   - Khi người dùng chỉ hỏi đáp, xin tư vấn mà không yêu cầu thay đổi hay tạo slide.\n\n' +
      'CẤU TRÚC JSON PHẢN HỒI MẪU CHO BATCH_CHANGES (Khi yêu cầu thêm slide ví dụ code sau các khái niệm/lý thuyết):\n' +
      '{\n' +
      '  "reply": "Tôi đã tạo 4 slide ví dụ code minh họa bằng C++ chèn ngay sau các phần lý thuyết trọng tâm của bài giảng.",\n' +
      '  "action": "BATCH_CHANGES",\n' +
      '  "proposals": [\n' +
      '    {\n' +
      '      "action": "CREATE_SLIDE",\n' +
      '      "targetSlideIndex": 1,\n' +
      '      "summary": "Ví dụ Code: Cấu Trúc Node",\n' +
      '      "proposedSlide": {\n' +
      '        "header": "VÍ DỤ CODE C++",\n' +
      '        "title": "Cài Đặt Node và Chèn Đầu Danh Sách",\n' +
      '        "subtitle": "Thao tác con trỏ và cấp phát động trong C++",\n' +
      '        "layout": "code",\n' +
      '        "codeLanguage": "cpp",\n' +
      '        "codeSnippet": "#include <iostream>\\nusing namespace std;\\n\\nstruct Node {\\n    int data;\\n    Node* next;\\n};\\n\\nvoid pushHead(Node*& head, int val) {\\n    Node* newNode = new Node{val, head};\\n    head = newNode;\\n    cout << \\"Đã thêm: \\" << val << endl;\\n}",\n' +
      '        "contentItems": [\n' +
      '          { "title": "Cấu trúc Node", "description": "Lưu dữ liệu và con trỏ next tới phần tử kế." },\n' +
      '          { "title": "Cấp phát động", "description": "Dùng toán tử new để tạo node trên vùng nhớ Heap." },\n' +
      '          { "title": "Độ phức tạp O(1)", "description": "Gắn node mới lên đầu giúp tối ưu thời gian O(1)." }\n' +
      '        ],\n' +
      '        "bullets": ["Quản lý chặt chẽ con trỏ head", "Giải phóng bộ nhớ bằng delete khi xóa"],\n' +
      '        "speakerNotes": "Giải thích chi tiết cơ chế cấp phát bộ nhớ động của Node trong danh sách liên kết đơn."\n' +
      '      }\n' +
      '    },\n' +
      '    {\n' +
      '      "action": "CREATE_SLIDE",\n' +
      '      "targetSlideIndex": 2,\n' +
      '      "summary": "Ví dụ Code: Thao Tác Ngăn Xếp",\n' +
      '      "proposedSlide": {\n' +
      '        "header": "VÍ DỤ CODE C++",\n' +
      '        "title": "Thực Thi Ngăn Xếp (Stack) Với Mảng",\n' +
      '        "subtitle": "Nguyên lý LIFO: Thao tác Push và Pop",\n' +
      '        "layout": "code",\n' +
      '        "codeLanguage": "cpp",\n' +
      '        "codeSnippet": "#include <iostream>\\n#define MAX 100\\nusing namespace std;\\n\\nint top = -1;\\nint stackArr[MAX];\\n\\nvoid push(int val) {\\n    if (top >= MAX - 1) return;\\n    stackArr[++top] = val;\\n}\\n\\nint pop() {\\n    if (top < 0) return -1;\\n    return stackArr[top--];\\n}",\n' +
      '        "contentItems": [\n' +
      '          { "title": "Chỉ số top", "description": "Theo dõi vị trí phần tử trên cùng của Stack." },\n' +
      '          { "title": "Thao tác Push/Pop", "description": "Thêm và lấy phần tử với độ phức tạp tối ưu O(1)." },\n' +
      '          { "title": "Tràn ngăn xếp", "description": "Kiểm tra giới hạn MAX để tránh tràn bộ đệm." }\n' +
      '        ],\n' +
      '        "bullets": ["Quy tắc vào sau ra trước (LIFO)", "Cần kiểm tra mảng rỗng trước khi pop"],\n' +
      '        "speakerNotes": "Lưu ý học viên về kích thước bộ nhớ và xử lý lỗi tràn ngăn xếp (Stack Overflow)."\n' +
      '      }\n' +
      '    },\n' +
      '    {\n' +
      '      "action": "CREATE_SLIDE",\n' +
      '      "targetSlideIndex": 3,\n' +
      '      "summary": "Ví dụ Code: Tìm Kiếm Nhị Phân",\n' +
      '      "proposedSlide": {\n' +
      '        "header": "VÍ DỤ CODE C++",\n' +
      '        "title": "Thuật Toán Tìm Kiếm Nhị Phân",\n' +
      '        "subtitle": "Tối ưu hóa tìm kiếm trên mảng đã sắp xếp",\n' +
      '        "layout": "code",\n' +
      '        "codeLanguage": "cpp",\n' +
      '        "codeSnippet": "int binarySearch(int arr[], int n, int x) {\\n    int left = 0, right = n - 1;\\n    while (left <= right) {\\n        int mid = left + (right - left) / 2;\\n        if (arr[mid] == x) return mid;\\n        if (arr[mid] < x) left = mid + 1;\\n        else right = mid - 1;\\n    }\\n    return -1;\\n}",\n' +
      '        "contentItems": [\n' +
      '          { "title": "Phân đôi không gian", "description": "Giảm một nửa số phần tử cần xét sau mỗi bước." },\n' +
      '          { "title": "Độ phức tạp O(log n)", "description": "Vượt trội hoàn toàn so với tìm kiếm tuần tự O(n)." },\n' +
      '          { "title": "Tránh tràn số", "description": "Tính mid = left + (right - left) / 2 an toàn tuyệt đối." }\n' +
      '        ],\n' +
      '        "bullets": ["Điều kiện tiên quyết: Mảng phải được sắp xếp trước", "Thời gian thực thi O(log n)"],\n' +
      '        "speakerNotes": "Nhắc nhở học viên về lỗi tràn số nguyên khi tính (left + right) / 2."\n' +
      '      }\n' +
      '    },\n' +
      '    {\n' +
      '      "action": "CREATE_SLIDE",\n' +
      '      "targetSlideIndex": 4,\n' +
      '      "summary": "Ví dụ Code: Thuật Toán Sắp Xếp Nổi Bọt",\n' +
      '      "proposedSlide": {\n' +
      '        "header": "VÍ DỤ CODE C++",\n' +
      '        "title": "Cài Đặt Bubble Sort Trong C++",\n' +
      '        "subtitle": "Đổi chỗ các cặp phần tử liền kề sai thứ tự",\n' +
      '        "layout": "code",\n' +
      '        "codeLanguage": "cpp",\n' +
      '        "codeSnippet": "void bubbleSort(int arr[], int n) {\\n    for (int i = 0; i < n - 1; i++) {\\n        bool swapped = false;\\n        for (int j = 0; j < n - i - 1; j++) {\\n            if (arr[j] > arr[j + 1]) {\\n                swap(arr[j], arr[j + 1]);\\n                swapped = true;\\n            }\\n        }\\n        if (!swapped) break;\\n    }\\n}",\n' +
      '        "contentItems": [\n' +
      '          { "title": "Vòng lặp kép", "description": "Duyệt qua mảng và đẩy phần tử lớn nhất về cuối." },\n' +
      '          { "title": "Tối ưu cờ swapped", "description": "Dừng sớm khi mảng đã có thứ tự, tối ưu trường hợp tốt nhất O(n)." },\n' +
      '          { "title": "Độ phức tạp O(n^2)", "description": "Dễ hiểu, phù hợp cho tập dữ liệu kích thước nhỏ." }\n' +
      '        ],\n' +
      '        "bullets": ["Cơ chế nổi bọt phần tử", "Tối ưu hóa dừng sớm với biến swapped"],\n' +
      '        "speakerNotes": "Phân tích số phép so sánh và hoán đổi vị trí của Bubble Sort."\n' +
      '      }\n' +
      '    }\n' +
      '  ],\n' +
      '  "updatedSummary": "Đã cập nhật bài giảng C++ với 4 slide ví dụ code thực hành sau các bài lý thuyết."\n' +
      '}\n\n' +
      'QUY TẮC BỐ CỤC (LAYOUTS) & CHỐNG TRÀN CHỮ, ĐÈ CHỮ (BẮT BUỘC TUÂN THỦ):\n' +
      '1. Layout "metrics-grid" (Lưới chỉ số thống kê nổi bật):\n' +
      '   - Dùng cho 2-3 số liệu thống kê lớn (Big Numbers), tỷ lệ, Big-O, kết quả đo lường.\n' +
      '   - Mỗi item trong "contentItems" có: "stat", "title", "description".\n' +
      '   - "stat": BẮT BUỘC LÀ SỐ LIỆU SIÊU NGẮN (tối đa 4-6 ký tự, ví dụ: "500+", "95%", "10x", "Top 1", "O(1)", "$2M").\n' +
      '   - TUYỆT ĐỐI KHÔNG để câu văn hoặc cụm từ dài (như "Ứng dụng Rộng rãi", "Nghiên cứu khoa học") vào trường "stat". Nếu nội dung mang tính định tính/mô tả khái niệm, BẮT BUỘC chuyển layout sang "cards" hoặc chuyển "stat" thành số liệu ngắn gọn (ví dụ: "100%", "Top 1")!\n' +
      '   - KHI NGƯỜI DÙNG PHÀN NÀN "TRÀN CHỮ / ĐÈ CHỮ / CHỮ CHỒNG LÊN NHAU" Ở SLIDE DÙNG "metrics-grid":\n' +
      '     + Kiểm tra ngay slide đích: Nếu có "stat" là văn bản dài, BẮT BUỘC rút gọn "stat" thành con số (<= 5 ký tự) HOẶC đổi "layout": "cards"!\n' +
      '     + Rút gọn "description" còn 12-16 từ súc tích.\n' +
      '2. Layout "cards" (Lưới thẻ thông dụng): Bố cục an toàn nhất cho mọi nội dung lý thuyết, định nghĩa, đặc điểm. Thẻ tự động co giãn, không bao giờ đè chữ.\n' +
      '3. Layout "split-highlight": 1 Thẻ Hero lớn bên trái + 2 Thẻ con bên phải. Dùng khi có 1 ý quan trọng hàng đầu.\n' +
      'BẢNG MẪU NHẬN DIỆN KHẨU NGỮ TIẾNG VIỆT & HÀNH ĐỘNG CHUẨN (FEW-SHOT EXAMPLES):\n' +
      '1. Khẩu ngữ: "Phần [Tên cụm từ] cơ mà" / "Chỗ này bị lỗi cơ mà" / "Sửa phần [Tên] cơ mà":\n' +
      '   - Ý định thực sự: Người dùng đang nhấn mạnh vào thành phần [Tên] vì thành phần đó đang bị lỗi hiển thị, tràn chữ hoặc đè chữ, KHÔNG PHẢI người dùng yêu cầu viết văn dài dòng về chủ đề đó!\n' +
      '   - Hành động chuẩn: Kiểm tra xem cụm từ đó đang nằm ở đâu. Nếu nằm ở ô "stat" của layout "metrics-grid", BẮT BUỘC đổi layout sang "cards" hoặc rút gọn thành số ngắn (<= 5 ký tự). Trong "reply", giải thích rõ: "Tôi nhận thấy cụm từ [...] đang gây tràn/đè chữ ở ô số liệu nên tôi đã chuyển layout sang thẻ Cards để hiển thị thông thoáng và hoàn toàn hết đè chữ."\n' +
      '2. Khẩu ngữ: "Bị đè chữ rồi" / "Chữ chồng lên nhau" / "Vỡ khung rồi":\n' +
      '   - Ý định thực sự: Khắc phục lỗi bố cục vật lý.\n' +
      '   - Hành động chuẩn: Chuyển sang layout "cards", rút gọn "description" còn 12-14 từ.\n' +
      '3. Khẩu ngữ: "Rút gọn lại" / "Dài quá":\n' +
      '   - Ý định thực sự: Rút gọn văn bản description còn 1-2 câu ngắn (10-14 từ).\n\n' +
      'QUY TẮC CƯỠNG CHẾ ĐẶC BIỆT KHI VIẾT SLIDE VÍ DỤ CODE:\n' +
      '- BẮT BUỘC đặt "layout": "code", "codeLanguage": "cpp".\n' +
      '- BẮT BUỘC cung cấp trường "codeSnippet" chứa mã nguồn C++ thực tế hoàn chỉnh, có khai báo struct/biến/hàm/cout. TUYỆT ĐỐI KHÔNG ĐƯỢC VIẾT VĂN XUÔI LÝ THUYẾT TRONG CODE!\n\n' +
      'QUY TẮC ĐỘ DÀI VĂN BẢN (CHỐNG TRÀN CHỮ - BẮT BUỘC):\n' +
      '- Tiêu đề chính của slide (title): Ngắn gọn từ 4 đến 8 từ. Tránh tiêu đề quá dài làm tràn 3-4 dòng.\n' +
      '- Tiêu đề con của mỗi khối (item title): Súc tích từ 3 đến 6 từ.\n' +
      '- Nội dung mô tả (description) của mỗi khối: BẮT BUỘC KHÔNG VƯỢT QUÁ 14 ĐẾN 18 TỪ (tối đa 1-2 câu súc tích). TUYỆT ĐỐI KHÔNG VIẾT ĐOẠN VĂN DÀI (trên 22 từ) vì sẽ làm vỡ khung thẻ và tràn ra ngoài đường viền slide!\n' +
      '- BẤT KỲ KHI NÀO người dùng yêu cầu "sửa slide", "đẹp và gọn gàng", "rút gọn", "sửa layout", "chống đè chữ": Bạn BẮT BUỘC phải biên tập lại toàn bộ các câu văn dài dòng thành các câu cô đọng, giàu giá trị thông tin, chỉ dài 12-16 từ mỗi thẻ!\n\n' +
      'QUY TẮC PHẢN HỒI JSON:\n' +
      '- Cung cấp trường "thought" (Chuỗi suy luận): Phân tích ngắn gọn ý định người dùng (Sửa nội dung hay Lỗi hiển thị đồ họa) và giải pháp bố cục được chọn trước khi xuất JSON.\n' +
      '- Phản hồi BẮT BUỘC là JSON thuần túy theo cấu trúc trên. Tuyệt đối không chèn ký tự xuống dòng thô bên trong chuỗi string.'

    const isUserAskingToCreate =
      /\b(thêm|tạo|bổ sung|viết thêm|chèn thêm)\b.*?\b(slide|slides|trang)\b/i.test(
        normalizedMessage
      ) ||
      /\b(thêm|tạo|bổ sung)\b.*?\b(ví dụ|code|bài tập|minh họa)\b.*?\b(sau|cho)\b/i.test(
        normalizedMessage
      )

    const isUserAskingToEdit =
      /\b(sửa|chỉnh sửa|điều chỉnh|đổi|thay đổi|cập nhật|rút gọn|viết lại|format|bố cục|layout|đè chữ|tràn chữ|chống đè|đọc lại|xem lại|khắc phục|sắp xếp)\b/i.test(
        normalizedMessage
      )

    const isUserAskingBatch =
      /\b(các slide|nhiều slide|mỗi slide|các khái niệm|mỗi phần|toàn bộ|tất cả|sau các|hàng loạt|toàn bài)\b/i.test(
        normalizedMessage
      )

    const isAskingNewCodeExamples =
      isUserAskingToCreate &&
      /\b(code|ví dụ|c\+\+|thực hành|minh họa)\b/i.test(normalizedMessage)

    // Tự động phân tích các slide lý thuyết/khái niệm trong danh mục để ép targetSlideIndex chính xác
    let forcedTargetInstructions = ''
    if (
      isUserAskingBatch &&
      isUserAskingToEdit &&
      !isUserAskingToCreate &&
      context.slidesCatalog &&
      context.slidesCatalog.length > 0
    ) {
      forcedTargetInstructions =
        `\n⚠️ BẮT BUỘC CHỈNH SỬA TRỰC TIẾP TRÊN CÁC SLIDE HIỆN CÓ ("action": "UPDATE_SLIDE"):\n` +
        `Người dùng yêu cầu đọc lại toàn bộ bài giảng và chỉnh sửa layout/rút gọn văn bản để chống đè chữ.\n` +
        `BẮT BUỘC THỰC HIỆN ĐÚNG CÁC NGUYÊN TẮC SAU:\n` +
        `1. Chọn "action": "BATCH_CHANGES".\n` +
        `2. Mảng "proposals" BẮT BUỘC chứa các đề xuất cập nhật cho tất cả các slide trong bài giảng.\n` +
        `3. Mỗi phần tử trong "proposals" BẮT BUỘC DÙNG "action": "UPDATE_SLIDE". TUYỆT ĐỐI KHÔNG DÙNG "CREATE_SLIDE" vì người dùng không yêu cầu thêm slide mới, nếu dùng CREATE_SLIDE sẽ nhân đôi slide và giữ nguyên các slide cũ bị lỗi!\n` +
        `4. "targetSlideIndex": là 0-indexed vị trí của từng slide hiện có trong bài giảng (Slide 1: index 0, Slide 2: index 1, Slide 3: index 2,...).\n` +
        `5. "proposedSlide": đối tượng slide với tiêu đề và các "contentItems" được viết lại súc tích (12-18 từ mỗi mô tả), bố cục thông thoáng, tuyệt đối không bị đè chữ.\n`
    } else if (
      isUserAskingBatch &&
      isAskingNewCodeExamples &&
      context.slidesCatalog &&
      context.slidesCatalog.length > 1
    ) {
      const conceptRegex =
        /khái niệm|định nghĩa|cấu trúc|thuật toán|tổng quan|nguyên lý|ngăn xếp|hàng đợi|danh sách|cây|đồ thị|con trỏ|mảng|đệ quy|sắp xếp|tìm kiếm|biến|kiểu|vòng lặp|hàm|lớp|struct|class/i

      let targetedSlides = context.slidesCatalog.filter((s) =>
        conceptRegex.test(s.title)
      )

      if (targetedSlides.length < 2) {
        // Nếu không khớp từ khóa thì lấy các slide ở giữa bài giảng (bỏ slide 1 mở đầu)
        targetedSlides = context.slidesCatalog.filter(
          (_s, idx) => idx > 0 && idx < context.slidesCatalog!.length - 1
        )
      }

      // Giới hạn từ 3 đến 5 slide tiêu biểu
      const selectedForcedSlides = targetedSlides.slice(0, 5)

      if (selectedForcedSlides.length > 0) {
        forcedTargetInstructions =
          `\n⚠️ BẮT BUỘC TẠO SLIDE VÍ DỤ CODE C++ MỚI SAU CÁC KHÁI NIỆM:\n` +
          `Người dùng yêu cầu bổ sung các slide ví dụ sau các khái niệm/nội dung đã nêu trong bài giảng.\n` +
          `Dựa trên danh mục bài giảng, bạn BẮT BUỘC PHẢI TẠO ĐÚNG ${selectedForcedSlides.length} SLIDE VÍ DỤ CODE C++ MỚI ("action": "CREATE_SLIDE"), chèn ngay sau các slide sau:\n` +
          selectedForcedSlides
            .map(
              (s) =>
                `  + Slide ${s.slideNumber}: "${s.title}" -> BẮT BUỘC tạo 1 slide ví dụ code C++ chèn sau slide này (targetSlideIndex: ${s.slideNumber - 1})`
            )
            .join('\n') +
          `\nTUYỆT ĐỐI KHÔNG ĐƯỢC THIẾU HOẶC CHỈ TRẢ VỀ 1 SLIDE! Mảng "proposals" BẮT BUỘC PHẢI CHỨA ĐỦ ${selectedForcedSlides.length} PHẦN TỬ tương ứng với các targetSlideIndex trên.\n`
      }
    }

    const catalogFormatted = (context.slidesCatalog || [])
      .map((s) => {
        let lines = `  - Slide ${s.slideNumber} (index: ${s.slideNumber - 1}): "${s.title}" [layout: ${s.layout}]`
        if (s.header) lines += ` [header: "${s.header}"]`
        if (s.contentItems && s.contentItems.length > 0) {
          const itemsStr = s.contentItems
            .map((it, idx) => {
              let str = `      + Mục ${idx + 1}: `
              if (it.stat) str += `[Chỉ số/Stat: "${it.stat}"] `
              if (it.tag) str += `[Tag: "${it.tag}"] `
              str += `"${it.title}": "${it.description}"`
              return str
            })
            .join('\n')
          lines += `\n    Nội dung hiện tại:\n${itemsStr}`
        } else if (s.bullets && s.bullets.length > 0) {
          lines += `\n    Ý chính: ${s.bullets.slice(0, 3).join('; ')}`
        }
        return lines
      })
      .join('\n')

    let currentSlideInfo = 'Không có slide nào đang mở'
    if (context.currentSlide) {
      const cs = context.currentSlide
      type RawItem = {
        title?: string
        description?: string
        tag?: string
        stat?: string
      }
      let rawItems: RawItem[] = []
      if (Array.isArray(cs.contentItems) && cs.contentItems.length > 0) {
        rawItems = (cs.contentItems as RawItem[]).map((it) => ({
          title: it.title || '',
          description: it.description || '',
          stat: it.stat || undefined,
          tag: it.tag || undefined
        }))
      } else if (Array.isArray(cs.components)) {
        const comps = cs.components as Array<{ id?: string; content?: string }>
        const titleComps = comps.filter(
          (c) => c.id?.includes('title-') && !c.id.startsWith('title-')
        )
        const descComps = comps.filter((c) => c.id?.includes('desc-'))
        const statComps = comps.filter(
          (c) => c.id?.includes('metric-num-') || c.id?.includes('tl-year-')
        )
        const tagComps = comps.filter(
          (c) => c.id?.includes('tag-') && !c.id.includes('tag-bg-')
        )
        rawItems = titleComps.map((tc, idx) => ({
          title: tc.content || '',
          description: descComps[idx]?.content || '',
          stat: statComps[idx]?.content || undefined,
          tag: tagComps[idx]?.content || undefined
        }))
      }
      const itemsSummary = rawItems
        .filter((it) => it.title || it.description || it.stat)
        .map((it, i) => {
          let str = `    ${i + 1}. `
          if (it.stat) str += `[Chỉ số/Stat: "${it.stat}"] `
          if (it.tag) str += `[Tag: "${it.tag}"] `
          str += `"${it.title}": "${it.description}"`
          return str
        })
        .join('\n')

      currentSlideInfo =
        `  - Đang mở: Slide ${(context.currentSlideIndex ?? 0) + 1}/${context.totalSlides}\n` +
        `  - Header: "${cs.header || ''}"\n` +
        `  - Tiêu đề: "${cs.title || 'Không có tiêu đề'}"\n` +
        `  - Bố cục hiện tại: "${cs.layout || cs.contentLayout || 'cards'}"\n` +
        (itemsSummary ? `  - Các khối nội dung trên slide:\n${itemsSummary}\n` : '') +
        (Array.isArray(cs.bullets) && cs.bullets.length > 0
          ? `  - Các ý chính: ${(cs.bullets as string[]).join('; ')}\n`
          : '')
    }

    const conversationHistoryText = (context.history || [])
      .slice(-8)
      .map((h) => `${h.role === 'user' ? 'Người dùng' : 'AI'}: ${h.text}`)
      .join('\n')

    const executionDirectives: string[] = []
    if (isUserAskingBatch && isUserAskingToEdit && !isUserAskingToCreate) {
      executionDirectives.push(
        'Người dùng yêu cầu chỉnh sửa/chống đè chữ toàn bộ bài giảng: BẮT BUỘC chọn "action": "BATCH_CHANGES" với các phần tử trong "proposals" có "action": "UPDATE_SLIDE".',
        'Duyệt qua từng slide trong slidesCatalog, đặt "targetSlideIndex" là vị trí 0-indexed tương ứng (0, 1, 2, ...).',
        'TUYỆT ĐỐI KHÔNG DÙNG "CREATE_SLIDE" vì người dùng không yêu cầu thêm slide, dùng CREATE_SLIDE sẽ nhân bản bài giảng và làm hỏng bài của người dùng!',
        'Viết lại nội dung description của từng item thật súc tích (12-18 từ), chọn bố cục layout thích hợp để không bao giờ bị đè chữ hay tràn chữ.',
        'TUYỆT ĐỐI KHÔNG xuất trường proposedSlide ở ngoài cùng JSON khi là BATCH_CHANGES. Toàn bộ các slide phải nằm trong mảng proposals.'
      )
    } else if (isAskingNewCodeExamples) {
      executionDirectives.push(
        'Khi người dùng yêu cầu tạo/thêm các slide sau các khái niệm/lý thuyết: BẮT BUỘC chọn "action": "BATCH_CHANGES".',
        'MẢNG "proposals" BẮT BUỘC PHẢI CHỨA TỐI THIỂU TỪ 3 ĐẾN 6 SLIDE ĐỀ XUẤT ("action": "CREATE_SLIDE"), TUYỆT ĐỐI KHÔNG ĐƯỢC CHỈ TẠO 1 SLIDE.',
        'Duyệt danh mục slidesCatalog và chèn slide ví dụ mới sau các slide lý thuyết tiêu biểu (ví dụ: sau slide 2, 3, 4, 5, 6...).',
        'TUYỆT ĐỐI KHÔNG xuất trường proposedSlide ở ngoài cùng JSON khi là BATCH_CHANGES. Toàn bộ slide mới phải nằm trong mảng proposals.',
        'SLIDE VÍ DỤ CODE PHẢI CÓ CODE C++ THỰC TẾ TRONG "codeSnippet" VỚI LAYOUT "code", TUYỆT ĐỐI KHÔNG VIẾT VĂN XUÔI LÝ THUYẾT!'
      )
    } else if (isUserAskingToCreate) {
      executionDirectives.push(
        'Người dùng yêu cầu tạo slide mới: Chọn "action": "CREATE_SLIDE" (hoặc "BATCH_CHANGES" nếu tạo nhiều slide).',
        '"targetSlideIndex": Vị trí slide đứng trước vị trí cần chèn.',
        'Sinh nội dung slide mới hoàn chỉnh theo bố cục phù hợp.'
      )
    } else {
      const slideNumMatch = normalizedMessage.match(/\bslide\s*(\d+)\b/i)
      const targetIndexHint = slideNumMatch
        ? parseInt(slideNumMatch[1], 10) - 1
        : context.currentSlideIndex ?? 0

      executionDirectives.push(
        'Người dùng yêu cầu chỉnh sửa slide: Chọn "action": "UPDATE_SLIDE".',
        `"targetSlideIndex": Vị trí 0-indexed của slide cần chỉnh sửa (người dùng nhắc đích danh: ${slideNumMatch ? `Slide ${slideNumMatch[1]} -> index ${targetIndexHint}` : `Slide hiện tại -> index ${targetIndexHint}`}).`,
        'Nếu slide bị tràn chữ hoặc đè chữ: Kiểm tra layout của slide đó. Nếu là "metrics-grid" mà có "stat" là câu chữ dài (như "Ứng dụng Rộng rãi"), BẮT BUỘC rút ngắn "stat" thành số liệu ngắn gọn (<= 5 ký tự như "100%", "Top 1", "500+") HOẶC chuyển "layout": "cards", đồng thời rút gọn "description" còn 12-16 từ súc tích.',
        'Trả về đối tượng proposedSlide hoàn chỉnh với nội dung mới đã khắc phục triệt để lỗi đè chữ.'
      )
    }

    const userPromptContent =
      `# THÔNG TIN BÀI GIẢNG: "${context.presentationTitle}" (Tổng: ${context.totalSlides} slides)\n\n` +
      `## 1. DANH MỤC TOÀN BỘ CÁC SLIDE (slidesCatalog):\n` +
      `*(BẮT BUỘC tra cứu danh mục này khi người dùng nói về slide khác, chủ đề cụ thể, hoặc khi yêu cầu thao tác trên nhiều slide/toàn bài)*\n` +
      `${catalogFormatted || '(Trống)'}\n\n` +
      `## 2. SLIDE NGƯỜI DÙNG ĐANG MỞ TRÊN MÀN HÌNH (Vị trí hiện tại: Slide ${(context.currentSlideIndex ?? 0) + 1}):\n` +
      `*(CHỈ sử dụng mục này khi người dùng yêu cầu sửa slide hiện tại hoặc không chỉ định slide/chủ đề nào khác)*\n` +
      `${currentSlideInfo}\n\n` +
      (context.outlineOverview
        ? `## 3. DÀN Ý CHUNG:\n${context.outlineOverview}\n\n`
        : '') +
      `## 4. TÓM TẮT CỐT LÕI BÀI GIẢNG:\n${context.contextSummary || 'Chưa có'}\n\n` +
      (conversationHistoryText
        ? `## 5. LỊCH SỬ HỘI THOẠI GẦN ĐÂY:\n${conversationHistoryText}\n\n`
        : '') +
      `# YÊU CẦU MỚI TỪ NGƯỜI DÙNG:\n"${normalizedMessage}"\n\n` +
      'CHỈ THỊ THỰC HIỆN BẮT BUỘC:\n' +
      executionDirectives.map((d, i) => `${i + 1}. ${d}`).join('\n') +
      (forcedTargetInstructions || '') +
      `\n${executionDirectives.length + 1}. Trả về đúng 1 JSON object hợp lệ.`

    const response = await ai.models.generateContent({
      model: DEFAULT_AI_MODEL,
      contents: userPromptContent,
      config: {
        systemInstruction,
        temperature: 0.5,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json'
      }
    })

    const rawText = response.text
    if (!rawText) {
      logger.error(
        { err: 'Không nhận được nội dung từ AI' },
        'ai.chatAndProposeSlideEdit failed'
      )
      throw new AppError(
        'Dịch vụ AI tạm thời bị gián đoạn. Vui lòng thử lại sau.',
        502
      )
    }

    const parsed = safeParseAiJson<{
      thought?: string
      reply?: string
      action?: AiSlideAction
      targetSlideIndex?: number
      proposedSlide?: Record<string, unknown>
      proposals?: Array<{
        action?: 'CREATE_SLIDE' | 'UPDATE_SLIDE'
        targetSlideIndex?: number
        proposedSlide?: Record<string, unknown>
        summary?: string
      }>
      updatedSummary?: string
    }>(rawText)

    const reply = parsed.reply?.trim() || 'Tôi đã hoàn thành yêu cầu của bạn.'
    let action: AiSlideAction = parsed.action || 'CHAT_ONLY'
    if (
      action !== 'UPDATE_CURRENT_SLIDE' &&
      action !== 'UPDATE_SLIDE' &&
      action !== 'CREATE_SLIDE' &&
      action !== 'BATCH_CHANGES' &&
      action !== 'CHAT_ONLY'
    ) {
      action = 'CHAT_ONLY'
    }

    let rawProposals = Array.isArray(parsed.proposals) ? parsed.proposals : []

    // Chuẩn hóa nếu AI trả về proposedSlide đơn lẻ nhưng không có proposals
    if (rawProposals.length === 0 && parsed.proposedSlide) {
      if (
        action === 'CREATE_SLIDE' ||
        action === 'UPDATE_SLIDE' ||
        action === 'UPDATE_CURRENT_SLIDE'
      ) {
        rawProposals = [
          {
            action: action === 'CREATE_SLIDE' ? 'CREATE_SLIDE' : 'UPDATE_SLIDE',
            targetSlideIndex:
              parsed.targetSlideIndex ?? context.currentSlideIndex,
            proposedSlide: parsed.proposedSlide,
            summary: reply
          }
        ]
      }
    }

    if (
      rawProposals.length > 1 ||
      (isUserAskingBatch && rawProposals.length > 0) ||
      action === 'BATCH_CHANGES'
    ) {
      action = 'BATCH_CHANGES'
    }

    if (isUserAskingToCreate && action === 'UPDATE_SLIDE') {
      action = 'CREATE_SLIDE'
    }

    // Chuẩn hóa từng proposal trong mảng
    const proposals: AiSlideProposal[] = rawProposals.map((p, idx) => {
      let pAction: 'CREATE_SLIDE' | 'UPDATE_SLIDE' =
        p.action === 'CREATE_SLIDE' ? 'CREATE_SLIDE' : 'UPDATE_SLIDE'
      if (isUserAskingToCreate) {
        pAction = 'CREATE_SLIDE'
      } else if (isUserAskingToEdit && !isUserAskingToCreate) {
        pAction = 'UPDATE_SLIDE'
      }
      const pTargetIndex =
        typeof p.targetSlideIndex === 'number' &&
        p.targetSlideIndex >= 0 &&
        p.targetSlideIndex < context.totalSlides
          ? p.targetSlideIndex
          : context.currentSlideIndex
      const slideData = p.proposedSlide || {}
      const slideTitle = String(slideData.title || '').toLowerCase()
      const slideHeader = String(slideData.header || '').toLowerCase()
      const hasCodeSignal =
        Boolean(slideData.codeSnippet) ||
        Boolean(slideData.code) ||
        slideTitle.includes('code') ||
        slideTitle.includes('cài đặt') ||
        slideHeader.includes('code')

      const normalizedSlide: Record<string, unknown> = {
        ...slideData,
        bullets: Array.isArray(slideData.bullets) ? slideData.bullets : [],
        layout:
          (slideData.layout as string) ||
          (slideData.contentLayout as string) ||
          (hasCodeSignal ? 'code' : 'cards'),
        id: (slideData.id as string) || `slide-${crypto.randomUUID()}`
      }
      // Luôn luôn tạo lại components bằng buildSlideComponents để Layout Engine tính toán lại tọa độ chính xác,
      // không bao giờ giữ lại tọa độ cũ bị lệch hay đè chữ!
      const slideComps = buildSlideComponents(normalizedSlide, context.theme)

      return {
        id: `prop-${Date.now()}-${idx}`,
        action: pAction,
        targetSlideIndex: pTargetIndex,
        proposedSlide: {
          ...normalizedSlide,
          components: slideComps
        },
        summary: p.summary?.trim() || `Đề xuất cho Slide ${pTargetIndex + 1}`
      }
    })

    // Sắp xếp proposals theo targetSlideIndex tăng dần để đảm bảo thứ tự chèn slide chuẩn xác
    proposals.sort((a, b) => a.targetSlideIndex - b.targetSlideIndex)

    const primaryProposal = proposals[0]
    const targetSlideIndex = primaryProposal
      ? primaryProposal.targetSlideIndex
      : typeof parsed.targetSlideIndex === 'number' &&
          parsed.targetSlideIndex >= 0 &&
          parsed.targetSlideIndex < context.totalSlides
        ? parsed.targetSlideIndex
        : context.currentSlideIndex

    const proposedSlide = primaryProposal
      ? primaryProposal.proposedSlide
      : undefined

    return {
      thought: parsed.thought?.trim(),
      reply,
      action,
      targetSlideIndex,
      proposedSlide,
      proposals,
      updatedSummary: parsed.updatedSummary?.trim()
    }
  } catch (err) {
    if (err instanceof AppError) throw err
    logger.error({ err }, 'ai.chatAndProposeSlideEdit failed')
    throw new AppError('Lỗi kết nối tới dịch vụ AI của Google', 502)
  }
}
