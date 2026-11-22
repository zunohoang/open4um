const mockGenerateContent = jest.fn()

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: (...args: any[]) => mockGenerateContent(...args)
    }
  }))
}))

import { env } from '@/config/env'
import {
  AI_INVALID_OUTPUT_MESSAGE,
  chatAndProposeSlideEdit,
  editSelectedText
} from '@/services/ai.service'
import { AppError } from '@/utils/AppError'

describe('ai.service chatAndProposeSlideEdit', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('chỉ thêm gợi ý V1 vào slide hiện tại dù AI trả về thay đổi ngoài phạm vi', async () => {
    const currentSlide = {
      id: 'slide-1',
      title: 'Bài tập đọc hiểu',
      subtitle: 'Làm việc cá nhân',
      bullets: ['Chọn một quyển sách'],
      contentItems: [
        {
          title: 'Nhiệm vụ',
          description: 'Hãy chọn một quyển sách em yêu thích.'
        }
      ],
      components: [
        {
          id: 'title-slide-1',
          type: 'title',
          content: 'Bài tập đọc hiểu'
        },
        {
          id: 'body-slide-1',
          type: 'text',
          content: 'Hãy chọn một quyển sách em yêu thích.'
        },
        {
          id: 'sub-slide-1',
          type: 'subtitle',
          content: 'Làm việc cá nhân'
        }
      ]
    }
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        reply: 'Đã bổ sung gợi ý.',
        action: 'BATCH_CHANGES',
        proposals: [
          {
            action: 'UPDATE_SLIDE',
            targetSlideIndex: 1,
            proposedSlide: {
              id: 'slide-2',
              title: 'Slide khác đã bị viết lại',
              subtitle: 'Nội dung ngoài phạm vi'
            }
          },
          {
            action: 'UPDATE_SLIDE',
            targetSlideIndex: 0,
            proposedSlide: {
              ...currentSlide,
              title: 'Bài tập đọc',
              subtitle: 'Gợi ý: Tìm từ khóa mô tả chủ đề trước khi chọn sách.',
              bullets: ['Chọn quyển sách']
            }
          }
        ]
      })
    })

    const result = await chatAndProposeSlideEdit(
      'Chỉ bổ sung một gợi ý ngắn vào slide hiện tại. Thêm nhãn ‘V1’ ngay trước gợi ý. Giữ nguyên đề bài, mọi câu chữ có sẵn và tất cả slide khác.',
      {
        presentationTitle: 'Bài giảng',
        totalSlides: 2,
        currentSlideIndex: 0,
        currentSlide,
        slidesCatalog: [
          {
            slideNumber: 1,
            id: 'slide-1',
            title: currentSlide.title,
            bullets: currentSlide.bullets,
            layout: 'cards'
          },
          {
            slideNumber: 2,
            id: 'slide-2',
            title: 'Slide không liên quan',
            bullets: [],
            layout: 'cards'
          }
        ]
      }
    )

    expect(result.action).toBe('UPDATE_SLIDE')
    expect(result.targetSlideIndex).toBe(0)
    expect(result.proposals).toHaveLength(1)
    expect(result.proposedSlide).toEqual(
      expect.objectContaining({
        id: 'slide-1',
        title: currentSlide.title,
        bullets: currentSlide.bullets,
        contentItems: currentSlide.contentItems,
        subtitle:
          'Làm việc cá nhân\nV1: Gợi ý: Tìm từ khóa mô tả chủ đề trước khi chọn sách.'
      })
    )
    expect(JSON.stringify(result.proposedSlide)).toContain('một quyển sách')
    expect(JSON.stringify(result.proposedSlide)).not.toContain(
      'Slide khác đã bị viết lại'
    )

    const request = mockGenerateContent.mock.calls[0][0]
    expect(request.contents).toContain('"V1: Gợi ý: ..."')
    expect(request.contents).toContain('BẮT BUỘC giữ nguyên nhãn "V1"')
  })

  const slide = (n: number) => ({
    id: `slide-${n}`,
    title: `Tiêu đề ${n}`,
    layout: 'cards',
    bullets: [],
    components: [
      {
        id: `title-${n}`,
        type: 'title',
        content: `Tiêu đề ${n}`,
        color: '#111111'
      },
      { id: `body-${n}`, type: 'text', content: `Đoạn văn ${n}` }
    ]
  })
  const contextAt = (index: number) => ({
    presentationTitle: 'Bài giảng',
    totalSlides: 5,
    currentSlideIndex: index,
    currentSlide: slide(index + 1),
    slidesCatalog: [1, 2, 3, 4, 5].map((n) => ({
      slideNumber: n,
      id: `slide-${n}`,
      title: `Tiêu đề ${n}`,
      bullets: [],
      layout: 'cards'
    }))
  })

  it.each([
    'Chỉ thêm tiêu đề phụ "Luyện tập độc lập" vào slide hiện tại. Không sửa slide khác.',
    'Thêm một dòng ghi chú ngắn "Hạn nộp thứ Sáu" vào cuối slide hiện tại. Không sửa slide khác.',
    'Thêm vào cuối slide hiện tại một dòng "Ôn tập".'
  ])(
    '"thêm … vào slide hiện tại" sửa slide đang mở, không tạo slide mới (NEW-3): %s',
    async (message) => {
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify({
          reply: 'Đã đề xuất.',
          action: 'CREATE_SLIDE',
          targetSlideIndex: 3,
          proposedSlide: { title: 'Tiêu đề 4', subtitle: 'Luyện tập độc lập' }
        })
      })

      const result = await chatAndProposeSlideEdit(message, contextAt(3))

      expect(result.action).toBe('UPDATE_SLIDE')
      expect(result.targetSlideIndex).toBe(3)
      expect(result.proposals).toEqual([
        expect.objectContaining({ action: 'UPDATE_SLIDE', targetSlideIndex: 3 })
      ])
    }
  )

  it('vẫn tạo slide khi người dùng đòi slide mới', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        reply: 'Đã đề xuất.',
        action: 'CREATE_SLIDE',
        targetSlideIndex: 1,
        proposedSlide: { title: 'Bài tập' }
      })
    })

    const result = await chatAndProposeSlideEdit(
      'Thêm slide mới về bài tập sau slide 2',
      contextAt(3)
    )

    expect(result.action).toBe('CREATE_SLIDE')
  })

  it('chỉ đổi màu thì giữ nguyên câu chữ và đối tượng của slide (NEW-2)', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        reply: 'Đã đổi màu.',
        action: 'UPDATE_SLIDE',
        targetSlideIndex: 0,
        proposedSlide: {
          title: 'Mục tiêu học tập',
          layout: 'cards',
          contentItems: [{ title: 'Năng lực chính', description: 'Câu mới' }],
          backgroundColor: '#E3F2FD',
          textColor: '#0D47A1'
        }
      })
    })

    const result = await chatAndProposeSlideEdit(
      'Đổi màu nền của slide hiện tại sang xanh nhạt và màu chữ tiêu đề sang xanh đậm. Không đổi nội dung chữ và không sửa slide khác.',
      contextAt(0)
    )

    const proposed = result.proposedSlide as Record<string, any>
    expect(result.action).toBe('UPDATE_SLIDE')
    expect(proposed.backgroundColor).toBe('#E3F2FD')
    expect(proposed.title).toBe('Tiêu đề 1')
    expect(proposed.components).toEqual([
      expect.objectContaining({
        type: 'title',
        content: 'Tiêu đề 1',
        color: '#0D47A1'
      }),
      expect.objectContaining({ type: 'text', content: 'Đoạn văn 1' })
    ])
  })

  describe('nội dung AI không hợp lệ (QA-1, NEW-10)', () => {
    const originalFallback = env.GEMINI_FALLBACK_MODEL
    beforeEach(() => {
      ;(env as any).GEMINI_FALLBACK_MODEL = undefined
    })
    afterAll(() => {
      ;(env as any).GEMINI_FALLBACK_MODEL = originalFallback
    })

    it('chat thiếu action thì báo lỗi rõ ràng sau khi thử lại', async () => {
      mockGenerateContent.mockResolvedValue({ text: '{"reply":"ok"}' })

      const err = await chatAndProposeSlideEdit(
        'Rút gọn slide này',
        contextAt(0)
      ).catch((e) => e)

      expect(err).toBeInstanceOf(AppError)
      expect(err.statusCode).toBe(502)
      expect(err.message).toBe(AI_INVALID_OUTPUT_MESSAGE)
      expect(mockGenerateContent).toHaveBeenCalledTimes(2)
    })

    it('"Viết lại" trả nguyên văn thì thử lại, vẫn trùng thì báo lỗi', async () => {
      mockGenerateContent.mockResolvedValue({ text: 'Câu gốc.' })

      const err = await editSelectedText('rewrite', 'Câu gốc.').catch((e) => e)

      expect(err).toBeInstanceOf(AppError)
      expect(err.message).toMatch(/chưa đưa ra cách viết khác/)
      expect(mockGenerateContent).toHaveBeenCalledTimes(2)
    })

    it('"Viết lại" lần hai khác câu gốc thì dùng kết quả đó', async () => {
      mockGenerateContent
        .mockResolvedValueOnce({ text: 'Câu gốc.' })
        .mockResolvedValueOnce({ text: 'Câu đã diễn đạt lại.' })

      await expect(editSelectedText('rewrite', 'Câu gốc.')).resolves.toEqual(
        expect.objectContaining({ replacement: 'Câu đã diễn đạt lại.' })
      )
    })
  })
})
